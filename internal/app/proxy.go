package app

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/exec"
	"runtime"
	"strconv"
	"strings"
	"time"
)

// proxyLookupTimeout bounds each system-proxy probe. These helpers answer in
// milliseconds normally; the cap only matters if one wedges the system.
const proxyLookupTimeout = 2 * time.Second

// ApplySystemProxy makes the updater — and any net/http call that goes
// through http.DefaultClient / ProxyFromEnvironment — route through the
// operating system's configured proxy.
//
// Go's standard library only honours the HTTPS_PROXY / HTTP_PROXY
// environment variables; it does not read the system proxy that Clash,
// V2Ray, Surge and friends install. Users who reach GitHub only through
// such a proxy therefore saw the update check hang connecting to
// github.com (dial tcp ... failed to respond). We copy the system proxy
// into the environment at startup so DefaultClient picks it up.
//
// Call this before any network use. A proxy already set in the environment
// is respected and left untouched: the user's explicit configuration wins.
func ApplySystemProxy() {
	if alreadyProxied() {
		log.Printf("proxy: HTTPS_PROXY/HTTP_PROXY already set in the environment; leaving as-is")
		return
	}

	host, port, scheme := detectSystemProxy()
	if host == "" {
		// No system proxy configured; nothing to do.
		return
	}

	val := fmt.Sprintf("%s://%s:%d", scheme, host, port)
	_ = os.Setenv("HTTP_PROXY", val)
	_ = os.Setenv("HTTPS_PROXY", val)
	_ = os.Setenv("http_proxy", val)
	_ = os.Setenv("https_proxy", val)

	// Keep local traffic off the proxy: this app has no local HTTP server,
	// but album-art lookups or future loopback calls must not be tunneled.
	if os.Getenv("NO_PROXY") == "" && os.Getenv("no_proxy") == "" {
		_ = os.Setenv("NO_PROXY", "localhost,127.0.0.1,::1")
		_ = os.Setenv("no_proxy", "localhost,127.0.0.1,::1")
	}

	log.Printf("proxy: using system proxy %s", val)
}

// alreadyProxied reports whether the caller already configured a proxy via
// the environment, in which case we must not override it.
func alreadyProxied() bool {
	for _, k := range []string{"HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy"} {
		if os.Getenv(k) != "" {
			return true
		}
	}
	return false
}

// runWithTimeout runs a proxy-lookup helper and returns its stdout, giving up
// after proxyLookupTimeout. The helpers (scutil, reg query, gsettings) normally
// answer in milliseconds, but they run synchronously on the main thread during
// startup, so one of them hanging on a wedged system would freeze the app
// before its window appears. A timeout just means "no system proxy found",
// which is the same as a machine without one.
func runWithTimeout(name string, args ...string) ([]byte, error) {
	ctx, cancel := context.WithTimeout(context.Background(), proxyLookupTimeout)
	defer cancel()
	return exec.CommandContext(ctx, name, args...).Output()
}

// detectSystemProxy returns the host, port and proxy scheme of the system
// HTTP/HTTPS proxy. It returns empty strings when none is configured or the
// lookup fails, which is not an error: the app simply connects directly.
func detectSystemProxy() (host string, port int, scheme string) {
	switch runtime.GOOS {
	case "darwin":
		return parseDarwinProxy()
	case "windows":
		return parseWindowsProxy()
	default:
		// Linux/other: most desktop environments already export the
		// variables, which alreadyProxied() would have caught. Try
		// gsettings as a best-effort fallback.
		return parseGSettingsProxy()
	}
}

// parseDarwinProxy reads the effective proxy configuration from the system
// configuration dynamic store via `scutil --proxy`, which prints a small
// dictionary we can parse line by line.
func parseDarwinProxy() (string, int, string) {
	out, err := runWithTimeout("scutil", "--proxy")
	if err != nil {
		return "", 0, ""
	}
	text := string(out)

	httpsHost := strField(text, "HTTPSProxy")
	httpsPort := intField(text, "HTTPSPort")
	httpHost := strField(text, "HTTPProxy")
	httpPort := intField(text, "HTTPPort")

	// Prefer the HTTPS endpoint; fall back to HTTP. Most desktop proxies
	// expose the same listener for both protocols.
	if boolField(text, "HTTPSEnable") && httpsHost != "" {
		return httpsHost, orPort(httpsPort, 443), "http"
	}
	if boolField(text, "HTTPEnable") && httpHost != "" {
		return httpHost, orPort(httpPort, 80), "http"
	}
	return "", 0, ""
}

