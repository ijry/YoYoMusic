package app

import (
	"encoding/json"
	"os"
	"path/filepath"
)

const settingsFileName = "settings.json"

// LoadSettings reads the persisted settings, falling back to defaults when
// the file is absent or corrupt.
func LoadSettings(dir string) (AppSettings, error) {
	def := NewAppState().settings
	path := filepath.Join(dir, settingsFileName)
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return def, nil
		}
		return def, err
	}
	var loaded AppSettings
	if err := json.Unmarshal(data, &loaded); err != nil {
		return def, err
	}
	// Fill any unset maps so the UI never sees nil.
	if loaded.Shortcuts == nil {
		loaded.Shortcuts = def.Shortcuts
	}
	// A mode this build does not know — a settings file written by a newer
	// version, or a hand edit — must fall back, or the mode picker points at
	// a mode nothing can draw.
	if !isKnownViz(loaded.VisualizationMode) {
		loaded.VisualizationMode = def.VisualizationMode
	}
	if loaded.Equalizer.Preset == "" {
		loaded.Equalizer = def.Equalizer
	}
	if loaded.DesktopLyrics.Theme == "" {
		loaded.DesktopLyrics = def.DesktopLyrics
	}
	return loaded, nil
}

// SaveSettings writes the settings atomically-ish (write then rename).
func SaveSettings(dir string, s AppSettings) error {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}
	path := filepath.Join(dir, settingsFileName)
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}

// ApplySettings copies persisted settings into the live state, restoring the
// transport state (volume, mute) users expect to survive a restart.
func (s *AppState) ApplySettings(loaded AppSettings) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if loaded.DefaultSkin == "" {
		loaded.DefaultSkin = s.settings.DefaultSkin
	}
	s.settings = loaded
	s.playback.Volume = loaded.playbackVolume(s.playback.Volume)
	s.playback.Muted = loaded.playbackMuted()
	if s.settings.Equalizer.Enabled {
		s.playback.EQEnabled = true
	}
}
