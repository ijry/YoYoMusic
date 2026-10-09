// Package ui builds the native (GPU-drawn) interface for YoYoMusic with the
// mygo ui package. It is named "ui" but imports the framework as myui to avoid
// a name clash with github.com/egoist/mygo/ui.
//
// The layout mirrors the Tauri build's modern shell: a full-bleed visualiser
// behind everything, a floating playlist column on the left, a floating
// feature panel on the right, and a full-width transport along the bottom
// that carries the cover art and track information. Both side columns fold to
// an icon rail after the pointer has been still for a while.
package ui

import (
	"fmt"
	"path/filepath"
	"time"

	"yoyomusic/internal/app"

	"github.com/egoist/mygo"
	myui "github.com/egoist/mygo/ui"
)

// idleFold is how long the pointer must stay still before a side column
// folds back to its rail.
const idleFold = 10 * time.Second

// layoutState holds the per-window layout bookkeeping the view function
// cannot keep on the stack, because it is rebuilt every frame.
type layoutState struct {
	// lastMove is when the pointer last moved; drives the idle fold.
	lastMove time.Time
	// lastX/lastY is the previous pointer position, so a frame that reports
	// the same coordinates does not reset the timer.
	lastX, lastY float32
	// hadPointer is whether the pointer has ever been inside the window.
	hadPointer bool
}

var layout = &layoutState{}

// View returns the window view function bound to the app orchestrator.
func View(a *app.App) func(c *myui.Context) {
	return func(c *myui.Context) {
		skin := a.CurrentSkin()
		c.SetTheme(skinTheme(skin))

		// The visualiser animates continuously, so the window repaints every
		// frame; when nothing is playing a 25fps rebuild keeps the clock and
		// the idle-breathing spectrum alive without spinning the CPU.
		if a.IsPlaying() {
			c.AnimationFrame()
		} else {
			c.After(40 * time.Millisecond)
		}
		if c.Shortcut(0, myui.KeySpace) {
			a.TogglePlay()
		}

		// The root is a plain Box filling the window, so the layers below can
		// be positioned over the visualiser instead of beside it.
		root := myui.Box(c).Fill()
		trackPointer(root, c)
		root.Children(func() {
			// Layer 1: the visualiser, full bleed.
			visualizerBackdrop(c, a, skin)

			// Layer 2: the floating chrome over it.
			myui.Box(c).Fill().Children(func() {
				myui.Column(c).Fill().Children(func() {
					topBar(c, a, skin)
					myui.Box(c).Grow(1).Children(func() {
						leftRail(c, a, skin)
						rightRail(c, a, skin)
					})
					transport(c, a, skin)
				})
			})
		})
	}
}

// trackPointer feeds the idle-fold timer from the root element's pointer
// position. The root fills the window, so "inside the root" is "inside the
// window", and its own origin is the window origin.
//
// Comparing against the previous position matters: mygo reports the last
// known pointer coordinates on every frame, so a stationary pointer would
// otherwise keep resetting the timer and the columns would never fold.
func trackPointer(root myui.Element, c *myui.Context) {
	x, y, over := root.PointerPosition()
	if !over {
		// The pointer left the window: start the fold from now, so the
		// columns do not stay open while the user is elsewhere.
		if layout.hadPointer {
			layout.lastMove = c.Now()
			layout.hadPointer = false
		}
		return
	}
	if !layout.hadPointer || x != layout.lastX || y != layout.lastY {
		layout.lastMove = c.Now()
		layout.lastX, layout.lastY = x, y
		layout.hadPointer = true
	}
}