// parseWindowsProxy reads the WinINET (Internet Options) proxy that desktop
// proxy tools configure, from the registry via `reg query` (avoiding a new
// dependency on golang.org/x/sys/windows).
func parseWindowsProxy() (string, int, string) {
	const key = `HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings`

	out, err := runWithTimeout("reg", "query", key, "/v", "ProxyEnable")
	if err != nil {
		return "", 0, ""
	}
	if !regDwordEnabled(string(out), "ProxyEnable") {
		return "", 0, ""
	}

	out, err = runWithTimeout("reg", "query", key, "/v", "ProxyServer")
	if err != nil {
		return "", 0, ""
	}
	server := regStringValue(string(out), "ProxyServer")
	return parseProxyServer(server)
}

// parseGSettingsProxy handles GNOME-based Linux desktops that configure a
// manual proxy through gsettings.
func parseGSettingsProxy() (string, int, string) {
	out, err := runWithTimeout("gsettings", "get", "org.gnome.system.proxy", "mode")
	if err != nil || !strings.Contains(string(out), "'manual'") {
		return "", 0, ""
	}
	hostOut, err := runWithTimeout("gsettings", "get", "org.gnome.system.proxy.https", "host")
	if err != nil {
		return "", 0, ""
	}
	portOut, err := runWithTimeout("gsettings", "get", "org.gnome.system.proxy.https", "port")
	if err != nil {
		return "", 0, ""
	}
	host := strings.Trim(strings.TrimSpace(string(hostOut)), "'\"")
	port, _ := strconv.Atoi(strings.TrimSpace(string(portOut)))
	if host == "" {
		return "", 0, ""
	}
	if port == 0 {
		port = 443
	}
	return host, port, "http"
}

// parseProxyServer parses a Windows ProxyServer value, which is either a
// bare "host:port" or a per-protocol list "http=host:port;https=host:port".
func parseProxyServer(server string) (string, int, string) {
	server = strings.TrimSpace(server)
	if server == "" {
		return "", 0, ""
	}

	host := ""
	port := 0

	if strings.Contains(server, "=") {
		for _, part := range strings.Split(server, ";") {
			kv := strings.SplitN(part, "=", 2)
			if len(kv) != 2 {
				continue
			}
			key, val := strings.TrimSpace(kv[0]), strings.TrimSpace(kv[1])
			if key == "https" || key == "http" {
				h, p := splitHostPort(val)
				if h != "" {
					host, port = h, p
					if key == "https" {
						break // prefer the https endpoint
					}
				}
			}
		}
	} else {
		host, port = splitHostPort(server)
	}

	if host == "" {
		return "", 0, ""
	}
	if port == 0 {
		port = 80
	}
	return host, port, "http"
}

// splitHostPort splits "host:port", tolerating an optional scheme and IPv6
// literals. A missing port yields 0 so the caller can apply a default.
func splitHostPort(s string) (string, int) {
	s = strings.TrimSpace(s)
	if s == "" {
		return "", 0
	}
	if i := strings.Index(s, "://"); i >= 0 {
		s = s[i+3:]
	}
	if strings.HasPrefix(s, "[") {
		if i := strings.Index(s, "]"); i >= 0 {
			host := s[1:i]
			rest := strings.TrimPrefix(s[i+1:], ":")
			p, _ := strconv.Atoi(rest)
			return host, p
		}
	}
	if i := strings.LastIndex(s, ":"); i >= 0 {
		host := s[:i]
		p, _ := strconv.Atoi(s[i+1:])
		return host, p
	}
	return s, 0
}

// scutil field helpers ------------------------------------------------------

func strField(text, key string) string {
	prefix := key + " : "
	for _, line := range strings.Split(text, "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, prefix) {
			return strings.TrimSpace(strings.TrimPrefix(line, prefix))
		}
	}
	return ""
}

func intField(text, key string) int {
	v := strField(text, key)
	if v == "" {
		return 0
	}
	n, err := strconv.Atoi(v)
	if err != nil {
		return 0
	}
	return n
}

func boolField(text, key string) bool { return intField(text, key) != 0 }

func orPort(port, fallback int) int {
	if port == 0 {
		return fallback
	}
	return port
}

// reg field helpers ---------------------------------------------------------

// regStringValue extracts the value of a REG_SZ entry from `reg query`
// output, which looks like:
//
//	ProxyServer    REG_SZ    127.0.0.1:7890
func regStringValue(output, valueName string) string {
	for _, line := range strings.Split(output, "\n") {
		fields := strings.Fields(line)
		if len(fields) >= 3 && fields[0] == valueName {
			return fields[len(fields)-1]
		}
	}
	return ""
}

// regDwordEnabled reports whether a REG_DWORD entry (e.g. ProxyEnable) is
// non-zero. The value prints as "0x1" (hex) or "1" (decimal).
func regDwordEnabled(output, valueName string) bool {
	v := regStringValue(output, valueName)
	v = strings.TrimPrefix(strings.ToLower(v), "0x")
	n, err := strconv.ParseInt(v, 16, 64)
	if err != nil {
		n, err = strconv.ParseInt(v, 10, 64)
	}
	return err == nil && n != 0
}
