# YoYoMusic Autoplay Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Rust-owned automatic play-through behavior so finished tracks advance, repeat, shuffle, or stop according to `playMode`, and frontend windows update from Rust events.

**Architecture:** Keep Rust Core as the playback truth source. Add playlist auto-advance helpers, playback completion detection, a background playback maintenance loop, and two snapshot events consumed by the React main and mini windows. Frontend polling remains as a fallback for progress updates.

**Tech Stack:** Tauri 2, Rust, React 19, TypeScript, Vitest, Testing Library, rodio.

## Global Constraints

- Application name remains `悠悠乐听`.
- Rust Core owns playback state and playlist current index.
- Frontend must not infer autoplay decisions.
- Event names must be exactly `playback_state_changed` and `playlist_changed`.
- `sequence` stops at the final playable track.
- `repeat_all` wraps to the first playable track.
- `repeat_one` replays the current playable track.
- `shuffle` excludes the current track when more than one playable track exists.
- Missing or unplayable tracks must not be selected by automatic advancement.
- Existing polling must remain as a fallback in this implementation.
- Do not implement tray/global-shortcut linkage, lyrics time-axis scrolling, or persistence redesign in this plan.

---

## File Structure

- `src-tauri/src/services/playlist.rs`: Owns track order and auto-advance decisions.
- `src-tauri/src/services/playback.rs`: Owns playback state, `rodio::Sink` completion detection, and stop-after-finish behavior.
- `src-tauri/src/services/autoplay.rs`: New Rust service that runs one maintenance tick and spawns the background monitor.
- `src-tauri/src/state.rs`: Emits canonical playback and playlist snapshot events.
- `src-tauri/src/lib.rs`: Wires the autoplay service and exposes `run_playback_maintenance`.
- `src/shared/tauri.ts`: Adds typed event names and `listenToAppEvent`.
- `src/App.tsx`: Subscribes the main window to autoplay events.
- `src/shared/usePlaybackProjection.ts`: New shared hook for mini/desktop projection event subscription.
- `src/main.tsx`: Uses `usePlaybackProjection` for mini and desktop routes.
- Tests live next to the touched units.

## Task 1: Playlist Auto-Advance Rules

**Files:**
- Modify: `src-tauri/src/services/playlist.rs`

**Interfaces:**
- Produces: `pub enum AutoAdvanceDecision { Play(Track), Stop }`
- Produces: `PlaylistService::auto_advance_after_finished(current_track_id: Option<&str>) -> AutoAdvanceDecision`
- Produces: `PlaylistService::select_next_track() -> Option<Track>`
- Produces: `PlaylistService::select_previous_track() -> Option<Track>`

- [ ] **Step 1: Add failing playlist auto-advance tests**

Append this test module to `src-tauri/src/services/playlist.rs`:

```rust
#[cfg(test)]
mod tests {
    use crate::{
        models::{PlayMode, Playlist, TagStatus, Track, TrackStatus},
        services::playlist::{AutoAdvanceDecision, PlaylistService},
    };

#[test]
fn sequence_advances_to_next_ready_track() {
    let mut service = playlist_with_tracks(vec![
        track("a", TrackStatus::Ready),
        track("b", TrackStatus::Ready),
    ]);
    service.select_track("a");

    let decision = service.auto_advance_after_finished(Some("a"));

    assert!(matches!(decision, AutoAdvanceDecision::Play(track) if track.id == "b"));
    assert_eq!(service.snapshot().playlist.current_index, 1);
}

#[test]
fn sequence_stops_at_last_track() {
    let mut service = playlist_with_tracks(vec![
        track("a", TrackStatus::Ready),
        track("b", TrackStatus::Ready),
    ]);
    service.select_track("b");

    let decision = service.auto_advance_after_finished(Some("b"));

    assert_eq!(decision, AutoAdvanceDecision::Stop);
    assert_eq!(service.snapshot().playlist.current_index, 1);
}

#[test]
fn repeat_all_wraps_to_first_track() {
    let mut service = playlist_with_tracks(vec![
        track("a", TrackStatus::Ready),
        track("b", TrackStatus::Ready),
    ]);
    service.set_play_mode(PlayMode::RepeatAll);
    service.select_track("b");

    let decision = service.auto_advance_after_finished(Some("b"));

    assert!(matches!(decision, AutoAdvanceDecision::Play(track) if track.id == "a"));
    assert_eq!(service.snapshot().playlist.current_index, 0);
}

#[test]
fn repeat_one_replays_current_track() {
    let mut service = playlist_with_tracks(vec![
        track("a", TrackStatus::Ready),
        track("b", TrackStatus::Ready),
    ]);
    service.set_play_mode(PlayMode::RepeatOne);
    service.select_track("b");

    let decision = service.auto_advance_after_finished(Some("b"));

    assert!(matches!(decision, AutoAdvanceDecision::Play(track) if track.id == "b"));
    assert_eq!(service.snapshot().playlist.current_index, 1);
}

#[test]
fn shuffle_does_not_repeat_current_track_when_alternatives_exist() {
    let mut service = playlist_with_tracks(vec![
        track("a", TrackStatus::Ready),
        track("b", TrackStatus::Ready),
        track("c", TrackStatus::Ready),
    ]);
    service.set_play_mode(PlayMode::Shuffle);
    service.select_track("a");

    let decision = service.auto_advance_after_finished(Some("a"));

    assert!(matches!(decision, AutoAdvanceDecision::Play(track) if track.id != "a"));
}

#[test]
fn auto_advance_skips_missing_and_unplayable_tracks() {
    let mut service = playlist_with_tracks(vec![
        track("a", TrackStatus::Ready),
        track("missing", TrackStatus::Missing),
        track("bad", TrackStatus::Unplayable),
        track("b", TrackStatus::Ready),
    ]);
    service.select_track("a");

    let decision = service.auto_advance_after_finished(Some("a"));

    assert!(matches!(decision, AutoAdvanceDecision::Play(track) if track.id == "b"));
    assert_eq!(service.snapshot().playlist.current_index, 3);
}

fn playlist_with_tracks(tracks: Vec<Track>) -> PlaylistService {
    let track_ids = tracks.iter().map(|track| track.id.clone()).collect();
    PlaylistService {
        playlist: Playlist {
            id: "default".into(),
            name: "当前播放列表".into(),
            track_ids,
            current_index: 0,
            play_mode: PlayMode::Sequence,
        },
        tracks,
    }
}

fn track(id: &str, status: TrackStatus) -> Track {
    Track {
        id: id.into(),
        file_path: format!("{id}.mp3"),
        title: id.into(),
        artist: String::new(),
        album: String::new(),
        duration_ms: 1000,
        cover_art_ref: None,
        lyrics_ref: None,
        tag_status: TagStatus::Clean,
        status,
    }
}
}
```

