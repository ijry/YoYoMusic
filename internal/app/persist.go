package app

import (
	"encoding/json"
	"os"
	"path/filepath"
)

const libraryFileName = "library.json"

// HistoryEntry records one play of a track: which track and when.
type HistoryEntry struct {
	TrackID  string `json:"track_id"`
	PlayedAt int64  `json:"played_at"` // unix milliseconds
}

// LibraryState is the persisted library. Track metadata is stored in full
// because a track's ID is its absolute file path — there is no external
// catalogue to re-read titles/artists from, and the user expects their
// library to survive a restart with its metadata intact.
//
// Resume maps a track id to the last playhead (ms) so playback can continue
// where it left off; History is the recent-plays log, newest first.
type LibraryState struct {
	Tracks   []*Track         `json:"tracks"`
	Playlist Playlist         `json:"playlist"`
	History  []HistoryEntry   `json:"history"`
	Resume   map[string]int64 `json:"resume"`
}

// LoadLibrary reads the persisted library. A missing file is not an error:
// it simply means the user has no saved library yet, so nil is returned and
// the app starts empty. A corrupt file is ignored the same way, so a bad
// write never strands the app in a crash loop.
func LoadLibrary(dir string) (*LibraryState, error) {
	path := filepath.Join(dir, libraryFileName)
	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	var ls LibraryState
	if err := json.Unmarshal(data, &ls); err != nil {
		return nil, err
	}
	if ls.Resume == nil {
		ls.Resume = map[string]int64{}
	}
	return &ls, nil
}

// SaveLibrary writes the library atomically (write temp, then rename).
func SaveLibrary(dir string, ls *LibraryState) error {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	data, err := json.MarshalIndent(ls, "", "  ")
	if err != nil {
		return err
	}
	path := filepath.Join(dir, libraryFileName)
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	return os.Rename(tmp, path)
}
