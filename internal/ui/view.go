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
	"runtime"
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
		// Drive the automatic visualiser rotation from the frame clock, so
		// the backdrop switches at random intervals when random mode is on.
		a.TickVizRandom(c.Now())
		if c.Shortcut(0, myui.KeySpace) {
			a.TogglePlay()
		}

		// The root is a plain Box filling the window, so the layers below can
		// be positioned over the visualiser instead of beside it. It is also
		// the window's drag handle: a press anywhere that does not land on
		// a control moves the window, which is what frameless-style chrome
		// asks for. Descendants that are interactive — buttons, sliders,
		// rows — take the press first and work as usual, because the input
		// engine picks the innermost interactive element in the hit chain.
		root := myui.Box(c).Fill().DragWindow()
		trackPointer(root, c, a)
		root.Children(func() {
			// Layer 1: the visualiser, absolutely positioned so it fills the
			// window without taking part in the column's flow. A second
			// Fill() child here would split the column's height between the
			// two layers — measured at 227px each in a 681px window — and
			// push the whole chrome into the middle of the screen.
			//
			// Its insets keep it off the chrome: it starts under the toolbar
			// and stops just above the transport, so nothing is drawn where
			// the opaque bars cover it anyway. Insetting from the bottom by
			// the whole transport height would leave a dead band between the
			// spectrum and the seek bar, so the visualiser reaches down into
			// the transport's own upper padding instead.
			backdrop := myui.Box(c).Absolute().
				Left(0).Top(topBarH).Right(0).Bottom(transportH - vizDeckInset)
			backdrop.Children(func() { visualizerBackdrop(c, a, skin) })

			// Layer 2: the chrome. It must ALSO be absolute: mygo paints all
			// flow children before any absolute child (paint.go paints
			// e.first twice, split by flagAbsolute), so a flow chrome here
			// lands UNDER the backdrop and the toolbar and transport vanish
			// behind the visualiser. Among absolute children the declaration
			// order holds, so declaring it after the backdrop keeps it on top.
			myui.Column(c).Absolute().Left(0).Top(0).Right(0).Bottom(0).Children(func() {
				topBar(c, a, skin)
				myui.Box(c).Grow(1)
				transport(c, a, skin)
			})

			// Layer 3: the two side panels, absolutely positioned so they
			// float over the visualiser rather than squeezing it. They sit
			// below the toolbar and above the transport by inset, and paint
			// above the chrome because they are declared after it.
			leftRail(c, a, skin)
			rightRail(c, a, skin)
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
func trackPointer(root myui.Element, c *myui.Context, a *app.App) {
	x, y, over := root.PointerPosition()
	if !over {
		// The pointer left the window: start the fold from now, so the
		// columns do not stay open while the user is elsewhere.
		if layout.hadPointer {
			layout.lastMove = c.Now()
			layout.hadPointer = false
		}
		// Hide the playlist when the pointer leaves the window unless the
		// user pinned it open: a hover panel should not linger over the
		// visualiser once the cursor is gone.
		if !a.LibraryPinned && a.LibraryOpen {
			a.LibraryOpen = false
			a.LibraryPinned = false
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
			case app.VizGenerative:
				drawGenerative(p, r, f, skin, dt)
			case app.VizKaleido:
				drawKaleidoscope(p, r, f, skin, dt)
			case app.VizPiano:
				drawPiano(p, r, f, skin, dt)
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
// toggle, the visualiser mode picker and the feature-panel icons.
//
// macOS differs in one respect: its window controls — the traffic lights —
// sit at the top-left, so the app name moves to the right-hand end of the
// bar instead of sharing that corner with them. The playlist toggle stays
// on the left either way, next to the column it folds.
func topBar(c *myui.Context, a *app.App, skin app.Skin) myui.Element {
	t := c.Theme()
	bar := c.TitleBar()
	// macOS keeps its window controls on the left; Windows and Linux keep
	// them on the right. Which end is taken decides where the name goes.
	mac := runtime.GOOS == "darwin"

	return myui.Row(c).Height(52).Padding(12, 14).Gap(10).AlignItems(myui.Center).
		Background(t.Surface.Alpha(0.82)).DragWindow().Children(func() {
		// Reserve the room the OS keeps for its window controls when the
		// native title bar is hidden (traffic lights on macOS, the button
		// cluster on Windows/Linux), so our icons never sit under them.
		if bar.Left > 0 {
			myui.Box(c).Width(float32(bar.Left))
		}

		if mac {
			// Left: only the playlist toggle, beside the traffic lights.
			libraryToggleButton(c, a)
		} else {
			// Left: brand plus the playlist fold toggle.
			myui.Row(c).Gap(8).AlignItems(myui.Center).Children(func() {
				brandBadge(c, skin, t)
				libraryToggleButton(c, a)
			})
		}

		myui.Box(c).Grow(1)

		// Centre: the visualiser mode picker. Eight modes do not fit as
		// labels, so it is a compact row of buttons with tooltips, carrying
		// the same information as the old build's mode strip. The random
		// toggle folds into this same cluster.
		vizModePicker(c, a)

		myui.Box(c).Grow(1)

		// Right: the feature-panel icons, each toggling its panel.
		sidePanelIcons(c, a, t)

		if mac {
			// Right end: the app name, clear of the traffic lights.
			brandBadge(c, skin, t)
		}

		if bar.Right > 0 {
			myui.Box(c).Width(float32(bar.Right))
		}
	})
}

// brandBadge is the gradient mark plus the app name.
func brandBadge(c *myui.Context, skin app.Skin, t *myui.Theme) {
	myui.Row(c).Gap(8).AlignItems(myui.Center).Children(func() {
		myui.Box(c).Size(22, 22).Radius(11).Draw(func(p *myui.Painter, r myui.Rect) {
			p.FillGradient(r, myui.LinearGradient{
				From: colOf(skin.Primary), To: colOf(skin.Accent), Angle: 135,
			}, 11)
		})
		myui.Text(c, "悠悠乐听").FontSize(16).Bold().TextColor(t.Text)
	})
}

// libraryToggleButton is the playlist fold/unpin toggle.
func libraryToggleButton(c *myui.Context, a *app.App) {
	lb := iconButton(c, "library-toggle", "playlist", playlistTip(a))
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
}

// sidePanelIcons is the row of feature-panel toggles.
func sidePanelIcons(c *myui.Context, a *app.App, t *myui.Theme) {
	for _, p := range app.SidePanels {
		panel := p
		label := sidePanelLabel(panel)
		b := iconButton(c, "panel-"+panel, sidePanelIcon(panel), label)
		if a.SidePanel == panel {
			b.Background(t.Accent.Alpha(0.22))
		}
		b.Size(32, 32).Radius(8).OnClick(func() { a.ToggleSidePanel(panel) })
	}
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

// The mode picker's geometry. vizPickerWidth is the room it keeps in the top
// bar whether it is folded or open, vizItemSize and vizFanStep are one mode
// button and the pitch of one button plus the gap after it, and vizFanLeft is
// how many of the other modes sit on the left of the face.
//
// With nine modes the face fans four to each side, and the random-rotation
// toggle hangs one pitch beyond the leftmost mode — ten items in all. The face
// therefore sits at (vizFanLeft+1) pitches from the left edge, and the row is
// exactly that span (five right of the face plus the face width).
const (
	vizPickerWidth float32 = 307
	vizItemSize    float32 = 28
	vizFanStep     float32 = 31
	vizFanLeft             = 4
)

// vizFaceX is where the face sits: (vizFanLeft+1) pitches from the left edge,
// so the random toggle at k=-(vizFanLeft+1) lands exactly at x=0 and the
// rightmost mode at k=+4 ends at vizPickerWidth.
func vizFaceX() float32 { return float32(vizFanLeft+1) * vizFanStep }

// vizSlide is the transition a mode button enters and leaves with. d is signed
// how far the button's slot is from the face, so the motion runs along the row:
// the button starts at the face and slides out to its slot, fading in as it
// goes, and slides back into the face on the way out.
//
// Collapse is deliberately not set: the buttons are absolute, so they take no
// room either way, and a collapsing button would be wiped out from the side as
// well as slid, which reads as a glitch rather than a fold.
func vizSlide(d float32) myui.ElementTransition {
	return myui.ElementTransition{
		Duration: 180 * time.Millisecond,
		Enter:    &myui.Motion{X: -d, Opacity: 0},
		Exit:     &myui.Motion{X: -d, Opacity: 0},
	}
}

// vizModePicker is the visualiser-mode picker in the top bar: folded it is the
// single icon of the mode in use, and the pointer unfolds the rest of the modes
// around it, folds them back when it leaves.
//
// Every mode button — the face included — is absolutely positioned, which is
// what keeps the eight of them the same size and on one line. An earlier
// version kept the face in flow and hung the other seven off the row; the
// face then measured 55 wide while the other seven measured 32, because a
// flow child's width is its flex base (hyp = max(minMain, …)) while an
// absolute child's is the width it was given outright, and Button's own
// Padding(t.Space(1.5), t.Space(3.5)) pushed the face's intrinsic minimum past
// its 28. Absolute placement sidesteps the flex maths entirely.
//
// The row itself is always vizPickerWidth wide, open or folded, and centres
// the face. It has to be: a row that grew with its contents would be
// re-centred by the two Grow() spacers around it as they took back the room,
// sliding the icon out from under the cursor the moment it was hovered — and
// since the folded row is what opens it, the picker would flicker open and
// shut. That does mean the picker answers the pointer across its whole width
// even when folded, which is a little eager, but the alternative is the
// flicker.
//
// The face carries no transition. A transition works in the parent's
// coordinates, so a face animating from its folded offset to its place among
// the open modes would be dragged across the bar by a move the layout had
// already made.
//
// Eight names would not fit as labels, so each mode is an icon button with a
// tooltip carrying the full name, and the active one is highlighted instead of
// spelled out.
func vizModePicker(c *myui.Context, a *app.App) {
	t := c.Theme()
	active := app.VizOrder[a.VizMode]

	row := myui.Row(c).Width(vizPickerWidth).Height(vizItemSize)
	open := row.Hovered()

	row.Children(func() {
		// The face: the mode in use, always in the same place, and the one
		// control that is there whether the picker is open or folded.
		face := iconButton(c, "viz-face", vizIcon(active), vizLabel(active))
		face.Absolute().Top(0).Left(vizFaceX()).
			Size(vizItemSize, vizItemSize).Radius(7).
			Background(t.Accent.Alpha(0.22)).
			OnClick(func() { a.SetVisualization(active) })

		if !open {
			return
		}

		// The other modes unfold around the face, four to its right and three
		// to its left, in the order they are listed. Keeping the slots fixed
		// and folding the active mode out of the list — rather than putting
		// the active mode first — means the row does not renumber itself
		// every time the mode changes.
		slot := 0
		for _, m := range app.VizOrder {
			mode := m
			if mode == active {
				continue
			}
			var k float32
			if slot < vizFanLeft {
				k = float32(slot - vizFanLeft)
			} else {
				k = float32(slot - vizFanLeft + 1)
			}
			slot++
			// Slots sit whole pitches from the face: the face anchors the
			// centre and the other modes clear it by the 3 px gap, so every
			// pitch on the row reads the same. A half-pitch offset here put
			// the first button to the right on top of the face.
			d := k * vizFanStep

			b := iconButton(c, "viz-"+string(mode), vizIcon(mode), vizLabel(mode))
			b.Absolute().Top(0).Left(vizFaceX()+d).
				Size(vizItemSize, vizItemSize).Radius(7).
				OnClick(func() { a.SetVisualization(mode) }).
				Transition(vizSlide(d))
		}

		// The random-rotation toggle folds into the cluster one pitch to the
		// left of the leftmost mode, so it opens and closes with the picker
		// instead of living as a separate always-on button. Placing it there
		// also balances the fan: four items sit on each side of the face.
		rd := float32(-(vizFanLeft + 1)) * vizFanStep
		rndTip := "随机切换可视化：关"
		if a.VizRandom {
			rndTip = "随机切换可视化：开"
		}
		rnd := iconButton(c, "viz-random", "shuffle", rndTip)
		rnd.Absolute().Top(0).Left(vizFaceX()+rd).
			Size(vizItemSize, vizItemSize).Radius(7)
		if a.VizRandom {
			rnd.Background(t.Accent.Alpha(0.22))
		}
		rnd.OnClick(func() { a.SetVizRandom(!a.VizRandom) }).
			Transition(vizSlide(rd))
	})
}

// vizLabel is the display name of a visualiser mode, or its id if it has none.
func vizLabel(m app.VisualizationMode) string {
	if s := app.VizLabels[m]; s != "" {
		return s
	}
	return string(m)
}

// vizIcon maps a visualiser mode to its icon name.
func vizIcon(m app.VisualizationMode) string {
	switch m {
	case app.VizSpectrum:
		return "viz-spectrum"
	case app.VizWaveform:
		return "viz-waveform"
	case app.VizRadial:
		return "viz-radial"
	case app.VizAurora:
		return "viz-aurora"
	case app.VizParticles:
		return "viz-particles"
	case app.VizWaterfall:
		return "viz-waterfall"
	case app.VizGenerative:
		return "viz-generative"
	case app.VizKaleido:
		return "viz-kaleido"
	case app.VizPiano:
		return "viz-piano"
	}
	return ""
}

func sidePanelLabel(p string) string {
	switch p {
	case "eq":
		return "均衡器"
	case "lyrics":
		return "歌词"
	case "history":
		return "最近播放"
	case "skins":
		return "外观"
	case "about":
		return "关于"
	}
	return p
}

// sidePanelIcon maps a panel id to its SVG icon name.
func sidePanelIcon(p string) string {
	switch p {
	case "eq":
		return "eq"
	case "lyrics":
		return "lyrics"
	case "history":
		return "history"
	case "skins":
		return "skins"
	case "about":
		return "about"
	}
	return ""
}

// Layout insets, in DIPs. The rails float between the toolbar and the
// transport, so they are inset by those two heights rather than by the
// layout's flow.
const (
	topBarH    = 52
	transportH = 92 // seek bar plus the deck

	// vizDeckInset is how far the visualiser's floor sits above the window
	// bottom. It is less than the transport height on purpose: the seek bar
	// occupies the top of the transport, so the spectrum may run down into
	// the deck's padding and still clear the bar. Insetting by the whole
	// transport height would leave a dead band between the two.
	vizDeckInset = 34
)

// leftRail is the playlist column: a floating panel when open, a slim icon
// rail when folded. Absolutely positioned so it floats over the visualiser.
func leftRail(c *myui.Context, a *app.App, skin app.Skin) {
	// The playlist toggle already lives in the top bar, so the folded rail
	// would only duplicate it — draw nothing when the column is not open.
	if idleFolded(a.LibraryPinned) || !a.LibraryOpen {
		return
	}
	panel := myui.Box(c).Absolute().Left(12).Top(topBarH + 8).
		Bottom(transportH + 8).Width(268)
	panel.Children(func() {
		playlistPanel(c, a, skin)
	})
}

// rightRail is the feature column: the open panel when expanded, otherwise
// nothing at all — the top-bar icons are the only affordance. Also absolutely
// positioned, floating over the visualiser.
func rightRail(c *myui.Context, a *app.App, skin app.Skin) {
	if a.SidePanel == "" {
		return
	}
	if idleFolded(a.SidePanelSticky()) {
		// Folded: the panel is not drawn; the top-bar icons remain.
		return
	}
	panel := myui.Box(c).Absolute().Right(12).Top(topBarH + 8).
		Bottom(transportH + 8).Width(300)
	panel.Children(func() { sidePanel(c, a, skin) })
}

// transport is the full-width bottom bar: cover art, track information, the
// seek bar, the transport buttons and the volume controls.
func transport(c *myui.Context, a *app.App, skin app.Skin) myui.Element {
	t := c.Theme()
	pos := a.PositionMs()
	dur := a.DurationMs()
	snap := a.Snapshot()
	cur := snap.Current

	// Fixed height, not Fill(): Fill would let the seek slider's own stretch
	// claim the whole window, which is how the transport ended up 629px tall
	// and swallowed the visualiser.
	return myui.Column(c).Height(transportH).Children(func() {
		seekBar(c, a, skin, pos, dur)
		myui.Row(c).Grow(1).Padding(10, 16).Gap(14).AlignItems(myui.Center).Children(func() {
			transportNowPlaying(c, a, skin, cur)
			myui.Box(c).Grow(1)
			transportButtons(c, a, skin, t, snap.Playback.PlayMode)
			myui.Box(c).Grow(1)
			transportUtility(c, a, t)
		})
	})
}

// transportNowPlaying is the cover art plus title and artist.
func transportNowPlaying(c *myui.Context, a *app.App, skin app.Skin, cur *app.Track) {
	t := c.Theme()
	myui.Row(c).Gap(10).AlignItems(myui.Center).Children(func() {
		// Cover art placeholder: a gradient tile with the music mark centred
		// in it. It is ONE box that paints its own background in Draw and
		// centres the icon as its child — two Fill() children would split
		// the tile in half (a Box stacks like a column), which put the
		// gradient on the top half and the mark in the bottom half.
		myui.Box(c).Size(48, 48).Radius(10).
			AlignItems(myui.Center).Justify(myui.Center).
			Draw(func(p *myui.Painter, r myui.Rect) {
				p.FillGradient(r, myui.LinearGradient{
					From: colOf(skin.Primary), To: colOf(skin.Accent), Angle: 135,
				}, 10)
			}).
			Children(func() {
				myui.Icon(c, icon("music")).Size(22, 22).
					TextColor(colOf(skin.VizInk).Alpha(0.92))
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

// transportButtons is the centred play-mode / prev / play / next group.
func transportButtons(c *myui.Context, a *app.App, skin app.Skin, t *myui.Theme, mode app.PlayMode) {
	myui.Row(c).Gap(10).AlignItems(myui.Center).Children(func() {
		// Play-mode cycle: sequence → repeat all → repeat one → shuffle.
		mb := iconButton(c, "play-mode", playModeIcon(mode),
			app.PlayModeLabel(mode)+"（点击切换）")
		mb.Size(34, 34).Radius(9).OnClick(func() { a.SetPlayMode(app.NextPlayMode(mode)) })

		prev := iconButton(c, "prev", "prev", "上一首")
		prev.Size(38, 38).Radius(19).OnClick(func() { a.Prev() })

		var play myui.Element
		if a.IsPlaying() {
			play = myui.PrimaryButton(c.Key("play"), "").Tooltip("暂停")
			play.Children(func() { myui.Icon(c, icon("pause")) })
		} else {
			play = myui.PrimaryButton(c.Key("play"), "").Tooltip("播放")
			play.Children(func() { myui.Icon(c, icon("play")) })
		}
		play.Size(46, 46).Radius(23).OnClick(func() { a.TogglePlay() })

		next := iconButton(c, "next", "next", "下一首")
		next.Size(38, 38).Radius(19).OnClick(func() { a.Next() })
	})
}

// playModeIcon maps a play mode to its icon name.
func playModeIcon(m app.PlayMode) string {
	switch m {
	case app.ModeRepeatAll:
		return "repeat"
	case app.ModeRepeatOne:
		return "repeat-one"
	case app.ModeShuffle:
		return "shuffle"
	default:
		return "sequence"
	}
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

// muteBtn is the speaker button: one click toggles mute, and the icon shows
// the current state the way desktop players do.
func muteBtn(c *myui.Context, a *app.App, t *myui.Theme) myui.Element {
	name, tip := speakerIcon(a.Volume, a.Muted)
	b := iconButton(c, "mute", name, tip)
	b.Size(32, 32).Radius(8).OnClick(func() { a.ToggleMute() })
	return b
}

// speakerIcon picks the volume icon and tooltip for the current volume.
func speakerIcon(vol float64, muted bool) (name, tip string) {
	switch {
	case muted || vol <= 0:
		return "volume-mute", "取消静音"
	case vol < 0.34:
		return "volume-low", "静音"
	case vol < 0.67:
		return "volume-mid", "静音"
	default:
		return "volume-high", "静音"
	}
}

// playlistPanel is the expanded left column: the library list.
func playlistPanel(c *myui.Context, a *app.App, skin app.Skin) {
	t := c.Theme()
	snap := a.Snapshot()
	// The caller (leftRail) sizes and positions this; here it just fills.
	myui.Column(c).Fill().Background(t.Surface.Alpha(0.82)).Radius(0, 14, 14, 0).
		Padding(12, 10).Gap(6).Children(func() {
		myui.Row(c).AlignItems(myui.Center).Children(func() {
			myui.Text(c, "播放列表").FontSize(14).Bold().TextColor(t.Text)
			myui.Box(c).Grow(1)
			myui.Text(c, fmt.Sprintf("%d 首", len(snap.Tracks))).FontSize(11).TextColor(t.TextMuted)
			pin := iconButton(c, "pin-library", "pin", playlistTip(a))
			pin.Size(26, 26).Radius(6).OnClick(func() { a.ToggleLibraryPin() })
		})
		myui.Row(c).Gap(6).Children(func() {
			imp := myui.Button(c.Key("import"), "导入音乐…").Grow(1)
			imp.OnClick(func() { TriggerImport(a) })
			fld := myui.Button(c.Key("import-folder"), "打开文件夹")
			fld.OnClick(func() { TriggerImportFolder(a) })
		})
		myui.Scroll(c).Fill().Children(func() {
			if len(snap.Tracks) == 0 {
				myui.Text(c, "还没有音乐。\n点击「导入音乐…」选择文件，或「打开文件夹」批量导入。").
					FontSize(12).TextColor(t.TextMuted).Padding(12, 10)
				return
			}
			for i, tr := range snap.Tracks {
				trackRow(c, a, tr, snap.Current, i)
			}
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

// sidePanel is the expanded right column. The caller (rightRail) sizes and
// positions it; here it just fills.
func sidePanel(c *myui.Context, a *app.App, skin app.Skin) {
	t := c.Theme()
	myui.Column(c).Fill().Background(t.Surface.Alpha(0.82)).
		Padding(12, 12).Gap(8).Children(func() {
		myui.Row(c).AlignItems(myui.Center).Children(func() {
			myui.Text(c, sidePanelLabel(a.SidePanel)).FontSize(14).Bold().TextColor(t.Text)
			myui.Box(c).Grow(1)
			cl := iconButton(c, "close-panel", "close", "关闭")
			cl.Size(26, 26).Radius(6).OnClick(func() { a.CloseSidePanel() })
		})
		myui.Scroll(c).Fill().Children(func() {
			switch a.SidePanel {
			case "eq":
				eqPanel(c, a, skin)
			case "lyrics":
				lyricsPanel(c, a, skin)
			case "history":
				historyPanel(c, a, skin)
			case "skins":
				skinsPanel(c, a, skin)
			case "about":
				aboutPanel(c, a)
			}
		})
	})
}

// historyPanel lists the recently played tracks (newest first). Clicking an
// entry jumps straight to that track, so the play history doubles as a quick
// launcher for things the user was just listening to.
func historyPanel(c *myui.Context, a *app.App, skin app.Skin) {
	t := c.Theme()
	snap := a.Snapshot()
	byID := make(map[string]*app.Track, len(snap.Tracks))
	for _, tr := range snap.Tracks {
		byID[tr.ID] = tr
	}
	hist := snap.History
	if len(hist) == 0 {
		myui.Text(c, "还没有播放记录。\n播放过的歌曲会显示在这里。").
			FontSize(12).TextColor(t.TextMuted).Padding(10, 8)
		return
	}
	for i, h := range hist {
		tr, ok := byID[h.TrackID]
		if !ok {
			// The track is no longer in the library (file moved/deleted);
			// keep the history entry from breaking the list, just skip it.
			continue
		}
		entry := tr
		idx := i
		row := myui.Row(c).Key("hist-"+entry.ID+"-"+fmt.Sprintf("%d", idx)).
			Padding(8, 9).Gap(10).AlignItems(myui.Center).Radius(8).
			OnClick(func() { a.PlayTrack(entry.ID) })
		if snap.Current != nil && snap.Current.ID == entry.ID {
			row = row.Background(t.Accent.Alpha(0.16))
		}
		row.Children(func() {
			myui.Box(c).Size(30, 30).Radius(8).Background(t.Background.Alpha(0.6)).
				AlignItems(myui.Center).Justify(myui.Center).Children(func() {
				myui.Icon(c, icon("music")).Size(16, 16).TextColor(colOf(skin.VizInk).Alpha(0.8))
			})
			myui.Column(c).Grow(1).Gap(1).Children(func() {
				myui.Text(c, entry.Title).FontSize(13).Bold().
					TextColor(t.Text).MaxLines(1)
				myui.Text(c, entry.Artist+" · "+entry.Album).FontSize(11).
					TextColor(t.TextMuted).MaxLines(1)
			})
			myui.Text(c, relTime(h.PlayedAt)).FontSize(11).TextColor(t.TextMuted)
		})
	}
}

// relTime renders a unix-millisecond timestamp as a short Chinese relative
// time: 刚刚 / N分钟前 / N小时前 / N天前 / date.
func relTime(ms int64) string {
	if ms <= 0 {
		return ""
	}
	d := time.Now().UnixMilli() - ms
	if d < 0 {
		d = 0
	}
	m := d / 60000
	switch {
	case m < 1:
		return "刚刚"
	case m < 60:
		return fmt.Sprintf("%d分钟前", m)
	case m < 1440:
		return fmt.Sprintf("%d小时前", m/60)
	case m < 43200: // ~30 days
		return fmt.Sprintf("%d天前", m/1440)
	}
	tm := time.UnixMilli(ms)
	return tm.Format("01-02")
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
		// A fixed height and a padded row, so the slider cannot stretch
		// vertically and claim space the transport deck needs.
		return myui.Box(c).Height(24).Padding(9, 16).Children(func() {
			s := myui.Slider(c, &seek, 0, float64(dur)).Fill()
			s.OnChange(func() { a.SeekMs(int64(seek)) })
		})
	}
	// Nothing loaded: show an inert, empty rail.
	return myui.Box(c).Height(24).Padding(9, 16).Children(func() {
		myui.Box(c).Fill().Height(6).Radius(3).Background(t.Border.Alpha(0.4))
	})
}

// eqPanel is the ten-band equaliser with presets and an enable switch.
func eqPanel(c *myui.Context, a *app.App, skin app.Skin) myui.Element {
	t := c.Theme()
	freqs := []string{"31", "62", "125", "250", "500", "1k", "2k", "4k", "8k", "16k"}
	presetNames := map[string]string{
		"flat": "平直", "rock": "摇滚", "pop": "流行", "classical": "古典",
		"bass": "重低音", "vocal": "人声", "treble": "高音",
	}
	return myui.Column(c).Gap(8).Children(func() {
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
		myui.Row(c).AlignItems(myui.Center).Children(func() {
			myui.Text(c, "歌词").FontSize(13).Bold().TextColor(t.Text)
			myui.Box(c).Grow(1)
			dt := iconButton(c, "toggle-desktop-lyrics", "lyrics-screen", "桌面歌词：在桌面显示悬浮歌词")
			dt.Size(28, 28).Radius(7).OnClick(func() { ToggleDesktopLyrics() })
		})
		myui.Text(c, "歌词文件（.lrc）与音乐文件同名同目录放置时会自动加载，\n也支持读取文件内嵌的歌词标签。").
			FontSize(12).TextColor(t.TextMuted)
		myui.Divider(c)

		lines := a.Lyrics()
		if len(lines) == 0 {
			myui.Text(c, "播放带歌词的曲目后，这里会逐行高亮显示。").
				FontSize(11).TextColor(t.TextMuted)
			return
		}
		_, _, idx := a.CurrentLyric()
		myui.Scroll(c).Fill().Children(func() {
			for i, l := range lines {
				if l.Text == "" {
					myui.Box(c).Height(10)
					continue
				}
				active := i == idx
				col := t.TextMuted
				size := float32(13)
				if active {
					col = t.Text
					size = float32(15)
				}
				myui.Text(c, l.Text).FontSize(size).Bold().TextColor(col)
			}
		})
	})
}

// skinsPanel lists the selectable themes.
func skinsPanel(c *myui.Context, a *app.App, skin app.Skin) myui.Element {
	cur := a.CurrentSkin().ID
	return myui.Column(c).Gap(6).Children(func() {
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
			myui.Icon(c, icon("check")).TextColor(t.Accent)
		}
	})
	e.OnClick(func() { a.SetSkin(s.ID) })
	return e
}

// aboutPanel shows app information and the update controls.
func aboutPanel(c *myui.Context, a *app.App) {
	t := c.Theme()
	myui.Column(c).Gap(6).Children(func() {
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
			myui.Scroll(c).MaxHeight(220).Children(func() {
				myui.Text(c, st.Available.Notes).FontSize(11).TextColor(t.TextMuted)
			})
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

// mainWindow is the primary OS window. We keep a handle so native dialogs can
// attach as a sheet to it. On macOS a sheet (beginSheetModalForWindow:) is far
// more reliable than the app-modal runModal path mygo takes when Parent is
// nil; the latter can silently fail to present from a webview callback.
var mainWindow *mygo.Window

// SetMainWindow hands the primary window handle to this package. Called once
// at startup from main.
func SetMainWindow(w *mygo.Window) { mainWindow = w }

// TriggerImport opens a native file dialog and adds the chosen audio to the
// library. Safe to call from the UI or a menu click on the main thread.
func TriggerImport(a *app.App) {
	paths, err := mygo.Dialog.Open(mygo.OpenDialogOptions{
		Parent:   mainWindow,
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

// TriggerImportFolder opens a native folder dialog and recursively imports
// every audio file beneath the chosen directory. Safe on the main thread.
func TriggerImportFolder(a *app.App) {
	path, err := mygo.Dialog.Open(mygo.OpenDialogOptions{
		Parent:    mainWindow,
		Title:     "打开文件夹",
		Directory: true,
	})
	if err != nil {
		a.State.PushError("打开文件夹失败: " + err.Error())
		return
	}
	if len(path) == 0 {
		return
	}
	if errs := a.ImportPaths(path); len(errs) > 0 {
		for _, e := range errs {
			a.State.PushError(e.Error())
		}
	}
}

// vizLast is when the previous visualiser frame ran, for computing dt.
var vizLast time.Time
