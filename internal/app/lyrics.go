package app

import (
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"

	"github.com/dhowden/tag"
)

// LyricLine is one timed line of a synced lyric (LRC).
type LyricLine struct {
	TimeMs int64
	Text   string
}

// lyricCache memoises parsed lyrics per track id so the desktop-lyrics window
// and the in-app panel do not reparse the tag or re-read the .lrc every frame.
var lyricCache sync.Map // trackID -> []LyricLine

// Lyrics returns the parsed synced lyrics for the current track, loading them
// from a sidecar .lrc file first and the embedded tag second. It returns nil
// when the track has no lyrics.
func (a *App) Lyrics() []LyricLine {
	cur := a.Snapshot().Current
	if cur == nil {
		return nil
	}
	if v, ok := lyricCache.Load(cur.ID); ok {
		return v.([]LyricLine)
	}
	lines := a.loadLyrics(cur)
	lyricCache.Store(cur.ID, lines)
	return lines
}

// loadLyrics resolves lyrics for a track from disk.
func (a *App) loadLyrics(t *Track) []LyricLine {
	// 1. Sidecar .lrc beside the audio file — the documented convention.
	base := strings.TrimSuffix(t.FilePath, filepath.Ext(t.FilePath))
	if data, err := os.ReadFile(base + ".lrc"); err == nil {
		if ls := ParseLRC(string(data)); len(ls) > 0 {
			return ls
		}
	}
	// 2. Embedded lyrics in the audio tag.
	if t.LyricsRef == "embedded" {
		if f, err := os.Open(t.FilePath); err == nil {
			defer f.Close()
			if meta, err := tag.ReadFrom(f); err == nil {
				if v := meta.Lyrics(); v != "" {
					return ParseLRC(v)
				}
			}
		}
	}
	return nil
}

// CurrentLyric returns the active line, the next line (for a karaoke-style
// preview), and the active line index. When nothing is playing or there are
// no lyrics it returns empty strings and index -1.
func (a *App) CurrentLyric() (cur, next string, idx int) {
	lines := a.Lyrics()
	if len(lines) == 0 {
		return "", "", -1
	}
	pos := a.PositionMs()
	i := -1
	for k, l := range lines {
		if l.TimeMs <= pos {
			i = k
		} else {
			break
		}
	}
	if i < 0 {
		return "", lines[0].Text, 0
	}
	cur = lines[i].Text
	if i+1 < len(lines) {
		next = lines[i+1].Text
	}
	return cur, next, i
}

// ParseLRC parses LRC text into timed lines. It accepts the standard form
//
//	[mm:ss.xx] lyrics
//
// with possibly several timestamps on one line, and ignores metadata tags
// such as [ti:], [ar:], [offset:].
func ParseLRC(text string) []LyricLine {
	var out []LyricLine
	for _, raw := range strings.Split(text, "\n") {
		line := strings.TrimSpace(raw)
		if line == "" {
			continue
		}
		// Strip leading metadata tags like [ti:...] or [offset:123].
		idx := 0
		stamped := false
		var body string
		for {
			open := strings.Index(line[idx:], "[")
			if open < 0 {
				if !stamped {
					body = line[idx:]
				}
				break
			}
			open += idx
			close := strings.Index(line[open:], "]")
			if close < 0 {
				break
			}
			close += open
			stamp := line[open+1 : close]
			if ms, err := parseLRCTime(stamp); err == nil {
				stamped = true
				textPart := strings.TrimSpace(line[close+1:])
				out = append(out, LyricLine{TimeMs: ms, Text: textPart})
			} else if isMetaTag(stamp) {
				// [ti:..], [ar:..], [al:..], [offset:..], [by:..]
				// skip
			} else {
				body = line[close+1:]
			}
			idx = close + 1
		}
		if !stamped && body != "" {
			// A line with no timestamp: keep it as a static line at 0 so it
			// shows until the first timed line — rare, but avoids dropping
			// untimed lyrics entirely.
			if !strings.HasPrefix(body, "[") {
				out = append(out, LyricLine{TimeMs: 0, Text: strings.TrimSpace(body)})
			}
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].TimeMs < out[j].TimeMs })
	return out
}

// isMetaTag reports whether a bracket contents is an LRC metadata tag rather
// than a timestamp.
func isMetaTag(s string) bool {
	colon := strings.Index(s, ":")
	if colon < 0 {
		return false
	}
	key := strings.ToLower(strings.TrimSpace(s[:colon]))
	switch key {
	case "ti", "ar", "al", "by", "offset", "length", "re", "ve", "kuwo", "qq":
		return true
	}
	// Anything with a non-numeric first char before a colon is metadata.
	return colon > 0
}

// parseLRCTime parses "mm:ss.xx" or "mm:ss" into milliseconds.
func parseLRCTime(s string) (int64, error) {
	s = strings.TrimSpace(s)
	// mm:ss.xx
	if i := strings.Index(s, ":"); i >= 0 {
		min, err := strconv.ParseFloat(strings.TrimSpace(s[:i]), 64)
		if err != nil {
			return 0, err
		}
		rest := s[i+1:]
		sec, err := strconv.ParseFloat(strings.TrimSpace(rest), 64)
		if err != nil {
			return 0, err
		}
		return int64((min*60 + sec) * 1000), nil
	}
	// Plain seconds.
	v, err := strconv.ParseFloat(s, 64)
	if err != nil {
		return 0, err
	}
	return int64(v * 1000), nil
}
