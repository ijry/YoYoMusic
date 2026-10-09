package app

import (
	"sort"
	"strings"
	"sync"
)

// PlayMode mirrors the original YoYoMusic play modes.
type PlayMode string

const (
	ModeSequence  PlayMode = "sequence"
	ModeRepeatAll PlayMode = "repeat_all"
	ModeRepeatOne PlayMode = "repeat_one"
	ModeShuffle   PlayMode = "shuffle"
)

// VisualizationMode is one of the six built-in visualisers.
type VisualizationMode string

const (
	VizSpectrum  VisualizationMode = "spectrum"
	VizWaveform  VisualizationMode = "waveform"
	VizRadial    VisualizationMode = "radial"
	VizParticles VisualizationMode = "particles"
	VizAurora    VisualizationMode = "aurora"
	VizWaterfall VisualizationMode = "waterfall"
)

// TrackStatus / TagStatus describe a track's health.
type TrackStatus string
type TagStatus string

const (
	TrackReady   TrackStatus = "ready"
	TrackMissing TrackStatus = "missing"
	TrackBad     TrackStatus = "unplayable"
	TagClean     TagStatus   = "clean"
	TagDirty     TagStatus   = "dirty"
)

// Skin is a named colour theme. Colours are hex strings ("#rrggbb") so the
// model stays free of the UI package; the UI converts them to ui.Color.
type Skin struct {
	ID      string
	Name    string
	Author  string
	Version string
	Primary string // dominant brand colour
	Accent  string // secondary accent
	BG      string // window background
	Surface string // cards / panels
	Ink     string // primary text
	VizA    string // visualiser gradient start
	VizB    string // visualiser gradient end
	VizInk  string // visualiser text/line on top
}

// Track is one song in the library.
type Track struct {
	ID         string
	FilePath   string
	Title      string
	Artist     string
	Album      string
	DurationMs int64
	CoverRef   string
	LyricsRef  string
	TagStatus  TagStatus
	Status     TrackStatus
}

// Playlist is an ordered list of track ids plus playback cursor.
type Playlist struct {
	ID           string
	Name         string
	TrackIDs     []string
	CurrentIndex int
	PlayMode     PlayMode
}

// Playback is the live transport state.
type Playback struct {
	TrackID    string
	PositionMs int64
	DurationMs int64
	Volume     float64
	IsPlaying  bool
	Muted      bool
	PlayMode   PlayMode
	EQEnabled  bool
}

// EqualizerSettings holds the ten-band equaliser.
type EqualizerSettings struct {
	Enabled bool
	Preset  string
	Bands   [10]float64
}

// DesktopLyricsSettings controls the floating lyric strip (here a toggle in
// the main window for the native replica).
type DesktopLyricsSettings struct {
	Theme     string
	FontScale float64
	Pinned    bool
}

// AppSettings is the persisted user configuration.
type AppSettings struct {
	DefaultSkin       string
	Shortcuts         map[string]string
	VisualizationMode VisualizationMode
	Equalizer         EqualizerSettings
	DesktopLyrics     DesktopLyricsSettings
	RestoreSession    bool
	EnrichmentEnabled bool

	// Volume and Muted are the transport state users expect to persist
	// across restarts; -1 volume means "unset, use the default".
	Volume *float64
	Muted  *bool
}

// playbackVolume returns the persisted volume, or the default when unset.
func (s AppSettings) playbackVolume(def float64) float64 {
	if s.Volume != nil {
		return *s.Volume
	}
	return def
}

// playbackMuted returns the persisted mute flag, or false when unset.
func (s AppSettings) playbackMuted() bool {
	if s.Muted != nil {
		return *s.Muted
	}
	return false
}

// builtInSkins is the four glassmorphism themes shipped with the app.
func builtInSkins() []Skin {
	return []Skin{
		{
			ID: "aurora", Name: "极光玻璃", Author: "xyito", Version: "1.0",
			Primary: "#8b5cf6", Accent: "#22d3ee", BG: "#0e0b1a", Surface: "#171327",
			Ink: "#f4f1ff", VizA: "#8b5cf6", VizB: "#22d3ee", VizInk: "#ffffff",
		},
		{
			ID: "midnight", Name: "午夜霓虹", Author: "xyito", Version: "1.0",
			Primary: "#d946ef", Accent: "#6366f1", BG: "#0a0a16", Surface: "#14142a",
			Ink: "#f0e9ff", VizA: "#d946ef", VizB: "#6366f1", VizInk: "#ffffff",
		},
		{
			ID: "sunset", Name: "落日熔金", Author: "xyito", Version: "1.0",
			Primary: "#f97316", Accent: "#facc15", BG: "#1a0f08", Surface: "#2a1a10",
			Ink: "#fff3e6", VizA: "#f97316", VizB: "#facc15", VizInk: "#fffaf0",
		},
		{
			ID: "mint", Name: "薄荷录音室", Author: "xyito", Version: "1.0",
			Primary: "#34d399", Accent: "#38bdf8", BG: "#06140f", Surface: "#0e211b",
			Ink: "#e6fff4", VizA: "#34d399", VizB: "#38bdf8", VizInk: "#f0fffb",
		},
	}
}

