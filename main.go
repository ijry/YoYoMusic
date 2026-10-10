// Command yoyomusic is a native (GPU-drawn) desktop music player built with
// the mygo framework. It uses the ui package's pure-Go, webview-free
// Content rather than a web frontend.
package main

import (
	"bytes"
	"errors"
	"flag"
	"image"
	"image/color"
	"image/png"
	"log"
	"os"
	"path/filepath"

	"yoyomusic/internal/app"
	"yoyomusic/internal/ui"

	"github.com/egoist/mygo"
	myui "github.com/egoist/mygo/ui"
)

// cliArgs holds the optional command-line arguments: files or directories to
// import on startup, so the player can be scripted and tested without the
// file dialog.
var cliArgs struct {
	imports []string
	play    bool
}

func parseFlags() {
	fs := flag.NewFlagSet(os.Args[0], flag.ContinueOnError)
	fs.BoolVar(&cliArgs.play, "play", false, "start playback of the imported files")
	// flag.ContinueOnError prints usage and returns ErrHelp for -h/--help:
	// exit instead of starting a GUI nobody asked for, with the conventional
	// status 0. A malformed flag exits 2. Both give CI a cheap way to check
	// the binary runs without a display.
	if err := fs.Parse(os.Args[1:]); err != nil {
		if errors.Is(err, flag.ErrHelp) {
			os.Exit(0)
		}
		os.Exit(2)
	}
	cliArgs.imports = fs.Args()
}

func main() {
	mygo.App.SetName("悠悠乐听")
	// Do NOT hardcode the version here: mygo injects the packaged version
	// (from mygo.json) at build time and App.Version() reports it. A stale
	// literal made released binaries misreport as an old version and always
	// offer a "newer" build. Let the build metadata be the single source.

	// Route outbound HTTP (the updater's download host, album-art lookups)
	// through the OS system proxy when one is configured. Go's net/http
	// only reads the HTTPS_PROXY/HTTP_PROXY env vars, so we copy the system
	// proxy into them before any network use. Must run before AutoCheck().
	app.ApplySystemProxy()

	// Every skin is dark, so declare the appearance instead of following the
	// system. Windows otherwise paints the native minimise, maximise and
	// close glyphs for a *light* title bar — dark strokes — which left them
	// all but invisible on the dark toolbar. mygo drives
	// DWMWA_USE_IMMERSIVE_DARK_MODE from this, so the controls draw light.
	mygo.Theme.SetSource(mygo.ThemeDark)

	parseFlags()

	mygo.App.WhenReady(func() {
		dataDir, err := mygo.App.Path(mygo.PathUserData)
		if err != nil {
			dataDir = "yoyomusic-data"
		}

		a := app.NewApp(dataDir)

		// Bring over the Tauri release's settings and library so upgrading
		// keeps the user's configuration. A fresh install finds nothing and
		// writes no file.
		if rep, err := a.MigrateLegacyData(); err != nil {
			log.Printf("legacy migration: %v", err)
		} else if rep.HadSettings || rep.HadPlaylist {
			log.Printf("legacy migration: from %s (skin=%q viz=%q eq=%q tracks=%d)",
				rep.FromDir, rep.SkinMapped, rep.VizMapped, rep.EQPreset, rep.TrackCount)
		}

		// Look for a newer version shortly after startup; silent unless
		// something is found.
		a.Updater.AutoCheck()

		// Files named on the command line are imported at startup, which
		// also lets the player be scripted and tested headlessly.
		if len(cliArgs.imports) > 0 {
			if errs := a.ImportPaths(cliArgs.imports); len(errs) > 0 {
				for _, e := range errs {
					log.Printf("import: %v", e)
				}
			}
			if cliArgs.play {
				snap := a.Snapshot()
				if len(snap.Tracks) > 0 {
					a.PlayTrack(snap.Tracks[0].ID)
				}
			} else {
				a.SetPanel("library")
			}
		}

		registerShortcuts(a)
		buildTray(a)
		// No menu bar: every action lives in the window (top toolbar, side
		// panels, tray) or on a global shortcut. A menu bar on Windows and
		// Linux would take a row of vertical space the floating layout needs,
		// and on macOS it would duplicate the panels. mygo.App.SetMenu is
		// deliberately not called; the tray keeps the same actions reachable
		// when the window is closed.

		mw := mygo.NewWindow(mygo.WindowOptions{
			Title:         "悠悠乐听",
			Width:         1100,
			Height:        720,
			MinWidth:      820,
			MinHeight:     560,
			TitleBarStyle: mygo.TitleBarHidden,
			Content:       myui.View(ui.View(a)),
		})
		ui.SetMainWindow(mw)

		// Desktop lyrics: a separate, transparent, always-on-top window that
		// floats over the desktop like the Tauri build's. It is hidden until
		// the user toggles it from the tray or the lyrics panel.
		lw := mygo.NewWindow(mygo.WindowOptions{
			Title:         "悠悠乐听 · 桌面歌词",
			Width:         880,
			Height:        110,
			AlwaysOnTop:   true,
			Frameless:     true,
			Transparent:   true,
			SkipTaskbar:   true,
			TitleBarStyle: mygo.TitleBarHidden,
			Hidden:        true,
			Content:       myui.View(ui.DesktopLyricsView(a)),
		})
		ui.SetLyricWindow(lw)

		// Persist user settings when the application is about to quit. On
		// Windows the backend does not deliver a graceful quit, so the app
		// also autosaves on every change; this flushes the tail.
		mygo.App.OnWillQuit(func(e *mygo.QuitEvent) {
			a.Flush()
		})
		mygo.App.OnQuit(func() {
			a.Flush()
		})
	})

	if err := mygo.App.Run(); err != nil {
		log.Fatal(err)
	}
}

