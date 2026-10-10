package app

import (
	"fmt"
	"log"
	"math/rand"
	"sync"
	"time"

	"yoyomusic/internal/app/audio"
)

// eqPresets maps preset names to 10-band gain tables (dB, low→high).
var eqPresets = map[string][10]float64{
	"flat":      {0, 0, 0, 0, 0, 0, 0, 0, 0, 0},
	"rock":      {5, 4, 3, 1, -1, -1, 1, 3, 4, 5},
	"pop":       {-1, 2, 4, 5, 4, 1, -1, -2, -2, -3},
	"classical": {4, 3, 2, -1, -2, -2, 0, 2, 3, 4},
	"bass":      {7, 6, 5, 3, 1, 0, 0, 0, 0, 0},
	"vocal":     {-3, -2, 0, 3, 5, 5, 4, 2, 0, -1},
	"treble":    {0, 0, 0, 0, 0, 2, 4, 6, 7, 8},
}

// eqPresetNames is the stable order shown in the UI.
var eqPresetNames = []string{"flat", "rock", "pop", "classical", "bass", "vocal", "treble"}

// VizState holds per-frame visualiser history that must survive rebuilds.
// App ties the UI-facing state to the audio engine and playback controls.
// The UI thread (the mygo view) is the only writer of Panel/Muted/Volume/
// eqUI; the player callbacks (OnEnd) may mutate playback state from a
// goroutine, so those go through Player/Snapshot which lock internally.
type App struct {
	State   *AppState
	Player  *audio.Player
	dataDir string

	// Panel is the selected main panel (library/visualizer/eq/lyrics/skins/about).
	Panel string
	// VizMode is the index of the active visualiser in VizOrder.
	VizMode int
	// Volume (0..1) is bound directly by sliders.
	Volume float64
	// Muted bound by the mute switch.
	Muted bool
	// EQEnabled mirrors the equaliser enable switch.
	EQEnabled bool
	// EQBands mirrors the 10 EQ band sliders.
	EQBands [10]float64

	// VizRandom mirrors the random-rotation setting; when on, the backdrop
	// switches between visualisers at random intervals (see TickVizRandom).
	VizRandom bool
	// vizRandomAt is the next scheduled automatic switch; zero means none.
	vizRandomAt time.Time
	// rng drives the random mode choice and the random interval. It is only
	// touched from the UI thread, so it needs no lock.
	rng *rand.Rand

	// LibraryOpen is whether the left playlist column is expanded. It folds
	// to an icon rail after the pointer has been still for a while.
	LibraryOpen bool
	// LibraryPinned keeps the playlist column expanded regardless of the
	// idle timer, the way pinning a sidebar works in every other player.
	LibraryPinned bool
	// SidePanel is the feature panel open on the right: eq, lyrics, skins,
	// about, or "" when none is open.
	SidePanel string
	// SidePanelPinned keeps the right panel expanded regardless of the idle
	// timer. Lyrics is the exception: it stays open until explicitly closed,
	// because reading lyrics is not something you do with the mouse.
	SidePanelPinned bool
	// Updater drives the signed self-update flow.
	Updater *Updater

	// autosave debounces writes so dragging a slider does not hit the disk
	// on every frame. Flush() forces an immediate write.
	saveMu     sync.Mutex
	saveTimer  *time.Timer
	saveQueued bool

	// libTimer debounces library writes the same way as settings.
	libTimer *time.Timer

	// loadedID is the track currently decoded in the player; it differs
	// from playback.TrackID only transiently, but tracking it lets TogglePlay
	// know whether to resume an already-loaded track or load a new one (the
	// session-restore case).
	loadedID string

	// pendingResumeID/pos carry the session-restored track so PlayTrack can
	// seek to the remembered position exactly once, then clear them.
	pendingResumeID string
	pendingResumeMs int64
}