// visualizerBackdrop paints the audio visualiser behind the whole window.
func visualizerBackdrop(c *myui.Context, a *app.App, skin app.Skin) {
	myui.Box(c).Fill().Draw(func(p *myui.Painter, r myui.Rect) {
		bg := colOf(skin.BG)
		p.Fill(r, bg, 0)
		p.Clip(r, 0, func() {
			f := a.Frame()
			now := c.Now()
			dt := float32(now.Sub(vizLast).Seconds())
			if dt <= 0 || dt > 0.25 {
				dt = 1.0 / 60
			}
			vizLast = now

			switch app.VizOrder[a.VizMode] {
			case app.VizSpectrum:
				drawSpectrum(p, r, f, skin, dt)
			case app.VizWaveform:
				drawWaveform(p, r, f, skin)
			case app.VizRadial:
				drawRadial(p, r, f, skin, dt)
			case app.VizParticles:
				drawParticles(p, r, f, skin, dt)
			case app.VizAurora:
				drawAurora(p, r, f, skin, now)
			case app.VizWaterfall:
				drawWaterfall(p, r, f, skin, dt)
			}
		})
	})
}

// colOf parses a hex colour string into a ui.Color.
func colOf(hex string) myui.Color { return myui.Hex(hex) }

// skinTheme derives a dark theme from the active glassmorphism skin so the
// whole window shares the player's palette.
func skinTheme(s app.Skin) *myui.Theme {
	t := myui.DarkTheme()
	t.Background = colOf(s.BG)
	t.Surface = colOf(s.Surface)
	t.Text = colOf(s.Ink)
	t.TextMuted = colOf(s.Ink).Mix(colOf(s.Surface), 0.45)
	t.Accent = colOf(s.Primary)
	t.AccentHover = colOf(s.Primary).Mix(myui.RGB(255, 255, 255), 0.18)
	t.AccentText = colOf(s.VizInk)
	t.Border = colOf(s.Surface).Mix(colOf(s.Ink), 0.18)
	t.Danger = myui.RGB(239, 68, 68)
	t.Success = myui.RGB(34, 197, 94)
	return t
}

// idleFolded reports whether a column should fold: the pointer has been still
// for the fold delay and the column is not pinned.
func idleFolded(pinned bool) bool {
	if pinned {
		return false
	}
	if layout.lastMove.IsZero() {
		return false
	}
	return time.Since(layout.lastMove) >= idleFold
}

// topBar is the floating toolbar across the top: the brand, the playlist
// toggle on the left, and the feature-panel icons on the right.
func topBar(c *myui.Context, a *app.App, skin app.Skin) myui.Element {
	t := c.Theme()
	return myui.Row(c).Height(52).Padding(12, 14).Gap(10).AlignItems(myui.Center).Children(func() {
		// Left: brand plus the playlist fold toggle.
		myui.Row(c).Gap(8).AlignItems(myui.Center).Children(func() {
			myui.Box(c).Size(22, 22).Radius(11).Draw(func(p *myui.Painter, r myui.Rect) {
				p.FillGradient(r, myui.LinearGradient{
					From: colOf(skin.Primary), To: colOf(skin.Accent), Angle: 135,
				}, 11)
			})
			myui.Text(c, "悠悠乐听").FontSize(16).Bold().TextColor(t.Text)

			// Playlist toggle: folds the left column, or pins it open.
			lb := myui.Button(c.Key("library-toggle"), "☰").Tooltip(playlistTip(a))
			lb.Size(32, 32).Radius(8).OnClick(func() {
				if a.LibraryPinned {
					a.ToggleLibraryPin()
					a.ToggleLibrary()
					return
				}
				if a.LibraryOpen {
					a.ToggleLibrary()
				} else {
					a.LibraryOpen = true
					a.ToggleLibraryPin()
				}
			})
		})

		myui.Box(c).Grow(1)

		// Right: the feature-panel icons, each toggling its panel.
		for _, p := range app.SidePanels {
			panel := p
			label := sidePanelLabel(panel)
			b := myui.Button(c.Key("panel-"+panel), sidePanelGlyph(panel)).Tooltip(label)
			active := a.SidePanel == panel
			if active {
				b.Background(t.Accent.Alpha(0.22))
			}
			b.Size(32, 32).Radius(8).OnClick(func() { a.ToggleSidePanel(panel) })
		}
	})
}

func playlistTip(a *app.App) string {
	switch {
	case a.LibraryPinned:
		return "播放列表已固定，点击取消固定"
	case a.LibraryOpen:
		return "收起播放列表"
	default:
		return "展开播放列表"
	}
}

