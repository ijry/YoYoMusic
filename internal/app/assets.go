package app

import (
	"os"
	"path/filepath"
)

// ResourceDirs is where the packaged assets — the app icon above all — are
// looked for, in the order worth looking: beside the working directory first,
// so a run straight out of a source checkout finds them, then beside the
// executable, which is where an installed app keeps them.
//
// Asset loading is shared because more than one place needs it and each has to
// agree on where the files are: the tray icon on startup, and the app's own
// mark in the interface. Every caller falls back on something drawn rather
// than leave nothing there, so a missing directory is never fatal.
func ResourceDirs() []string {
	dirs := []string{"resources"}
	if exe, err := os.Executable(); err == nil {
		dirs = append(dirs, filepath.Join(filepath.Dir(exe), "resources"))
	}
	return dirs
}