// VizOrder lists the visualisers in the same order as the Tabs labels, which
// is the order the Tauri build used: the analyses first, then the showpieces,
// then the two that are generated rather than plotted.
var VizOrder = []VisualizationMode{
	VizSpectrum, VizWaveform, VizRadial, VizAurora, VizParticles, VizWaterfall,
	VizGenerative, VizKaleido, VizPiano,
}

// VizLabels names each mode for the mode picker, in VizOrder.
var VizLabels = map[VisualizationMode]string{
	VizSpectrum:   "频谱柱",
	VizWaveform:   "示波波形",
	VizRadial:     "环形律动",
	VizAurora:     "音浪绸带",
	VizParticles:  "粒子星尘",
	VizWaterfall:  "镜像瀑布",
	VizGenerative: "生成动画",
	VizKaleido:    "万花筒",
	VizPiano:      "钢琴",
}

// vizRandomMin/Max bound the random gap between automatic visualiser switches
// when random mode is on: the backdrop rotates every 5–20 seconds.
const (
	vizRandomMin = 5 * time.Second
	vizRandomMax = 20 * time.Second
)

// NewApp builds the orchestrator, loading persisted settings and library
// when present.
func NewApp(dataDir string) *App {
	st := NewAppState()
	if loaded, err := LoadSettings(dataDir); err == nil {
		st.ApplySettings(loaded)
	}

	a := &App{
		State:   st,
		Player:  audio.NewPlayer(),
		dataDir: dataDir,
		Panel:   "library",
		Volume:  st.playback.Volume,
		Updater: NewUpdater(),
		// The playlist starts expanded but unpinned, so it folds away once
		// the pointer rests — the same idle behaviour as the feature rail.
		LibraryOpen: true,
	}
	a.Muted = st.playback.Muted
	a.EQEnabled = st.Settings().Equalizer.Enabled
	a.EQBands = st.Settings().Equalizer.Bands
	// Restore the saved visualiser into the live index (not just the
	// persisted string) so the picker and the random switcher agree with what
	// the user last chose, and seed the random source for the rotation.
	a.VizRandom = st.Settings().VizRandom
	a.VizMode = indexOfViz(st.Settings().VisualizationMode)
	a.rng = rand.New(rand.NewSource(time.Now().UnixNano()))

	a.Player.SetVolume(a.Volume)
	a.Player.SetMuted(a.Muted)
	if st.Settings().Equalizer.Enabled {
		a.Player.SetEQ(a.EQBands, true)
	}

	// Restore the saved library (tracks, playlist, resume, history) so the
	// user's collection and recent plays survive a restart.
	var ls *LibraryState
	if l, err := LoadLibrary(dataDir); err == nil {
		ls = l
	}
	if ls != nil {
		st.RestoreLibrary(ls)
	}
	// Resume the session track (paused at its last position) when enabled.
	a.restoreSession(ls)

	a.Player.SetOnEnd(func() {
		if cur := a.State.Current(); cur != nil {
			a.State.ClearResume(cur.ID)
		}
		a.Next()
		a.autosaveLibrary()
	})
	a.Player.Start()
	// Keep the resume position fresh on disk while something is playing.
	go a.positionTicker()
	return a
}

// restoreSession points playback at the saved track, paused at its last
// position, when RestoreSession is on. It does not decode audio — the player
// stays idle until the user presses play, at which point PlayTrack seeks to
// the remembered spot.
func (a *App) restoreSession(ls *LibraryState) {
	if ls == nil || !a.State.Settings().RestoreSession {
		return
	}
	a.State.mu.Lock()
	idx := a.State.playlist.CurrentIndex
	var id string
	if idx >= 0 && idx < len(a.State.playlist.TrackIDs) {
		id = a.State.playlist.TrackIDs[idx]
	}
	a.State.mu.Unlock()
	if id == "" {
		return
	}
	pos := a.State.Resume(id)
	if pos <= 0 {
		return
	}
	a.State.mu.Lock()
	a.State.playback.TrackID = id
	a.State.playback.PositionMs = pos
	a.State.playback.IsPlaying = false
	a.State.playback.DurationMs = 0
	a.State.mu.Unlock()
	a.pendingResumeID = id
	a.pendingResumeMs = pos
}