func sidePanelLabel(p string) string {
	switch p {
	case "eq":
		return "均衡器"
	case "lyrics":
		return "歌词"
	case "skins":
		return "外观"
	case "about":
		return "关于"
	}
	return p
}

func sidePanelGlyph(p string) string {
	switch p {
	case "eq":
		return "🎚"
	case "lyrics":
		return "🎤"
	case "skins":
		return "🎨"
	case "about":
		return "ℹ"
	}
	return "•"
}

// leftRail is the playlist column: a floating panel when open, a slim icon
// rail when folded by the idle timer.
func leftRail(c *myui.Context, a *app.App, skin app.Skin) {
	folded := idleFolded(a.LibraryPinned) || !a.LibraryOpen
	if folded {
		// The rail keeps just the toggle, so the playlist is one click away.
		myui.Box(c).Width(44).FillHeight().Padding(6, 6).Children(func() {
			b := myui.Button(c.Key("rail-library"), "☰").Tooltip("展开播放列表")
			b.Size(32, 32).Radius(8).OnClick(func() {
				a.LibraryOpen = true
				a.ToggleLibraryPin()
			})
		})
		return
	}
	playlistPanel(c, a, skin)
}

// rightRail is the feature column: the open panel when expanded, otherwise
// nothing but the top-bar icons (which live in topBar).
func rightRail(c *myui.Context, a *app.App, skin app.Skin) {
	if a.SidePanel == "" {
		return
	}
	folded := idleFolded(a.SidePanelSticky())
	if folded {
		// Folded: the panel is not drawn at all; the top-bar icons remain.
		return
	}
	sidePanel(c, a, skin)
}

// transport is the full-width bottom bar: cover art, track information, the
// seek bar, the transport buttons and the volume controls.
func transport(c *myui.Context, a *app.App, skin app.Skin) myui.Element {
	t := c.Theme()
	pos := a.PositionMs()
	dur := a.DurationMs()
	snap := a.Snapshot()
	cur := snap.Current

	return myui.Column(c).Fill().Children(func() {
		seekBar(c, a, skin, pos, dur)
		myui.Row(c).Height(64).Padding(10, 16).Gap(14).AlignItems(myui.Center).Children(func() {
			transportNowPlaying(c, a, skin, cur)
			myui.Box(c).Grow(1)
			transportButtons(c, a, skin, t)
			myui.Box(c).Grow(1)
			transportUtility(c, a, t)
		})
	})
}

// transportNowPlaying is the cover art plus title and artist.
func transportNowPlaying(c *myui.Context, a *app.App, skin app.Skin, cur *app.Track) {
	t := c.Theme()
	myui.Row(c).Gap(10).AlignItems(myui.Center).Children(func() {
		myui.Box(c).Size(48, 48).Radius(10).Draw(func(p *myui.Painter, r myui.Rect) {
			p.FillGradient(r, myui.LinearGradient{
				From: colOf(skin.Primary), To: colOf(skin.Accent), Angle: 135,
			}, 10)
			p.Text(r.X+8, r.Y+30, "♪", 18, colOf(skin.VizInk).Alpha(0.85))
		})
		myui.Column(c).Gap(2).Children(func() {
			if cur == nil {
				myui.Text(c, "尚未播放").FontSize(14).Bold().TextColor(t.Text)
				myui.Text(c, "从左侧播放列表选择音乐").FontSize(11).TextColor(t.TextMuted)
				return
			}
			myui.Text(c, cur.Title).FontSize(14).Bold().TextColor(t.Text)
			myui.Text(c, cur.Artist+" · "+cur.Album).FontSize(11).TextColor(t.TextMuted)
		})
	})
}

