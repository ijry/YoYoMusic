# YoYoMusic Playback Usability Design

## Goal

Make YoYoMusic feel like a usable local music player when users press playback controls. The app already has a Tauri command layer, playlist service, Rodio playback service, event emission, and frontend polling. This pass should tighten that chain so common user actions produce clear, reliable feedback instead of feeling inert.

## Current Findings

- The frontend playback controls already call Tauri commands such as `toggle_playback`, `previous_track`, `next_track`, `seek`, `set_volume`, `set_muted`, and `set_play_mode`.
- Track rows call `play_track` with a track id, and playlist add/remove/clear actions are already wired.
- The Rust playback service can play files through Rodio, pause, seek, mute, clamp volume, and report position from the active sink.
- The playlist service already has play-mode-aware auto-advance logic and can skip missing or unplayable tracks during automatic advance.
- The weak spot is user-visible behavior around edge cases: empty queues, no selected track, missing/unplayable files, transport controls that appear clickable when they cannot do useful work, and keeping playlist/playback state aligned after commands.

## User Experience Requirements

- Empty playlist: pressing play, previous, or next should not look broken. Controls that cannot do useful work should be disabled or produce a clear user-facing message.
- Loaded playlist with no active track: pressing play should start the current playlist item instead of doing nothing.
- Track row activation: clicking a ready track should select and play it; current track state should update consistently.
- Missing or unplayable tracks: the UI should visibly mark them, avoid presenting them as normal playable rows, and avoid blocking automatic advance when alternatives exist.
- Playback completion: when a track finishes, sequence/repeat/shuffle behavior should continue to match playlist play mode and emit both playlist and playback updates.
- Playback controls: progress, play/pause text, mute state, play mode, and volume should stay in sync with the backend state.
- Error feedback: backend errors should become readable app messages rather than silent console-only failures.

## Design

The implementation should improve the existing chain rather than replace it.

Frontend behavior:

- Extend `PlayerControls` with capability props derived from playlist/playback state, such as whether there are tracks and whether playback can start.
- Disable transport buttons only when there is no useful action, while preserving keyboard accessibility and visible disabled styling.
- Keep volume and seek controls usable when a track exists; seek should remain bounded by known duration.
- Add clear tests that empty queues do not dispatch inert playback commands from disabled buttons.

App command orchestration:

- In browser mode, keep debug behavior for development but make desktop-mode behavior explicit in tests.
- In Tauri mode, if `toggle_playback` is requested with no active track but the playlist has a current ready track, call `play_track` for that track rather than sending a no-op toggle to the backend.
- After playback commands that can change the selected track, ensure both playback and playlist state are updated when necessary.
- Continue using `playback_state_changed` and `playlist_changed` events as the source of truth for async maintenance updates.

Rust service behavior:

- Keep the existing Rodio playback service and playlist service.
- Add focused tests for the command/service boundary where possible, especially automatic advance and no-op cases.
- If a play request fails because the file is missing or unplayable, mark the corresponding track status and emit an updated playlist snapshot so the UI can show the problem.
- Preserve current play modes: `sequence`, `repeat_all`, `repeat_one`, and `shuffle`.

Visual and interaction feedback:

- Use existing error banner and status pills for messages; do not introduce a new notification system in this pass.
- Use existing disabled button styling and hardwareized controls; do not redesign skins.
- Track rows should keep the existing `文件丢失` and `不可播放` flags, but ready/playable rows should be clearly the only normal activation targets.

## Non-Goals

- No new audio engine and no replacement of Rodio.
- No real FFT or audio-analysis changes.
- No new skin layouts or visual redesign.
- No persistence redesign for playlists or sessions.
- No online metadata/lyrics work.
- No new dependencies.

## Testing Plan

- Frontend component tests for `PlayerControls` disabled states, command dispatch, seek, mute, volume, and play-mode cycling.
- App-level tests for empty playlist behavior, loaded playlist play-from-current behavior, and readable error display when a playback command fails.
- Playlist panel tests for ready, missing, and unplayable row affordances.
- Rust unit tests for playlist auto-advance remain part of the targeted suite.
- Rust playback service tests should cover no-track toggle, volume clamp, finished state, and missing-file rejection.
- Run targeted frontend and Rust tests, then full `npm test`, `npm run build`, and `npm run tauri build`.
- Install the newest MSI and smoke-check adding music, clicking a track, play/pause, next/previous, mute/volume, and no full-window scrolling.

## Success Criteria

- A user can add local files, click a track, and see the player state change immediately.
- Pressing play with a populated playlist starts a track even if nothing was previously active.
- Empty or invalid actions are visibly handled, not silent.
- Missing/unplayable tracks are marked and do not block normal queue progression.
- Existing skin switching, visualization modes, fixed shell layout, and installer behavior continue to pass tests.