// SaveSettings writes the live settings to disk.
func (a *App) SaveSettings() error {
	return SaveSettings(a.dataDir, a.State.CloneSettings())
}

// autosave schedules a debounced settings write. The mygo backend does not
// deliver a graceful quit on Windows (signals kill the process), so
// persisting on change is the only reliable way to keep settings.
func (a *App) autosave() {
	a.saveMu.Lock()
	defer a.saveMu.Unlock()
	if a.saveTimer != nil {
		a.saveTimer.Stop()
	}
	a.saveQueued = true
	a.saveTimer = time.AfterFunc(400*time.Millisecond, func() {
		a.saveMu.Lock()
		a.saveQueued = false
		a.saveMu.Unlock()
		if err := a.SaveSettings(); err != nil {
			log.Printf("autosave settings: %v", err)
		}
	})
}

// Flush writes any pending settings and library immediately.
func (a *App) Flush() {
	// Capture the live playhead before persisting, so a graceful quit keeps
	// the exact resume point rather than the last debounced save.
	a.recordPosition()
	a.saveMu.Lock()
	if !a.saveQueued {
		a.saveMu.Unlock()
		return
	}
	a.saveQueued = false
	if a.saveTimer != nil {
		a.saveTimer.Stop()
		a.saveTimer = nil
	}
	a.saveMu.Unlock()
	if err := a.SaveSettings(); err != nil {
		log.Printf("flush settings: %v", err)
	}
	// Persist the library on the way out too — the last playhead and any
	// freshly imported tracks must not be lost when the process is killed.
	if err := a.SaveLibrary(); err != nil {
		log.Printf("flush library: %v", err)
	}
}

// Snapshot returns a thread-safe copy of the state the UI needs.
func (a *App) Snapshot() Snapshot { return a.State.Snapshot() }

// Settings returns a copy of the persisted settings.
func (a *App) Settings() AppSettings { return a.State.Settings() }

// Skins returns built-in then imported skins, sorted by name.
func (a *App) Skins() []Skin { return a.State.SortedSkins() }

// CurrentSkin returns the active skin definition.
func (a *App) CurrentSkin() Skin {
	id := a.State.DefaultSkin()
	for _, s := range a.State.SortedSkins() {
		if s.ID == id {
			return s
		}
	}
	all := a.State.SortedSkins()
	if len(all) > 0 {
		return all[0]
	}
	return Skin{ID: "aurora", BG: "#0e0b1a", Surface: "#171327", Ink: "#f4f1ff",
		Primary: "#8b5cf6", Accent: "#22d3ee", VizA: "#8b5cf6", VizB: "#22d3ee", VizInk: "#ffffff"}
}

// ImportPaths adds the chosen files/directories to the library.
func (a *App) ImportPaths(paths []string) []error {
	tracks, errs := ImportPaths(paths)
	if len(tracks) > 0 {
		a.State.AddTracks(tracks)
		// New files should persist even if the app is closed immediately.
		a.autosaveLibrary()
	}
	return errs
}

// PlayTrack decodes and plays the track with the given id.
func (a *App) PlayTrack(id string) {
	t := a.State.trackByID(id)
	if t == nil {
		return
	}
	dec, err := audio.Decode(t.FilePath)
	if err != nil {
		a.State.PushError("无法解码: " + t.Title)
		return
	}
	if err := a.Player.Load(dec); err != nil {
	}
	a.loadedID = id
	// Resume from memory if this is the session-restored track.
	if id == a.pendingResumeID {
		a.Player.SeekMs(a.pendingResumeMs)
		a.State.mu.Lock()
		a.State.playback.PositionMs = a.pendingResumeMs
		a.State.mu.Unlock()
		a.pendingResumeID = ""
	}
	a.Player.Play()
	a.State.SelectTrack(id)
	a.State.mu.Lock()
	a.State.playback.DurationMs = dec.DurationMs
	a.State.playback.IsPlaying = true
	a.State.mu.Unlock()
	a.State.AddHistory(id)
	a.recordPosition()
	a.autosaveLibrary()
}

