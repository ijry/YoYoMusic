package app

import (
	"os"
	"path/filepath"
	"testing"
)

// TestLibraryRoundTrip checks that tracks, the playlist order, resume points
// and the play history all survive a save/load cycle — the core promise of
// "list persistence" and "progress memory".
func TestLibraryRoundTrip(t *testing.T) {
	dir := t.TempDir()
	st := NewAppState()

	st.AddTracks([]*Track{
		{ID: "/music/a.wav", FilePath: "/music/a.wav", Title: "A", Artist: "X", Album: "1", DurationMs: 60000},
		{ID: "/music/b.wav", FilePath: "/music/b.wav", Title: "B", Artist: "Y", Album: "2", DurationMs: 90000},
	})
	st.SetResume("/music/a.wav", 30000, 60000)
	st.AddHistory("/music/a.wav")

	if err := SaveLibrary(dir, st.BuildLibrary()); err != nil {
		t.Fatalf("SaveLibrary: %v", err)
	}

	ls, err := LoadLibrary(dir)
	if err != nil {
		t.Fatalf("LoadLibrary: %v", err)
	}
	if ls == nil {
		t.Fatal("LoadLibrary returned nil for a saved library")
	}

	fresh := NewAppState()
	fresh.RestoreLibrary(ls)

	snap := fresh.Snapshot()
	if len(snap.Tracks) != 2 {
		t.Fatalf("restored %d tracks, want 2", len(snap.Tracks))
	}
	if snap.Tracks[0].Title != "A" || snap.Tracks[1].Title != "B" {
		t.Errorf("track order not preserved: %q, %q", snap.Tracks[0].Title, snap.Tracks[1].Title)
	}
	if got := fresh.Resume("/music/a.wav"); got != 30000 {
		t.Errorf("resume = %d, want 30000", got)
	}
	hist := fresh.History()
	if len(hist) != 1 || hist[0].TrackID != "/music/a.wav" {
		t.Errorf("history not preserved: %+v", hist)
	}
}

// TestSetResumeGuards checks the boundaries: a position near the very start or
// the very end is not remembered, so playback never resumes at 0:00 or at a
// dead end.
func TestSetResumeGuards(t *testing.T) {
	st := NewAppState()
	st.SetResume("/x", 1000, 60000)  // too early
	st.SetResume("/x", 59500, 60000) // too near the end
	if got := st.Resume("/x"); got != 0 {
		t.Errorf("guarded positions should not persist, got %d", got)
	}
	st.SetResume("/x", 30000, 60000)
	if got := st.Resume("/x"); got != 30000 {
		t.Errorf("mid-track position should persist, got %d", got)
	}
}

// TestAddHistoryDedupesConsecutive checks that replaying the same track does
// not flood the log with duplicates.
func TestAddHistoryDedupesConsecutive(t *testing.T) {
	st := NewAppState()
	st.AddHistory("/a")
	st.AddHistory("/a")
	if got := len(st.History()); got != 1 {
		t.Errorf("consecutive repeat should not duplicate: got %d entries", got)
	}
	st.AddHistory("/b")
	st.AddHistory("/a")
	if got := len(st.History()); got != 3 {
		t.Errorf("non-consecutive replay should be recorded: got %d entries", got)
	}
}

// TestNewAppRestoresSession checks the launch path: with RestoreSession on and
// a saved resume point, NewApp points playback at the saved track, paused at
// the remembered position.
func TestNewAppRestoresSession(t *testing.T) {
	dir := t.TempDir()
	ls := &LibraryState{
		Tracks: []*Track{{ID: "/m/a.wav", FilePath: "/m/a.wav", Title: "A", DurationMs: 180000}},
		Playlist: Playlist{
			ID: "default", TrackIDs: []string{"/m/a.wav"}, CurrentIndex: 0, PlayMode: ModeSequence,
		},
		Resume: map[string]int64{"/m/a.wav": 42000},
	}
	if err := SaveLibrary(dir, ls); err != nil {
		t.Fatalf("SaveLibrary: %v", err)
	}
	a := NewApp(dir)
	defer a.Player.Close()
	snap := a.Snapshot()
	if snap.Current == nil || snap.Current.ID != "/m/a.wav" {
		t.Fatalf("session track not restored: %+v", snap.Current)
	}
	if snap.Playback.PositionMs != 42000 {
		t.Errorf("resume position = %d, want 42000", snap.Playback.PositionMs)
	}
	if snap.Playback.IsPlaying {
		t.Error("restored session must start paused")
	}
}

// TestLoadLibraryMissingIsNil documents that a first run (no file yet) is not
// an error.
func TestLoadLibraryMissingIsNil(t *testing.T) {
	ls, err := LoadLibrary(t.TempDir())
	if err != nil {
		t.Fatalf("missing library should not error: %v", err)
	}
	if ls != nil {
		t.Fatal("missing library should be nil")
	}
}

// TestLoadLibraryCorruptIsSkipped documents that a corrupt file is reported as
// an error rather than crashing.
func TestLoadLibraryCorruptIsSkipped(t *testing.T) {
	dir := t.TempDir()
	if err := os.WriteFile(filepath.Join(dir, libraryFileName), []byte("{not json"), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := LoadLibrary(dir); err == nil {
		t.Error("corrupt library should return an error")
	}
}