- [ ] **Step 2: Run failing playlist tests**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml services::playlist::tests
```

Expected: fails because `AutoAdvanceDecision` and `auto_advance_after_finished` do not exist.

- [ ] **Step 3: Implement auto-advance helpers**

In `src-tauri/src/services/playlist.rs`, add this enum above `impl Default for PlaylistService`:

```rust
#[derive(Clone, Debug, PartialEq)]
pub enum AutoAdvanceDecision {
    Play(Track),
    Stop,
}
```

Inside `impl PlaylistService`, replace `next_track` and `previous_track` with wrappers and add the helpers below:

```rust
pub fn next_track(&mut self) -> Option<Track> {
    self.select_next_track()
}

pub fn previous_track(&mut self) -> Option<Track> {
    self.select_previous_track()
}

pub fn select_next_track(&mut self) -> Option<Track> {
    if self.playlist.track_ids.is_empty() {
        return None;
    }

    self.playlist.current_index = match self.playlist.play_mode {
        PlayMode::RepeatOne => self.playlist.current_index,
        PlayMode::Shuffle => self
            .shuffle_candidate_index(self.current_track_id())
            .unwrap_or(self.playlist.current_index),
        _ => (self.playlist.current_index + 1) % self.playlist.track_ids.len(),
    };
    self.current_track()
}

pub fn select_previous_track(&mut self) -> Option<Track> {
    if self.playlist.track_ids.is_empty() {
        return None;
    }

    self.playlist.current_index = if self.playlist.current_index == 0 {
        self.playlist.track_ids.len() - 1
    } else {
        self.playlist.current_index - 1
    };
    self.current_track()
}

pub fn auto_advance_after_finished(
    &mut self,
    current_track_id: Option<&str>,
) -> AutoAdvanceDecision {
    if self.playlist.track_ids.is_empty() {
        return AutoAdvanceDecision::Stop;
    }

    if let Some(track_id) = current_track_id {
        if let Some(index) = self.playlist.track_ids.iter().position(|id| id == track_id) {
            self.playlist.current_index = index;
        }
    }

    let next_index = match self.playlist.play_mode {
        PlayMode::RepeatOne => self.playable_current_index(),
        PlayMode::RepeatAll => self.next_playable_index_wrapping(self.playlist.current_index),
        PlayMode::Shuffle => self.shuffle_candidate_index(current_track_id),
        PlayMode::Sequence => self.next_playable_index_without_wrapping(self.playlist.current_index),
    };

    let Some(index) = next_index else {
        return AutoAdvanceDecision::Stop;
    };

    self.playlist.current_index = index;
    self.current_track()
        .map(AutoAdvanceDecision::Play)
        .unwrap_or(AutoAdvanceDecision::Stop)
}

