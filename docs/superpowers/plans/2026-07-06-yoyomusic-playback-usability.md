# YoYoMusic Playback Usability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make playback controls produce clear, reliable results for empty queues, queued tracks, invalid tracks, and normal transport actions.

**Architecture:** Keep the existing React layout, Tauri command layer, `PlaylistService`, and Rodio-backed `PlaybackService`. Add frontend capability gating, app-level play-from-current orchestration, and backend playlist status updates for failed playback attempts. Verify with focused frontend tests, Rust service tests, full build, installer, and smoke checks.

**Tech Stack:** Tauri 2, React 19, TypeScript, Vitest, Testing Library, Rust, Rodio.

## Global Constraints

- Use Node `22.22.2` for all npm/test/build commands.
- Do not add new dependencies.
- Do not redesign skins or change visualization behavior.
- Do not replace Rodio or rewrite the audio engine.
- Preserve existing play modes: `sequence`, `repeat_all`, `repeat_one`, `shuffle`.
- Preserve fixed shell layout and internal scroll zones.
- Keep `.superpowers/` untracked and do not stage it.
- Use `apply_patch` for manual edits.

---

## File Structure

- Modify `src/features/player/PlayerControls.tsx`: add transport capability props and disable inert controls.
- Modify `src/features/player/PlayerControls.test.tsx`: cover enabled command dispatch and disabled empty-queue behavior.
- Modify `src/features/skin/layoutShared.tsx`: pass playable-track capability into `PlayerControls`.
- Modify `src/App.tsx`: resolve `toggle_playback` to `play_track` when a ready current playlist item exists, and sync playlist current index after transport commands.
- Modify `src/App.autoplay.test.tsx`: cover play-from-current and readable playback errors.
- Modify `src-tauri/src/services/playlist.rs`: add a focused method for marking track status.
- Modify `src-tauri/src/lib.rs`: emit playlist updates on selection changes and mark failed play attempts as missing/unplayable.
- Run existing Rust tests in `src-tauri/tests/playlist_service.rs` plus crate unit tests.

---

### Task 1: Gate Inert Transport Controls

**Files:**
- Modify: `src/features/player/PlayerControls.tsx`
- Modify: `src/features/player/PlayerControls.test.tsx`
- Modify: `src/features/skin/layoutShared.tsx`

**Interfaces:**
- Consumes: `PlaybackState` from `src/shared/types.ts`.
- Produces: `PlayerControls({ state, hasPlayableTrack, onCommand })`, where `hasPlayableTrack?: boolean` defaults to `Boolean(state.trackId)`.

- [ ] **Step 1: Replace `PlayerControls.test.tsx` with failing disabled-state coverage**

Replace `src/features/player/PlayerControls.test.tsx` with this complete content:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlayerControls } from "./PlayerControls";
import type { PlaybackState } from "../../shared/types";

const baseState: PlaybackState = {
  trackId: "1",
  positionMs: 1000,
  durationMs: 5000,
  volume: 0.5,
  isPlaying: false,
  isMuted: false,
  playMode: "sequence",
  eqEnabled: false,
};

