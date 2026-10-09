// Package ui builds the native (GPU-drawn) interface for YoYoMusic with the
// mygo ui package. It is named "ui" but imports the framework as myui to avoid
// a name clash with github.com/egoist/mygo/ui.
package ui

import (
	"fmt"
	"path/filepath"
	"time"

	"yoyomusic/internal/app"

	"github.com/egoist/mygo"
	myui "github.com/egoist/mygo/ui"
)

// View returns the window view function bound to the app orchestrator.
func View(a *app.App) func(c *myui.Context) {
	return func(c *myui.Context) {
		skin := a.CurrentSkin()
		c.SetTheme(skinTheme(skin))

		// Keep the window redrawing while playing (transport + clock); when
		// paused the visualiser canvas still repaints itself via
		// Painter.AnimationFrame, so a cheap 25fps rebuild is enough.
		if a.IsPlaying() {
			c.AnimationFrame()
		} else {
			c.After(40 * time.Millisecond)
		}
		// Space toggles playback while the window is focused.
		if c.Shortcut(0, myui.KeySpace) {
			a.TogglePlay()
		}

		// Row() centers its children on the cross axis by default; the
		// three columns must stretch to the full window height instead.
		myui.Row(c).Fill().AlignItems(myui.Stretch).Children(func() {
			sidebar(c, a, skin)
			myui.Column(c).Grow(1).FillHeight().Children(func() {
				topBar(c, a, skin)
				visualizerHost(c, a, skin)
				transport(c, a, skin)
			})
			rightPanel(c, a, skin)
		})
	}
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
	return t
}

// sidebar holds the brand, navigation and the import button.
func sidebar(c *myui.Context, a *app.App, skin app.Skin) myui.Element {
	t := c.Theme()
	return myui.Column(c).Width(220).FillHeight().Background(t.Background).Padding(16, 12).Gap(6).Children(func() {
		myui.Row(c).Gap(8).AlignItems(myui.Center).Children(func() {
			myui.Box(c).Size(22, 22).Radius(11).Draw(func(p *myui.Painter, r myui.Rect) {
				p.Fill(r, colOf(skin.Primary).Mix(colOf(skin.Accent), 0.5), 11)
			})
			myui.Text(c, "悠悠乐听").FontSize(18).Bold().TextColor(t.Text)
		})
		myui.Text(c, "原生音乐播放器").FontSize(11).TextColor(t.TextMuted).Margin(0, 0, 4, 0)
		myui.Divider(c).Margin(6, 0, 8, 0)
		navItem(c, a, "library", "音乐库")
		navItem(c, a, "eq", "均衡器")
		navItem(c, a, "lyrics", "歌词")
		navItem(c, a, "skins", "外观")
		navItem(c, a, "about", "关于")
		myui.Box(c).Grow(1)
		imp := myui.Button(c.Key("import"), "导入音乐…").Width(196)
		imp.OnClick(func() { TriggerImport(a) })
	})
}

// navItem is a clickable sidebar entry that selects the main panel.
func navItem(c *myui.Context, a *app.App, id, label string) myui.Element {
	t := c.Theme()
	active := a.Panel == id
	txt := t.Text
	if active {
		txt = t.Accent
	}
	e := myui.Box(c).Key(id).Padding(8, 10).Radius(8)
	if active {
		e = e.Background(t.Accent.Alpha(0.18))
	}
	e.Children(func() {
		myui.Text(c, label).FontSize(14).TextColor(txt)
	})
	e.OnClick(func() { a.SetPanel(id) })
	return e
}

// topBar shows the current track and the visualiser-mode selector.
func topBar(c *myui.Context, a *app.App, skin app.Skin) myui.Element {
	t := c.Theme()
	snap := a.Snapshot()
	cur := snap.Current
	return myui.Row(c).Height(92).Padding(16, 16).Gap(14).AlignItems(myui.Center).Children(func() {
		coverArt(c, cur, skin)
		myui.Column(c).Grow(1).Gap(6).Children(func() {
			if cur == nil {
				myui.Text(c, "尚未播放").FontSize(18).Bold().TextColor(t.Text)
				myui.Text(c, "从右侧导入或选择音乐开始播放").FontSize(12).TextColor(t.TextMuted)
			} else {
				myui.Text(c, cur.Title).FontSize(18).Bold().TextColor(t.Text)
				myui.Text(c, cur.Artist+" · "+cur.Album).FontSize(12).TextColor(t.TextMuted)
			}
			tabs := myui.Tabs(c, &a.VizMode, "频谱", "波形", "径向", "粒子", "极光", "瀑布").Gap(4)
			if tabs.Changed() {
				a.SetVisualization(app.VizOrder[a.VizMode])
			}
		})
		// Errors are pushed to state by import and playback failures; without
		// this the user clicks a track and nothing at all appears to happen.
		if errs := a.State.Errors(); len(errs) > 0 {
			last := errs[len(errs)-1]
			myui.Box(c).MaxWidth(300).Padding(8, 10).Radius(8).Background(t.Danger.Alpha(0.16)).
				Border(1, t.Danger.Alpha(0.4)).Radius(8).Children(func() {
				myui.Text(c, "⚠ "+last).FontSize(11).TextColor(t.Text)
			})
		}
	})
}