fn current_track_id(&self) -> Option<&str> {
    self.playlist
        .track_ids
        .get(self.playlist.current_index)
        .map(String::as_str)
}

fn playable_current_index(&self) -> Option<usize> {
    let track_id = self.current_track_id()?;
    self.playable_index_for_track_id(track_id)
}

fn next_playable_index_without_wrapping(&self, current_index: usize) -> Option<usize> {
    ((current_index + 1)..self.playlist.track_ids.len())
        .find(|index| self.is_playable_index(*index))
}

fn next_playable_index_wrapping(&self, current_index: usize) -> Option<usize> {
    let len = self.playlist.track_ids.len();
    if len == 0 {
        return None;
    }

    (1..=len)
        .map(|offset| (current_index + offset) % len)
        .find(|index| self.is_playable_index(*index))
}

fn shuffle_candidate_index(&self, current_track_id: Option<&str>) -> Option<usize> {
    let playable: Vec<usize> = self
        .playlist
        .track_ids
        .iter()
        .enumerate()
        .filter_map(|(index, id)| {
            if self.is_playable_index(index) {
                Some((index, id.as_str()))
            } else {
                None
            }
        })
        .filter(|(_, id)| playable_exclusion_allows(*id, current_track_id, self.playable_count()))
        .map(|(index, _)| index)
        .collect();

    if playable.is_empty() {
        return None;
    }

    let seed = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.subsec_nanos() as usize)
        .unwrap_or(0);
    Some(playable[seed % playable.len()])
}

fn playable_count(&self) -> usize {
    self.playlist
        .track_ids
        .iter()
        .enumerate()
        .filter(|(index, _)| self.is_playable_index(*index))
        .count()
}

fn playable_index_for_track_id(&self, track_id: &str) -> Option<usize> {
    self.playlist
        .track_ids
        .iter()
        .position(|id| id == track_id)
        .filter(|index| self.is_playable_index(*index))
}

fn is_playable_index(&self, index: usize) -> bool {
    let Some(track_id) = self.playlist.track_ids.get(index) else {
        return false;
    };
    self.tracks
        .iter()
        .any(|track| track.id == *track_id && track.status == TrackStatus::Ready)
}
```

Add this private function outside `impl PlaylistService`:

```rust
fn playable_exclusion_allows(id: &str, current_track_id: Option<&str>, playable_count: usize) -> bool {
    if playable_count <= 1 {
        return true;
    }
    Some(id) != current_track_id
}
```

- [ ] **Step 4: Verify playlist tests pass**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml playlist
```

Expected: all playlist tests pass.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src-tauri/src/services/playlist.rs
git commit -m "feat: add playlist autoplay rules"
```

## Task 2: Playback Completion Detection

**Files:**
- Modify: `src-tauri/src/services/playback.rs`

**Interfaces:**
- Produces: `pub enum PlaybackTick { Idle(PlaybackState), PositionChanged(PlaybackState), Finished(PlaybackState) }`
- Produces: `PlaybackService::tick() -> PlaybackTick`
- Produces: `PlaybackService::stop_after_finished() -> PlaybackState`
- Produces: test-only helper `PlaybackService::set_state_for_test(...)`

- [ ] **Step 1: Add failing playback completion tests**

In `src-tauri/src/services/playback.rs`, add these tests in the existing test module:

```rust
#[test]
fn stop_after_finished_marks_state_stopped_at_duration() {
    let mut service = PlaybackService::new_null();
    service.set_state_for_test(Some("track-1".into()), 2500, 1000, true);

    let state = service.stop_after_finished();

    assert_eq!(state.track_id.as_deref(), Some("track-1"));
    assert_eq!(state.position_ms, 2500);
    assert!(!state.is_playing);
}

#[test]
fn tick_is_idle_when_not_playing() {
    let mut service = PlaybackService::new_null();
    service.set_state_for_test(Some("track-1".into()), 2500, 1000, false);

    let tick = service.tick();

    assert!(matches!(tick, PlaybackTick::Idle(state) if !state.is_playing));
}
```

- [ ] **Step 2: Run failing playback tests**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml services::playback::tests
```

Expected: fails because `PlaybackTick`, `tick`, `stop_after_finished`, and `set_state_for_test` do not exist.

- [ ] **Step 3: Implement playback tick primitives**

In `src-tauri/src/services/playback.rs`, add this enum after `AudioBackend`:

```rust
#[derive(Clone, Debug, PartialEq)]
pub enum PlaybackTick {
    Idle(PlaybackState),
    PositionChanged(PlaybackState),
    Finished(PlaybackState),
}
```

Inside `impl PlaybackService`, add:

```rust
pub fn tick(&mut self) -> PlaybackTick {
    let previous_position = self.state.position_ms;

    if self.state.track_id.is_none() || !self.state.is_playing {
        return PlaybackTick::Idle(self.current_state());
    }

    self.sync_position_from_sink();

    if self.current_sink_finished() {
        let state = self.stop_after_finished();
        return PlaybackTick::Finished(state);
    }

    let state = self.current_state();
    if state.position_ms != previous_position {
        PlaybackTick::PositionChanged(state)
    } else {
        PlaybackTick::Idle(state)
    }
}

pub fn stop_after_finished(&mut self) -> PlaybackState {
    self.sync_position_from_sink();
    self.state.position_ms = self.state.duration_ms;
    self.state.is_playing = false;
    self.current_state()
}

fn current_sink_finished(&self) -> bool {
    self.audio
        .as_ref()
        .and_then(|audio| audio.sink.as_ref())
        .map(|sink| sink.empty())
        .unwrap_or(false)
}
```

Inside the existing `#[cfg(test)] mod tests`, add this test-only helper implementation:

```rust
#[cfg(test)]
impl PlaybackService {
    fn set_state_for_test(
        &mut self,
        track_id: Option<String>,
        duration_ms: u64,
        position_ms: u64,
        is_playing: bool,
    ) {
        self.state.track_id = track_id;
        self.state.duration_ms = duration_ms;
        self.state.position_ms = position_ms;
        self.state.is_playing = is_playing;
    }
}
```

- [ ] **Step 4: Verify playback tests pass**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml playback
```

Expected: all playback tests pass.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src-tauri/src/services/playback.rs
git commit -m "feat: detect playback completion"
```

## Task 3: Rust Autoplay Service and Event Emission

**Files:**
- Create: `src-tauri/src/services/autoplay.rs`
- Modify: `src-tauri/src/state.rs`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Produces: `services::autoplay::run_playback_maintenance(app: &tauri::AppHandle) -> Result<(), AppError>`
- Produces: `services::autoplay::spawn_playback_monitor(app: tauri::AppHandle) -> Result<(), AppError>`
- Produces: `AppState::emit_playback_state(app: &tauri::AppHandle, state: &PlaybackState)`
- Produces: `AppState::emit_playlist(app: &tauri::AppHandle, snapshot: &PlaylistSnapshot)`
- Produces Tauri command: `run_playback_maintenance`

- [ ] **Step 1: Add autoplay service**

Create `src-tauri/src/services/autoplay.rs`:

```rust
use std::{thread, time::Duration};

use tauri::Manager;

use crate::{
    errors::AppError,
    models::{PlaybackState, PlaylistSnapshot},
    services::{
        playback::PlaybackTick,
        playlist::{AutoAdvanceDecision, PlaylistService},
    },
    state::AppState,
};

pub fn spawn_playback_monitor(app: tauri::AppHandle) -> Result<(), AppError> {
    thread::Builder::new()
        .name("yoyomusic-autoplay".into())
        .spawn(move || loop {
            thread::sleep(Duration::from_millis(500));
            if let Err(err) = run_playback_maintenance(&app) {
                log::warn!("playback maintenance failed: {err}");
            }
        })
        .map(|_| ())
        .map_err(|err| AppError::StorageFailed(err.to_string()))
}

pub fn run_playback_maintenance(app: &tauri::AppHandle) -> Result<(), AppError> {
    let app_state = app.state::<AppState>();
    let tick = {
        let mut playback = app_state
            .playback
            .lock()
            .map_err(|err| AppError::StorageFailed(err.to_string()))?;
        playback.tick()
    };

    match tick {
        PlaybackTick::Finished(finished_state) => handle_finished_playback(app, finished_state),
        PlaybackTick::PositionChanged(state) => {
            AppState::emit_playback_state(app, &state);
            Ok(())
        }
        PlaybackTick::Idle(_) => Ok(()),
    }
}

fn handle_finished_playback(
    app: &tauri::AppHandle,
    finished_state: PlaybackState,
) -> Result<(), AppError> {
    let app_state = app.state::<AppState>();
    let (decision, playlist_snapshot) = {
        let mut playlist = app_state
            .playlist
            .lock()
            .map_err(|err| AppError::StorageFailed(err.to_string()))?;
        let decision = playlist.auto_advance_after_finished(finished_state.track_id.as_deref());
        let snapshot = playlist.snapshot();
        (decision, snapshot)
    };

    let playback_state = apply_auto_advance_decision(app, decision)?;
    AppState::emit_playlist(app, &playlist_snapshot);
    AppState::emit_playback_state(app, &playback_state);
    Ok(())
}

fn apply_auto_advance_decision(
    app: &tauri::AppHandle,
    decision: AutoAdvanceDecision,
) -> Result<PlaybackState, AppError> {
    let app_state = app.state::<AppState>();
    let mut playback = app_state
        .playback
        .lock()
        .map_err(|err| AppError::StorageFailed(err.to_string()))?;

    match decision {
        AutoAdvanceDecision::Play(track) => playback
            .play(track)
            .or_else(|_| Ok(playback.stop_after_finished())),
        AutoAdvanceDecision::Stop => Ok(playback.stop_after_finished()),
    }
}
```