// transportButtons is the centred prev/play/next group.
func transportButtons(c *myui.Context, a *app.App, skin app.Skin, t *myui.Theme) {
	myui.Row(c).Gap(10).AlignItems(myui.Center).Children(func() {
		prev := myui.Button(c.Key("prev"), "⏮").Tooltip("上一首")
		prev.Size(38, 38).Radius(19).OnClick(func() { a.Prev() })

		var play myui.Element
		if a.IsPlaying() {
			play = myui.PrimaryButton(c.Key("play"), "⏸").Tooltip("暂停")
		} else {
			play = myui.PrimaryButton(c.Key("play"), "▶").Tooltip("播放")
		}
		play.Size(46, 46).Radius(23).OnClick(func() { a.TogglePlay() })

		next := myui.Button(c.Key("next"), "⏭").Tooltip("下一首")
		next.Size(38, 38).Radius(19).OnClick(func() { a.Next() })
	})
}

// transportUtility holds the clock, volume and mute on the right of the deck.
func transportUtility(c *myui.Context, a *app.App, t *myui.Theme) {
	pos := a.PositionMs()
	dur := a.DurationMs()
	myui.Row(c).Gap(10).AlignItems(myui.Center).Children(func() {
		myui.Text(c, fmt.Sprintf("%s / %s", app.FmtTime(pos), app.FmtTime(dur))).
			FontSize(12).TextColor(t.TextMuted)
		muteBtn(c, a, t)
		vol := myui.Slider(c, &a.Volume, 0, 1).Width(110)
		vol.OnChange(func() { a.SetVolume(a.Volume) })
	})
}

// muteBtn is the speaker button: one click toggles mute, and the glyph shows
// the current state the way desktop players do.
func muteBtn(c *myui.Context, a *app.App, t *myui.Theme) myui.Element {
	glyph, tip := speakerGlyph(a.Volume, a.Muted)
	b := myui.Button(c.Key("mute"), glyph).Tooltip(tip)
	b.Size(32, 32).Radius(8).OnClick(func() { a.ToggleMute() })
	return b
}

// speakerGlyph picks the speaker icon and tooltip for the current volume.
func speakerGlyph(vol float64, muted bool) (glyph, tip string) {
	switch {
	case muted || vol <= 0:
		return "🔇", "取消静音"
	case vol < 0.34:
		return "🔈", "静音"
	case vol < 0.67:
		return "🔉", "静音"
	default:
		return "🔊", "静音"
	}
}

// playlistPanel is the expanded left column: the library list.
func playlistPanel(c *myui.Context, a *app.App, skin app.Skin) {
	t := c.Theme()
	snap := a.Snapshot()
	myui.Box(c).Width(300).FillHeight().Children(func() {
		// Translucent so the visualiser reads through, the way the old
		// build's floating panels did.
		myui.Column(c).Fill().Background(t.Surface.Alpha(0.82)).Radius(0, 14, 14, 0).
			Padding(12, 10).Gap(6).Children(func() {
			myui.Row(c).AlignItems(myui.Center).Children(func() {
				myui.Text(c, "播放列表").FontSize(14).Bold().TextColor(t.Text)
				myui.Box(c).Grow(1)
				myui.Text(c, fmt.Sprintf("%d 首", len(snap.Tracks))).FontSize(11).TextColor(t.TextMuted)
				pin := myui.Button(c.Key("pin-library"), "📌").Tooltip(playlistTip(a))
				pin.Size(26, 26).Radius(6).OnClick(func() { a.ToggleLibraryPin() })
			})
			myui.Row(c).Gap(6).Children(func() {
				imp := myui.Button(c.Key("import"), "导入音乐…").Grow(1)
				imp.OnClick(func() { TriggerImport(a) })
			})
			myui.Scroll(c).Fill().Children(func() {
				if len(snap.Tracks) == 0 {
					myui.Text(c, "还没有音乐。\n点击「导入音乐…」选择文件或文件夹。").
						FontSize(12).TextColor(t.TextMuted).Padding(12, 10)
					return
				}
				for i, tr := range snap.Tracks {
					trackRow(c, a, tr, snap.Current, i)
				}
			})
		})
	})
}

