package app

import (
	"encoding/json"
	"os"
	"path/filepath"

	"yoyomusic/internal/app/audio"
)

// legacyIdentifiers are the bundle identifiers of the Tauri release, whose
// data directory the Go build inherits so upgrading keeps the user's
// settings. Tauri's app_data_dir on Windows is %APPDATA%/<identifier>.
var legacyIdentifiers = []string{
	"com.xyito.yoyomusic",
	"com.yoyomusic.app",
	"net.lingyun.yoyomusic",
}

// LegacyData is what the Tauri version persisted. Field names are the Rust
// struct's camelCase, kept verbatim so the file round-trips unchanged.
type LegacyData struct {
	Settings    *LegacySettings `json:"settings,omitempty"`
	Playback    *LegacyPlayback `json:"playback,omitempty"`
	Playlist    *LegacyPlaylist `json:"playlist,omitempty"`
	Tracks      []*LegacyTrack  `json:"tracks,omitempty"`
	WindowState json.RawMessage `json:"-"`
}

// LegacySettings mirrors the Rust AppSettings struct.
type LegacySettings struct {
	DefaultSkin        string               `json:"defaultSkin"`
	Shortcuts          map[string]string    `json:"shortcuts"`
	EnrichmentEnabled  bool                 `json:"enrichmentEnabled"`
	CacheRetentionDays int                  `json:"cacheRetentionDays"`
	RecentPlaylists    []string             `json:"recentPlaylists"`
	RestoreSession     bool                 `json:"restoreSession"`
	VisualizationMode  string               `json:"visualizationMode"`
	Equalizer          LegacyEqualizer      `json:"equalizer"`
	DesktopLyrics      *LegacyDesktopLyrics `json:"desktopLyrics,omitempty"`
}

type LegacyEqualizer struct {
	Enabled bool      `json:"enabled"`
	Preset  string    `json:"preset"`
	Bands   []float64 `json:"bands"`
}

type LegacyDesktopLyrics struct {
	Theme        string  `json:"theme"`
	FontScale    float64 `json:"fontScale"`
	Pinned       bool    `json:"pinned"`
	ClickThrough bool    `json:"clickThrough"`
}

type LegacyPlayback struct {
	TrackID    string  `json:"trackId"`
	PositionMs int64   `json:"positionMs"`
	DurationMs int64   `json:"durationMs"`
	Volume     float64 `json:"volume"`
	IsPlaying  bool    `json:"isPlaying"`
	IsMuted    bool    `json:"isMuted"`
	PlayMode   string  `json:"playMode"`
	EQEnabled  bool    `json:"eqEnabled"`
}

type LegacyPlaylist struct {
	ID           string   `json:"id"`
	Name         string   `json:"name"`
	TrackIDs     []string `json:"trackIds"`
	CurrentIndex int      `json:"currentIndex"`
	PlayMode     string   `json:"playMode"`
}

type LegacyTrack struct {
	ID          string `json:"id"`
	FilePath    string `json:"filePath"`
	Title       string `json:"title"`
	Artist      string `json:"artist"`
	Album       string `json:"album"`
	DurationMs  int64  `json:"durationMs"`
	CoverArtRef string `json:"coverArtRef"`
	LyricsRef   string `json:"lyricsRef"`
	TagStatus   string `json:"tagStatus"`
	Status      string `json:"status"`
}

// MigrationReport records what the migration found, for the log and the UI.
type MigrationReport struct {
	FromDir      string // legacy directory the data came from
	HadSettings  bool
	HadPlaylist  bool
	TrackCount   int
	DroppedPaths int // tracks whose file no longer exists
	SkinMapped   string
	VizMapped    string
	EQPreset     string
	Volume       float64
	Muted        bool
}

// hasLegacyData reports whether dir holds anything the migration can read.
func hasLegacyData(dir string) bool {
	for _, name := range []string{"settings.json", "library.json", "playlist.json", "tracks.json"} {
		if _, err := os.Stat(filepath.Join(dir, name)); err == nil {
			return true
		}
	}
	return false
}

// MigrateLegacyData imports the Tauri version's settings and library into
// this app's data directory. It is safe to call when nothing is there: the
// common case for a fresh install.
//
// The old release wrote settings.json under its own bundle identifier, so a
// Go build - which uses its own identifier - would otherwise start from
// defaults and silently lose the user's configuration.
func (a *App) MigrateLegacyData() (*MigrationReport, error) {
	for _, id := range legacyIdentifiers {
		dir := legacyAppDataDir(id)
		if dir == "" || !hasLegacyData(dir) {
			continue
		}
		return a.MigrateLegacyDataFrom(dir)
	}
	return &MigrationReport{}, nil
}

// MigrateLegacyDataFrom migrates from an explicit legacy data directory.
// Exported so the migration can be tested without depending on the platform
// path lookup, and so a portable install can point at a chosen directory.
func (a *App) MigrateLegacyDataFrom(dir string) (*MigrationReport, error) {
	report := &MigrationReport{FromDir: dir}
	if !hasLegacyData(dir) {
		return report, nil
	}

	// --- settings ---
	if data, err := os.ReadFile(filepath.Join(dir, "settings.json")); err == nil {
		var ls LegacySettings
		if err := json.Unmarshal(data, &ls); err != nil {
			logMigration("settings.json unreadable: %v", err)
		} else {
			report.HadSettings = true
			a.applyLegacySettings(&ls, report)
		}
	}

	// --- playlist + tracks ---
	if tracks := a.loadLegacyLibrary(dir); len(tracks) > 0 {
		a.State.AddTracks(tracks)
		report.HadPlaylist = true
		report.TrackCount = len(tracks)
	}

	// Only write when something was actually imported, so a fresh install
	// does not create a settings file it never needed.
	if report.HadSettings || report.HadPlaylist {
		a.autosave()
	}
	return report, nil
}

