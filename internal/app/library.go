package app

import (
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/dhowden/tag"

	"yoyomusic/internal/app/audio"
)

// audioExtensions are the formats the player can actually decode. Keeping
// this in step with audio.Decodable avoids importing files that can never
// play.
var audioExtensions = map[string]bool{
	".wav": true, ".mp3": true, ".flac": true, ".ogg": true,
}

// ImportPaths expands directories, reads metadata for every audio file it
// finds, and returns ready-to-play tracks plus any per-file errors.
func ImportPaths(paths []string) ([]*Track, []error) {
	var tracks []*Track
	var errs []error
	seen := map[string]bool{}
	for _, p := range paths {
		info, err := os.Stat(p)
		if err != nil {
			errs = append(errs, err)
			continue
		}
		if info.IsDir() {
			files, werr := walkAudio(p)
			if werr != nil {
				errs = append(errs, werr)
			}
			for _, f := range files {
				if t, e := loadTrack(f); e != nil {
					errs = append(errs, e)
				} else if !seen[t.ID] {
					seen[t.ID] = true
					tracks = append(tracks, t)
				}
			}
			continue
		}
		if !audioExtensions[strings.ToLower(filepath.Ext(p))] {
			continue
		}
		if t, e := loadTrack(p); e != nil {
			errs = append(errs, e)
		} else if !seen[t.ID] {
			seen[t.ID] = true
			tracks = append(tracks, t)
		}
	}
	return tracks, errs
}

func walkAudio(dir string) ([]string, error) {
	var out []string
	err := filepath.WalkDir(dir, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return nil
		}
		if d.IsDir() {
			return nil
		}
		if audioExtensions[strings.ToLower(filepath.Ext(path))] {
			out = append(out, path)
		}
		return nil
	})
	return out, err
}

func loadTrack(path string) (*Track, error) {
	abs, err := filepath.Abs(path)
	if err != nil {
		abs = path
	}
	t := &Track{
		ID:        abs,
		FilePath:  abs,
		Title:     strings.TrimSuffix(filepath.Base(abs), filepath.Ext(abs)),
		Artist:    "未知艺术家",
		Album:     "未知专辑",
		Status:    TrackReady,
		TagStatus: TagClean,
	}
	f, err := os.Open(abs)
	if err != nil {
		t.Status = TrackMissing
		return t, err
	}
	defer f.Close()
	meta, rerr := tag.ReadFrom(f)
	if rerr == nil && meta != nil {
		if v := meta.Title(); v != "" {
			t.Title = v
		}
		if v := meta.Artist(); v != "" {
			t.Artist = v
		}
		if v := meta.Album(); v != "" {
			t.Album = v
		}
		if v := meta.Picture(); v != nil {
			t.CoverRef = "embedded"
		}
		if v := meta.Lyrics(); v != "" {
			t.LyricsRef = "embedded"
		}
	} else if rerr != nil && rerr != io.EOF {
		// Non-fatal: keep the file, let the decoder decide later.
		t.TagStatus = TagDirty
	}
	// Flag formats this build cannot decode, so the UI can say so instead of
	// failing silently when the user clicks the row.
	if !audio.Decodable(abs) {
		t.Status = TrackBad
	}
	return t, nil
}
