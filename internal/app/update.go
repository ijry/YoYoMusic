package app

import (
	"context"
	"log"
	"sync"
	"time"

	"github.com/egoist/mygo"
)

// UpdateState is what the UI shows about the update flow.
type UpdateState struct {
	// Checking is true while a check is in flight.
	Checking bool
	// Available is a newer version, nil when up to date.
	Available *mygo.Update
	// Installing is true while downloading.
	Installing bool
	// Progress is 0..1 while downloading, negative when unknown.
	Progress float64
	// Error is the last failure, empty when none.
	Error string
	// Installed marks that an update is ready and needs a relaunch.
	Installed bool
	// LastChecked is when the last check finished.
	LastChecked time.Time
}

// Updater wraps mygo.Updater with the state the UI needs. Checks run in the
// background so a slow network never blocks the window.
type Updater struct {
	mu    sync.Mutex
	state UpdateState
	// autoChecked guards the startup check so it runs once per process.
	autoChecked bool
}

// NewUpdater builds an updater for the app.
func NewUpdater() *Updater { return &Updater{} }

// State returns a copy of the current update state.
func (u *Updater) State() UpdateState {
	u.mu.Lock()
	defer u.mu.Unlock()
	return u.state
}

// Enabled reports whether this build can update itself. Development builds
// and builds without updates configured cannot.
func (u *Updater) Enabled() bool { return mygo.Updater.Enabled() }

// CheckAsync looks for an update in the background, updating state as it
// goes. The UI polls State() to render the result.
func (u *Updater) CheckAsync(force bool) {
	u.mu.Lock()
	if u.state.Checking {
		u.mu.Unlock()
		return
	}
	u.state.Checking = true
	u.state.Error = ""
	u.mu.Unlock()

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		up, err := mygo.Updater.Check(ctx)

		u.mu.Lock()
		u.state.Checking = false
		u.state.LastChecked = time.Now()
		switch {
		case err == mygo.ErrUpdatesDisabled:
			// Not an error worth showing: this build simply cannot update.
			u.state.Error = ""
		case err != nil:
			u.state.Error = err.Error()
			u.state.Available = nil
		default:
			u.state.Available = up // nil means already up to date
		}
		u.mu.Unlock()

		if err != nil && err != mygo.ErrUpdatesDisabled {
			log.Printf("update check: %v", err)
		}
	}()
}

// InstallAsync downloads and installs the available update in the
// background. The app is replaced on disk; it takes effect on the next
// launch (or after Relaunch).
func (u *Updater) InstallAsync() {
	u.mu.Lock()
	up := u.state.Available
	if up == nil || u.state.Installing {
		u.mu.Unlock()
		return
	}
	u.state.Installing = true
	u.state.Progress = 0
	u.state.Error = ""
	u.mu.Unlock()

	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
		defer cancel()

		err := up.Install(ctx, func(downloaded, total int64) {
			u.mu.Lock()
			if total > 0 {
				u.state.Progress = float64(downloaded) / float64(total)
			} else {
				u.state.Progress = -1
			}
			u.mu.Unlock()
		})

		u.mu.Lock()
		u.state.Installing = false
		switch {
		case err != nil:
			u.state.Error = err.Error()
		default:
			u.state.Installed = true
			u.state.Available = nil
			u.state.Progress = 1
		}
		u.mu.Unlock()

		if err != nil {
			log.Printf("update install: %v", err)
		}
	}()
}

// AutoCheck runs a check once per process, shortly after startup, so users
// learn about new versions without asking. It is a no-op when updates are
// disabled for this build.
func (u *Updater) AutoCheck() {
	u.mu.Lock()
	if u.autoChecked || !mygo.Updater.Enabled() {
		u.mu.Unlock()
		return
	}
	u.autoChecked = true
	u.mu.Unlock()

	// Delay so the window is up and interactive before any network work.
	go func() {
		time.Sleep(3 * time.Second)
		u.CheckAsync(false)
	}()
}

// Relaunch restarts the app into the installed update.
func (u *Updater) Relaunch() {
	mygo.App.Relaunch()
}