// trackRow is one selectable track in the playlist.
func trackRow(c *myui.Context, a *app.App, tr *app.Track, cur *app.Track, index int) myui.Element {
	t := c.Theme()
	active := cur != nil && cur.ID == tr.ID
	bad := tr.Status == app.TrackBad || tr.Status == app.TrackMissing
	e := myui.Row(c).Key(tr.ID).Padding(7, 8).Gap(10).AlignItems(myui.Center).Radius(8)
	if active {
		e = e.Background(t.Accent.Alpha(0.16))
	}
	e.Children(func() {
		myui.Box(c).Size(30, 30).Radius(8).Background(t.Background.Alpha(0.6)).
			AlignItems(myui.Center).Justify(myui.Center).Children(func() {
			myui.Text(c, fmt.Sprintf("%d", index+1)).FontSize(11).TextColor(t.TextMuted)
		})
		myui.Column(c).Grow(1).Gap(1).Children(func() {
			titleColor := t.Text
			if bad {
				titleColor = t.TextMuted
			}
			myui.Text(c, tr.Title).FontSize(13).TextColor(titleColor)
			line := tr.Artist
			if tr.Status == app.TrackBad {
				line += " · 格式不支持"
			} else if tr.Status == app.TrackMissing {
				line += " · 文件缺失"
			}
			myui.Text(c, line).FontSize(11).TextColor(t.TextMuted)
		})
		myui.Text(c, app.FmtTime(tr.DurationMs)).FontSize(11).TextColor(t.TextMuted)
	})
	e.OnClick(func() {
		switch tr.Status {
		case app.TrackBad:
			a.State.PushError("暂不支持 " + filepath.Ext(tr.FilePath) + " 格式（支持 WAV / MP3 / FLAC / OGG）")
		case app.TrackMissing:
			a.State.PushError("文件不存在: " + tr.FilePath)
		default:
			a.PlayTrack(tr.ID)
		}
	})
	return e
}

// sidePanel is the expanded right column.
func sidePanel(c *myui.Context, a *app.App, skin app.Skin) {
	t := c.Theme()
	myui.Box(c).Width(320).FillHeight().Children(func() {
		myui.Column(c).Fill().Background(t.Surface.Alpha(0.82)).
			Padding(12, 12).Gap(8).Children(func() {
			myui.Row(c).AlignItems(myui.Center).Children(func() {
				myui.Text(c, sidePanelLabel(a.SidePanel)).FontSize(14).Bold().TextColor(t.Text)
				myui.Box(c).Grow(1)
				cl := myui.Button(c.Key("close-panel"), "✕").Tooltip("关闭")
				cl.Size(26, 26).Radius(6).OnClick(func() { a.CloseSidePanel() })
			})
			myui.Scroll(c).Fill().Children(func() {
				switch a.SidePanel {
				case "eq":
					eqPanel(c, a, skin)
				case "lyrics":
					lyricsPanel(c, a, skin)
				case "skins":
					skinsPanel(c, a, skin)
				case "about":
					aboutPanel(c, a)
				}
			})
		})
	})
}

// seekBar is the progress bar across the top of the transport.
//
// A Slider is used rather than a drawn bar because it brings dragging,
// keyboard seeking and accessibility for free; the value it binds is a local
// copy of the position, written back to the player on change so the bar does
// not fight the playback clock between frames.
func seekBar(c *myui.Context, a *app.App, skin app.Skin, pos, dur int64) myui.Element {
	t := c.Theme()
	seek := float64(pos)
	if dur > 0 {
		s := myui.Slider(c, &seek, 0, float64(dur)).Fill()
		s.OnChange(func() { a.SeekMs(int64(seek)) })
		return s
	}
	// Nothing loaded: show an inert, empty rail.
	return myui.Box(c).Fill().Height(6).Radius(3).Background(t.Border.Alpha(0.4))
}

