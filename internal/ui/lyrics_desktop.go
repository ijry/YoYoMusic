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

// lyricColorSchemes are the desktop-lyric text colours the palette button
// cycles through. The pill background stays a dark frost regardless, so the
// text is always legible against any wallpaper.
var lyricColorSchemes = []struct {
	name string
	text ui.Color
}{
	{"白", ui.RGB(255, 255, 255)},
	{"金", ui.RGB(255, 214, 102)},
	{"青", ui.RGB(120, 230, 255)},
	{"粉", ui.RGB(255, 160, 200)},
	{"绿", ui.RGB(160, 255, 170)},
}

// lyricColorIdx is the active desktop-lyric colour, advanced by the palette
// button. Stored here (not in settings) because it is a pure display choice.
var lyricColorIdx int

// lyricLocked freezes the lyrics window in place so dragging it (even by
// accident) does not move it. It is a session preference.
var lyricLocked bool

// DesktopLyricsView is the content of the floating, always-on-top lyrics
// window. It is transparent and frameless; a frosted pill carries the current
// line large and the next line smaller, like the Tauri build's desktop lyrics.
//
// The background is transparent so only the pill and text show over the
// desktop. A control bar (colour, lock, size -/+ and close) fades in only
// while the pointer is over the window, keeping the display uncluttered while
// playing and reachable when the user wants to tweak it.
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
		textColor := lyricColorSchemes[lyricColorIdx%len(lyricColorSchemes)].text

		// The whole surface drags the window — unless it is locked.
		root := ui.Box(c).Fill()
		if !lyricLocked {
			root = root.DragWindow()
		}
		root.Children(func() {
			hovered := root.Hovered()

			// Control bar: revealed on hover. Sits along the top of the
			// window, overlaid on the lyrics pill.
			if hovered {
				ui.Box(c).Absolute().Top(0).Left(0).Right(0).Height(34).
					Background(t.Surface.Alpha(0.7)).Children(func() {
					ui.Row(c).Fill().Height(34).Padding(6, 8).Gap(6).
						AlignItems(ui.Center).Children(func() {
						// Colour: cycle through the palette.
						cb := iconButton(c, "lyric-color", "palette",
							"配色："+lyricColorSchemes[lyricColorIdx%len(lyricColorSchemes)].name)
						cb.Size(26, 26).Radius(6).OnClick(func() {
							lyricColorIdx = (lyricColorIdx + 1) % len(lyricColorSchemes)
						})

						// Lock / unlock the window position.
						lockName := "lock"
						lockTip := "锁定位置"
						if lyricLocked {
							lockName = "unlock"
							lockTip = "解锁位置"
						}
						lb := iconButton(c, "lyric-lock", lockName, lockTip)
						lb.Size(26, 26).Radius(6).OnClick(func() { lyricLocked = !lyricLocked })

						// Size - / +.
						sb := iconButton(c, "lyric-smaller", "minus", "缩小")
						sb.Size(26, 26).Radius(6).OnClick(func() {
							a.SetDesktopLyricScale(a.Settings().DesktopLyrics.FontScale - 0.15)
						})
						gb := iconButton(c, "lyric-bigger", "plus", "放大")
						gb.Size(26, 26).Radius(6).OnClick(func() {
							a.SetDesktopLyricScale(a.Settings().DesktopLyrics.FontScale + 0.15)
						})

						ui.Box(c).Grow(1)

						// Close the desktop lyrics window.
						xb := iconButton(c, "lyric-close", "close", "关闭桌面歌词")
						xb.Size(26, 26).Radius(6).OnClick(func() {
							if lyricWindow != nil {
								lyricWindow.Hide()
							}
							lyricVisible = false
						})
					})
				})
			}

			ui.Column(c).Fill().AlignItems(ui.Center).Justify(ui.Center).Children(func() {
				ui.Box(c).Padding(12, 26).Gap(8).Background(t.Surface.Alpha(0.42)).Radius(18).
					AlignItems(ui.Center).Children(func() {
					if cur == "" {
						ui.Text(c, "暂无歌词").FontSize(float32(20 * scale)).TextColor(textColor)
						return
					}
					ui.Text(c, cur).FontSize(float32(34 * scale)).Bold().TextColor(textColor)
					if next != "" {
						ui.Text(c, next).FontSize(float32(20 * scale)).TextColor(textColor.Alpha(0.55))
					}
				})
			})
		})
	}
}
