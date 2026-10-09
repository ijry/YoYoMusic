package app

import (
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

// writeWAV writes a 1-second 440 Hz stereo WAV, the minimum the player needs
// to accept a file.
func writeWAV(t *testing.T, path string) {
	t.Helper()
	const sr, ch = 44100, 2
	n := sr * ch
	dataSize := n * 2
	hdr := make([]byte, 44)
	copy(hdr[0:4], "RIFF")
	le32(hdr[4:], uint32(36+dataSize))
	copy(hdr[8:12], "WAVE")
	copy(hdr[12:16], "fmt ")
	le32(hdr[16:], 16)
	le16(hdr[20:], 1)
	le16(hdr[22:], uint16(ch))
	le32(hdr[24:], uint32(sr))
	le32(hdr[28:], uint32(sr*ch*2))
	le16(hdr[32:], uint16(ch*2))
	le16(hdr[34:], 16)
	copy(hdr[36:40], "data")
	le32(hdr[40:], uint32(dataSize))
	buf := make([]byte, 44+dataSize)
	copy(buf, hdr)
	for i := 0; i < sr; i++ {
		v := int16(8000)
		le16(buf[44+i*4:], uint16(v))
		le16(buf[44+i*4+2:], uint16(v))
	}
	if err := os.WriteFile(path, buf, 0o644); err != nil {
		t.Fatal(err)
	}
}

func le16(b []byte, v uint16) { b[0] = byte(v); b[1] = byte(v >> 8) }
func le32(b []byte, v uint32) {
	b[0] = byte(v)
	b[1] = byte(v >> 8)
	b[2] = byte(v >> 16)
	b[3] = byte(v >> 24)
}

// TestMigrateFromSyntheticLegacy builds a fake Tauri-era data directory and
// checks every field lands where it should.
func TestMigrateFromSyntheticLegacy(t *testing.T) {
	dir := t.TempDir()
	dataDir := filepath.Join(dir, "data")
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		t.Fatal(err)
	}
	good := filepath.Join(dir, "song.wav")
	writeWAV(t, good)

	legacyDir := filepath.Join(dir, "legacy")
	if err := os.MkdirAll(legacyDir, 0o755); err != nil {
		t.Fatal(err)
	}

	// camelCase, exactly as the Rust serde structs wrote it.
	settings := map[string]any{
		"defaultSkin":       "sunset",
		"shortcuts":         map[string]string{"toggle_playback": "Ctrl+Alt+P"},
		"visualizationMode": "radial",
		"enrichmentEnabled": true,
		"restoreSession":    true,
		"equalizer": map[string]any{
			"enabled": true,
			"preset":  "rock",
			"bands":   []float64{1, 2, 3, 4, 5, 6, 7, 8, 9, 10},
		},
		"desktopLyrics": map[string]any{
			"theme": "aurora", "fontScale": 1.5, "pinned": true, "clickThrough": false,
		},
	}
	sb, _ := json.Marshal(settings)
	if err := os.WriteFile(filepath.Join(legacyDir, "settings.json"), sb, 0o644); err != nil {
		t.Fatal(err)
	}

	lib := []map[string]any{
		{"id": good, "filePath": good, "title": "Song", "artist": "A", "album": "B", "durationMs": 1000},
		{"id": "/nope/gone.wav", "filePath": "/nope/gone.wav", "title": "Gone", "artist": "X", "album": "Y"},
	}
	lb, _ := json.Marshal(lib)
	if err := os.WriteFile(filepath.Join(legacyDir, "library.json"), lb, 0o644); err != nil {
		t.Fatal(err)
	}

	a := NewApp(dataDir)
	rep, err := a.MigrateLegacyDataFrom(legacyDir)
	if err != nil {
		t.Fatalf("migrate: %v", err)
	}
	// The migration debounces its write; flush so the settings file exists
	// before anything reads it back.
	a.Flush()
	t.Logf("report: %+v", rep)

	if !rep.HadSettings || !rep.HadPlaylist {
		t.Errorf("should report settings and playlist: %+v", rep)
	}
	if rep.SkinMapped != "sunset" {
		t.Errorf("skin = %q, want sunset", rep.SkinMapped)
	}
	if rep.VizMapped != "radial" {
		t.Errorf("viz = %q, want radial", rep.VizMapped)
	}
	if rep.EQPreset != "rock" {
		t.Errorf("eq preset = %q, want rock", rep.EQPreset)
	}
	// The missing file must be dropped, not imported as a dead row.
	if rep.TrackCount != 1 {
		t.Errorf("track count = %d, want 1 (missing file dropped)", rep.TrackCount)
	}

	snap := a.Snapshot()
	if len(snap.Tracks) != 1 {
		t.Fatalf("library has %d tracks, want 1", len(snap.Tracks))
	}
	if snap.Tracks[0].Title != "Song" || snap.Tracks[0].Status != TrackReady {
		t.Errorf("track = %+v", snap.Tracks[0])
	}

	s := a.Settings()
	if s.DefaultSkin != "sunset" {
		t.Errorf("DefaultSkin = %q", s.DefaultSkin)
	}
	if s.VisualizationMode != VizRadial {
		t.Errorf("VisualizationMode = %q", s.VisualizationMode)
	}
	if !s.Equalizer.Enabled || s.Equalizer.Preset != "rock" {
		t.Errorf("equalizer = %+v", s.Equalizer)
	}
	if s.Equalizer.Bands[9] != 10 {
		t.Errorf("last band = %v, want 10", s.Equalizer.Bands[9])
	}
	if s.Shortcuts["toggle_playback"] != "Ctrl+Alt+P" {
		t.Errorf("shortcut = %q", s.Shortcuts["toggle_playback"])
	}
	if !s.RestoreSession || !s.EnrichmentEnabled {
		t.Errorf("session flags = %+v", s)
	}
}

