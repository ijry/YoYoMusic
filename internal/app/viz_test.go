package app_test

import (
	"testing"
	"time"

	"yoyomusic/internal/app"
)

// TestAllVizModesRender drives every visualiser mode through the real app and
// checks the frame it consumes stays sane. The draw code itself runs inside
// mygo's painter, which needs a window; what is verified here is that every
// mode is reachable, keeps the frame in range, and does not stall playback.
func TestAllVizModesRender(t *testing.T) {
	if len(app.VizOrder) != 9 {
		t.Fatalf("expected 9 modes, got %d", len(app.VizOrder))
	}
	// Every mode must have a label, or the picker shows a blank tooltip.
	for _, m := range app.VizOrder {
		if app.VizLabels[m] == "" {
			t.Errorf("mode %q has no label", m)
		}
	}

	dir := t.TempDir()
	a := app.NewApp(dir)
	// A track must be playing for the frames to be live rather than idle.
	if errs := a.ImportPaths([]string{`C:/Windows/Media/Alarm01.wav`}); len(errs) > 0 {
		t.Skipf("no test audio: %v", errs)
	}
	snap := a.Snapshot()
	if len(snap.Tracks) == 0 {
		t.Fatal("no tracks imported")
	}
	a.PlayTrack(snap.Tracks[0].ID)

	for _, m := range app.VizOrder {
		a.SetVisualization(m)
		// Let the mode run long enough that a stateful one (waterfall rows,
		// particle spawns, generative scene scheduling) does real work.
		time.Sleep(250 * time.Millisecond)

		f := a.Frame()
		for b, v := range f.Bands {
			if v < 0 || v > 1 {
				t.Errorf("%s: band %d out of range: %v", m, b, v)
				break
			}
		}
		if f.Level < 0 || f.Level > 1 {
			t.Errorf("%s: level out of range: %v", m, f.Level)
		}
		if a.PositionMs() <= 0 {
			t.Errorf("%s: playback did not advance", m)
		}
		t.Logf("%-12s level=%.3f pos=%dms", m, f.Level, a.PositionMs())
	}

	// Stop playback before the temp dir goes away: the player runs a
	// background goroutine that can outlive the test body and hold it.
	a.Stop()
	a.Flush()
}

// TestVizModePersists checks the chosen mode survives a settings round trip,
// so the picker does not reset on restart.
func TestVizModePersists(t *testing.T) {
	dir := t.TempDir()
	a := app.NewApp(dir)
	a.SetVisualization(app.VizKaleido)
	a.Flush()

	b := app.NewApp(dir)
	if b.Settings().VisualizationMode != app.VizKaleido {
		t.Errorf("viz mode = %q, want kaleidoscope",
			b.Settings().VisualizationMode)
	}
}

// TestUnknownVizFallsBack guards the migration path: a mode name this build
// does not know must fall back rather than leave the picker pointing nowhere.
func TestUnknownVizFallsBack(t *testing.T) {
	dir := t.TempDir()
	a := app.NewApp(dir)
	a.SetVisualization(app.VizSpectrum)
	a.Flush()

	// Hand-edit the settings to an unknown mode, then reload.
	// (AppSettings is written with Go field names, so patch through JSON.)
	if err := writeVizOverride(dir, "no-such-mode"); err != nil {
		t.Fatal(err)
	}
	b := app.NewApp(dir)
	if got := b.Settings().VisualizationMode; got == "no-such-mode" {
		t.Error("unknown mode was accepted")
	}
	t.Logf("unknown mode fell back to %q", b.Settings().VisualizationMode)
}

// TestVizRandom exercises the automatic rotation: off leaves the mode alone,
// turning on switches to a different mode on a due tick (and keeps switching),
// and turning off again freezes it.
func TestVizRandom(t *testing.T) {
	dir := t.TempDir()
	a := app.NewApp(dir)
	defer a.Stop()
	start := a.VizMode

	// Off: a far-future tick must not change anything.
	a.TickVizRandom(time.Now().Add(10 * time.Hour))
	if a.VizMode != start {
		t.Errorf("off: mode changed from %d to %d", start, a.VizMode)
	}

	// On: the first due tick switches to a different mode.
	a.SetVizRandom(true)
	if !a.VizRandom {
		t.Fatal("SetVizRandom(true) did not take")
	}
	a.TickVizRandom(time.Now().Add(10 * time.Hour))
	if a.VizMode == start {
		t.Errorf("on: mode did not change (stayed %d)", start)
	}

	// Each subsequent due tick must pick a mode different from the previous.
	base := time.Now()
	for i := 0; i < 20; i++ {
		prev := a.VizMode
		a.TickVizRandom(base.Add(time.Duration(i+1) * 24 * time.Hour))
		if a.VizMode == prev {
			t.Errorf("iteration %d: mode did not change from %d", i, prev)
		}
	}

	// Off again: a far-future tick leaves the mode alone.
	a.SetVizRandom(false)
	held := a.VizMode
	a.TickVizRandom(time.Now().Add(10 * time.Hour))
	if a.VizMode != held {
		t.Errorf("off after on: mode changed from %d to %d", held, a.VizMode)
	}

	// The random switches must not have overwritten the persisted mode: read
	// the file back from disk, which should still hold the mode the app
	// started with (spectrum), not the last random pick.
	if loaded, err := app.LoadSettings(dir); err == nil {
		if loaded.VisualizationMode != app.VizOrder[start] {
			t.Errorf("persisted mode = %q, want %q", loaded.VisualizationMode, app.VizOrder[start])
		}
	} else {
		t.Fatalf("LoadSettings: %v", err)
	}
}
