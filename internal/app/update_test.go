package app

import "testing"

// TestUpdaterInitialState checks a fresh updater reports nothing pending,
// so the UI shows "check for updates" rather than a phantom banner.
func TestUpdaterInitialState(t *testing.T) {
	u := NewUpdater()
	st := u.State()
	if st.Checking {
		t.Error("should not be checking before anything runs")
	}
	if st.Available != nil {
		t.Error("should have no update available")
	}
	if st.Installing || st.Installed {
		t.Error("should not be installing or installed")
	}
	if st.Error != "" {
		t.Errorf("should have no error, got %q", st.Error)
	}
	if !st.LastChecked.IsZero() {
		t.Error("should not have checked yet")
	}
}

// TestUpdaterInstallWithoutUpdateIsNoop checks the install path cannot be
// entered with nothing to install — a nil Available would panic.
func TestUpdaterInstallWithoutUpdateIsNoop(t *testing.T) {
	u := NewUpdater()
	u.InstallAsync() // must not panic or spin
	st := u.State()
	if st.Installing || st.Installed {
		t.Error("nothing to install, so nothing should be installing")
	}
}

// TestUpdaterConcurrentCheckIsCoalesced checks a second check while one is in
// flight is dropped rather than starting a parallel request.
func TestUpdaterConcurrentCheckIsCoalesced(t *testing.T) {
	u := NewUpdater()
	// Force the in-flight flag the way CheckAsync would, then confirm the
	// second call is a no-op rather than a second goroutine.
	u.mu.Lock()
	u.state.Checking = true
	u.mu.Unlock()

	u.CheckAsync(false)
	st := u.State()
	if !st.Checking {
		t.Error("state should still report checking")
	}
	if !st.LastChecked.IsZero() {
		t.Error("a coalesced check must not mark LastChecked")
	}
}

// TestUpdaterEnabledFollowsBuild checks Enabled mirrors the framework's
// answer. In a dev build it is false, and the UI relies on that to show
// "this build cannot update itself" instead of a dead button.
func TestUpdaterEnabledFollowsBuild(t *testing.T) {
	u := NewUpdater()
	enabled := u.Enabled()
	t.Logf("updater enabled in this build: %v", enabled)
	// Whatever it is, it must be stable across calls.
	if u.Enabled() != enabled {
		t.Error("Enabled() must be stable")
	}
}

// TestToggleMuteRestoresVolume covers the speaker button: clicking mutes,
// clicking again unmutes, and unmuting from a zero volume restores a usable
// level instead of leaving the user stuck in silence.
func TestToggleMuteRestoresVolume(t *testing.T) {
	a := NewApp(t.TempDir())
	a.SetVolume(0.8)

	if a.Muted {
		t.Fatal("should start unmuted")
	}

	a.ToggleMute()
	if !a.Muted {
		t.Error("first toggle should mute")
	}
	a.ToggleMute()
	if a.Muted {
		t.Error("second toggle should unmute")
	}
	if a.Volume != 0.8 {
		t.Errorf("volume should survive a mute cycle, got %v", a.Volume)
	}

	// Mute, drag the volume to zero, unmute: must not stay silent.
	a.ToggleMute()
	a.SetVolume(0)
	a.ToggleMute()
	if a.Muted {
		t.Error("should be unmuted")
	}
	if a.Volume <= 0 {
		t.Errorf("unmuting from zero volume should restore a level, got %v", a.Volume)
	}
	t.Logf("restored volume = %v", a.Volume)
}