// TogglePlay flips between playing and paused for the current track. If the
// track is not yet loaded into the player (the session-restore case), it
// loads and plays it instead of toggling a silent, empty player.
func (a *App) TogglePlay() {
	cur := a.State.Current()
	if cur == nil {
		return
	}
	if a.loadedID != cur.ID {
		a.PlayTrack(cur.ID)
		return
	}
	a.Player.TogglePlay()
	a.State.mu.Lock()
	a.State.playback.IsPlaying = a.Player.IsPlaying()
	a.State.mu.Unlock()
	a.recordPosition()
	a.autosaveLibrary()
}

// Stop halts playback and rewinds.
func (a *App) Stop() {
	a.recordPosition()
	a.autosaveLibrary()
	a.Player.Stop()
	a.State.mu.Lock()
	a.State.playback.IsPlaying = false
	a.State.playback.PositionMs = 0
	a.State.mu.Unlock()
}

// Next advances to the following track and plays it.
func (a *App) Next() {
	a.recordPosition()
	a.autosaveLibrary()
	id, ok := a.State.AdvanceIndex(1)
	if !ok {
		a.Stop()
		return
	}
	a.PlayTrack(id)
}

// Prev goes back; if more than 3s in, it rewinds the current track instead.
func (a *App) Prev() {
	if a.Player.PositionMs() > 3000 {
		a.Player.SeekMs(0)
		a.recordPosition()
		a.autosaveLibrary()
		return
	}
	a.recordPosition()
	a.autosaveLibrary()
	id, ok := a.State.AdvanceIndex(-1)
	if !ok {
		a.Player.SeekMs(0)
		return
	}
	a.PlayTrack(id)
}

// SeekMs moves the playhead.
func (a *App) SeekMs(ms int64) {
	a.Player.SeekMs(ms)
	a.State.mu.Lock()
	a.State.playback.PositionMs = ms
	a.State.mu.Unlock()
	a.recordPosition()
	a.autosaveLibrary()
}

// recordPosition snapshots the current playhead into the resume map so it can
// be restored later.
func (a *App) recordPosition() {
	cur := a.State.Current()
	if cur == nil {
		return
	}
	pos := a.Player.PositionMs()
	dur := a.Player.DurationMs()
	a.State.SetResume(cur.ID, pos, dur)
}

// SaveLibrary writes the live library (tracks, playlist, history, resume) to
// disk.
func (a *App) SaveLibrary() error {
	return SaveLibrary(a.dataDir, a.State.BuildLibrary())
}

// autosaveLibrary schedules a debounced library write. Like settings, the
// Windows backend gives no graceful quit, so persisting on change is the only
// reliable way to keep the library and resume points current.
func (a *App) autosaveLibrary() {
	a.saveMu.Lock()
	defer a.saveMu.Unlock()
	if a.libTimer != nil {
		a.libTimer.Stop()
	}
	a.libTimer = time.AfterFunc(1500*time.Millisecond, func() {
		if err := a.SaveLibrary(); err != nil {
			log.Printf("autosave library: %v", err)
		}
	})
}

// positionTicker flushes the resume position to disk every few seconds while
// something is playing, so a crash or forced quit loses at most a few seconds
// of progress.
func (a *App) positionTicker() {
	t := time.NewTicker(5 * time.Second)
	defer t.Stop()
	for range t.C {
		if a.Player.IsPlaying() {
			a.recordPosition()
			a.autosaveLibrary()
		}
	}
}

// SetVolume sets the linear volume and updates the engine.
func (a *App) SetVolume(v float64) {
	a.Volume = v
	a.Player.SetVolume(v)
	a.State.SetVolume(v)
	a.autosave()
}

