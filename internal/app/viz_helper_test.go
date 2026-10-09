package app_test

import (
	"encoding/json"
	"os"
	"path/filepath"
)

// writeVizOverride rewrites VisualizationMode in a settings file, simulating
// what a future or foreign build might have written.
func writeVizOverride(dir, mode string) error {
	p := filepath.Join(dir, "settings.json")
	data, err := os.ReadFile(p)
	if err != nil {
		return err
	}
	var m map[string]any
	if err := json.Unmarshal(data, &m); err != nil {
		return err
	}
	m["VisualizationMode"] = mode
	out, err := json.Marshal(m)
	if err != nil {
		return err
	}
	return os.WriteFile(p, out, 0o644)
}