// boundShortcuts maps action ids to the accelerator that was actually bound,
// so the menu can show the working shortcut.
var boundShortcuts = map[string]string{
	"toggle_playback": "",
	"previous_track":  "",
	"next_track":      "",
}

// registerShortcuts binds the global playback shortcuts that work even when
// the window is not focused. It honours the user's configured accelerators
// (from settings.json) and falls back to alternates when a combination is
// already claimed by another application on the system.
func registerShortcuts(a *app.App) {
	settings := a.Settings()
	shortcuts := []struct {
		id     string
		prefer []string
		fn     func()
	}{
		{
			id:     "toggle_playback",
			prefer: []string{settings.Shortcuts["toggle_playback"], "CmdOrCtrl+Alt+P", "CmdOrCtrl+Alt+Shift+P", "CmdOrCtrl+Alt+F13"},
			fn:     a.TogglePlay,
		},
		{
			id:     "previous_track",
			prefer: []string{settings.Shortcuts["previous_track"], "CmdOrCtrl+Alt+Left", "CmdOrCtrl+Alt+Shift+Left", "CmdOrCtrl+Alt+F14"},
			fn:     a.Prev,
		},
		{
			id:     "next_track",
			prefer: []string{settings.Shortcuts["next_track"], "CmdOrCtrl+Alt+Right", "CmdOrCtrl+Alt+Shift+Right", "CmdOrCtrl+Alt+F15"},
			fn:     a.Next,
		},
	}
	for _, s := range shortcuts {
		registered := ""
		for _, acc := range s.prefer {
			if acc == "" || mygo.GlobalShortcut.IsRegistered(acc) {
				continue
			}
			if err := mygo.GlobalShortcut.Register(acc, s.fn); err == nil {
				registered = acc
				break
			}
		}
		boundShortcuts[s.id] = registered
		if registered == "" {
			log.Printf("shortcut %s: no free accelerator (in-app controls and menu still work)", s.id)
		} else if registered != s.prefer[0] {
			log.Printf("shortcut %s: %q was taken, using %q", s.id, s.prefer[0], registered)
		}
	}
}

// buildMenu assembles the application menu bar (macOS) or window menu
// (Linux, Windows).
// buildTray adds a notification-area / menu-bar icon. With the menu bar gone,
// the tray is where the actions that have no window affordance live: import,
// the four panels, and checking for updates.
func buildTray(a *app.App) {
	menu := mygo.NewMenu([]*mygo.MenuItem{
		{Label: "播放/暂停", Click: func(*mygo.MenuItem, *mygo.Window) { a.TogglePlay() }},
		{Label: "上一首", Click: func(*mygo.MenuItem, *mygo.Window) { a.Prev() }},
		{Label: "下一首", Click: func(*mygo.MenuItem, *mygo.Window) { a.Next() }},
		mygo.Separator(),
		{Label: "导入音乐…", Click: func(*mygo.MenuItem, *mygo.Window) { ui.TriggerImport(a) }},
		mygo.Separator(),
		{Label: "均衡器", Click: func(*mygo.MenuItem, *mygo.Window) { a.ToggleSidePanel("eq") }},
		{Label: "歌词", Click: func(*mygo.MenuItem, *mygo.Window) { a.ToggleSidePanel("lyrics") }},
		{Label: "桌面歌词", Click: func(*mygo.MenuItem, *mygo.Window) { ui.ToggleDesktopLyrics() }},
		{Label: "外观", Click: func(*mygo.MenuItem, *mygo.Window) { a.ToggleSidePanel("skins") }},
		{Label: "关于与更新", Click: func(*mygo.MenuItem, *mygo.Window) {
			a.ToggleSidePanel("about")
			a.Updater.CheckAsync(true)
		}},
		mygo.Separator(),
		{Label: "退出", Click: func(*mygo.MenuItem, *mygo.Window) { mygo.App.Quit() }},
	})
	if _, err := mygo.NewTray(mygo.TrayOptions{
		Icon:    trayIcon(),
		Title:   "悠悠乐听",
		ToolTip: "悠悠乐听 · 原生音乐播放器",
		Menu:    menu,
	}); err != nil {
		log.Printf("tray: %v", err)
	}
}

// trayIcon loads the app icon for the tray. The 32x32 variant is preferred
// since every platform scales the tray image down anyway; the full-size
// icon.png is the fallback, and a generated glyph the last resort so the
// tray still shows something when the assets are missing.
func trayIcon() []byte {
	dirs := []string{"resources"}
	if exe, err := os.Executable(); err == nil {
		dirs = append(dirs, filepath.Join(filepath.Dir(exe), "resources"))
	}
	for _, dir := range dirs {
		for _, name := range []string{"icon-32.png", "icon.png"} {
			if data, err := os.ReadFile(filepath.Join(dir, name)); err == nil {
				return data
			}
		}
	}
	const s = 32
	img := image.NewRGBA(image.Rect(0, 0, s, s))
	c := color.RGBA{R: 0x8b, G: 0x5c, B: 0xf6, A: 0xff}
	for y := 0; y < s; y++ {
		for x := 0; x < s; x++ {
			img.Set(x, y, c)
		}
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		return nil
	}
	return buf.Bytes()
}