// SetMuted toggles muting.
func (a *App) SetMuted(b bool) {
	a.Muted = b
	a.Player.SetMuted(b)
	a.State.SetMuted(b)
	a.autosave()
}

// ToggleMute flips the mute flag, for the speaker button. Unmuting restores
// the previous volume when it had been dragged to zero, so the user never
// gets stuck with a silent slider.
func (a *App) ToggleMute() {
	if a.Muted {
		a.SetMuted(false)
		// Restore a sensible level if the volume was dragged to zero.
		if a.Volume <= 0 {
			a.SetVolume(0.5)
		}
		return
	}
	a.SetMuted(true)
}

// SetEQEnabled flips the equaliser and re-applies current bands.
func (a *App) SetEQEnabled(b bool) {
	a.State.SetEQEnabled(b)
	a.Player.SetEQ(a.EQBands, b)
	a.autosave()
}

// SetEQPreset applies a named preset to the 10 bands and the engine.
func (a *App) SetEQPreset(name string) {
	bands, ok := eqPresets[name]
	if !ok {
		return
	}
	a.EQBands = bands
	a.State.mu.Lock()
	a.State.settings.Equalizer.Preset = name
	a.State.settings.Equalizer.Bands = bands
	enabled := a.State.settings.Equalizer.Enabled
	a.State.mu.Unlock()
	a.Player.SetEQ(bands, enabled)
	a.autosave()
}

// SetEQBand updates a single band from a slider.
func (a *App) SetEQBand(i int, db float64) {
	if i < 0 || i >= 10 {
		return
	}
	a.EQBands[i] = db
	a.State.mu.Lock()
	a.State.settings.Equalizer.Bands[i] = db
	enabled := a.State.settings.Equalizer.Enabled
	a.State.mu.Unlock()
	a.Player.SetEQ(a.EQBands, enabled)
	a.autosave()
}

// EQPresets returns the preset names in display order.
func (a *App) EQPresets() []string { return eqPresetNames }

// SetVisualization switches the active visualiser.
func (a *App) SetVisualization(m VisualizationMode) {
	a.State.SetVisualization(m)
	a.autosave()
	for i, v := range VizOrder {
		if v == m {
			a.VizMode = i
			break
		}
	}
}

// indexOfViz returns the position of m in VizOrder, or 0 for an unknown mode
// (the fallback the picker and restore paths expect).
func indexOfViz(m VisualizationMode) int {
	for i, v := range VizOrder {
		if v == m {
			return i
		}
	}
	return 0
}

// SetVizRandom turns the automatic visualiser rotation on or off and persists
// the preference, so it is still on after a restart. Turning it on schedules
// the first switch; turning it off cancels any pending one.
func (a *App) SetVizRandom(on bool) {
	if a.VizRandom == on {
		return
	}
	a.VizRandom = on
	a.State.SetVizRandom(on)
	a.autosave()
	if on {
		a.vizRandomAt = time.Now().Add(vizRandomInterval(a.rng))
	} else {
		a.vizRandomAt = time.Time{}
	}
}

// TickVizRandom is called every frame. While random mode is on and the
// scheduled time has passed, it rotates to a random different visualiser and
// schedules the next switch.
func (a *App) TickVizRandom(now time.Time) {
	if !a.VizRandom {
		return
	}
	if a.vizRandomAt.IsZero() || !now.Before(a.vizRandomAt) {
		a.randomizeViz()
		a.vizRandomAt = now.Add(vizRandomInterval(a.rng))
	}
}

// randomizeViz switches to a random visualiser other than the current one,
// without persisting the change.
func (a *App) randomizeViz() {
	if len(VizOrder) < 2 {
		return
	}
	n := a.rng.Intn(len(VizOrder))
	if n == a.VizMode {
		n = (n + 1) % len(VizOrder)
	}
	a.VizMode = n
	a.State.SetVisualizationLive(VizOrder[n])
}