describe("PlayerControls", () => {
  it("calls playback commands from enabled controls", async () => {
    const user = userEvent.setup();
    const onCommand = vi.fn();
    const { container } = render(
      <PlayerControls state={baseState} hasPlayableTrack={true} onCommand={onCommand} />,
    );

    const playButton = screen.getByRole("button", { name: "播放" });
    const progress = screen.getByLabelText("播放进度");
    const volume = screen.getByLabelText("音量");

    expect(playButton).toHaveClass("transport-button", "transport-button--play");
    expect(playButton).not.toBeDisabled();
    expect(progress).toHaveClass("progress-rail");
    expect(progress).not.toBeDisabled();
    expect(volume).toHaveClass("volume-input");
    expect(container.querySelector(".volume-well__tick")).toBeInTheDocument();
    expect(container.querySelector(".transport-status-strip")).toBeInTheDocument();
    expect(container.querySelectorAll(".transport-status-light")).toHaveLength(3);
    expect(container.querySelectorAll(".control-monitor")).toHaveLength(2);

    await user.click(playButton);
    await user.click(screen.getByRole("button", { name: "下一首" }));
    await user.clear(volume);
    await user.type(volume, "80");

    expect(onCommand).toHaveBeenCalledWith("toggle_playback", {});
    expect(onCommand).toHaveBeenCalledWith("next_track", {});
    expect(onCommand).toHaveBeenCalledWith("set_volume", { value: 0.8 });
  });

  it("disables inert transport controls when there is no playable track", async () => {
    const user = userEvent.setup();
    const onCommand = vi.fn();
    render(
      <PlayerControls
        state={{ ...baseState, trackId: null, positionMs: 0, durationMs: 0 }}
        hasPlayableTrack={false}
        onCommand={onCommand}
      />,
    );

    expect(screen.getByRole("button", { name: "上一首" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "播放" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "下一首" })).toBeDisabled();
    expect(screen.getByRole("slider", { name: "播放进度" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "静音" })).not.toBeDisabled();

    await user.click(screen.getByRole("button", { name: "播放" }));
    await user.click(screen.getByRole("button", { name: "下一首" }));

    expect(onCommand).not.toHaveBeenCalledWith("toggle_playback", {});
    expect(onCommand).not.toHaveBeenCalledWith("next_track", {});
  });
});
```

- [ ] **Step 2: Run the component test and verify it fails**

Run:

```powershell
nvm use 22.22.2; npm test -- src/features/player/PlayerControls.test.tsx
```

Expected: FAIL because `PlayerControls` does not accept `hasPlayableTrack` and does not disable transport controls.

- [ ] **Step 3: Update `PlayerControls.tsx` props and disabled controls**

In `src/features/player/PlayerControls.tsx`, replace the props interface with:

```tsx
interface PlayerControlsProps {
  state: PlaybackState;
  hasPlayableTrack?: boolean;
  onCommand: (command: CommandName, payload: CommandPayload) => void;
}
```

Replace the function signature and initial derived constants with:

```tsx
export function PlayerControls({ state, hasPlayableTrack = Boolean(state.trackId), onCommand }: PlayerControlsProps) {
  const volumePercent = Math.round(state.volume * 100);
  const [volumeInput, setVolumeInput] = useState(String(volumePercent));
  const volumeNeedleRotation = `${Math.round(volumePercent * 2.4 - 120)}deg`;
  const currentPlayModeLabel = playModeLabel(state.playMode);
  const canUseTransport = Boolean(state.trackId) || hasPlayableTrack;
  const canSeek = Boolean(state.trackId) && state.durationMs > 0;
```

Add `disabled={!canUseTransport}` to the previous, play, and next buttons:

```tsx
<button
  type="button"
  className="transport-button transport-button--prev"
  disabled={!canUseTransport}
  onClick={() => onCommand("previous_track", {})}
>
  上一首
</button>
<button
  type="button"
  className="transport-button transport-button--play"
  disabled={!canUseTransport}
  onClick={() => onCommand("toggle_playback", {})}
>
  {state.isPlaying ? "暂停" : "播放"}
</button>
<button
  type="button"
  className="transport-button transport-button--next"
  disabled={!canUseTransport}
  onClick={() => onCommand("next_track", {})}
>
  下一首
</button>
```

Add `disabled={!canSeek}` to the progress input:

```tsx
<input
  aria-label="播放进度"
  className="progress-rail"
  type="range"
  min="0"
  max={Math.max(state.durationMs, 1)}
  value={state.positionMs}
  disabled={!canSeek}
  onChange={(event) => onCommand("seek", { positionMs: Number(event.currentTarget.value) })}
/>
```

- [ ] **Step 4: Pass capability from `layoutShared.tsx`**

In `src/features/skin/layoutShared.tsx`, replace `ControlsBlock` body with this function:

```tsx
export function ControlsBlock({
  moduleLabel,
  eyebrow = "Transport Console",
  moduleClassName,
  ...props
}: PlayerLayoutProps & DeviceBlockProps) {
  const hasPlayableTrack = props.playlist.tracks.some((track) => track.status === "ready");

  return (
    <DeviceModuleFrame
      moduleLabel={moduleLabel}
      eyebrow={eyebrow}
      className={["device-module--controls", moduleClassName].filter(Boolean).join(" ")}
    >
      <PlayerControls
        state={props.playback}
        hasPlayableTrack={hasPlayableTrack}
        onCommand={(command, payload) => props.onPlayerCommand(command, payload)}
      />
    </DeviceModuleFrame>
  );
}
```

- [ ] **Step 5: Run targeted tests**

Run:

```powershell
nvm use 22.22.2; npm test -- src/features/player/PlayerControls.test.tsx src/features/skin/layouts.test.tsx src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit frontend transport gating**

Run:

```powershell
git add -- src/features/player/PlayerControls.tsx src/features/player/PlayerControls.test.tsx src/features/skin/layoutShared.tsx
git commit -m "feat: gate inert playback controls"
```

Expected: commit succeeds and `.superpowers/` remains untracked.

---

### Task 2: Start Current Playlist Item From Play

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.autoplay.test.tsx`

**Interfaces:**
- Consumes: `CommandName`, `CommandPayload`, `PlaybackState`, `PlaylistSnapshot`, `Track`.
- Produces: `resolvePlaybackCommand(command, payload, playback, playlist)` and `syncPlaylistSelection(snapshot, trackId)`.

- [ ] **Step 1: Add failing App-level playback orchestration tests**

In `src/App.autoplay.test.tsx`, add these tests inside `describe("App autoplay events", () => { ... })` after the existing skin test:

```tsx
  it("starts the current playlist track when play is pressed with no active track", async () => {
    const user = userEvent.setup();
    testState.stoppedPlayback = {
      ...testState.stoppedPlayback,
      trackId: null,
      positionMs: 0,
      isPlaying: false,
    };
    vi.mocked(invokeCommand).mockImplementation(async (command: string, payload?: Record<string, unknown>) => {
      if (command === "get_playlist") return testState.playlistSnapshot;
      if (command === "get_playback_state") return testState.stoppedPlayback;
      if (command === "load_settings") return testState.settings;
      if (command === "play_track") {
        return {
          ...testState.stoppedPlayback,
          trackId: payload?.trackId as string,
          durationMs: 1000,
          isPlaying: true,
        } satisfies PlaybackState;
      }
      return {};
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "播放" }));

    expect(invokeCommand).toHaveBeenCalledWith("play_track", { trackId: "a" });
    expect(await screen.findByRole("button", { name: "暂停" })).toBeInTheDocument();
  });

  it("shows readable playback errors when a play command fails", async () => {
    const user = userEvent.setup();
    vi.mocked(invokeCommand).mockImplementation(async (command: string) => {
      if (command === "get_playlist") return testState.playlistSnapshot;
      if (command === "get_playback_state") return testState.stoppedPlayback;
      if (command === "load_settings") return testState.settings;
      if (command === "play_track") {
        throw { code: "unplayable", message: "file is unplayable: bad.mp3" };
      }
      return {};
    });

    render(<App />);

    await user.click(await screen.findByRole("button", { name: "Song A 未知歌手" }));

    expect(await screen.findByText("音频文件不可播放")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the App tests and verify they fail**

Run:

```powershell
nvm use 22.22.2; npm test -- src/App.autoplay.test.tsx
```

Expected: FAIL because pressing play still invokes `toggle_playback` when no active track exists.

- [ ] **Step 3: Add command resolution helpers in `App.tsx`**

In `src/App.tsx`, add this helper below `handleCommand` or near the existing helper functions:

```tsx
function resolvePlaybackCommand(
  command: CommandName,
  payload: CommandPayload,
  playback: PlaybackState,
  playlist: PlaylistSnapshot,
): { command: CommandName; payload: CommandPayload } {
  if (command === "toggle_playback" && !playback.trackId && !playback.isPlaying) {
    const fallbackTrack = findCurrentTrack(playlist, null);
    if (fallbackTrack?.status === "ready") {
      return { command: "play_track", payload: { trackId: fallbackTrack.id } };
    }
  }

  return { command, payload };
}

function syncPlaylistSelection(snapshot: PlaylistSnapshot, trackId: string | null): PlaylistSnapshot {
  if (!trackId) return snapshot;

  const currentIndex = snapshot.playlist.trackIds.indexOf(trackId);
  if (currentIndex < 0 || currentIndex === snapshot.playlist.currentIndex) return snapshot;

  return {
    ...snapshot,
    playlist: {
      ...snapshot.playlist,
      currentIndex,
    },
  };
}

function commandCanChangeSelectedTrack(command: CommandName) {
  return command === "play_track" || command === "next_track" || command === "previous_track";
}
```

- [ ] **Step 4: Use resolved commands in `handleCommand`**

In `src/App.tsx`, replace the body of `handleCommand` with this complete body:

```tsx
  async function handleCommand(command: CommandName, payload: CommandPayload = {}) {
    if (!isTauriRuntime()) {
      console.debug("player command", command, payload);
      return;
    }

    const resolved = resolvePlaybackCommand(command, payload, playback, playlist);

    try {
      if (isPlaylistCommand(resolved.command)) {
        const snapshot = await invokeCommand<PlaylistSnapshot>(resolved.command, resolved.payload);
        setPlaylist(snapshot);
      } else if (isPlaybackCommand(resolved.command)) {
        const playbackState = await invokeCommand<PlaybackState>(resolved.command, resolved.payload);
        setPlayback(playbackState);
        if (resolved.command === "set_play_mode") {
          setPlaylist((current) => ({
            ...current,
            playlist: { ...current.playlist, playMode: playbackState.playMode },
          }));
        } else if (commandCanChangeSelectedTrack(resolved.command)) {
          setPlaylist((current) => syncPlaylistSelection(current, playbackState.trackId));
        }
      } else {
        await invokeCommand<unknown>(resolved.command, resolved.payload);
      }
      setError(null);
    } catch (commandError) {
      setError(toUserMessage(commandError));
    }
  }
```

- [ ] **Step 5: Run targeted App tests**

Run:

```powershell
nvm use 22.22.2; npm test -- src/App.autoplay.test.tsx src/App.test.tsx src/features/player/PlayerControls.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit app playback orchestration**

Run:

```powershell
git add -- src/App.tsx src/App.autoplay.test.tsx
git commit -m "feat: start queued track from playback controls"
```

Expected: commit succeeds and `.superpowers/` remains untracked.

---

### Task 3: Mark Failed Playback Tracks And Emit Playlist Selection

**Files:**
- Modify: `src-tauri/src/services/playlist.rs`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Consumes: `PlaylistService::select_track`, `next_track`, `previous_track`, `replace_track`, `PlaybackService::play`.
- Produces: `PlaylistService::mark_track_status(track_id: &str, status: TrackStatus) -> Result<PlaylistSnapshot, AppError>`.
- Produces: command helper `play_track_from_command(app, state, track) -> Result<PlaybackState, AppError>`.

- [ ] **Step 1: Add failing playlist status test**

In `src-tauri/src/services/playlist.rs`, add this test inside `#[cfg(test)] mod tests` after `auto_advance_skips_missing_and_unplayable_tracks`:

```rust
    #[test]
    fn marks_track_status_by_id() {
        let mut service = playlist_with_tracks(vec![
            track("a", TrackStatus::Ready),
            track("b", TrackStatus::Ready),
        ]);

        let snapshot = service
            .mark_track_status("b", TrackStatus::Unplayable)
            .expect("track should be marked");

        let marked = snapshot
            .tracks
            .iter()
            .find(|track| track.id == "b")
            .expect("track b should exist");
        assert_eq!(marked.status, TrackStatus::Unplayable);
    }
```

- [ ] **Step 2: Run Rust playlist test and verify it fails**

Run:

```powershell
cd src-tauri; cargo test services::playlist::tests::marks_track_status_by_id
```

Expected: FAIL because `mark_track_status` does not exist.

- [ ] **Step 3: Implement `mark_track_status`**

In `src-tauri/src/services/playlist.rs`, add this method inside `impl PlaylistService` after `replace_track`:

```rust
    pub fn mark_track_status(
        &mut self,
        track_id: &str,
        status: TrackStatus,
    ) -> Result<PlaylistSnapshot, AppError> {
        let track = self
            .tracks
            .iter_mut()
            .find(|track| track.id == track_id)
            .ok_or_else(|| AppError::FileMissing(track_id.to_string()))?;
        track.status = status;
        Ok(self.snapshot())
    }
```

- [ ] **Step 4: Run playlist service tests**

Run:

```powershell
cd src-tauri; cargo test services::playlist::tests
```

Expected: PASS.

- [ ] **Step 5: Update command imports in `lib.rs`**

In `src-tauri/src/lib.rs`, update the `models` import inside `pub mod commands` from:

```rust
models::{AppSettings, PlayMode, PlaybackState, PlaylistSnapshot},
```

to:

```rust
models::{AppSettings, PlayMode, PlaybackState, PlaylistSnapshot, Track, TrackStatus},
```

- [ ] **Step 6: Add command helpers in `lib.rs`**

In `src-tauri/src/lib.rs`, add these helper functions inside `pub mod commands` before the first `#[tauri::command]`:

```rust
    fn play_track_from_command(
        app: &tauri::AppHandle,
        state: &tauri::State<'_, AppState>,
        track: Track,
    ) -> Result<PlaybackState, errors::AppError> {
        let track_id = track.id.clone();
        let result = {
            let mut playback = state
                .playback
                .lock()
                .map_err(|err| errors::AppError::StorageFailed(err.to_string()))?;
            playback.play(track)
        };

        if let Err(err) = &result {
            mark_track_status_for_error(app, state.inner(), &track_id, err)?;
        }

        result
    }

    fn mark_track_status_for_error(
        app: &tauri::AppHandle,
        state: &AppState,
        track_id: &str,
        err: &errors::AppError,
    ) -> Result<(), errors::AppError> {
        let Some(status) = status_for_playback_error(err) else {
            return Ok(());
        };

        let snapshot = {
            let mut playlist = state
                .playlist
                .lock()
                .map_err(|lock_err| errors::AppError::StorageFailed(lock_err.to_string()))?;
            playlist.mark_track_status(track_id, status)?
        };
        AppState::emit_playlist(app, &snapshot);
        Ok(())
    }

    fn status_for_playback_error(err: &errors::AppError) -> Option<TrackStatus> {
        match err {
            errors::AppError::FileMissing(_) => Some(TrackStatus::Missing),
            errors::AppError::Unplayable(_) => Some(TrackStatus::Unplayable),
            _ => None,
        }
    }
```

- [ ] **Step 7: Update playback-changing command signatures and bodies**

In `src-tauri/src/lib.rs`, replace `play_track`, `next_track`, and `previous_track` with this complete code:

```rust
    #[tauri::command]
    pub fn play_track(
        track_id: String,
        app: tauri::AppHandle,
        state: tauri::State<'_, AppState>,
    ) -> Result<PlaybackState, errors::AppError> {
        let (track, snapshot) = {
            let mut playlist = state
                .playlist
                .lock()
                .map_err(|err| errors::AppError::StorageFailed(err.to_string()))?;
            let track = playlist
                .select_track(&track_id)
                .ok_or_else(|| errors::AppError::FileMissing(track_id.clone()))?;
            (track, playlist.snapshot())
        };
        AppState::emit_playlist(&app, &snapshot);

        play_track_from_command(&app, &state, track)
    }

    #[tauri::command]
    pub fn next_track(
        app: tauri::AppHandle,
        state: tauri::State<'_, AppState>,
    ) -> Result<PlaybackState, errors::AppError> {
        let (track, snapshot) = {
            let mut playlist = state
                .playlist
                .lock()
                .map_err(|err| errors::AppError::StorageFailed(err.to_string()))?;
            let track = playlist.next_track();
            (track, playlist.snapshot())
        };
        AppState::emit_playlist(&app, &snapshot);

        match track {
            Some(track) => play_track_from_command(&app, &state, track),
            None => {
                let playback = state
                    .playback
                    .lock()
                    .map_err(|err| errors::AppError::StorageFailed(err.to_string()))?;
                Ok(playback.current_state())
            }
        }
    }

    #[tauri::command]
    pub fn previous_track(
        app: tauri::AppHandle,
        state: tauri::State<'_, AppState>,
    ) -> Result<PlaybackState, errors::AppError> {
        let (track, snapshot) = {
            let mut playlist = state
                .playlist
                .lock()
                .map_err(|err| errors::AppError::StorageFailed(err.to_string()))?;
            let track = playlist.previous_track();
            (track, playlist.snapshot())
        };
        AppState::emit_playlist(&app, &snapshot);

        match track {
            Some(track) => play_track_from_command(&app, &state, track),
            None => {
                let playback = state
                    .playback
                    .lock()
                    .map_err(|err| errors::AppError::StorageFailed(err.to_string()))?;
                Ok(playback.current_state())
            }
        }
    }
```

- [ ] **Step 8: Run Rust tests**

Run:

```powershell
cd src-tauri; cargo test
```

Expected: PASS.

- [ ] **Step 9: Run frontend playback tests**

Run:

```powershell
nvm use 22.22.2; npm test -- src/App.autoplay.test.tsx src/features/player/PlayerControls.test.tsx src/features/playlist/PlaylistPanel.test.tsx
```

Expected: PASS.

- [ ] **Step 10: Commit backend playback status handling**

Run:

```powershell
git add -- src-tauri/src/services/playlist.rs src-tauri/src/lib.rs
git commit -m "feat: mark failed playback tracks"
```

Expected: commit succeeds and `.superpowers/` remains untracked.

---

### Task 4: Full Verification, Package, Install, Smoke, Push

**Files:**
- Read: `src-tauri/target/release/bundle/msi/`
- Read: installed Windows shortcut entries.
- Do not modify source files unless verification exposes a defect.

**Interfaces:**
- Consumes: Tasks 1-3 committed.
- Produces: passing tests/build/package, installed MSI, smoke verification, pushed `main`.

- [ ] **Step 1: Run targeted frontend tests**

Run:

```powershell
nvm use 22.22.2; npm test -- src/features/player/PlayerControls.test.tsx src/App.autoplay.test.tsx src/App.test.tsx src/features/playlist/PlaylistPanel.test.tsx src/features/skin/layouts.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run Rust tests**

Run:

```powershell
cd src-tauri; cargo test
```

Expected: PASS.

- [ ] **Step 3: Run full frontend test suite**

Run:

```powershell
nvm use 22.22.2; npm test
```

Expected: PASS.

- [ ] **Step 4: Build web bundle**

Run:

```powershell
nvm use 22.22.2; npm run build
```

Expected: PASS.

- [ ] **Step 5: Build Tauri bundles**

Run:

```powershell
nvm use 22.22.2; npm run tauri build
```

Expected: PASS and bundles are produced under:

```text
src-tauri/target/release/bundle/msi/
src-tauri/target/release/bundle/nsis/
```

- [ ] **Step 6: Install newest MSI**

Run:

```powershell
$ErrorActionPreference = 'Stop'
$installed = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*','HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*','HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -eq '悠悠乐听' } | Select-Object -First 1
if ($installed -and $installed.PSChildName) {
  $uninstall = Start-Process msiexec.exe -ArgumentList @('/x', $installed.PSChildName, '/passive', '/norestart') -Wait -PassThru -WindowStyle Hidden
  if ($uninstall.ExitCode -ne 0 -and $uninstall.ExitCode -ne 3010) { throw "Uninstall failed with exit code $($uninstall.ExitCode)" }
}
$msi = Get-ChildItem 'src-tauri\target\release\bundle\msi' -Filter '*.msi' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $msi) { throw 'No MSI found' }
$install = Start-Process msiexec.exe -ArgumentList @('/i', $msi.FullName, '/passive', '/norestart') -Wait -PassThru -WindowStyle Hidden
if ($install.ExitCode -ne 0 -and $install.ExitCode -ne 3010) { throw "Install failed with exit code $($install.ExitCode)" }
"Installed $($msi.FullName) with exit code $($install.ExitCode)"
```

Expected: MSI install exits `0` or `3010`.

- [ ] **Step 7: Verify installed shortcut target**

Run:

```powershell
$shell = New-Object -ComObject WScript.Shell
$roots = @("$env:APPDATA\Microsoft\Windows\Start Menu\Programs", "$env:ProgramData\Microsoft\Windows\Start Menu\Programs")
$shortcuts = foreach ($root in $roots) {
  Get-ChildItem $root -Recurse -Filter '*.lnk' -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like '*悠悠乐听*' } |
    ForEach-Object {
      $lnk = $shell.CreateShortcut($_.FullName)
      [PSCustomObject]@{ Shortcut = $_.FullName; Target = $lnk.TargetPath }
    }
}
$shortcuts | Format-List
```

Expected: one shortcut target points to:

```text
C:\Users\Admin\AppData\Local\悠悠乐听\yoyomusic.exe
```

- [ ] **Step 8: Run playback usability smoke check**

Use the installed app manually or a browser smoke where applicable. Verify:

```text
Empty playlist: 播放/上一首/下一首 are disabled and window-level scrolling is absent.
Add local music: playlist count updates and tracks appear.
Click a ready track: now-playing title updates and play button changes to 暂停.
Click 暂停/播放: playback state toggles.
Click 下一首/上一首: selected track changes when another track exists.
Change 音量 and 静音: UI readouts update.
Switch 播放模式: labels cycle through 顺序播放, 列表循环, 单曲循环, 随机播放.
```

- [ ] **Step 9: Check status and push**

Run:

```powershell
git status --short
git push origin main
```

Expected: only `.superpowers/` remains untracked before push, and `main` pushes successfully.

---

## Self-Review Notes

- Spec coverage: Task 1 covers inert controls and empty queue affordance; Task 2 covers play-from-current, state sync, and readable errors; Task 3 covers failed playback status marking and playlist events; Task 4 covers full verification, installer, smoke, and push.
- Gap scan: This plan contains no unresolved implementation gaps.
- Type consistency: `hasPlayableTrack` is produced by `ControlsBlock` and consumed by `PlayerControls`; `resolvePlaybackCommand` and `syncPlaylistSelection` use existing `CommandName`, `CommandPayload`, `PlaybackState`, and `PlaylistSnapshot`; Rust helpers use existing `Track`, `TrackStatus`, `PlaybackState`, and `AppError`.
- Scope: The plan does not redesign skins, change visualization modes, replace Rodio, add dependencies, or change persistence format.