- [ ] **Step 2: Add event emitters to AppState**

In `src-tauri/src/state.rs`, update imports:

```rust
use tauri::Emitter;

use crate::{
    errors::AppError,
    models::{AppSettings, PlaybackState, PlaylistSnapshot},
    services::{playback::PlaybackService, playlist::PlaylistService, settings::SettingsService},
};
```

Add constants and helper methods:

```rust
pub const PLAYBACK_STATE_CHANGED: &str = "playback_state_changed";
pub const PLAYLIST_CHANGED: &str = "playlist_changed";
```

Inside `impl AppState`, add:

```rust
pub fn emit_playback_state(app: &tauri::AppHandle, state: &PlaybackState) {
    let _ = app.emit(PLAYBACK_STATE_CHANGED, state.clone());
}

pub fn emit_playlist(app: &tauri::AppHandle, snapshot: &PlaylistSnapshot) {
    let _ = app.emit(PLAYLIST_CHANGED, snapshot.clone());
}
```

- [ ] **Step 3: Wire autoplay service in lib**

In `src-tauri/src/lib.rs`, add the service module inside `pub mod services`:

```rust
pub mod autoplay;
```

Add command in `pub mod commands`:

```rust
#[tauri::command]
pub fn run_playback_maintenance(app: tauri::AppHandle) -> Result<String, errors::AppError> {
    crate::services::autoplay::run_playback_maintenance(&app)?;
    Ok("ok".into())
}
```

In setup, after `services::tray::setup_tray(app.handle())?;`, add:

```rust
services::autoplay::spawn_playback_monitor(app.handle().clone())?;
```

Add `commands::run_playback_maintenance` to `tauri::generate_handler![...]`.

- [ ] **Step 4: Run Rust verification**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: all Rust tests pass.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src-tauri/src/services/autoplay.rs src-tauri/src/state.rs src-tauri/src/lib.rs
git commit -m "feat: add autoplay maintenance events"
```

## Task 4: Typed Frontend Event Bridge

**Files:**
- Modify: `src/shared/tauri.ts`
- Modify: `src/shared/tauri.test.ts`

**Interfaces:**
- Produces: `AppEventName = "playback_state_changed" | "playlist_changed"`
- Produces: `listenToAppEvent<T>(event: AppEventName, handler: (payload: T) => void): Promise<() => void>`
- Extends: `CommandName` with `"run_playback_maintenance"`

- [ ] **Step 1: Add failing event bridge test**

Update `src/shared/tauri.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { invokeCommand, listenToAppEvent } from "./tauri";

const listenMock = vi.hoisted(() =>
  vi.fn(async (_event: string, _handler: (event: { payload: unknown }) => void) => vi.fn()),
);

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (name: string, payload: unknown) => ({ name, payload })),
}));

vi.mock("@tauri-apps/api/event", () => ({
  listen: (event: string, handler: (event: { payload: unknown }) => void) => listenMock(event, handler),
}));

describe("invokeCommand", () => {
  it("forwards a typed command to Tauri invoke", async () => {
    const result = await invokeCommand("get_playlist", { playlistId: "default" });

    expect(result).toEqual({
      name: "get_playlist",
      payload: { playlistId: "default" },
    });
  });
});

describe("listenToAppEvent", () => {
  it("forwards event payloads to the handler", async () => {
    const handler = vi.fn();
    await listenToAppEvent("playback_state_changed", handler);

    const registeredHandler = listenMock.mock.calls[0][1] as (event: { payload: unknown }) => void;
    registeredHandler({ payload: { isPlaying: true } });

    expect(listenMock).toHaveBeenCalledWith("playback_state_changed", expect.any(Function));
    expect(handler).toHaveBeenCalledWith({ isPlaying: true });
  });
});
```

- [ ] **Step 2: Run failing frontend bridge test**

Run:

```powershell
npm test -- src/shared/tauri.test.ts
```

Expected: fails because `listenToAppEvent` does not exist.

- [ ] **Step 3: Implement event bridge**

Update `src/shared/tauri.ts`:

```ts
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
```

Add command name:

```ts
  | "run_playback_maintenance";
```

Add event types and function at the end of the file:

```ts
export type AppEventName = "playback_state_changed" | "playlist_changed";

export async function listenToAppEvent<T>(
  event: AppEventName,
  handler: (payload: T) => void,
): Promise<() => void> {
  return listen<T>(event, (eventPayload) => handler(eventPayload.payload));
}
```

- [ ] **Step 4: Verify event bridge test passes**

Run:

```powershell
npm test -- src/shared/tauri.test.ts
```

Expected: test passes.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src/shared/tauri.ts src/shared/tauri.test.ts
git commit -m "feat: add playback event bridge"
```

