// Command yoyomusic is a native (GPU-drawn) desktop music player built with
// the mygo framework. It uses the ui package's pure-Go, webview-free
// Content rather than a web frontend.
package main

import (
	"bytes"
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
	fs.Parse(os.Args[1:])
	cliArgs.imports = fs.Args()
}

func main() {
	mygo.App.SetName("YoYoMusic")
	mygo.App.SetVersion("1.0.0")
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
		mygo.App.SetMenu(buildMenu(a))

		mygo.NewWindow(mygo.WindowOptions{
			Title:     "YoYoMusic",
			Width:     1100,
			Height:    720,
			MinWidth:  820,
			MinHeight: 560,
			Content:   myui.View(ui.View(a)),
		})

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
func buildMenu(a *app.App) *mygo.Menu {
	return mygo.NewMenu([]*mygo.MenuItem{
		{Role: mygo.RoleAppMenu},
		{
			Label: "播放控制",
			Submenu: []*mygo.MenuItem{
				{Label: "播放/暂停", Accelerator: boundShortcuts["toggle_playback"], Click: func(*mygo.MenuItem, *mygo.Window) { a.TogglePlay() }},
				{Label: "上一首", Accelerator: boundShortcuts["previous_track"], Click: func(*mygo.MenuItem, *mygo.Window) { a.Prev() }},
				{Label: "下一首", Accelerator: boundShortcuts["next_track"], Click: func(*mygo.MenuItem, *mygo.Window) { a.Next() }},
			},
		},
		{
			Label: "文件",
			Submenu: []*mygo.MenuItem{
				{Label: "导入音乐…", Click: func(*mygo.MenuItem, *mygo.Window) { ui.TriggerImport(a) }},
				mygo.Separator(),
				{Label: "检查更新…", Click: func(*mygo.MenuItem, *mygo.Window) {
					a.SetPanel("about")
					a.Updater.CheckAsync(true)
				}},
				mygo.Separator(),
				{Role: mygo.RoleQuit},
			},
		},
		{Role: mygo.RoleEditMenu},
	})
}

// buildTray adds a notification-area / menu-bar icon with playback controls.
func buildTray(a *app.App) {
	menu := mygo.NewMenu([]*mygo.MenuItem{
		{Label: "播放/暂停", Click: func(*mygo.MenuItem, *mygo.Window) { a.TogglePlay() }},
		{Label: "上一首", Click: func(*mygo.MenuItem, *mygo.Window) { a.Prev() }},
		{Label: "下一首", Click: func(*mygo.MenuItem, *mygo.Window) { a.Next() }},
		mygo.Separator(),
		{Label: "导入音乐…", Click: func(*mygo.MenuItem, *mygo.Window) { ui.TriggerImport(a) }},
		mygo.Separator(),
		{Label: "退出", Click: func(*mygo.MenuItem, *mygo.Window) { mygo.App.Quit() }},
	})
	if _, err := mygo.NewTray(mygo.TrayOptions{
		Icon:    trayIcon(),
		Title:   "YoYoMusic",
		ToolTip: "YoYoMusic · 原生音乐播放器",
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
