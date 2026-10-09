package ui

import (
	"github.com/egoist/mygo/ui"

	"yoyomusic/internal/app"
)

// lyricWindow holds the desktop-lyrics OS window so the view can hide it from
// its own close button. It is an interface (Show/Hide) rather than the concrete
// *mygo.Window to keep this package free of a mygo import and the resulting
// import cycle (mygo imports mygo/ui).
var lyricWindow interface {
	Show()
	Hide()
}

// lyricVisible tracks whether the desktop lyrics window is currently shown, so
// ToggleDesktopLyrics can flip it without asking the OS for state.
var lyricVisible bool

// SetLyricWindow hands the desktop-lyrics window handle to this package. Called
// from main once the window is created.
func SetLyricWindow(w interface {
	Show()
	Hide()
}) {
	lyricWindow = w
}

// ToggleDesktopLyrics shows or hides the desktop lyrics window and returns the
// new visibility. A no-op (false) when the window was never created.
func ToggleDesktopLyrics() bool {
	if lyricWindow == nil {
		return false
	}
	lyricVisible = !lyricVisible
	if lyricVisible {
		lyricWindow.Show()
	} else {
		lyricWindow.Hide()
	}
	return lyricVisible
}

// DesktopLyricsView is the content of the floating, always-on-top lyrics
// window. It is transparent and frameless; a frosted pill carries the current
// line large and the next line smaller, like the Tauri build's desktop lyrics.
// The whole surface drags the window, with a close affordance in the corner.
func DesktopLyricsView(a *app.App) func(c *ui.Context) {
	return func(c *ui.Context) {
		// The floating window must be transparent: the framework's root
		// paints the theme background unless told otherwise, which showed as
		// an opaque white card over the desktop. Force transparency and pin
		// the dark skin theme so the pill and text stay readable regardless
		// of the system appearance.
		c.Root().Background(ui.Transparent)
		c.SetTheme(skinTheme(a.CurrentSkin()))
		t := c.Theme()
		scale := 1.0
		if s := a.Settings().DesktopLyrics.FontScale; s > 0 {
			scale = s
		}
		cur, next, _ := a.CurrentLyric()

		root := ui.Box(c).Fill().DragWindow()
		root.Children(func() {
			// Close affordance in the corner: the window is frameless, so it
			// needs its own way out.
			ui.Box(c).Absolute().Top(6).Right(6).Children(func() {
				cb := iconButton(c, "lyric-close", "close", "关闭桌面歌词")
				cb.Size(22, 22).Radius(6).OnClick(func() {
					if lyricWindow != nil {
						lyricWindow.Hide()
					}
					lyricVisible = false
				})
			})

			ui.Column(c).Fill().AlignItems(ui.Center).Justify(ui.Center).Children(func() {
				ui.Box(c).Padding(12, 26).Gap(8).Background(t.Surface.Alpha(0.42)).Radius(18).
					AlignItems(ui.Center).Children(func() {
					if cur == "" {
						ui.Text(c, "暂无歌词").FontSize(float32(20 * scale)).TextColor(ui.RGB(255, 255, 255))
						return
					}
					ui.Text(c, cur).FontSize(float32(34 * scale)).Bold().TextColor(ui.RGB(255, 255, 255))
					if next != "" {
						ui.Text(c, next).FontSize(float32(20 * scale)).TextColor(ui.RGB(255, 255, 255).Alpha(0.55))
					}
				})
			})
		})
	}
}