// vizRandomInterval returns a random duration in [vizRandomMin, vizRandomMax].
func vizRandomInterval(rng *rand.Rand) time.Duration {
	span := int64(vizRandomMax - vizRandomMin)
	if span < 0 {
		return vizRandomMin
	}
	return vizRandomMin + time.Duration(rng.Int63n(span+1))
}

// SetPlayMode changes the play mode and persists it with the library, so the
// choice survives a restart (Next/Prev read it from the playlist).
func (a *App) SetPlayMode(m PlayMode) {
	a.State.SetPlayMode(m)
	a.autosaveLibrary()
}

// NextPlayMode is the order the transport's mode button cycles through.
func NextPlayMode(m PlayMode) PlayMode {
	switch m {
	case ModeSequence:
		return ModeRepeatAll
	case ModeRepeatAll:
		return ModeRepeatOne
	case ModeRepeatOne:
		return ModeShuffle
	default:
		return ModeSequence
	}
}

// PlayModeLabel names a mode for the button's tooltip.
func PlayModeLabel(m PlayMode) string {
	switch m {
	case ModeRepeatAll:
		return "列表循环"
	case ModeRepeatOne:
		return "单曲循环"
	case ModeShuffle:
		return "随机播放"
	default:
		return "顺序播放"
	}
}

// SetSkin selects the active skin.
func (a *App) SetSkin(id string) {
	a.State.SetDefaultSkin(id)
	a.autosave()
}

// SetDesktopLyricScale adjusts the desktop-lyrics font scale and persists it.
// Clamped to a sane range so the text never collapses or overflows the window.
func (a *App) SetDesktopLyricScale(scale float64) {
	if scale < 0.6 {
		scale = 0.6
	}
	if scale > 3 {
		scale = 3
	}
	a.State.mu.Lock()
	a.State.settings.DesktopLyrics.FontScale = scale
	a.State.mu.Unlock()
	a.autosave()
}

// SetPanel switches the main panel.
// SetPanel selects the main panel. Kept for the migration path and the
// command line; the new layout drives SidePanel instead.
func (a *App) SetPanel(p string) { a.Panel = p }

// SidePanels lists the panels the right-hand rail can show, in the order the
// old build showed them.
var SidePanels = []string{"eq", "lyrics", "history", "skins", "about"}

// ToggleSidePanel opens a panel, or closes it when it is already open. The
// panel opens pinned, so it does not fold away the moment the pointer rests.
func (a *App) ToggleSidePanel(p string) {
	if a.SidePanel == p {
		a.SidePanel = ""
		a.SidePanelPinned = false
		return
	}
	a.SidePanel = p
	a.SidePanelPinned = true
}

// CloseSidePanel closes the right panel. Lyrics is the one panel the user
// asks for explicitly and expects to stay, so it ignores the idle timer.
func (a *App) CloseSidePanel() {
	a.SidePanel = ""
	a.SidePanelPinned = false
}

// SidePanelSticky reports whether the open panel survives the idle timer.
func (a *App) SidePanelSticky() bool {
	return a.SidePanelPinned || a.SidePanel == "lyrics"
}

// ToggleLibrary folds or expands the left playlist column.
func (a *App) ToggleLibrary() { a.LibraryOpen = !a.LibraryOpen }

// ToggleLibraryPin pins or unpins the playlist column.
func (a *App) ToggleLibraryPin() { a.LibraryPinned = !a.LibraryPinned }

// Frame returns the live (or idle) visualiser frame.
func (a *App) Frame() audio.SignalFrame { return a.Player.Frame() }

// PositionMs / DurationMs / IsPlaying expose transport state.
func (a *App) PositionMs() int64 { return a.Player.PositionMs() }
func (a *App) DurationMs() int64 { return a.Player.DurationMs() }
func (a *App) IsPlaying() bool   { return a.Player.IsPlaying() }

// FmtTime formats milliseconds as m:ss.
func FmtTime(ms int64) string {
	if ms < 0 {
		ms = 0
	}
	s := ms / 1000
	m := s / 60
	s = s % 60
	return fmt.Sprintf("%d:%02d", m, s)
}