// AppState is the single source of truth for the UI. All mutations are
// guarded by the mutex; the native view reads snapshots each frame.
type AppState struct {
	mu          sync.RWMutex
	tracks      map[string]*Track
	playlist    Playlist
	playback    Playback
	settings    AppSettings
	skins       []Skin
	imported    []Skin
	activePanel string // "" means rail collapsed
	libraryOpen bool
	errors      []string
	seq         int
}

// NewAppState builds the initial state with defaults.
func NewAppState() *AppState {
	defaultSettings := AppSettings{
		DefaultSkin:       "aurora",
		Shortcuts:         map[string]string{"toggle_playback": "Ctrl+Alt+P", "previous_track": "Ctrl+Alt+Left", "next_track": "Ctrl+Alt+Right"},
		VisualizationMode: VizSpectrum,
		Equalizer:         EqualizerSettings{Enabled: false, Preset: "flat", Bands: [10]float64{0, 0, 0, 0, 0, 0, 0, 0, 0, 0}},
		DesktopLyrics:     DesktopLyricsSettings{Theme: "aurora", FontScale: 1, Pinned: false},
		RestoreSession:    true,
	}
	return &AppState{
		tracks:      map[string]*Track{},
		playlist:    Playlist{ID: "default", Name: "当前播放列表", CurrentIndex: 0, PlayMode: ModeSequence, TrackIDs: []string{}},
		playback:    Playback{Volume: 0.8, IsPlaying: false, PlayMode: ModeSequence},
		settings:    defaultSettings,
		skins:       builtInSkins(),
		activePanel: "",
		libraryOpen: true,
	}
}

// Snapshot returns a thread-safe copy of the data the UI needs.
type Snapshot struct {
	Tracks      []*Track
	Playlist    Playlist
	Playback    Playback
	Settings    AppSettings
	Skins       []Skin
	Current     *Track
	ActivePanel string
	LibraryOpen bool
}

func (s *AppState) Snapshot() Snapshot {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.snapshotLocked()
}

// snapshotLocked builds the snapshot. The caller must hold the mutex
// (read or write); calling Snapshot while already holding the write lock
// would deadlock, since sync.RWMutex is not reentrant.
func (s *AppState) snapshotLocked() Snapshot {
	tracks := make([]*Track, 0, len(s.tracks))
	for _, id := range s.playlist.TrackIDs {
		if t, ok := s.tracks[id]; ok {
			tracks = append(tracks, t)
		}
	}
	var cur *Track
	if s.playback.TrackID != "" {
		if t, ok := s.tracks[s.playback.TrackID]; ok {
			cur = t
		}
	}
	skins := append([]Skin{}, s.skins...)
	skins = append(skins, s.imported...)
	return Snapshot{
		Tracks:      tracks,
		Playlist:    s.playlist,
		Playback:    s.playback,
		Settings:    s.settings,
		Skins:       skins,
		Current:     cur,
		ActivePanel: s.activePanel,
		LibraryOpen: s.libraryOpen,
	}
}

// --- mutations ---

func (s *AppState) addTracks(loaded []*Track) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, t := range loaded {
		if _, ok := s.tracks[t.ID]; !ok {
			s.tracks[t.ID] = t
			s.playlist.TrackIDs = append(s.playlist.TrackIDs, t.ID)
		}
	}
}

// AddTracks merges imported tracks, returning the new snapshot.
func (s *AppState) AddTracks(loaded []*Track) Snapshot {
	s.addTracks(loaded)
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.snapshotLocked()
}

// RemoveTrack drops a track id from the playlist.
func (s *AppState) RemoveTrack(id string) Snapshot {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.tracks, id)
	out := s.playlist.TrackIDs[:0]
	for _, x := range s.playlist.TrackIDs {
		if x != id {
			out = append(out, x)
		}
	}
	s.playlist.TrackIDs = out
	if s.playback.TrackID == id {
		s.playback.TrackID = ""
		s.playback.IsPlaying = false
	}
	return s.snapshotLocked()
}

