package app

import (
	"fmt"
	"log"
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

	// Updater drives the signed self-update flow.
	Updater *Updater

	// autosave debounces writes so dragging a slider does not hit the disk
	// on every frame. Flush() forces an immediate write.
	saveMu     sync.Mutex
	saveTimer  *time.Timer
	saveQueued bool
}

// VizOrder lists the visualisers in the same order as the Tabs labels.
var VizOrder = []VisualizationMode{
	VizSpectrum, VizWaveform, VizRadial, VizParticles, VizAurora, VizWaterfall,
}

// NewApp builds the orchestrator, loading persisted settings when present.
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
	}
	a.Muted = st.playback.Muted
	a.EQEnabled = st.Settings().Equalizer.Enabled
	a.EQBands = st.Settings().Equalizer.Bands

	a.Player.SetVolume(a.Volume)
	a.Player.SetMuted(a.Muted)
	if st.Settings().Equalizer.Enabled {
		a.Player.SetEQ(a.EQBands, true)
	}
	a.Player.SetOnEnd(func() { a.Next() })
	a.Player.Start()
	return a
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

// Flush writes any pending settings immediately.
func (a *App) Flush() {
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
	a.Player.Play()
	a.State.SelectTrack(id)
	a.State.mu.Lock()
	a.State.playback.DurationMs = dec.DurationMs
	a.State.playback.IsPlaying = true
	a.State.mu.Unlock()
}

// TogglePlay flips between playing and paused for the current track.
func (a *App) TogglePlay() {
	if a.State.Current() == nil {
		return
	}
	a.Player.TogglePlay()
	a.State.mu.Lock()
	a.State.playback.IsPlaying = a.Player.IsPlaying()
	a.State.mu.Unlock()
}

// Stop halts playback and rewinds.
func (a *App) Stop() {
	a.Player.Stop()
	a.State.mu.Lock()
	a.State.playback.IsPlaying = false
	a.State.playback.PositionMs = 0
	a.State.mu.Unlock()
}

// Next advances to the following track and plays it.
func (a *App) Next() {
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
		return
	}
	id, ok := a.State.AdvanceIndex(-1)
	if !ok {
		a.Player.SeekMs(0)
		return
	}
	a.PlayTrack(id)
}

// SeekMs moves the playhead.
func (a *App) SeekMs(ms int64) { a.Player.SeekMs(ms) }

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

// SetSkin selects the active skin.
func (a *App) SetSkin(id string) {
	a.State.SetDefaultSkin(id)
	a.autosave()
}

// SetPanel switches the main panel.
func (a *App) SetPanel(p string) { a.Panel = p }

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