## Task 5: Frontend Event Subscriptions

**Files:**
- Create: `src/shared/usePlaybackProjection.ts`
- Create: `src/shared/usePlaybackProjection.test.tsx`
- Create: `src/App.autoplay.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`

**Interfaces:**
- Produces: `usePlaybackProjection(): { currentTrack: Track | null; playback: PlaybackState; runCommand: (...) => Promise<void> }`
- Consumes: `listenToAppEvent<PlaybackState>("playback_state_changed", ...)`
- Consumes: `listenToAppEvent<PlaylistSnapshot>("playlist_changed", ...)`

- [ ] **Step 1: Add failing shared projection hook test**

Create `src/shared/usePlaybackProjection.test.tsx`:

```tsx
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePlaybackProjection } from "./usePlaybackProjection";
import type { PlaybackState, PlaylistSnapshot, Track } from "./types";

const testState = vi.hoisted(() => {
  function track(id: string, title: string): Track {
    return {
      id,
      filePath: `${id}.mp3`,
      title,
      artist: "",
      album: "",
      durationMs: 1000,
      coverArtRef: null,
      lyricsRef: null,
      tagStatus: "clean",
      status: "ready",
    };
  }

  return {
    listeners: new Map<string, (payload: unknown) => void>(),
    playlistSnapshot: {
      playlist: {
        id: "default",
        name: "当前播放列表",
        trackIds: ["a", "b"],
        currentIndex: 0,
        playMode: "sequence",
      },
      tracks: [
        track("a", "Song A"),
        track("b", "Song B"),
      ],
    } satisfies PlaylistSnapshot,
    stoppedPlayback: {
      trackId: "a",
      positionMs: 0,
      durationMs: 1000,
      volume: 0.8,
      isPlaying: false,
      isMuted: false,
      playMode: "sequence",
      eqEnabled: false,
    } satisfies PlaybackState,
  };
});

vi.mock("./tauri", () => ({
  isTauriRuntime: () => true,
  invokeCommand: vi.fn(async (command: string) => {
    if (command === "get_playlist") return testState.playlistSnapshot;
    if (command === "get_playback_state") return testState.stoppedPlayback;
    return {};
  }),
  listenToAppEvent: vi.fn(async (event: string, handler: (payload: unknown) => void) => {
    testState.listeners.set(event, handler);
    return vi.fn();
  }),
}));

function Probe() {
  const { currentTrack, playback } = usePlaybackProjection();
  return (
    <div>
      <span>{currentTrack?.title ?? "none"}</span>
      <span>{playback.isPlaying ? "playing" : "stopped"}</span>
    </div>
  );
}

describe("usePlaybackProjection", () => {
  beforeEach(() => {
    testState.listeners.clear();
  });

  it("updates track and playback from app events", async () => {
    render(<Probe />);
    expect(await screen.findByText("Song A")).toBeInTheDocument();

    act(() => {
      testState.listeners.get("playlist_changed")?.({
        ...testState.playlistSnapshot,
        playlist: { ...testState.playlistSnapshot.playlist, currentIndex: 1 },
      });
      testState.listeners.get("playback_state_changed")?.({
        ...testState.stoppedPlayback,
        trackId: "b",
        isPlaying: true,
      });
    });

    expect(screen.getByText("Song B")).toBeInTheDocument();
    expect(screen.getByText("playing")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Add failing App event test**

Create `src/App.autoplay.test.tsx`:

```tsx
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { AppSettings, PlaybackState, PlaylistSnapshot, Track } from "./shared/types";

const testState = vi.hoisted(() => {
  function track(id: string, title: string): Track {
    return {
      id,
      filePath: `${id}.mp3`,
      title,
      artist: "",
      album: "",
      durationMs: 1000,
      coverArtRef: null,
      lyricsRef: null,
      tagStatus: "clean",
      status: "ready",
    };
  }

  return {
    listeners: new Map<string, (payload: unknown) => void>(),
    playlistSnapshot: {
      playlist: {
        id: "default",
        name: "当前播放列表",
        trackIds: ["a", "b"],
        currentIndex: 0,
        playMode: "sequence",
      },
      tracks: [
        track("a", "Song A"),
        track("b", "Song B"),
      ],
    } satisfies PlaylistSnapshot,
    stoppedPlayback: {
      trackId: "a",
      positionMs: 0,
      durationMs: 1000,
      volume: 0.8,
      isPlaying: false,
      isMuted: false,
      playMode: "sequence",
      eqEnabled: false,
    } satisfies PlaybackState,
    settings: {
      defaultSkin: "default",
      shortcuts: {},
      enrichmentEnabled: false,
      cacheRetentionDays: 30,
      recentPlaylists: [],
      restoreSession: true,
      visualizationMode: "spectrum",
      equalizer: {
        enabled: false,
        preset: "flat",
        bands: Array(10).fill(0),
      },
    } satisfies AppSettings,
  };
});