// Clear clears the playlist.
func (s *AppState) Clear() Snapshot {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.tracks = map[string]*Track{}
	s.playlist.TrackIDs = []string{}
	s.playback.TrackID = ""
	s.playback.IsPlaying = false
	s.playback.PositionMs = 0
	return s.snapshotLocked()
}

func (s *AppState) trackByID(id string) *Track {
	if t, ok := s.tracks[id]; ok {
		return t
	}
	return nil
}

// SelectTrack sets the current track without starting playback.
func (s *AppState) SelectTrack(id string) Snapshot {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.trackByID(id) == nil {
		return s.snapshotLocked()
	}
	s.playback.TrackID = id
	idx := indexOf(s.playlist.TrackIDs, id)
	if idx >= 0 {
		s.playlist.CurrentIndex = idx
	}
	return s.snapshotLocked()
}

// SetPlayMode updates the play mode everywhere it is mirrored.
func (s *AppState) SetPlayMode(m PlayMode) Snapshot {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.playback.PlayMode = m
	s.playlist.PlayMode = m
	return s.snapshotLocked()
}

func (s *AppState) SetVolume(v float64) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if v < 0 {
		v = 0
	}
	if v > 1 {
		v = 1
	}
	s.playback.Volume = v
	pv := v
	s.settings.Volume = &pv
}

func (s *AppState) SetMuted(m bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.playback.Muted = m
	pm := m
	s.settings.Muted = &pm
}

func (s *AppState) SetEQEnabled(b bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.playback.EQEnabled = b
	s.settings.Equalizer.Enabled = b
}

func (s *AppState) SetVisualization(m VisualizationMode) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.settings.VisualizationMode = m
}

func (s *AppState) SetDefaultSkin(id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.settings.DefaultSkin = id
}

func (s *AppState) TogglePanel(p string) string {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.activePanel == p {
		s.activePanel = ""
	} else {
		s.activePanel = p
	}
	return s.activePanel
}

func (s *AppState) ToggleLibrary() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.libraryOpen = !s.libraryOpen
	return s.libraryOpen
}

func (s *AppState) SetActivePanel(p string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.activePanel = p
}

func (s *AppState) PushError(msg string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.errors = append(s.errors, msg)
	if len(s.errors) > 8 {
		s.errors = s.errors[len(s.errors)-8:]
	}
}

func (s *AppState) Errors() []string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := append([]string{}, s.errors...)
	return out
}

// Current returns the current track (or nil) under the lock.
func (s *AppState) Current() *Track {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.trackByID(s.playback.TrackID)
}

// AdvanceIndex moves to the next/previous track according to the play mode,
// returning the new track id ("" if none).
func (s *AppState) AdvanceIndex(delta int) (string, bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	n := len(s.playlist.TrackIDs)
	if n == 0 {
		return "", false
	}
	switch s.playlist.PlayMode {
	case ModeRepeatOne:
		// caller handles repeat-one by restarting
		return s.playback.TrackID, true
	case ModeShuffle:
		s.playlist.CurrentIndex = (s.playlist.CurrentIndex + delta + n) % n
	default:
		ni := s.playlist.CurrentIndex + delta
		if ni < 0 {
			if s.playlist.PlayMode == ModeSequence {
				return "", false
			}
			ni = n - 1
		} else if ni >= n {
			if s.playlist.PlayMode == ModeSequence {
				return "", false
			}
			ni = 0
		}
		s.playlist.CurrentIndex = ni
	}
	if s.playlist.CurrentIndex < 0 || s.playlist.CurrentIndex >= n {
		return "", false
	}
	id := s.playlist.TrackIDs[s.playlist.CurrentIndex]
	s.playback.TrackID = id
	return id, true
}

func indexOf(s []string, v string) int {
	for i, x := range s {
		if x == v {
			return i
		}
	}
	return -1
}

// DefaultSkin returns the active skin id.
func (s *AppState) DefaultSkin() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.settings.DefaultSkin
}

// Settings returns a copy of the persisted settings.
func (s *AppState) Settings() AppSettings {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.settings
}

// CloneSettings returns a deep-ish copy safe to persist.
func (s *AppState) CloneSettings() AppSettings {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := s.settings
	if out.Shortcuts != nil {
		m := make(map[string]string, len(out.Shortcuts))
		for k, v := range out.Shortcuts {
			m[k] = v
		}
		out.Shortcuts = m
	}
	return out
}

// SortedSkins returns built-in then imported skins, sorted by name for stable UI.
func (s *AppState) SortedSkins() []Skin {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := append([]Skin{}, s.skins...)
	out = append(out, s.imported...)
	sort.SliceStable(out, func(i, j int) bool { return strings.ToLower(out[i].Name) < strings.ToLower(out[j].Name) })
	return out
}