// TestMigrateUnknownSkinFallsBack checks a skin the Go build does not ship
// falls back to a built-in instead of leaving an id nothing can resolve.
func TestMigrateUnknownSkinFallsBack(t *testing.T) {
	dir := t.TempDir()
	legacyDir := filepath.Join(dir, "legacy")
	os.MkdirAll(legacyDir, 0o755)
	sb, _ := json.Marshal(map[string]any{
		"defaultSkin":       "transparent-crystal", // Tauri-only skin
		"visualizationMode": "waterfall",
	})
	os.WriteFile(filepath.Join(legacyDir, "settings.json"), sb, 0o644)

	a := NewApp(t.TempDir())
	rep, err := a.MigrateLegacyDataFrom(legacyDir)
	if err != nil {
		t.Fatal(err)
	}
	if rep.SkinMapped == "transparent-crystal" {
		t.Error("unknown legacy skin should fall back")
	}
	// The fallback must be a skin that actually exists.
	skin := rep.SkinMapped
	found := false
	for _, s := range a.Skins() {
		if s.ID == skin {
			found = true
		}
	}
	if !found {
		t.Errorf("fallback skin %q does not exist", skin)
	}
	t.Logf("transparent-crystal -> %q", skin)
}

// TestMigrateEmptyDirIsNoop checks a fresh install imports nothing and does
// not fail.
func TestMigrateEmptyDirIsNoop(t *testing.T) {
	a := NewApp(t.TempDir())
	rep, err := a.MigrateLegacyDataFrom(t.TempDir())
	if err != nil {
		t.Fatalf("empty migration should not fail: %v", err)
	}
	if rep.HadSettings || rep.HadPlaylist || rep.TrackCount != 0 {
		t.Errorf("empty dir should import nothing: %+v", rep)
	}
	if len(a.Snapshot().Tracks) != 0 {
		t.Error("library should stay empty")
	}
}

// TestLegacyAppDataDirChecksKnownIdentifiers guards the list of Tauri bundle
// identifiers the migration looks for: dropping one strands the users of
// that build.
func TestLegacyAppDataDirChecksKnownIdentifiers(t *testing.T) {
	want := []string{"com.xyito.yoyomusic"}
	for _, id := range want {
		found := false
		for _, have := range legacyIdentifiers {
			if have == id {
				found = true
			}
		}
		if !found {
			t.Errorf("legacy identifier %q is not checked", id)
		}
	}
	// And the path must follow the platform convention.
	dir := legacyAppDataDir("com.xyito.yoyomusic")
	if dir == "" {
		t.Fatal("legacyAppDataDir returned empty")
	}
	t.Logf("legacy dir on this platform: %s", dir)
}