// coverArt is a gradient tile standing in for album art.
func coverArt(c *myui.Context, cur *app.Track, skin app.Skin) myui.Element {
	return myui.Box(c).Size(64, 64).Radius(12).Draw(func(p *myui.Painter, r myui.Rect) {
		g := myui.LinearGradient{From: colOf(skin.Primary), To: colOf(skin.Accent), Angle: 135}
		p.FillGradient(r, g, 12)
		p.Text(r.X+10, r.Y+40, "♪", 22, colOf(skin.VizInk).Alpha(0.85))
	})
}

// visualizerHost is the central animated canvas.
func visualizerHost(c *myui.Context, a *app.App, skin app.Skin) myui.Element {
	return myui.Box(c).Grow(1).Margin(16, 16, 0, 16).Radius(16).Draw(func(p *myui.Painter, r myui.Rect) {
		bg := colOf(skin.BG).Mix(colOf(skin.Surface), 0.4)
		p.Fill(r, bg, 16)
		p.Clip(r, 16, func() {
			f := a.Frame()
			// dt drives every stateful effect (peak fall, rotation,
			// particle motion, waterfall scroll). Deriving it from the
			// painter's clock keeps them frame-rate independent.
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
		p.Stroke(r, colOf(skin.Primary).Alpha(0.25), 16, 1)
		p.AnimationFrame()
	})
}

// vizLast is when the previous visualiser frame ran, for computing dt.
var vizLast time.Time

// transport holds the seek bar, play controls, time and volume.
func transport(c *myui.Context, a *app.App, skin app.Skin) myui.Element {
	t := c.Theme()
	pos := a.PositionMs()
	dur := a.DurationMs()
	return myui.Column(c).Height(96).Padding(10, 18).Gap(10).Children(func() {
		seekBar(c, a, skin, pos, dur)
		myui.Row(c).Height(40).AlignItems(myui.Center).Justify(myui.Center).Gap(18).Children(func() {
			ctrlBtn(c, "⏮", false, func() { a.Prev() })
			if a.IsPlaying() {
				ctrlBtn(c, "⏸", true, func() { a.TogglePlay() })
			} else {
				ctrlBtn(c, "▶", true, func() { a.TogglePlay() })
			}
			ctrlBtn(c, "⏭", false, func() { a.Next() })
			myui.Text(c, fmt.Sprintf("%s / %s", app.FmtTime(pos), app.FmtTime(dur))).
				FontSize(12).TextColor(t.TextMuted)
			myui.Box(c).Grow(1)
			muteBtn(c, a, t)
			vol := myui.Slider(c, &a.Volume, 0, 1).Width(120)
			vol.OnChange(func() { a.SetVolume(a.Volume) })
		})
	})
}

// muteBtn is the speaker button: one click toggles mute, and the glyph shows
// the current state (muted, low, normal, loud) the way desktop players do.
// A separate switch next to the slider was confusing, so the icon itself is
// the control.
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

// ctrlBtn is a round-ish transport button.
func ctrlBtn(c *myui.Context, glyph string, primary bool, on func()) myui.Element {
	var b myui.Element
	if primary {
		b = myui.PrimaryButton(c, glyph)
	} else {
		b = myui.Button(c, glyph)
	}
	b.Width(46).Height(40).OnClick(on)
	return b
}

// seekBar is a click-to-seek progress bar with a larger hit area.
func seekBar(c *myui.Context, a *app.App, skin app.Skin, pos, dur int64) myui.Element {
	t := c.Theme()
	frac := float32(0)
	if dur > 0 {
		frac = float32(pos) / float32(dur)
	}
	el := myui.Box(c).Height(20).Margin(2, 0, 2, 0).Draw(func(p *myui.Painter, r myui.Rect) {
		rr := r
		rr.Y += 5
		rr.H -= 10
		p.Fill(rr, t.Surface, 5)
		fw := rr.W * frac
		if fw > 0 {
			pr := rr
			pr.W = fw
			p.Fill(pr, colOf(skin.Primary), 5)
		}
		tx := rr.X + fw
		p.Fill(myui.Rect{X: tx - 6, Y: rr.Y - 3, W: 12, H: rr.H + 6}, colOf(skin.Accent), 6)
		p.AnimationFrame()
	})
	el.OnClick(func() {
		x, _, over := el.PointerPosition()
		b := el.Bounds()
		if !over || b.W <= 0 {
			return
		}
		f := x / b.W
		if f < 0 {
			f = 0
		}
		if f > 1 {
			f = 1
		}
		a.SeekMs(int64(f * float32(dur)))
	})
	return el
}

// rightPanel switches the side panel by the selected nav entry.
func rightPanel(c *myui.Context, a *app.App, skin app.Skin) myui.Element {
	t := c.Theme()
	return myui.Column(c).Width(340).FillHeight().Background(t.Surface).Children(func() {
		switch a.Panel {
		case "eq":
			eqPanel(c, a, skin)
		case "lyrics":
			lyricsPanel(c, a, skin)
		case "skins":
			skinsPanel(c, a, skin)
		case "about":
			aboutPanel(c, a, skin)
		default:
			libraryPanel(c, a, skin)
		}
	})
}

// headerRow is a section title with an optional right-aligned subtitle.
func headerRow(c *myui.Context, title, sub string) myui.Element {
	t := c.Theme()
	return myui.Row(c).Padding(16, 14, 16, 10).AlignItems(myui.Center).Justify(myui.SpaceBetween).Children(func() {
		myui.Text(c, title).FontSize(16).Bold().TextColor(t.Text)
		if sub != "" {
			myui.Text(c, sub).FontSize(11).TextColor(t.TextMuted)
		}
	})
}

// libraryPanel lists the imported tracks.
func libraryPanel(c *myui.Context, a *app.App, skin app.Skin) myui.Element {
	snap := a.Snapshot()
	return myui.Column(c).Fill().Children(func() {
		headerRow(c, "音乐库", fmt.Sprintf("%d 首", len(snap.Tracks)))
		myui.Scroll(c).Fill().Children(func() {
			if len(snap.Tracks) == 0 {
				myui.Text(c, "还没有音乐。\n点击左侧“导入音乐…”选择文件或文件夹。").
					FontSize(13).TextColor(c.Theme().TextMuted).Padding(16, 12)
				return
			}
			for i, tr := range snap.Tracks {
				trackRow(c, a, tr, snap.Current, i)
			}
		})
	})
}

// trackRow is one selectable track in the library list.
func trackRow(c *myui.Context, a *app.App, tr *app.Track, cur *app.Track, index int) myui.Element {
	t := c.Theme()
	active := cur != nil && cur.ID == tr.ID
	// Unplayable tracks are shown dimmed with a marker; clicking explains why
	// instead of silently doing nothing.
	bad := tr.Status == app.TrackBad || tr.Status == app.TrackMissing
	e := myui.Row(c).Key(tr.ID).Padding(8, 8).Gap(10).AlignItems(myui.Center).Radius(8)
	if active {
		e = e.Background(t.Accent.Alpha(0.16))
	}
	e.Children(func() {
		myui.Box(c).Size(36, 36).Radius(8).Background(t.Background).AlignItems(myui.Center).Justify(myui.Center).
			Children(func() {
				myui.Text(c, fmt.Sprintf("%d", index+1)).FontSize(12).TextColor(t.TextMuted)
			})
		myui.Column(c).Grow(1).Gap(2).Children(func() {
			titleColor := t.Text
			metaColor := t.TextMuted
			if bad {
				titleColor = t.TextMuted
			}
			myui.Text(c, tr.Title).FontSize(13).TextColor(titleColor)
			artistLine := tr.Artist
			if tr.Status == app.TrackBad {
				artistLine += " · 格式不支持"
			} else if tr.Status == app.TrackMissing {
				artistLine += " · 文件缺失"
			}
			myui.Text(c, artistLine).FontSize(11).TextColor(metaColor)
		})
		myui.Text(c, app.FmtTime(tr.DurationMs)).FontSize(11).TextColor(t.TextMuted)
	})
	e.OnClick(func() {
		if tr.Status == app.TrackBad {
			a.State.PushError("暂不支持 " + filepath.Ext(tr.FilePath) + " 格式（支持 WAV / MP3 / FLAC / OGG）")
			return
		}
		if tr.Status == app.TrackMissing {
			a.State.PushError("文件不存在: " + tr.FilePath)
			return
		}
		a.PlayTrack(tr.ID)
	})
	return e
}

// eqPanel is the ten-band equaliser with presets and an enable switch.
func eqPanel(c *myui.Context, a *app.App, skin app.Skin) myui.Element {
	t := c.Theme()
	freqs := []string{"31", "62", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"}
	presetNames := map[string]string{
		"flat": "平直", "rock": "摇滚", "pop": "流行", "classical": "古典",
		"bass": "重低音", "vocal": "人声", "treble": "高音",
	}
	return myui.Scroll(c).Fill().Padding(16, 12).Gap(10).Children(func() {
		headerRow(c, "均衡器", "")
		myui.Row(c).Gap(10).AlignItems(myui.Center).Children(func() {
			myui.Text(c, "启用").FontSize(14).TextColor(t.Text)
			en := myui.Switch(c, &a.EQEnabled)
			if en.Changed() {
				a.SetEQEnabled(a.EQEnabled)
			}
		})
		myui.Row(c).Gap(6).Wrap().Children(func() {
			for _, name := range a.EQPresets() {
				label := name
				if zh, ok := presetNames[name]; ok {
					label = zh
				}
				b := myui.Button(c.Key("preset-"+name), label)
				b.OnClick(func() { a.SetEQPreset(name) })
			}
		})
		myui.Divider(c).Margin(6, 0, 6, 0)
		for i := 0; i < 10; i++ {
			idx := i
			myui.Row(c).Gap(10).AlignItems(myui.Center).Children(func() {
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
	snap := a.Snapshot()
	return myui.Column(c).Fill().Gap(0).Children(func() {
		headerRow(c, "歌词", "")
		myui.Scroll(c).Fill().Padding(16, 8).Children(func() {
			if snap.Current == nil {
				myui.Text(c, "播放一首歌，歌词会显示在这里。").FontSize(13).TextColor(t.TextMuted)
				return
			}
			if snap.Current.LyricsRef == "" {
				myui.Text(c, "当前音频未包含内嵌歌词。").FontSize(13).TextColor(t.TextMuted)
				return
			}
			myui.Text(c, snap.Current.Title+"\n\n"+"(内嵌歌词)").FontSize(14).TextColor(t.Text)
		})
	})
}

// skinsPanel lets the user pick a glassmorphism theme.
func skinsPanel(c *myui.Context, a *app.App, skin app.Skin) myui.Element {
	return myui.Column(c).Fill().Children(func() {
		headerRow(c, "外观", "")
		myui.Scroll(c).Fill().Padding(12, 8).Gap(8).Children(func() {
			cur := a.CurrentSkin().ID
			for _, s := range a.Skins() {
				skinCard(c, a, s, cur)
			}
		})
	})
}

// skinCard is one selectable theme row with colour swatches.
func skinCard(c *myui.Context, a *app.App, s app.Skin, cur string) myui.Element {
	t := c.Theme()
	active := s.ID == cur
	e := myui.Row(c).Key(s.ID).Padding(10, 10).Gap(10).AlignItems(myui.Center).Radius(10)
	if active {
		e = e.Background(t.Accent.Alpha(0.16))
	}
	e.Children(func() {
		myui.Row(c).Gap(4).Children(func() {
			for _, hex := range []string{s.Primary, s.Accent, s.BG} {
				myui.Box(c).Size(18, 18).Radius(6).Draw(func(p *myui.Painter, r myui.Rect) {
					p.Fill(r, colOf(hex), 6)
				})
			}
		})
		myui.Column(c).Grow(1).Gap(2).Children(func() {
			myui.Text(c, s.Name).FontSize(14).TextColor(t.Text)
			myui.Text(c, "@"+s.Author).FontSize(11).TextColor(t.TextMuted)
		})
		if active {
			myui.Text(c, "●").FontSize(12).TextColor(t.Accent)
		}
	})
	e.OnClick(func() { a.SetSkin(s.ID) })
	return e
}

// aboutPanel shows app information and the update controls.
func aboutPanel(c *myui.Context, a *app.App, skin app.Skin) myui.Element {
	t := c.Theme()
	return myui.Column(c).Fill().Gap(6).Padding(16, 12).Children(func() {
		headerRow(c, "关于", "")
		myui.Text(c, "悠悠乐听").FontSize(20).Bold().TextColor(t.Text)
		myui.Text(c, "一个用 Go 与原生 UI 打造的音乐播放器。").FontSize(13).TextColor(t.TextMuted)
		myui.Divider(c).Margin(8, 0, 8, 0)
		myui.Text(c, "· 6 种实时音频可视化\n· 10 段参数均衡器与预设\n· 玻璃拟态主题\n· 本地音乐库与全局快捷键\n· 原生 GPU 绘制，无 WebView\n· 支持 WAV / MP3 / FLAC / OGG").
			FontSize(13).TextColor(t.Text)
		myui.Divider(c).Margin(8, 0, 8, 0)
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
		// Development builds carry no update feed; saying so avoids the user
		// hunting for a button that cannot work.
		myui.Text(c, "此构建未启用自动更新（开发版）").FontSize(12).TextColor(t.TextMuted)
		return
	}

	switch {
	case st.Installing:
		pct := int(st.Progress * 100)
		if st.Progress < 0 {
			pct = -1
		}
		label := "正在下载更新…"
		if pct >= 0 {
			label = fmt.Sprintf("正在下载更新… %d%%", pct)
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
	a.SetPanel("library")
}