vi.mock("./shared/tauri", () => ({
  isTauriRuntime: () => true,
  invokeCommand: vi.fn(async (command: string) => {
    if (command === "get_playlist") return testState.playlistSnapshot;
    if (command === "get_playback_state") return testState.stoppedPlayback;
    if (command === "load_settings") return testState.settings;
    return {};
  }),
  listenToAppEvent: vi.fn(async (event: string, handler: (payload: unknown) => void) => {
    testState.listeners.set(event, handler);
    return vi.fn();
  }),
}));

vi.mock("./shared/fileDialog", () => ({
  openAudioFiles: vi.fn(async () => []),
  openAudioFolders: vi.fn(async () => []),
  openSkinPackageFolder: vi.fn(async () => null),
}));

describe("App autoplay events", () => {
  beforeEach(() => {
    testState.listeners.clear();
  });

  it("updates the now playing card from playlist and playback events", async () => {
    render(<App />);
    expect(await screen.findByText("Song A")).toBeInTheDocument();

    act(() => {
      testState.listeners.get("playlist_changed")?.({
        ...testState.playlistSnapshot,
        playlist: { ...testState.playlistSnapshot.playlist, currentIndex: 1 },
      });
      testState.listeners.get("playback_state_changed")?.({
        ...testState.stoppedPlayback,
        trackId: "b",
        isPlaying: true,
      });
    });

    expect(screen.getByText("Song B")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "暂停" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run failing frontend event tests**

Run:

```powershell
npm test -- src/shared/usePlaybackProjection.test.tsx src/App.autoplay.test.tsx
```

Expected: fails because `usePlaybackProjection` does not exist and `App` does not subscribe to events.

- [ ] **Step 4: Create shared projection hook**

Create `src/shared/usePlaybackProjection.ts`:

```ts
import { useEffect, useState } from "react";
import { invokeCommand, isTauriRuntime, listenToAppEvent, type CommandName, type CommandPayload } from "./tauri";
import type { PlaybackState, PlaylistSnapshot, Track } from "./types";

const emptyPlaylist: PlaylistSnapshot = {
  playlist: {
    id: "default",
    name: "当前播放列表",
    trackIds: [],
    currentIndex: 0,
    playMode: "sequence",
  },
  tracks: [],
};

const initialPlayback: PlaybackState = {
  trackId: null,
  positionMs: 0,
  durationMs: 0,
  volume: 0.8,
  isPlaying: false,
  isMuted: false,
  playMode: "sequence",
  eqEnabled: false,
};

export function usePlaybackProjection() {
  const [playlist, setPlaylist] = useState<PlaylistSnapshot>(emptyPlaylist);
  const [playback, setPlayback] = useState<PlaybackState>(initialPlayback);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    let cancelled = false;
    const unlisteners: Array<() => void> = [];

    async function loadState() {
      const [playlistSnapshot, playbackState] = await Promise.all([
        invokeCommand<PlaylistSnapshot>("get_playlist"),
        invokeCommand<PlaybackState>("get_playback_state"),
      ]);

      if (!cancelled) {
        setPlaylist(playlistSnapshot);
        setPlayback(playbackState);
      }
    }

    void loadState();
    void listenToAppEvent<PlaylistSnapshot>("playlist_changed", setPlaylist).then((unlisten) => {
      unlisteners.push(unlisten);
    });
    void listenToAppEvent<PlaybackState>("playback_state_changed", setPlayback).then((unlisten) => {
      unlisteners.push(unlisten);
    });

    const intervalId = window.setInterval(() => {
      void loadState();
    }, 500);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, []);

  async function runCommand(command: CommandName, payload: CommandPayload = {}) {
    if (!isTauriRuntime()) {
      console.debug(command, payload);
      return;
    }

    if (isPlaybackCommand(command)) {
      setPlayback(await invokeCommand<PlaybackState>(command, payload));
    } else if (isPlaylistCommand(command)) {
      setPlaylist(await invokeCommand<PlaylistSnapshot>(command, payload));
    } else {
      await invokeCommand<unknown>(command, payload);
    }
  }

  return {
    currentTrack: findCurrentTrack(playlist, playback.trackId),
    playback,
    runCommand,
  };
}

function findCurrentTrack(snapshot: PlaylistSnapshot, trackId: string | null): Track | null {
  if (trackId) {
    const track = snapshot.tracks.find((candidate) => candidate.id === trackId);
    if (track) return track;
  }

  const fallbackId = snapshot.playlist.trackIds[snapshot.playlist.currentIndex];
  return snapshot.tracks.find((candidate) => candidate.id === fallbackId) ?? null;
}

function isPlaybackCommand(command: CommandName) {
  return [
    "play_track",
    "toggle_playback",
    "pause_playback",
    "next_track",
    "previous_track",
    "seek",
    "set_volume",
    "set_muted",
    "set_play_mode",
    "get_playback_state",
    "run_playback_maintenance",
  ].includes(command);
}

function isPlaylistCommand(command: CommandName) {
  return command === "add_tracks" || command === "remove_track" || command === "clear_playlist";
}
```

- [ ] **Step 5: Subscribe App to events**

In `src/App.tsx`, update the tauri import:

```ts
import {
  invokeCommand,
  isTauriRuntime,
  listenToAppEvent,
  type CommandName,
  type CommandPayload,
} from "./shared/tauri";
```

Add this effect after the initial-state loading effect:

```tsx
useEffect(() => {
  if (!isTauriRuntime()) return;

  const unlisteners: Array<() => void> = [];
  void listenToAppEvent<PlaylistSnapshot>("playlist_changed", setPlaylist).then((unlisten) => {
    unlisteners.push(unlisten);
  });
  void listenToAppEvent<PlaybackState>("playback_state_changed", setPlayback).then((unlisten) => {
    unlisteners.push(unlisten);
  });

  return () => {
    unlisteners.forEach((unlisten) => unlisten());
  };
}, []);
```

- [ ] **Step 6: Use shared hook in main routes**

In `src/main.tsx`, remove the local `usePlaybackProjection`, `findCurrentTrack`, `isPlaybackCommand`, and `isPlaylistCommand` implementations.

Update imports to:

```ts
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { DesktopLyrics } from "./features/lyrics/DesktopLyrics";
import { MiniPlayer } from "./features/mini/MiniPlayer";
import { usePlaybackProjection } from "./shared/usePlaybackProjection";
```

Keep `RootWindow`, `MiniPlayerRoute`, and `DesktopLyricsRoute` using the imported hook.

- [ ] **Step 7: Verify frontend event tests pass**

Run:

```powershell
npm test -- src/shared/tauri.test.ts src/shared/usePlaybackProjection.test.tsx src/App.autoplay.test.tsx
```

Expected: tests pass.

- [ ] **Step 8: Commit**

Run:

```powershell
git add src/App.tsx src/App.autoplay.test.tsx src/main.tsx src/shared/usePlaybackProjection.ts src/shared/usePlaybackProjection.test.tsx
git commit -m "feat: subscribe windows to playback events"
```

## Task 6: Final Autoplay Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/building.md`

**Interfaces:**
- Produces documentation note that automatic play-through is Rust-owned and event-driven.

- [ ] **Step 1: Add release readiness note**

Append this to `docs/building.md` under `Release readiness checks`:

```markdown
Autoplay smoke check:

1. Add at least two local audio files.
2. Set play mode to `顺序播放` and play the first track.
3. Wait for the first track to finish and confirm the second track starts automatically.
4. Set play mode to `列表循环` and confirm the final track wraps to the first track.
5. Open mini mode and confirm it follows automatic track changes.
```

Update `README.md` implemented range bullet from:

```markdown
- 播放、暂停、上一首、下一首、seek、音量、静音和播放模式命令。
```

to:

```markdown
- 播放、暂停、上一首、下一首、自动连播、seek、音量、静音和播放模式命令。
```

- [ ] **Step 2: Run full local verification**

Run:

```powershell
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
npm run tauri build
```

Expected:

- `npm test` passes all frontend tests.
- `npm run build` completes TypeScript and Vite production build.
- `cargo test --manifest-path src-tauri/Cargo.toml` passes all Rust tests.
- `npm run tauri build` produces Windows MSI and NSIS artifacts under `src-tauri/target/release/bundle/`.

- [ ] **Step 3: Verify evidence by search**

Run:

```powershell
rg -n "auto_advance_after_finished|PlaybackTick|run_playback_maintenance|playback_state_changed|playlist_changed|listenToAppEvent|usePlaybackProjection"
```

Expected: every listed term appears in source or tests.

- [ ] **Step 4: Commit**

Run:

```powershell
git add README.md docs/building.md
git commit -m "docs: document autoplay readiness checks"
```

## Self-Review Checklist

- Spec coverage: Tasks 1-3 implement Rust-owned auto-advance, completion detection, event emission, and background maintenance. Tasks 4-5 implement frontend event consumption. Task 6 documents verification.
- Placeholder scan: This plan contains no `TODO`, `TBD`, or unspecified implementation steps.
- Type consistency: Event names match the spec exactly: `playback_state_changed` and `playlist_changed`. Command names follow the existing `CommandName` pattern.
- Scope check: Tray/global-shortcut linkage, desktop lyrics time-axis scrolling, and persistence redesign are intentionally excluded.