// eqPanel is the ten-band equaliser with presets and an enable switch.
func eqPanel(c *myui.Context, a *app.App, skin app.Skin) myui.Element {
	t := c.Theme()
	freqs := []string{"31", "62", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"}
	presetNames := map[string]string{
		"flat": "平直", "rock": "摇滚", "pop": "流行", "classical": "古典",
		"bass": "重低音", "vocal": "人声", "treble": "高音",
	}
	return myui.Column(c).Fill().Gap(8).Children(func() {
		myui.Row(c).Gap(8).AlignItems(myui.Center).Children(func() {
			myui.Text(c, "启用").FontSize(13).TextColor(t.Text)
			en := myui.Switch(c, &a.EQEnabled)
			if en.Changed() {
				a.SetEQEnabled(a.EQEnabled)
			}
		})
		myui.Row(c).Gap(5).Wrap().Children(func() {
			for _, name := range a.EQPresets() {
				label := name
				if zh, ok := presetNames[name]; ok {
					label = zh
				}
				b := myui.Button(c.Key("preset-"+name), label)
				b.OnClick(func() { a.SetEQPreset(name) })
			}
		})
		myui.Divider(c)
		for i := 0; i < 10; i++ {
			idx := i
			myui.Row(c).Gap(8).AlignItems(myui.Center).Children(func() {
				myui.Text(c, freqs[i]).FontSize(11).TextColor(t.TextMuted).Width(34)
				s := myui.Slider(c, &a.EQBands[idx], -12, 12).Grow(1)
				s.OnChange(func() { a.SetEQBand(idx, a.EQBands[idx]) })
				myui.Text(c, fmt.Sprintf("%+.1f", a.EQBands[idx])).FontSize(11).TextColor(t.TextMuted).Width(42)
			})
		}
	})
}

// lyricsPanel shows imported lyrics, or a placeholder.
func lyricsPanel(c *myui.Context, a *app.App, skin app.Skin) myui.Element {
	t := c.Theme()
	return myui.Column(c).Fill().Gap(8).Children(func() {
		myui.Text(c, "歌词").FontSize(13).Bold().TextColor(t.Text)
		myui.Text(c, "歌词文件（.lrc）与音乐文件同名同目录放置时会自动加载，\n也支持读取文件内嵌的歌词标签。").
			FontSize(12).TextColor(t.TextMuted)
		myui.Divider(c)
		myui.Text(c, "播放带歌词的曲目后，这里会逐行高亮显示。").
			FontSize(11).TextColor(t.TextMuted)
	})
}

// skinsPanel lists the selectable themes.
func skinsPanel(c *myui.Context, a *app.App, skin app.Skin) myui.Element {
	cur := a.CurrentSkin().ID
	return myui.Column(c).Fill().Gap(6).Children(func() {
		for _, s := range a.Skins() {
			skinCard(c, a, s, cur)
		}
	})
}

// skinCard is one selectable theme row with colour swatches.
func skinCard(c *myui.Context, a *app.App, s app.Skin, cur string) myui.Element {
	t := c.Theme()
	active := s.ID == cur
	e := myui.Row(c).Key(s.ID).Padding(9, 9).Gap(10).AlignItems(myui.Center).Radius(10)
	if active {
		e = e.Background(t.Accent.Alpha(0.16))
	}
	e.Children(func() {
		myui.Row(c).Gap(4).Children(func() {
			for _, hex := range []string{s.Primary, s.Accent, s.BG} {
				myui.Box(c).Size(16, 16).Radius(5).Draw(func(p *myui.Painter, r myui.Rect) {
					p.Fill(r, colOf(hex), 5)
				})
			}
		})
		myui.Column(c).Grow(1).Gap(1).Children(func() {
			myui.Text(c, s.Name).FontSize(13).TextColor(t.Text)
			myui.Text(c, "@"+s.Author).FontSize(11).TextColor(t.TextMuted)
		})
		if active {
			myui.Text(c, "✓").FontSize(14).TextColor(t.Accent)
		}
	})
	e.OnClick(func() { a.SetSkin(s.ID) })
	return e
}

// aboutPanel shows app information and the update controls.
func aboutPanel(c *myui.Context, a *app.App) {
	t := c.Theme()
	myui.Column(c).Fill().Gap(6).Children(func() {
		myui.Text(c, "悠悠乐听").FontSize(18).Bold().TextColor(t.Text)
		myui.Text(c, "一个用 Go 与原生 UI 打造的音乐播放器。").FontSize(12).TextColor(t.TextMuted)
		myui.Divider(c)
		myui.Text(c, "· 6 种实时音频可视化\n· 10 段参数均衡器与预设\n· 玻璃拟态主题\n· 本地音乐库与全局快捷键\n· 原生 GPU 绘制，无 WebView\n· 支持 WAV / MP3 / FLAC / OGG").
			FontSize(12).TextColor(t.Text)
		myui.Divider(c)
		updateSection(c, a)
	})
}

// updateSection renders the self-update controls and the current state.
func updateSection(c *myui.Context, a *app.App) {
	t := c.Theme()
	st := a.Updater.State()

	myui.Text(c, "版本").FontSize(13).Bold().TextColor(t.Text)
	myui.Text(c, "当前版本 "+mygo.App.Version()).FontSize(12).TextColor(t.TextMuted)

	if !a.Updater.Enabled() {
		myui.Text(c, "此构建未启用自动更新（开发版）").FontSize(12).TextColor(t.TextMuted)
		return
	}

	switch {
	case st.Installing:
		label := "正在下载更新…"
		if st.Progress >= 0 {
			label = fmt.Sprintf("正在下载更新… %d%%", int(st.Progress*100))
		}
		myui.Text(c, label).FontSize(12).TextColor(t.Text)
		if st.Progress >= 0 {
			myui.Progress(c, st.Progress).Fill().Height(6)
		}

	case st.Installed:
		myui.Text(c, "更新已就绪，重启后生效。").FontSize(12).TextColor(t.Success)
		rb := myui.Button(c.Key("relaunch"), "立即重启")
		rb.OnClick(func() { a.Updater.Relaunch() })

	case st.Available != nil:
		myui.Text(c, "发现新版本 "+st.Available.Version).FontSize(13).Bold().TextColor(t.Text)
		if st.Available.Notes != "" {
			myui.Text(c, st.Available.Notes).FontSize(11).TextColor(t.TextMuted)
		}
		btn := myui.PrimaryButton(c.Key("install-update"), "下载并安装")
		btn.OnClick(func() { a.Updater.InstallAsync() })

	case st.Checking:
		myui.Text(c, "正在检查更新…").FontSize(12).TextColor(t.TextMuted)

	default:
		if st.Error != "" {
			myui.Text(c, "检查失败: "+st.Error).FontSize(11).TextColor(t.Danger)
		} else if !st.LastChecked.IsZero() {
			myui.Text(c, "已是最新版本").FontSize(12).TextColor(t.TextMuted)
		}
		cb := myui.Button(c.Key("check-update"), "检查更新")
		cb.OnClick(func() { a.Updater.CheckAsync(true) })
	}
}

// TriggerImport opens a native file dialog and adds the chosen audio to the
// library. Safe to call from the UI or a menu click on the main thread.
func TriggerImport(a *app.App) {
	paths, err := mygo.Dialog.Open(mygo.OpenDialogOptions{
		Title:    "导入音乐",
		Multiple: true,
		Filters: []mygo.FileFilter{
			// Only advertise what Decode actually handles; claiming more
			// leads to tracks that cannot be played. AAC/M4A/Opus need a
			// pure-Go decoder that does not exist yet (all bind fdk-aac
			// through cgo, which mygo forbids).
			{Name: "音频文件 (WAV / MP3 / FLAC / OGG)", Extensions: []string{"wav", "mp3", "flac", "ogg"}},
			{Name: "所有文件", Extensions: []string{"*"}},
		},
	})
	if err != nil {
		a.State.PushError("导入失败: " + err.Error())
		return
	}
	if len(paths) == 0 {
		return
	}
	if errs := a.ImportPaths(paths); len(errs) > 0 {
		for _, e := range errs {
			a.State.PushError(e.Error())
		}
	}
}

// vizLast is when the previous visualiser frame ran, for computing dt.
var vizLast time.Time
