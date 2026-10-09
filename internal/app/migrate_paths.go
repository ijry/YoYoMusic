package app

import (
	"log"
	"os"
	"path/filepath"
	"runtime"
)

// runtimeGOOS is the platform, indirected so tests can override the lookup.
var runtimeGOOS = runtime.GOOS

// legacyAppDataDir resolves where the Tauri release stored its data for the
// given bundle identifier. Tauri's app_data_dir follows the platform
// convention: %APPDATA%\<identifier> on Windows and
// ~/.local/share/<identifier> elsewhere.
func legacyAppDataDir(identifier string) string {
	var base string
	switch runtimeGOOS {
	case "windows":
		base = os.Getenv("APPDATA")
	case "darwin":
		if home, err := os.UserHomeDir(); err == nil {
			base = filepath.Join(home, "Library", "Application Support")
		}
	default: // linux and the other unixes
		if home, err := os.UserHomeDir(); err == nil {
			base = filepath.Join(home, ".local", "share")
		}
	}
	if base == "" {
		return ""
	}
	return filepath.Join(base, identifier)
}

// logMigration logs at a level that survives release builds, so a silent
// migration failure can still be diagnosed from the app's own output.
func logMigration(format string, args ...any) {
	log.Printf("migrate: "+format, args...)
}