// applyLegacySettings maps the Rust settings onto this app's model. Values
// that no longer exist (skins, visualiser ids, presets) fall back to a
// supported default instead of breaking the app.
func (a *App) applyLegacySettings(ls *LegacySettings, report *MigrationReport) {
	st := a.State
	st.mu.Lock()

	if ls.DefaultSkin != "" {
		if skinExists(st, ls.DefaultSkin) {
			st.settings.DefaultSkin = ls.DefaultSkin
		} else {
			// The Tauri build shipped skins the Go build does not; keep the
			// user's choice only when it still resolves.
			st.settings.DefaultSkin = "aurora"
		}
		report.SkinMapped = st.settings.DefaultSkin
	}

	if len(ls.Shortcuts) > 0 {
		st.settings.Shortcuts = ls.Shortcuts
	}

	// Visualisation ids are shared vocabulary between the two builds.
	if ls.VisualizationMode != "" {
		if isKnownViz(VisualizationMode(ls.VisualizationMode)) {
			st.settings.VisualizationMode = VisualizationMode(ls.VisualizationMode)
		} else {
			st.settings.VisualizationMode = VizSpectrum
		}
		report.VizMapped = string(st.settings.VisualizationMode)
	}

	st.settings.EnrichmentEnabled = ls.EnrichmentEnabled
	st.settings.RestoreSession = ls.RestoreSession

	// Equaliser: the Rust build stored bands as a Vec<f32>, this build as a
	// fixed array of 10.
	st.settings.Equalizer.Enabled = ls.Equalizer.Enabled
	if ls.Equalizer.Preset != "" {
		st.settings.Equalizer.Preset = ls.Equalizer.Preset
		report.EQPreset = ls.Equalizer.Preset
	}
	for i := 0; i < 10 && i < len(ls.Equalizer.Bands); i++ {
		st.settings.Equalizer.Bands[i] = ls.Equalizer.Bands[i]
	}

	if ls.DesktopLyrics != nil {
		st.settings.DesktopLyrics = DesktopLyricsSettings{
			Theme:     ls.DesktopLyrics.Theme,
			FontScale: ls.DesktopLyrics.FontScale,
			Pinned:    ls.DesktopLyrics.Pinned,
		}
	}

	// Playback transport lived in the settings' sibling file; keep whatever
	// the running app already has unless a legacy value is present.
	st.mu.Unlock()
}

// loadLegacyLibrary reads tracks from a legacy library file, dropping
// entries whose file has disappeared so the UI does not list dead rows.
func (a *App) loadLegacyLibrary(dir string) []*Track {
	var out []*Track
	dropped := 0
	for _, name := range []string{"library.json", "playlist.json", "tracks.json"} {
		data, err := os.ReadFile(filepath.Join(dir, name))
		if err != nil {
			continue
		}
		// Try the shapes the Tauri build could have written: a bare array of
		// tracks, or an object wrapping one.
		var raw []*LegacyTrack
		if err := json.Unmarshal(data, &raw); err != nil {
			var wrapper struct {
				Tracks []*LegacyTrack `json:"tracks"`
			}
			if err := json.Unmarshal(data, &wrapper); err != nil {
				continue
			}
			raw = wrapper.Tracks
		}
		for _, lt := range raw {
			if lt == nil || lt.FilePath == "" {
				continue
			}
			if _, err := os.Stat(lt.FilePath); err != nil {
				dropped++
				continue
			}
			t := &Track{
				ID:         lt.FilePath,
				FilePath:   lt.FilePath,
				Title:      lt.Title,
				Artist:     lt.Artist,
				Album:      lt.Album,
				DurationMs: lt.DurationMs,
				CoverRef:   lt.CoverArtRef,
				LyricsRef:  lt.LyricsRef,
				TagStatus:  TagClean,
			}
			if t.Title == "" {
				t.Title = filepath.Base(lt.FilePath)
			}
			if t.Artist == "" {
				t.Artist = "未知艺术家"
			}
			if t.Album == "" {
				t.Album = "未知专辑"
			}
			if !audio.Decodable(t.FilePath) {
				t.Status = TrackBad
			} else {
				t.Status = TrackReady
			}
			out = append(out, t)
		}
		break
	}
	if dropped > 0 {
		logMigration("dropped %d missing files from the legacy library", dropped)
	}
	return out
}

func skinExists(st *AppState, id string) bool {
	for _, s := range st.skins {
		if s.ID == id {
			return true
		}
	}
	for _, s := range st.imported {
		if s.ID == id {
			return true
		}
	}
	return false
}

func isKnownViz(m VisualizationMode) bool {
	switch m {
	case VizSpectrum, VizWaveform, VizRadial, VizParticles, VizAurora, VizWaterfall,
		VizGenerative, VizKaleido:
		return true
	}
	return false
}
