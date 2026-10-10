package app

import (
	"context"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/egoist/mygo"
)

// UpdateState is what the UI shows about the update flow.
type UpdateState struct {
	// Checking is true while a check is in flight.
	Checking bool
	// Available is a newer version, nil when up to date.
	Available *mygo.Update
	// Installing is true while downloading.
	Installing bool
	// Progress is 0..1 while downloading, negative when unknown.
	Progress float64
	// Error is the last failure, empty when none.
	Error string
	// Installed marks that an update is ready and needs a relaunch.
	Installed bool
	// LastChecked is when the last check finished.
	LastChecked time.Time
}

// Updater wraps mygo.Updater with the state the UI needs. Checks run in the
// background so a slow network never blocks the window.
type Updater struct {
	mu    sync.Mutex
	state UpdateState
	// autoChecked guards the startup check so it runs once per process.
	autoChecked bool
}

// NewUpdater builds an updater for the app.
func NewUpdater() *Updater { return &Updater{} }

// State returns a copy of the current update state.
func (u *Updater) State() UpdateState {
	u.mu.Lock()
	defer u.mu.Unlock()
	return u.state
}

// Enabled reports whether this build can update itself. Development builds
// and builds without updates configured cannot.
func (u *Updater) Enabled() bool { return mygo.Updater.Enabled() }

// CheckAsync looks for an update in the background, updating state as it
// goes. The UI polls State() to render the result.
//
// Known limitation: the update feed and the artifacts it points to both
// live on GitHub. The check first calls the GitHub REST API (api.github.com)
// to find the newest release tagged with updates.tagPrefix ("go-v") — that
// step is unavoidable here because this repository also hosts the older
// Tauri releases (v0.0.x) and the api-free "releases/latest/download/"
// path would resolve to the Tauri release (its v0.0.2 is marked "Latest")
// and 404. The manifest and the installer are then downloaded from
// github.com / its release CDN. Networks that cannot reach GitHub's download
// hosts (some regions behind restrictive proxies block the CDN while still
// allowing the API) therefore cannot update automatically: the check itself
// times out connecting to github.com. In that case download the new version
// manually from the project's GitHub Releases page (or a reachable mirror).
func (u *Updater) CheckAsync(force bool) {
	u.mu.Lock()
	if u.state.Checking {
		u.mu.Unlock()
		return
	}
	u.state.Checking = true
	u.state.Error = ""
	u.mu.Unlock()

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		up, err := mygo.Updater.Check(ctx)

		u.mu.Lock()
		u.state.Checking = false
		u.state.LastChecked = time.Now()
		switch {
		case err == mygo.ErrUpdatesDisabled:
			// Not an error worth showing: this build simply cannot update.
			u.state.Error = ""
		case err != nil:
			u.state.Error = updateCheckError(err)
			u.state.Available = nil
		default:
			u.state.Available = up // nil means already up to date
		}
		u.mu.Unlock()

		if err != nil && err != mygo.ErrUpdatesDisabled {
			log.Printf("update check: %v", err)
		}
	}()
}

// InstallAsync downloads and installs the available update in the
// background. The app is replaced on disk; it takes effect on the next
// launch (or after Relaunch).
func (u *Updater) InstallAsync() {
	u.mu.Lock()
	up := u.state.Available
	if up == nil || u.state.Installing {
		u.mu.Unlock()
		return
	}
	u.state.Installing = true
	u.state.Progress = 0
	u.state.Error = ""
	u.mu.Unlock()

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
		defer cancel()

		err := up.Install(ctx, func(downloaded, total int64) {
			u.mu.Lock()
			if total > 0 {
				u.state.Progress = float64(downloaded) / float64(total)
			} else {
				u.state.Progress = -1
			}
			u.mu.Unlock()
		})

		u.mu.Lock()
		u.state.Installing = false
		switch {
		case err != nil:
			u.state.Error = err.Error()
		default:
			u.state.Installed = true
			u.state.Available = nil
			u.state.Progress = 1
		}
		u.mu.Unlock()

		if err != nil {
			log.Printf("update install: %v", err)
		}
	}()
}

// AutoCheck runs a check once per process, shortly after startup, so users
// learn about new versions without asking. It is a no-op when updates are
// disabled for this build.
func (u *Updater) AutoCheck() {
	u.mu.Lock()
	if u.autoChecked || !mygo.Updater.Enabled() {
		u.mu.Unlock()
		return
	}
	u.autoChecked = true
	u.mu.Unlock()

	// Delay so the window is up and interactive before any network work.
	go func() {
		time.Sleep(3 * time.Second)
		u.CheckAsync(false)
	}()
}

// Relaunch restarts the app into the installed update.
func (u *Updater) Relaunch() {
	mygo.App.Relaunch()
}

// updateCheckError returns a user-facing message for an update-check
// failure. Connection/timeout errors mean the GitHub download host is
// unreachable from the user's network (the manifest and installer both live
// on github.com); API errors mean a proxy blocked api.github.com. Both get a
// hint to download manually. Other errors keep mygo's wording.
func updateCheckError(err error) string {
	msg := err.Error()
	if strings.Contains(msg, "dial tcp") || strings.Contains(msg, "connectex") ||
		strings.Contains(msg, "i/o timeout") || strings.Contains(msg, "timeout") ||
		strings.Contains(msg, "no such host") || strings.Contains(msg, "deadline exceeded") ||
		strings.Contains(msg, "connection") || strings.Contains(msg, "TLS handshake") {
		return "检查更新失败：无法连接 GitHub 下载更新（受限网络下 GitHub 下载主机可能不可达）。请前往 GitHub Releases 或国内镜像手动下载新版。"
	}
	if strings.Contains(msg, "400") || strings.Contains(msg, "403") || strings.Contains(msg, "401") {
		return "检查更新失败：GitHub 返回了异常状态（可能被网络代理拦截）。请前往 GitHub Releases 或国内镜像手动下载新版。"
	}
	return msg
}
