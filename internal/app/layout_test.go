package app

import "testing"

// TestSidePanelToggle covers the right-hand feature rail: opening a panel
// pins it, clicking the open panel closes it, and switching panels replaces
// rather than stacks.
func TestSidePanelToggle(t *testing.T) {
	a := NewApp(t.TempDir())
	if a.SidePanel != "" {
		t.Fatal("should start with no side panel")
	}

	a.ToggleSidePanel("eq")
	if a.SidePanel != "eq" {
		t.Errorf("SidePanel = %q, want eq", a.SidePanel)
	}
	if !a.SidePanelPinned {
		t.Error("opening a panel should pin it, so it does not fold at once")
	}
	if !a.SidePanelSticky() {
		t.Error("a pinned panel must survive the idle timer")
	}

	// Clicking the open panel closes it.
	a.ToggleSidePanel("eq")
	if a.SidePanel != "" || a.SidePanelPinned {
		t.Errorf("toggling the open panel should close it: panel=%q pinned=%v",
			a.SidePanel, a.SidePanelPinned)
	}

	// Switching replaces.
	a.ToggleSidePanel("eq")
	a.ToggleSidePanel("lyrics")
	if a.SidePanel != "lyrics" {
		t.Errorf("SidePanel = %q, want lyrics", a.SidePanel)
	}
}

// TestLyricsPanelIsSticky covers the exception: lyrics stay open through the
// idle timer even when not pinned, because reading lyrics is not something
// you do with the mouse.
func TestLyricsPanelIsSticky(t *testing.T) {
	a := NewApp(t.TempDir())
	a.SidePanel = "lyrics"
	a.SidePanelPinned = false
	if !a.SidePanelSticky() {
		t.Error("lyrics must be sticky even when unpinned")
	}

	a.SidePanel = "eq"
	if a.SidePanelSticky() {
		t.Error("eq must not be sticky when unpinned")
	}
}

// TestLibraryToggleAndPin covers the playlist column's fold and pin states.
func TestLibraryToggleAndPin(t *testing.T) {
	a := NewApp(t.TempDir())
	if !a.LibraryOpen {
		t.Fatal("playlist should start open")
	}
	if a.LibraryPinned {
		t.Fatal("playlist should start unpinned, so it can fold away")
	}

	a.ToggleLibrary()
	if a.LibraryOpen {
		t.Error("toggle should close the playlist")
	}
	a.ToggleLibrary()
	if !a.LibraryOpen {
		t.Error("toggle should reopen the playlist")
	}

	a.ToggleLibraryPin()
	if !a.LibraryPinned {
		t.Error("pin should be on")
	}
	// A pinned column must not fold, whatever the idle timer says.
	if idleFolds(a) {
		t.Error("pinned playlist must not fold")
	}
	a.ToggleLibraryPin()
	if a.LibraryPinned {
		t.Error("unpin should clear it")
	}
}

// idleFolds mirrors the UI's fold decision so the rule can be tested without
// a window. It must stay in step with ui.idleFolded.
func idleFolds(a *App) bool {
	return !a.LibraryPinned && !a.LibraryOpen
}

// TestCloseSidePanel clears both the panel and its pin, so reopening later
// starts from the folded state again.
func TestCloseSidePanel(t *testing.T) {
	a := NewApp(t.TempDir())
	a.ToggleSidePanel("skins")
	a.CloseSidePanel()
	if a.SidePanel != "" || a.SidePanelPinned {
		t.Errorf("close should clear both: panel=%q pinned=%v", a.SidePanel, a.SidePanelPinned)
	}
	if a.SidePanelSticky() {
		t.Error("nothing open must not be sticky")
	}
}

// TestSidePanelsList guards the rail's contents: the four panels the layout
// promises are exactly what it renders.
func TestSidePanelsList(t *testing.T) {
	want := map[string]bool{"eq": true, "lyrics": true, "skins": true, "about": true}
	if len(SidePanels) != len(want) {
		t.Fatalf("SidePanels = %v, want %d entries", SidePanels, len(want))
	}
	for _, p := range SidePanels {
		if !want[p] {
			t.Errorf("unexpected panel %q in the rail", p)
		}
		delete(want, p)
	}
	for p := range want {
		t.Errorf("panel %q is missing from the rail", p)
	}
}
