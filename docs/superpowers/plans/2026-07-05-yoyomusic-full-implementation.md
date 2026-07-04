# YoYoMusic Full Product Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build 悠悠乐听 as a Tauri 2 desktop music player with local playback, playlists, volume, visualizations, skins, lyrics, cover art, tag editing, equalizer controls, desktop lyrics, mini player, tray controls, global shortcuts, and manually triggered GitHub Actions installers for Windows, macOS, and Linux.

**Architecture:** Use Tauri 2 as the desktop shell, Rust as the application state and platform integration core, and React/TypeScript as the multi-window UI. Rust owns playback state, playlist state, persistence, metadata, skin validation, window orchestration, tray, shortcuts, and packaging configuration; React renders the main player, mini player, desktop lyrics, settings, visualization canvas, and skin/theme surfaces.

**Tech Stack:** Tauri 2, Rust, React, TypeScript, Vite, Vitest, Testing Library, rodio, lofty, serde, zip, sha2, GitHub Actions, tauri-apps/tauri-action.

## Global Constraints

- Application name: `悠悠乐听`.
- Technical route: `Tauri 2 + React + TypeScript + Rust Core`.
- Target platforms: `Windows、macOS、Linux`.
- Music source: local files first, with third-party public services allowed for lyrics, cover art, and metadata enrichment.
- Playlist scope: manual file and folder import only; no local music library scanning or artist/album library view.
- Required player functions: play, pause, previous, next, progress control, volume, mute, and play mode.
- Required classic-enhanced functions: lyrics, desktop lyrics, cover art, tag editing, and equalizer controls.
- Required visualization functions: at least spectrum bars, waveform, and radial pulse.
- Required skin functions: custom new skin package format, import, switch, preview, and validation; no strong compatibility with old player skin formats.
- Required desktop functions: system tray, global shortcuts, mini player, and always-on-top windows.
- Required packaging: GitHub Actions must support manual installer builds for Windows, macOS, and Linux.
- State source of truth: Rust Core owns playback and app state; UI windows consume state snapshots and send commands.
- Persistence: JSON or Tauri Store for settings, playlists, sessions, window state, selected skin, volume, play mode, equalizer settings, lyrics offset, and enrichment cache.
- Accessibility: keyboard navigation, visible focus states, and reduced-motion behavior are required.
- Excluded scope: online music library playback, old skin format compatibility, open plugin platform, and arbitrary user layout engine.

---

## Source Notes

Use the current official docs while executing:

- Tauri create project: `https://v2.tauri.app/start/create-project/`
- Tauri system tray: `https://v2.tauri.app/learn/system-tray/`
- Tauri global shortcut plugin: `https://v2.tauri.app/plugin/global-shortcut/`
- Tauri window customization: `https://v2.tauri.app/learn/window-customization/`
- Tauri file system plugin: `https://v2.tauri.app/plugin/file-system/`
- Tauri window state plugin: `https://v2.tauri.app/plugin/window-state/`
- Tauri GitHub Action: `https://github.com/tauri-apps/tauri-action`
- GitHub manual workflows: `https://docs.github.com/actions/using-workflows/events-that-trigger-workflows#workflow_dispatch`

## File Structure

Create and maintain these units:

- `package.json`: npm scripts, frontend dependencies, Tauri CLI, test commands.
- `index.html`: Vite entry shell.
- `vite.config.ts`: Vite and Vitest configuration.
- `tsconfig.json`, `tsconfig.node.json`: TypeScript compiler configuration.
- `.gitignore`: Node, Rust, Tauri, build, and local artifact ignores.
- `.github/workflows/build-installers.yml`: manual Windows/macOS/Linux installer build workflow.
- `src/main.tsx`: React entry for all window routes.
- `src/App.tsx`: main-window composition.
- `src/styles/theme.css`: CSS custom properties and default skin tokens.
- `src/styles/app.css`: application layout, focus states, responsive desktop sizing, reduced-motion rules.
- `src/shared/types.ts`: shared TypeScript domain types matching Rust serde models.
- `src/shared/tauri.ts`: typed command and event bridge.
- `src/shared/test-utils.tsx`: component test rendering helpers.
- `src/features/player/PlayerControls.tsx`: play, pause, previous, next, seek, volume, mute, and play mode controls.
- `src/features/player/playerReducer.ts`: frontend projection reducer for playback snapshots.
- `src/features/playlist/PlaylistPanel.tsx`: playlist display, current item, invalid item, remove, clear, and selection behavior.
- `src/features/playlist/playlistReducer.ts`: frontend playlist projection reducer.
- `src/features/lyrics/LyricsPanel.tsx`: main-window synchronized lyrics.
- `src/features/lyrics/DesktopLyrics.tsx`: desktop lyrics route.
- `src/features/visualization/VisualizationPanel.tsx`: visualization mode selector and canvas host.
- `src/features/visualization/renderers.ts`: spectrum, waveform, and radial pulse renderers.
- `src/features/skin/SkinManager.tsx`: skin import, preview, and apply UI.
- `src/features/skin/theme.ts`: conversion from skin tokens to CSS variables.
- `src/features/tags/TagEditor.tsx`: title, artist, album, and cover editing UI.
- `src/features/equalizer/EqualizerPanel.tsx`: equalizer enable, preset, and band controls.
- `src/features/mini/MiniPlayer.tsx`: mini-player route.
- `src/features/settings/SettingsPanel.tsx`: shortcuts, enrichment, windows, cache, and accessibility settings.
- `src/test/setup.ts`: Vitest DOM setup.
- `src-tauri/Cargo.toml`: Rust dependencies.
- `src-tauri/tauri.conf.json`: product metadata, bundle targets, windows, capabilities, and app identifiers.
- `src-tauri/capabilities/default.json`: Tauri permissions for commands and plugins.
- `src-tauri/src/main.rs`: Tauri builder, plugins, command registration, tray, shortcuts, and window events.
- `src-tauri/src/lib.rs`: module exports and command wiring for Rust tests.
- `src-tauri/src/models.rs`: serde domain models shared with frontend.
- `src-tauri/src/errors.rs`: typed app errors returned to the UI.
- `src-tauri/src/state.rs`: app state container and event emitter helpers.
- `src-tauri/src/services/playlist.rs`: playlist service.
- `src-tauri/src/services/playback.rs`: playback state machine and rodio adapter boundary.
- `src-tauri/src/services/metadata.rs`: metadata and tag editing via lofty.
- `src-tauri/src/services/lyrics.rs`: LRC parsing, matching, and active line resolution.
- `src-tauri/src/services/artwork.rs`: cover extraction and cover cache.
- `src-tauri/src/services/skin.rs`: skin package validation, extraction, and manifest parsing.
- `src-tauri/src/services/settings.rs`: JSON persistence and settings migration.
- `src-tauri/src/services/enrichment.rs`: provider abstraction for public lyrics, cover art, and metadata enrichment.
- `src-tauri/src/services/window.rs`: desktop lyrics and mini-player window orchestration.
- `src-tauri/src/services/shortcuts.rs`: global shortcut registration and conflict results.
- `src-tauri/src/services/tray.rs`: tray menu setup and dispatch.
- `src-tauri/tests/playlist_service.rs`: Rust playlist tests.
- `src-tauri/tests/lyrics_service.rs`: Rust lyrics tests.
- `src-tauri/tests/skin_service.rs`: Rust skin manifest tests.
- `src-tauri/tests/settings_service.rs`: Rust settings persistence tests.
- `docs/skins/yoyomusic-skin-format.md`: skin package authoring documentation.
- `docs/building.md`: local and CI packaging instructions.

## Task 1: Scaffold Tauri 2 React Workspace

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `.gitignore`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles/theme.css`
- Create: `src/styles/app.css`
- Create: `src-tauri/Cargo.toml`
- Create: `src-tauri/tauri.conf.json`
- Create: `src-tauri/capabilities/default.json`
- Create: `src-tauri/src/main.rs`
- Create: `src-tauri/src/lib.rs`

**Interfaces:**
- Produces: `npm run dev`, `npm run build`, `npm test`, `npm run tauri dev`, `npm run tauri build`.
- Produces: app product name `悠悠乐听` and binary identifier `yoyomusic`.

- [ ] **Step 1: Verify prerequisites**

Run:

```powershell
node --version
npm --version
rustc --version
cargo --version
```

Expected: each command prints a version and exits with code `0`.

- [ ] **Step 2: Create Vite React TypeScript shell**

Run:

```powershell
npm create vite@latest . -- --template react-ts
```

Expected: `package.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `tsconfig.json`, and `vite.config.ts` are created.

- [ ] **Step 3: Install desktop and test dependencies**

Run:

```powershell
npm install
npm install -D @tauri-apps/cli vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
npm install @tauri-apps/api @tauri-apps/plugin-dialog @tauri-apps/plugin-fs @tauri-apps/plugin-store @tauri-apps/plugin-global-shortcut @tauri-apps/plugin-window-state lucide-react clsx
```

Expected: `package-lock.json` is created and npm reports no install failure.

- [ ] **Step 4: Initialize Tauri**

Run:

```powershell
npm run tauri init -- --app-name "悠悠乐听" --window-title "悠悠乐听" --frontend-dist "../dist" --dev-url "http://localhost:5173" --before-dev-command "npm run dev" --before-build-command "npm run build"
```

Expected: `src-tauri/` is created with `Cargo.toml`, `tauri.conf.json`, and Rust source files.

- [ ] **Step 5: Set npm scripts**

Update `package.json` scripts to include exactly these command names:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "tauri": "tauri"
  }
}
```

- [ ] **Step 6: Configure Vitest**

Update `vite.config.ts` with this test block:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
    globals: true
  }
});
```

- [ ] **Step 7: Create smoke test setup**

Create `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Create `src/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import App from "./App";

it("renders the YoYoMusic app title", () => {
  render(<App />);
  expect(screen.getByRole("heading", { name: "悠悠乐听" })).toBeInTheDocument();
});
```

- [ ] **Step 8: Make the smoke test pass**

Set `src/App.tsx` to:

```tsx
import "./styles/theme.css";
import "./styles/app.css";

export default function App() {
  return (
    <main className="app-shell">
      <h1>悠悠乐听</h1>
      <p>跨平台新一代音乐播放器</p>
    </main>
  );
}
```

- [ ] **Step 9: Verify scaffold**

Run:

```powershell
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: all commands exit with code `0`.

- [ ] **Step 10: Commit**

Run:

```powershell
git add package.json package-lock.json index.html vite.config.ts tsconfig.json tsconfig.node.json src src-tauri .gitignore
git commit -m "chore: scaffold tauri react app"
```

## Task 2: Shared Domain Models and Typed Bridge

**Files:**
- Create: `src/shared/types.ts`
- Create: `src/shared/tauri.ts`
- Create: `src/shared/tauri.test.ts`
- Create: `src-tauri/src/models.rs`
- Create: `src-tauri/src/errors.rs`
- Modify: `src-tauri/src/lib.rs`

**Interfaces:**
- Produces: TypeScript `Track`, `Playlist`, `PlaybackState`, `LyricsDocument`, `SkinPackage`, `WindowPreferences`, `AppSettings`.
- Produces: Rust models with matching serde field names.
- Produces: `invokeCommand<T>(command: CommandName, payload?: CommandPayload): Promise<T>`.

- [ ] **Step 1: Write TypeScript model tests**

Create `src/shared/tauri.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { invokeCommand } from "./tauri";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (name: string, payload: unknown) => ({ name, payload }))
}));

describe("invokeCommand", () => {
  it("forwards a typed command to Tauri invoke", async () => {
    const result = await invokeCommand("get_playlist", { playlistId: "default" });
    expect(result).toEqual({
      name: "get_playlist",
      payload: { playlistId: "default" }
    });
  });
});
```

- [ ] **Step 2: Run failing test**

Run:

```powershell
npm test -- src/shared/tauri.test.ts
```

Expected: fails because `src/shared/tauri.ts` does not exist.

- [ ] **Step 3: Create TypeScript domain types**

Create `src/shared/types.ts` with these exported unions and interfaces:

```ts
export type PlayMode = "sequence" | "repeat_all" | "repeat_one" | "shuffle";
export type TrackStatus = "ready" | "missing" | "unplayable";
export type TagStatus = "clean" | "dirty" | "saving" | "failed";
export type VisualizationMode = "spectrum" | "waveform" | "radial";

export interface Track {
  id: string;
  filePath: string;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  coverArtRef: string | null;
  lyricsRef: string | null;
  tagStatus: TagStatus;
  status: TrackStatus;
}

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  currentIndex: number;
  playMode: PlayMode;
}

export interface PlaybackState {
  trackId: string | null;
  positionMs: number;
  durationMs: number;
  volume: number;
  isPlaying: boolean;
  isMuted: boolean;
  playMode: PlayMode;
  eqEnabled: boolean;
}

export interface LyricsLine {
  timeMs: number;
  text: string;
  translation?: string;
}

export interface LyricsDocument {
  id: string;
  sourceType: "embedded" | "local_file" | "cache" | "online";
  language: string;
  offsetMs: number;
  lines: LyricsLine[];
}

export interface SkinPackage {
  id: string;
  name: string;
  version: string;
  author: string;
  manifestPath: string;
  themePath: string;
  assetRoot: string;
}

export interface WindowPreferences {
  main: WindowPlacement;
  mini: WindowPlacement;
  lyrics: WindowPlacement & {
    opacity: number;
    clickThrough: boolean;
  };
}

export interface WindowPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
  alwaysOnTop: boolean;
}

export interface EqualizerSettings {
  enabled: boolean;
  preset: string;
  bands: number[];
}

export interface AppSettings {
  defaultSkin: string;
  shortcuts: Record<string, string>;
  enrichmentEnabled: boolean;
  cacheRetentionDays: number;
  recentPlaylists: string[];
  restoreSession: boolean;
  visualizationMode: VisualizationMode;
  equalizer: EqualizerSettings;
}
```

- [ ] **Step 4: Create typed Tauri bridge**

Create `src/shared/tauri.ts`:

```ts
import { invoke } from "@tauri-apps/api/core";

export type CommandName =
  | "get_playlist"
  | "add_tracks"
  | "remove_track"
  | "clear_playlist"
  | "play_track"
  | "toggle_playback"
  | "pause_playback"
  | "next_track"
  | "previous_track"
  | "seek"
  | "set_volume"
  | "set_muted"
  | "set_play_mode"
  | "get_playback_state"
  | "load_lyrics"
  | "save_tags"
  | "validate_skin_package"
  | "apply_skin"
  | "open_mini_player"
  | "toggle_desktop_lyrics"
  | "save_settings"
  | "load_settings";

export type CommandPayload = Record<string, unknown>;

export function invokeCommand<T>(
  command: CommandName,
  payload: CommandPayload = {}
): Promise<T> {
  return invoke<T>(command, payload);
}
```

- [ ] **Step 5: Create Rust serde models**

Create `src-tauri/src/models.rs` with matching `serde(rename_all = "camelCase")` structs and enums:

```rust
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PlayMode {
    Sequence,
    RepeatAll,
    RepeatOne,
    Shuffle,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TrackStatus {
    Ready,
    Missing,
    Unplayable,
}

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TagStatus {
    Clean,
    Dirty,
    Saving,
    Failed,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Track {
    pub id: String,
    pub file_path: String,
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_ms: u64,
    pub cover_art_ref: Option<String>,
    pub lyrics_ref: Option<String>,
    pub tag_status: TagStatus,
    pub status: TrackStatus,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Playlist {
    pub id: String,
    pub name: String,
    pub track_ids: Vec<String>,
    pub current_index: usize,
    pub play_mode: PlayMode,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaybackState {
    pub track_id: Option<String>,
    pub position_ms: u64,
    pub duration_ms: u64,
    pub volume: f32,
    pub is_playing: bool,
    pub is_muted: bool,
    pub play_mode: PlayMode,
    pub eq_enabled: bool,
}
```

- [ ] **Step 6: Create Rust app error**

Create `src-tauri/src/errors.rs`:

```rust
use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("file is missing: {0}")]
    FileMissing(String),
    #[error("file is unplayable: {0}")]
    Unplayable(String),
    #[error("metadata read failed: {0}")]
    MetadataReadFailed(String),
    #[error("metadata write failed: {0}")]
    MetadataWriteFailed(String),
    #[error("skin package invalid: {0}")]
    InvalidSkinPackage(String),
    #[error("shortcut conflict: {0}")]
    ShortcutConflict(String),
    #[error("storage failed: {0}")]
    StorageFailed(String),
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppErrorPayload {
    pub code: String,
    pub message: String,
}

impl serde::Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let code = match self {
            AppError::FileMissing(_) => "file_missing",
            AppError::Unplayable(_) => "unplayable",
            AppError::MetadataReadFailed(_) => "metadata_read_failed",
            AppError::MetadataWriteFailed(_) => "metadata_write_failed",
            AppError::InvalidSkinPackage(_) => "invalid_skin_package",
            AppError::ShortcutConflict(_) => "shortcut_conflict",
            AppError::StorageFailed(_) => "storage_failed",
        };
        AppErrorPayload {
            code: code.to_string(),
            message: self.to_string(),
        }
        .serialize(serializer)
    }
}
```

- [ ] **Step 7: Add Rust dependencies**

Run:

```powershell
cargo add serde serde_json thiserror uuid --features uuid/v4 --manifest-path src-tauri/Cargo.toml
```

Expected: `Cargo.toml` and `Cargo.lock` update.

- [ ] **Step 8: Verify**

Run:

```powershell
npm test -- src/shared/tauri.test.ts
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: both commands pass.

- [ ] **Step 9: Commit**

Run:

```powershell
git add src src-tauri package.json package-lock.json
git commit -m "feat: add shared domain models"
```

## Task 3: Rust App State, Settings, and Persistence

**Files:**
- Create: `src-tauri/src/state.rs`
- Create: `src-tauri/src/services/settings.rs`
- Create: `src-tauri/tests/settings_service.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/src/models.rs`

**Interfaces:**
- Produces: `AppState::new(app_data_dir: PathBuf) -> Result<AppState, AppError>`.
- Produces: `SettingsService::load() -> Result<AppSettings, AppError>`.
- Produces: `SettingsService::save(settings: &AppSettings) -> Result<(), AppError>`.
- Produces Tauri commands: `load_settings`, `save_settings`.

- [ ] **Step 1: Write failing settings persistence tests**

Create `src-tauri/tests/settings_service.rs`:

```rust
use std::fs;
use tempfile::tempdir;
use yoyomusic_lib::services::settings::SettingsService;
use yoyomusic_lib::models::{AppSettings, EqualizerSettings};

fn sample_settings() -> AppSettings {
    AppSettings {
        default_skin: "classic".into(),
        shortcuts: [("toggle_playback".into(), "Ctrl+Alt+P".into())].into(),
        enrichment_enabled: true,
        cache_retention_days: 30,
        recent_playlists: vec!["default".into()],
        restore_session: true,
        visualization_mode: "spectrum".into(),
        equalizer: EqualizerSettings {
            enabled: true,
            preset: "rock".into(),
            bands: vec![0.0, 1.5, 2.0, 1.0, 0.0, -1.0, -1.5, 0.5, 1.0, 0.0],
        },
    }
}

#[test]
fn saves_and_loads_settings_json() {
    let dir = tempdir().unwrap();
    let service = SettingsService::new(dir.path().to_path_buf());
    let settings = sample_settings();

    service.save(&settings).unwrap();
    let loaded = service.load().unwrap();

    assert_eq!(loaded.default_skin, "classic");
    assert!(loaded.equalizer.enabled);
    assert_eq!(loaded.equalizer.bands.len(), 10);
}

#[test]
fn creates_default_settings_when_file_is_missing() {
    let dir = tempdir().unwrap();
    fs::create_dir_all(dir.path()).unwrap();
    let service = SettingsService::new(dir.path().to_path_buf());

    let loaded = service.load().unwrap();

    assert_eq!(loaded.default_skin, "default");
    assert_eq!(loaded.visualization_mode, "spectrum");
    assert!(loaded.restore_session);
}
```

- [ ] **Step 2: Run failing tests**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml --test settings_service
```

Expected: fails because `SettingsService` and settings models do not exist.

- [ ] **Step 3: Add settings models**

Extend `src-tauri/src/models.rs`:

```rust
use std::collections::HashMap;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EqualizerSettings {
    pub enabled: bool,
    pub preset: String,
    pub bands: Vec<f32>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub default_skin: String,
    pub shortcuts: HashMap<String, String>,
    pub enrichment_enabled: bool,
    pub cache_retention_days: u32,
    pub recent_playlists: Vec<String>,
    pub restore_session: bool,
    pub visualization_mode: String,
    pub equalizer: EqualizerSettings,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            default_skin: "default".into(),
            shortcuts: HashMap::new(),
            enrichment_enabled: true,
            cache_retention_days: 30,
            recent_playlists: vec![],
            restore_session: true,
            visualization_mode: "spectrum".into(),
            equalizer: EqualizerSettings {
                enabled: false,
                preset: "flat".into(),
                bands: vec![0.0; 10],
            },
        }
    }
}
```

- [ ] **Step 4: Add settings service**

Create `src-tauri/src/services/settings.rs`:

```rust
use std::{fs, path::PathBuf};

use crate::{errors::AppError, models::AppSettings};

#[derive(Clone, Debug)]
pub struct SettingsService {
    settings_path: PathBuf,
}

impl SettingsService {
    pub fn new(app_data_dir: PathBuf) -> Self {
        Self {
            settings_path: app_data_dir.join("settings.json"),
        }
    }

    pub fn load(&self) -> Result<AppSettings, AppError> {
        if !self.settings_path.exists() {
            return Ok(AppSettings::default());
        }
        let contents = fs::read_to_string(&self.settings_path)
            .map_err(|err| AppError::StorageFailed(err.to_string()))?;
        serde_json::from_str(&contents).map_err(|err| AppError::StorageFailed(err.to_string()))
    }

    pub fn save(&self, settings: &AppSettings) -> Result<(), AppError> {
        if let Some(parent) = self.settings_path.parent() {
            fs::create_dir_all(parent).map_err(|err| AppError::StorageFailed(err.to_string()))?;
        }
        let contents = serde_json::to_string_pretty(settings)
            .map_err(|err| AppError::StorageFailed(err.to_string()))?;
        fs::write(&self.settings_path, contents)
            .map_err(|err| AppError::StorageFailed(err.to_string()))
    }
}
```

- [ ] **Step 5: Add state container**

Create `src-tauri/src/state.rs`:

```rust
use std::{path::PathBuf, sync::Mutex};

use crate::{errors::AppError, models::AppSettings, services::settings::SettingsService};

pub struct AppState {
    pub settings_service: SettingsService,
    pub settings: Mutex<AppSettings>,
}

impl AppState {
    pub fn new(app_data_dir: PathBuf) -> Result<Self, AppError> {
        let settings_service = SettingsService::new(app_data_dir);
        let settings = settings_service.load()?;
        Ok(Self {
            settings_service,
            settings: Mutex::new(settings),
        })
    }
}
```

- [ ] **Step 6: Wire modules**

Ensure `src-tauri/src/lib.rs` exports:

```rust
pub mod errors;
pub mod models;
pub mod state;

pub mod services {
    pub mod settings;
}
```

- [ ] **Step 7: Add tempfile dependency**

Run:

```powershell
cargo add tempfile --dev --manifest-path src-tauri/Cargo.toml
```

Expected: `tempfile` is available for Rust tests.

- [ ] **Step 8: Verify**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml --test settings_service
```

Expected: settings tests pass.

- [ ] **Step 9: Commit**

Run:

```powershell
git add src-tauri
git commit -m "feat: persist app settings"
```

## Task 4: Playlist Service and Commands

**Files:**
- Create: `src-tauri/src/services/playlist.rs`
- Create: `src-tauri/tests/playlist_service.rs`
- Modify: `src-tauri/src/models.rs`
- Modify: `src-tauri/src/state.rs`
- Modify: `src-tauri/src/lib.rs`
- Modify: `src-tauri/src/main.rs`
- Create: `src/features/playlist/playlistReducer.ts`
- Create: `src/features/playlist/playlistReducer.test.ts`

**Interfaces:**
- Produces: `PlaylistService::add_paths(paths: Vec<PathBuf>) -> Result<PlaylistSnapshot, AppError>`.
- Produces: `PlaylistService::remove_track(track_id: &str) -> Result<PlaylistSnapshot, AppError>`.
- Produces: `PlaylistService::clear() -> PlaylistSnapshot`.
- Produces Tauri commands: `get_playlist`, `add_tracks`, `remove_track`, `clear_playlist`.

- [ ] **Step 1: Write Rust playlist tests**

Create `src-tauri/tests/playlist_service.rs`:

```rust
use std::path::PathBuf;
use yoyomusic_lib::models::PlayMode;
use yoyomusic_lib::services::playlist::PlaylistService;

#[test]
fn adds_audio_paths_as_tracks() {
    let mut service = PlaylistService::default();
    let snapshot = service
        .add_paths(vec![PathBuf::from("D:/Music/a.mp3"), PathBuf::from("D:/Music/b.flac")])
        .unwrap();

    assert_eq!(snapshot.playlist.track_ids.len(), 2);
    assert_eq!(snapshot.tracks[0].title, "a");
    assert_eq!(snapshot.tracks[1].title, "b");
    assert_eq!(snapshot.playlist.play_mode, PlayMode::Sequence);
}

#[test]
fn remove_track_keeps_current_index_in_range() {
    let mut service = PlaylistService::default();
    let snapshot = service
        .add_paths(vec![PathBuf::from("a.mp3"), PathBuf::from("b.mp3")])
        .unwrap();
    let first_id = snapshot.tracks[0].id.clone();

    let updated = service.remove_track(&first_id).unwrap();

    assert_eq!(updated.playlist.track_ids.len(), 1);
    assert_eq!(updated.playlist.current_index, 0);
}
```

- [ ] **Step 2: Run failing playlist tests**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml --test playlist_service
```

Expected: fails because `PlaylistService` does not exist.

- [ ] **Step 3: Add playlist snapshot model**

Extend `src-tauri/src/models.rs`:

```rust
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlaylistSnapshot {
    pub playlist: Playlist,
    pub tracks: Vec<Track>,
}
```

- [ ] **Step 4: Implement playlist service**

Create `src-tauri/src/services/playlist.rs` with deterministic title fallback from file stem, UUID track ids, and allowed extensions `mp3`, `flac`, `wav`, `ogg`, `m4a`, `aac`.

Core add logic must produce this behavior:

```rust
fn is_supported_audio_path(path: &std::path::Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| matches!(ext.to_ascii_lowercase().as_str(), "mp3" | "flac" | "wav" | "ogg" | "m4a" | "aac"))
        .unwrap_or(false)
}
```

- [ ] **Step 5: Add frontend reducer test**

Create `src/features/playlist/playlistReducer.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { playlistReducer } from "./playlistReducer";
import type { Playlist, Track } from "../../shared/types";

const playlist: Playlist = {
  id: "default",
  name: "当前播放列表",
  trackIds: ["1"],
  currentIndex: 0,
  playMode: "sequence"
};

const tracks: Track[] = [{
  id: "1",
  filePath: "a.mp3",
  title: "a",
  artist: "",
  album: "",
  durationMs: 0,
  coverArtRef: null,
  lyricsRef: null,
  tagStatus: "clean",
  status: "ready"
}];

describe("playlistReducer", () => {
  it("replaces playlist snapshot", () => {
    const state = playlistReducer(undefined, { type: "playlist/snapshot", playlist, tracks });
    expect(state.playlist.trackIds).toEqual(["1"]);
    expect(state.tracks["1"].title).toBe("a");
  });
});
```

- [ ] **Step 6: Implement reducer**

Create `src/features/playlist/playlistReducer.ts` with action type `playlist/snapshot` and normalized `tracks: Record<string, Track>`.

- [ ] **Step 7: Verify**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml --test playlist_service
npm test -- src/features/playlist/playlistReducer.test.ts
```

Expected: both pass.

- [ ] **Step 8: Commit**

Run:

```powershell
git add src src-tauri
git commit -m "feat: add playlist service"
```

## Task 5: Playback State Machine and Audio Adapter

**Files:**
- Create: `src-tauri/src/services/playback.rs`
- Modify: `src-tauri/src/state.rs`
- Modify: `src-tauri/src/main.rs`
- Create: `src/features/player/playerReducer.ts`
- Create: `src/features/player/playerReducer.test.ts`

**Interfaces:**
- Produces: `PlaybackService::play(track: Track) -> Result<PlaybackState, AppError>`.
- Produces: `PlaybackService::pause() -> PlaybackState`.
- Produces: `PlaybackService::toggle() -> PlaybackState`.
- Produces: `PlaybackService::seek(position_ms: u64) -> PlaybackState`.
- Produces: `PlaybackService::set_volume(volume: f32) -> PlaybackState`.
- Produces: `PlaybackService::set_muted(is_muted: bool) -> PlaybackState`.
- Produces Tauri commands: `play_track`, `toggle_playback`, `pause_playback`, `next_track`, `previous_track`, `seek`, `set_volume`, `set_muted`, `set_play_mode`, `get_playback_state`.

- [ ] **Step 1: Write frontend playback reducer test**

Create `src/features/player/playerReducer.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { playerReducer } from "./playerReducer";

describe("playerReducer", () => {
  it("stores playback snapshot and clamps volume", () => {
    const state = playerReducer(undefined, {
      type: "player/snapshot",
      state: {
        trackId: "1",
        positionMs: 1200,
        durationMs: 3000,
        volume: 1.4,
        isPlaying: true,
        isMuted: false,
        playMode: "sequence",
        eqEnabled: false
      }
    });

    expect(state.trackId).toBe("1");
    expect(state.volume).toBe(1);
  });
});
```

- [ ] **Step 2: Write Rust playback service test**

Add unit tests in `src-tauri/src/services/playback.rs` under `#[cfg(test)]`:

```rust
#[test]
fn clamps_volume_between_zero_and_one() {
    let mut service = PlaybackService::new_null();
    assert_eq!(service.set_volume(1.2).volume, 1.0);
    assert_eq!(service.set_volume(-0.5).volume, 0.0);
}

#[test]
fn toggle_flips_playing_state() {
    let mut service = PlaybackService::new_null();
    assert!(!service.current_state().is_playing);
    assert!(service.toggle().is_playing);
    assert!(!service.toggle().is_playing);
}
```

- [ ] **Step 3: Run failing tests**

Run:

```powershell
npm test -- src/features/player/playerReducer.test.ts
cargo test --manifest-path src-tauri/Cargo.toml playback
```

Expected: fails because reducer and service do not exist.

- [ ] **Step 4: Add Rust audio dependency**

Run:

```powershell
cargo add rodio --manifest-path src-tauri/Cargo.toml
```

Expected: `rodio` is added.

- [ ] **Step 5: Implement playback state machine**

Create `PlaybackService` with a nullable audio adapter for tests and a rodio adapter for runtime. The service must clamp volume to `0.0..=1.0`, keep `PlaybackState` in memory, and return state snapshots after every command.

- [ ] **Step 6: Implement frontend reducer**

Create `src/features/player/playerReducer.ts`:

```ts
import type { PlaybackState } from "../../shared/types";

export type PlayerAction = { type: "player/snapshot"; state: PlaybackState };

const initialState: PlaybackState = {
  trackId: null,
  positionMs: 0,
  durationMs: 0,
  volume: 0.8,
  isPlaying: false,
  isMuted: false,
  playMode: "sequence",
  eqEnabled: false
};

function clampVolume(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function playerReducer(
  state: PlaybackState = initialState,
  action: PlayerAction
): PlaybackState {
  if (action.type === "player/snapshot") {
    return { ...action.state, volume: clampVolume(action.state.volume) };
  }
  return state;
}
```

- [ ] **Step 7: Verify**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml playback
npm test -- src/features/player/playerReducer.test.ts
```

Expected: both pass.

- [ ] **Step 8: Commit**

Run:

```powershell
git add src src-tauri
git commit -m "feat: add playback state machine"
```

## Task 6: Main Player Shell, Playlist UI, and Controls

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/styles/theme.css`
- Modify: `src/styles/app.css`
- Create: `src/features/player/PlayerControls.tsx`
- Create: `src/features/player/PlayerControls.test.tsx`
- Create: `src/features/playlist/PlaylistPanel.tsx`
- Create: `src/features/playlist/PlaylistPanel.test.tsx`
- Modify: `src/shared/tauri.ts`

**Interfaces:**
- Consumes: `Track`, `Playlist`, `PlaybackState`, `invokeCommand`.
- Produces: accessible main UI for playlist, controls, progress, volume, and play mode.

- [ ] **Step 1: Write PlayerControls test**

Create `src/features/player/PlayerControls.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlayerControls } from "./PlayerControls";

describe("PlayerControls", () => {
  it("calls playback commands from buttons and volume slider", async () => {
    const user = userEvent.setup();
    const onCommand = vi.fn();
    render(
      <PlayerControls
        state={{
          trackId: "1",
          positionMs: 1000,
          durationMs: 5000,
          volume: 0.5,
          isPlaying: false,
          isMuted: false,
          playMode: "sequence",
          eqEnabled: false
        }}
        onCommand={onCommand}
      />
    );

    await user.click(screen.getByRole("button", { name: "播放" }));
    await user.click(screen.getByRole("button", { name: "下一首" }));
    await user.clear(screen.getByLabelText("音量"));
    await user.type(screen.getByLabelText("音量"), "80");

    expect(onCommand).toHaveBeenCalledWith("toggle_playback", {});
    expect(onCommand).toHaveBeenCalledWith("next_track", {});
    expect(onCommand).toHaveBeenCalledWith("set_volume", { value: 0.8 });
  });
});
```

- [ ] **Step 2: Write PlaylistPanel test**

Create `src/features/playlist/PlaylistPanel.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlaylistPanel } from "./PlaylistPanel";

describe("PlaylistPanel", () => {
  it("marks current and missing tracks", () => {
    render(
      <PlaylistPanel
        currentTrackId="2"
        tracks={[
          { id: "1", filePath: "a.mp3", title: "a", artist: "", album: "", durationMs: 0, coverArtRef: null, lyricsRef: null, tagStatus: "clean", status: "missing" },
          { id: "2", filePath: "b.mp3", title: "b", artist: "artist", album: "", durationMs: 0, coverArtRef: null, lyricsRef: null, tagStatus: "clean", status: "ready" }
        ]}
        onPlay={() => undefined}
        onRemove={() => undefined}
      />
    );

    expect(screen.getByText("a")).toBeInTheDocument();
    expect(screen.getByText("文件丢失")).toBeInTheDocument();
    expect(screen.getByText("正在播放")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Run failing component tests**

Run:

```powershell
npm test -- src/features/player/PlayerControls.test.tsx src/features/playlist/PlaylistPanel.test.tsx
```

Expected: fails because components do not exist.

- [ ] **Step 4: Implement controls and playlist components**

Create accessible buttons with Chinese labels: `上一首`, `播放` or `暂停`, `下一首`, `静音`, `播放模式`. Use numeric inputs or range sliders with labels `播放进度` and `音量`.

- [ ] **Step 5: Compose main window**

Update `src/App.tsx` to render:

- App title `悠悠乐听`.
- `PlaylistPanel`.
- `PlayerControls`.
- Tabs or segmented buttons for `歌词`, `可视化`, `标签`, `均衡器`.
- Skin and settings buttons.
- Desktop lyrics and mini-player buttons.

- [ ] **Step 6: Verify**

Run:

```powershell
npm test
npm run build
```

Expected: both pass.

- [ ] **Step 7: Commit**

Run:

```powershell
git add src
git commit -m "feat: build main player shell"
```

## Task 7: Metadata, Cover Art, and Tag Editing

**Files:**
- Create: `src-tauri/src/services/metadata.rs`
- Create: `src-tauri/src/services/artwork.rs`
- Modify: `src-tauri/src/models.rs`
- Modify: `src-tauri/src/main.rs`
- Create: `src/features/tags/TagEditor.tsx`
- Create: `src/features/tags/TagEditor.test.tsx`

**Interfaces:**
- Produces: `read_track_metadata(path: &Path) -> TrackMetadata`.
- Produces: `save_tags(track_id, title, artist, album, cover_path) -> Result<Track, AppError>`.
- Produces Tauri command: `save_tags`.

- [ ] **Step 1: Write TagEditor test**

Create `src/features/tags/TagEditor.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TagEditor } from "./TagEditor";

describe("TagEditor", () => {
  it("submits edited title artist and album", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    render(
      <TagEditor
        track={{ id: "1", filePath: "a.mp3", title: "Old", artist: "", album: "", durationMs: 0, coverArtRef: null, lyricsRef: null, tagStatus: "clean", status: "ready" }}
        onSave={onSave}
      />
    );

    await user.clear(screen.getByLabelText("标题"));
    await user.type(screen.getByLabelText("标题"), "New");
    await user.type(screen.getByLabelText("歌手"), "Singer");
    await user.click(screen.getByRole("button", { name: "保存标签" }));

    expect(onSave).toHaveBeenCalledWith({ title: "New", artist: "Singer", album: "", coverPath: null });
  });
});
```

- [ ] **Step 2: Add metadata dependency**

Run:

```powershell
cargo add lofty sha2 --manifest-path src-tauri/Cargo.toml
```

- [ ] **Step 3: Implement metadata and artwork services**

Use `lofty` to read title, artist, album, duration, and embedded picture when available. If tag reading fails, use the file stem as `title`, empty `artist` and `album`, and `duration_ms = 0`.

- [ ] **Step 4: Implement TagEditor**

Create form fields labelled `标题`, `歌手`, `专辑`, and button `保存标签`. The component must preserve values on save failure through parent state.

- [ ] **Step 5: Verify**

Run:

```powershell
npm test -- src/features/tags/TagEditor.test.tsx
cargo test --manifest-path src-tauri/Cargo.toml metadata
```

Expected: frontend test passes; Rust metadata tests pass after adding fixture-independent fallback tests.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src src-tauri
git commit -m "feat: add metadata and tag editing"
```

## Task 8: Lyrics Parsing, Sync, Desktop Lyrics Data

**Files:**
- Create: `src-tauri/src/services/lyrics.rs`
- Create: `src-tauri/tests/lyrics_service.rs`
- Modify: `src-tauri/src/models.rs`
- Modify: `src-tauri/src/main.rs`
- Create: `src/features/lyrics/LyricsPanel.tsx`
- Create: `src/features/lyrics/LyricsPanel.test.tsx`

**Interfaces:**
- Produces: `parse_lrc(contents: &str) -> LyricsDocument`.
- Produces: `active_line_at(document: &LyricsDocument, position_ms: u64) -> Option<LyricsLine>`.
- Produces Tauri command: `load_lyrics`.

- [ ] **Step 1: Write lyrics parser tests**

Create `src-tauri/tests/lyrics_service.rs`:

```rust
use yoyomusic_lib::services::lyrics::{active_line_at, parse_lrc};

#[test]
fn parses_lrc_timestamps() {
    let doc = parse_lrc("[00:01.00]第一句\n[00:03.50]第二句").unwrap();
    assert_eq!(doc.lines.len(), 2);
    assert_eq!(doc.lines[0].time_ms, 1000);
    assert_eq!(doc.lines[1].time_ms, 3500);
}

#[test]
fn finds_active_line_with_offset() {
    let mut doc = parse_lrc("[00:01.00]第一句\n[00:03.00]第二句").unwrap();
    doc.offset_ms = 500;
    let line = active_line_at(&doc, 3600).unwrap();
    assert_eq!(line.text, "第二句");
}
```

- [ ] **Step 2: Write LyricsPanel test**

Create `src/features/lyrics/LyricsPanel.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LyricsPanel } from "./LyricsPanel";

describe("LyricsPanel", () => {
  it("highlights the active lyric line", () => {
    render(
      <LyricsPanel
        positionMs={3500}
        document={{
          id: "lyrics-1",
          sourceType: "local_file",
          language: "zh-CN",
          offsetMs: 0,
          lines: [
            { timeMs: 1000, text: "第一句" },
            { timeMs: 3000, text: "第二句" }
          ]
        }}
      />
    );

    expect(screen.getByText("第二句")).toHaveAttribute("aria-current", "true");
  });

  it("renders empty lyrics copy", () => {
    render(<LyricsPanel positionMs={0} document={null} />);
    expect(screen.getByText("暂无歌词")).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Implement lyrics service**

Support `[mm:ss.xx]`, `[mm:ss.xxx]`, multiple timestamps on one line, empty line filtering, and signed offset.

- [ ] **Step 4: Implement LyricsPanel**

Render text `暂无歌词` when no document exists. Add `aria-current="true"` to the active line.

- [ ] **Step 5: Verify**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml --test lyrics_service
npm test -- src/features/lyrics/LyricsPanel.test.tsx
```

- [ ] **Step 6: Commit**

Run:

```powershell
git add src src-tauri
git commit -m "feat: add lyrics parsing and display"
```

## Task 9: Enrichment Providers and Cache

**Files:**
- Create: `src-tauri/src/services/enrichment.rs`
- Modify: `src-tauri/src/services/artwork.rs`
- Modify: `src-tauri/src/services/lyrics.rs`
- Modify: `src-tauri/src/models.rs`
- Modify: `src-tauri/src/main.rs`

**Interfaces:**
- Produces: `EnrichmentProvider` trait with `search_lyrics`, `search_artwork`, and `search_metadata`.
- Produces: `CacheKey::for_track(path, title, artist) -> String`.
- Produces: local cache writes for online lyrics, artwork, and metadata results.

- [ ] **Step 1: Write cache key tests**

Add tests in `src-tauri/src/services/enrichment.rs`:

```rust
#[test]
fn cache_key_is_stable_for_same_track_identity() {
    let a = CacheKey::for_track("D:/Music/a.mp3", "Song", "Artist");
    let b = CacheKey::for_track("D:/Music/a.mp3", "Song", "Artist");
    assert_eq!(a.value, b.value);
}

#[test]
fn cache_key_changes_when_path_changes() {
    let a = CacheKey::for_track("a.mp3", "Song", "Artist");
    let b = CacheKey::for_track("b.mp3", "Song", "Artist");
    assert_ne!(a.value, b.value);
}
```

- [ ] **Step 2: Implement provider abstraction**

Create a trait:

```rust
pub trait EnrichmentProvider: Send + Sync {
    fn search_lyrics(&self, title: &str, artist: &str) -> Result<Option<String>, AppError>;
    fn search_artwork(&self, title: &str, artist: &str) -> Result<Option<Vec<u8>>, AppError>;
    fn search_metadata(&self, title: &str, artist: &str) -> Result<Option<EnrichedMetadata>, AppError>;
}
```

Add a `NoopProvider` that returns `Ok(None)` for tests and disabled settings.

- [ ] **Step 3: Add HTTP plugin**

Run:

```powershell
cargo add tauri-plugin-http --manifest-path src-tauri/Cargo.toml
```

Add the plugin to `src-tauri/src/main.rs` and permissions to `src-tauri/capabilities/default.json`.

- [ ] **Step 4: Verify**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml enrichment
npm run build
```

- [ ] **Step 5: Commit**

Run:

```powershell
git add src-tauri src
git commit -m "feat: add enrichment providers and cache keys"
```

## Task 10: Skin Package Validation and Theme Application

**Files:**
- Create: `src-tauri/src/services/skin.rs`
- Create: `src-tauri/tests/skin_service.rs`
- Create: `src/features/skin/theme.ts`
- Create: `src/features/skin/theme.test.ts`
- Create: `src/features/skin/SkinManager.tsx`
- Create: `src/features/skin/SkinManager.test.tsx`
- Create: `docs/skins/yoyomusic-skin-format.md`
- Modify: `src-tauri/src/models.rs`
- Modify: `src-tauri/src/main.rs`

**Interfaces:**
- Produces: `validate_skin_package(path: PathBuf) -> Result<SkinManifest, AppError>`.
- Produces: `applyThemeTokens(tokens: SkinThemeTokens, root: HTMLElement): void`.
- Produces Tauri commands: `validate_skin_package`, `apply_skin`.

- [ ] **Step 1: Write skin validation tests**

Create `src-tauri/tests/skin_service.rs`:

```rust
use std::fs;
use tempfile::tempdir;
use yoyomusic_lib::services::skin::validate_skin_package;

#[test]
fn validates_skin_package_with_required_files() {
    let dir = tempdir().unwrap();
    fs::create_dir_all(dir.path().join("assets")).unwrap();
    fs::write(
        dir.path().join("manifest.json"),
        r#"{"name":"Classic Blue","version":"1.0.0","author":"YoYoMusic","supports":["main","mini","desktopLyrics"],"assets":[]}"#,
    )
    .unwrap();
    fs::write(
        dir.path().join("theme.json"),
        r##"{"colors":{"primary":"#102030","surface":"#ffffff","text":"#111111"}}"##,
    )
    .unwrap();

    let manifest = validate_skin_package(dir.path().to_path_buf()).unwrap();

    assert_eq!(manifest.name, "Classic Blue");
}

#[test]
fn rejects_skin_package_without_manifest() {
    let dir = tempdir().unwrap();
    fs::create_dir_all(dir.path().join("assets")).unwrap();
    fs::write(dir.path().join("theme.json"), "{}").unwrap();

    let err = validate_skin_package(dir.path().to_path_buf()).unwrap_err();

    assert!(err.to_string().contains("manifest"));
}
```

- [ ] **Step 2: Write theme application test**

Create `src/features/skin/theme.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { applyThemeTokens } from "./theme";

describe("applyThemeTokens", () => {
  it("writes skin tokens as css variables", () => {
    const root = document.createElement("div");
    applyThemeTokens({ colors: { primary: "#102030", surface: "#ffffff", text: "#111111" } }, root);
    expect(root.style.getPropertyValue("--color-primary")).toBe("#102030");
    expect(root.style.getPropertyValue("--color-surface")).toBe("#ffffff");
  });
});
```

- [ ] **Step 3: Implement skin service**

Validate required files, reject missing `name`, `version`, or `author`, reject path traversal in asset paths, and return `AppError::InvalidSkinPackage` with a specific message.

- [ ] **Step 4: Implement skin UI**

Add import, preview, apply, and invalid package message. The UI must not change the current skin after validation failure.

- [ ] **Step 5: Document skin format**

Create `docs/skins/yoyomusic-skin-format.md` with examples for `manifest.json`, `theme.json`, allowed assets, supported windows, and unsupported capabilities.

- [ ] **Step 6: Verify**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml --test skin_service
npm test -- src/features/skin/theme.test.ts src/features/skin/SkinManager.test.tsx
```

- [ ] **Step 7: Commit**

Run:

```powershell
git add src src-tauri docs/skins
git commit -m "feat: add skin package support"
```

## Task 11: Visualization Modes and Equalizer UI

**Files:**
- Create: `src/features/visualization/VisualizationPanel.tsx`
- Create: `src/features/visualization/VisualizationPanel.test.tsx`
- Create: `src/features/visualization/renderers.ts`
- Create: `src/features/visualization/renderers.test.ts`
- Create: `src/features/equalizer/EqualizerPanel.tsx`
- Create: `src/features/equalizer/EqualizerPanel.test.tsx`
- Modify: `src-tauri/src/services/playback.rs`
- Modify: `src-tauri/src/models.rs`

**Interfaces:**
- Produces: visualization modes `spectrum`, `waveform`, `radial`.
- Produces: `VisualizationFrame { values: Vec<f32>, peak: f32, position_ms: u64 }`.
- Produces: equalizer settings with 10 frequency bands and presets `flat`, `rock`, `pop`, `vocal`.

- [ ] **Step 1: Write visualization renderer tests**

Create `src/features/visualization/renderers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { normalizeFrameValues } from "./renderers";

describe("normalizeFrameValues", () => {
  it("clamps visualizer values", () => {
    expect(normalizeFrameValues([-1, 0.5, 2])).toEqual([0, 0.5, 1]);
  });
});
```

- [ ] **Step 2: Write EqualizerPanel test**

Create `src/features/equalizer/EqualizerPanel.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EqualizerPanel } from "./EqualizerPanel";

describe("EqualizerPanel", () => {
  it("renders ten bands and applies rock preset", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <EqualizerPanel
        settings={{ enabled: false, preset: "flat", bands: Array(10).fill(0) }}
        onChange={onChange}
      />
    );

    expect(screen.getAllByLabelText(/频段/)).toHaveLength(10);
    await user.click(screen.getByRole("button", { name: "摇滚" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ preset: "rock", enabled: true }));
  });
});
```

- [ ] **Step 3: Implement visualization renderers**

Add pure renderer data helpers and canvas draw functions for spectrum bars, waveform, and radial pulse. Draw functions must skip animation when `window.matchMedia("(prefers-reduced-motion: reduce)").matches` is true.

- [ ] **Step 4: Implement equalizer panel**

Expose enable toggle, preset buttons, and ten band sliders. Dispatch `save_settings` or a dedicated `set_equalizer` command with full settings.

- [ ] **Step 5: Verify**

Run:

```powershell
npm test -- src/features/visualization/renderers.test.ts src/features/equalizer/EqualizerPanel.test.tsx
cargo test --manifest-path src-tauri/Cargo.toml playback
```

- [ ] **Step 6: Commit**

Run:

```powershell
git add src src-tauri
git commit -m "feat: add visualizations and equalizer controls"
```

## Task 12: Multi-Window Desktop Lyrics and Mini Player

**Files:**
- Create: `src-tauri/src/services/window.rs`
- Create: `src/features/lyrics/DesktopLyrics.tsx`
- Create: `src/features/lyrics/DesktopLyrics.test.tsx`
- Create: `src/features/mini/MiniPlayer.tsx`
- Create: `src/features/mini/MiniPlayer.test.tsx`
- Modify: `src/main.tsx`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/src/main.rs`

**Interfaces:**
- Produces Tauri commands: `open_mini_player`, `toggle_desktop_lyrics`.
- Produces routes: `/?window=main`, `/?window=mini`, `/?window=desktop-lyrics`.

- [ ] **Step 1: Write mini player test**

Create `src/features/mini/MiniPlayer.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MiniPlayer } from "./MiniPlayer";

describe("MiniPlayer", () => {
  it("shows compact playback controls", () => {
    render(
      <MiniPlayer
        title="Song A"
        artist="Artist A"
        isPlaying={false}
        onCommand={vi.fn()}
      />
    );

    expect(screen.getByText("Song A")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "播放" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "下一首" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "静音" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Write desktop lyrics test**

Create `src/features/lyrics/DesktopLyrics.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DesktopLyrics } from "./DesktopLyrics";

describe("DesktopLyrics", () => {
  it("renders current lyric with click-through control", () => {
    render(
      <DesktopLyrics
        currentLine="正在播放的歌词"
        locked={false}
        onToggleClickThrough={vi.fn()}
      />
    );

    expect(screen.getByText("正在播放的歌词")).toHaveClass("desktop-lyrics__line");
    expect(screen.getByRole("button", { name: "开启穿透" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: Implement route selection**

In `src/main.tsx`, read `new URLSearchParams(window.location.search).get("window")` and render `App`, `MiniPlayer`, or `DesktopLyrics`.

- [ ] **Step 4: Implement window service**

Use Tauri APIs to create or focus mini and lyrics windows. Configure desktop lyrics as transparent, decorations disabled, always on top, and skip taskbar where supported.

- [ ] **Step 5: Verify**

Run:

```powershell
npm test -- src/features/mini/MiniPlayer.test.tsx src/features/lyrics/DesktopLyrics.test.tsx
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
```

- [ ] **Step 6: Commit**

Run:

```powershell
git add src src-tauri
git commit -m "feat: add mini player and desktop lyrics windows"
```

## Task 13: Tray, Global Shortcuts, and Window State

**Files:**
- Create: `src-tauri/src/services/tray.rs`
- Create: `src-tauri/src/services/shortcuts.rs`
- Modify: `src-tauri/src/main.rs`
- Modify: `src-tauri/capabilities/default.json`
- Modify: `src/features/settings/SettingsPanel.tsx`
- Create: `src/features/settings/SettingsPanel.test.tsx`

**Interfaces:**
- Produces tray menu actions: play/pause, previous, next, show/hide main window, open mini player, toggle desktop lyrics, quit.
- Produces shortcut actions: toggle playback, previous, next, volume up, volume down, desktop lyrics.
- Produces conflict result `ShortcutConflict`.

- [ ] **Step 1: Add plugins**

Run:

```powershell
cargo add tauri-plugin-global-shortcut tauri-plugin-window-state --manifest-path src-tauri/Cargo.toml
```

Ensure npm plugin dependencies from Task 1 are installed.

- [ ] **Step 2: Write shortcut parser tests**

Add unit tests in `src-tauri/src/services/shortcuts.rs` for duplicate shortcut detection:

```rust
#[test]
fn detects_duplicate_shortcut_assignments() {
    let bindings = vec![
        ("toggle_playback".to_string(), "Ctrl+Alt+P".to_string()),
        ("next_track".to_string(), "Ctrl+Alt+P".to_string()),
    ];
    assert!(detect_duplicate_shortcuts(&bindings).is_err());
}
```

- [ ] **Step 3: Implement tray service**

Create menu items with stable ids `toggle_playback`, `previous_track`, `next_track`, `show_main_window`, `open_mini_player`, `toggle_desktop_lyrics`, and `quit`.

- [ ] **Step 4: Implement settings UI for shortcuts**

Create labelled shortcut fields and show a conflict message containing `快捷键冲突` when the save response returns `shortcut_conflict`.

- [ ] **Step 5: Verify**

Run:

```powershell
cargo test --manifest-path src-tauri/Cargo.toml shortcuts
npm test -- src/features/settings/SettingsPanel.test.tsx
```

- [ ] **Step 6: Commit**

Run:

```powershell
git add src src-tauri
git commit -m "feat: add tray shortcuts and window state"
```

## Task 14: Error Handling, Notifications, and Accessibility Pass

**Files:**
- Create: `src/shared/errors.ts`
- Create: `src/shared/errors.test.ts`
- Create: `src/features/shell/AppErrorBanner.tsx`
- Create: `src/features/shell/AppErrorBanner.test.tsx`
- Modify: `src/styles/app.css`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: visible error banner for file missing, unplayable file, tag save failure, enrichment failure, invalid skin, shortcut conflict, and desktop lyrics failure.
- Produces: keyboard-accessible focus states and reduced-motion CSS.

- [ ] **Step 1: Write error mapping test**

Create `src/shared/errors.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { mapAppError } from "./errors";

describe("mapAppError", () => {
  it("maps invalid skin errors to Chinese user copy", () => {
    expect(mapAppError({ code: "invalid_skin_package", message: "missing manifest" })).toBe("皮肤包无效：missing manifest");
  });
});
```

- [ ] **Step 2: Implement error mapper**

Create `src/shared/errors.ts` with explicit mappings for `file_missing`, `unplayable`, `metadata_read_failed`, `metadata_write_failed`, `invalid_skin_package`, `shortcut_conflict`, and `storage_failed`.

- [ ] **Step 3: Add focus and reduced-motion CSS**

In `src/styles/app.css`, add:

```css
:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 3px;
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.001ms !important;
    animation-iteration-count: 1 !important;
    scroll-behavior: auto !important;
    transition-duration: 0.001ms !important;
  }
}
```

- [ ] **Step 4: Verify**

Run:

```powershell
npm test -- src/shared/errors.test.ts src/features/shell/AppErrorBanner.test.tsx
npm run build
```

- [ ] **Step 5: Commit**

Run:

```powershell
git add src
git commit -m "feat: add error and accessibility handling"
```

## Task 15: End-to-End Integration and Local Documentation

**Files:**
- Create: `docs/building.md`
- Modify: `README.md`
- Modify: `src-tauri/tauri.conf.json`
- Modify: `src-tauri/capabilities/default.json`

**Interfaces:**
- Produces documented local commands for development, tests, and installer builds.
- Produces app metadata suitable for bundles.

- [ ] **Step 1: Configure bundle metadata**

Set in `src-tauri/tauri.conf.json`:

```json
{
  "productName": "悠悠乐听",
  "identifier": "com.xyito.yoyomusic",
  "bundle": {
    "active": true,
    "targets": "all",
    "category": "Music"
  }
}
```

Keep the rest of the generated Tauri config valid.

- [ ] **Step 2: Write local build docs**

Create `docs/building.md` with these commands:

````markdown
# Building YoYoMusic

## Development

```powershell
npm install
npm run tauri dev
```

## Tests

```powershell
npm test
cargo test --manifest-path src-tauri/Cargo.toml
```

## Local installer build

```powershell
npm run tauri build
```
````

- [ ] **Step 3: Update README**

Include product scope, platform targets, local development commands, and link to `docs/building.md`.

- [ ] **Step 4: Full local verification**

Run:

```powershell
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: all pass. On Windows, also run:

```powershell
npm run tauri build
```

Expected: installer artifacts are created under `src-tauri/target/release/bundle/`.

- [ ] **Step 5: Commit**

Run:

```powershell
git add README.md docs src-tauri
git commit -m "docs: add build and integration guidance"
```

## Task 16: GitHub Actions Manual Three-Platform Installer Builds

**Files:**
- Create: `.github/workflows/build-installers.yml`
- Modify: `docs/building.md`

**Interfaces:**
- Produces manual workflow `Build installers`.
- Produces `workflow_dispatch` with input `releaseDraft`.
- Produces Windows, macOS, and Linux build jobs.
- Produces uploaded installer artifacts for each platform.

- [ ] **Step 1: Create workflow file**

Create `.github/workflows/build-installers.yml`:

```yaml
name: Build installers

on:
  workflow_dispatch:
    inputs:
      releaseDraft:
        description: "Create a draft GitHub release with build artifacts"
        required: true
        default: "false"
        type: choice
        options:
          - "false"
          - "true"

permissions:
  contents: write

jobs:
  build:
    name: Build ${{ matrix.platform.name }}
    strategy:
      fail-fast: false
      matrix:
        platform:
          - name: windows
            os: windows-latest
          - name: macos
            os: macos-latest
          - name: linux
            os: ubuntu-latest
    runs-on: ${{ matrix.platform.os }}

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm

      - name: Setup Rust
        uses: dtolnay/rust-toolchain@stable

      - name: Install Linux dependencies
        if: matrix.platform.os == 'ubuntu-latest'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf libasound2-dev

      - name: Install frontend dependencies
        run: npm ci

      - name: Run frontend tests
        run: npm test

      - name: Run Rust tests
        run: cargo test --manifest-path src-tauri/Cargo.toml

      - name: Build app
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          includeDebug: false

      - name: Upload Windows installers
        if: matrix.platform.name == 'windows'
        uses: actions/upload-artifact@v4
        with:
          name: yoyomusic-windows-installers
          path: |
            src-tauri/target/release/bundle/msi/*.msi
            src-tauri/target/release/bundle/nsis/*.exe
          if-no-files-found: error

      - name: Upload macOS installers
        if: matrix.platform.name == 'macos'
        uses: actions/upload-artifact@v4
        with:
          name: yoyomusic-macos-installers
          path: |
            src-tauri/target/release/bundle/dmg/*.dmg
            src-tauri/target/release/bundle/macos/*.app
          if-no-files-found: error

      - name: Upload Linux installers
        if: matrix.platform.name == 'linux'
        uses: actions/upload-artifact@v4
        with:
          name: yoyomusic-linux-installers
          path: |
            src-tauri/target/release/bundle/deb/*.deb
            src-tauri/target/release/bundle/rpm/*.rpm
            src-tauri/target/release/bundle/appimage/*.AppImage
          if-no-files-found: error

  draft-release:
    name: Draft release
    needs: build
    if: github.event.inputs.releaseDraft == 'true'
    runs-on: ubuntu-latest
    steps:
      - name: Download artifacts
        uses: actions/download-artifact@v4
        with:
          path: artifacts

      - name: Create draft release
        uses: softprops/action-gh-release@v2
        with:
          draft: true
          tag_name: manual-${{ github.run_number }}
          name: YoYoMusic manual build ${{ github.run_number }}
          files: artifacts/**/*
```

- [ ] **Step 2: Validate workflow syntax locally**

Run:

```powershell
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: project commands referenced by the workflow pass locally.

- [ ] **Step 3: Document manual workflow**

Append to `docs/building.md`:

```markdown
## GitHub Actions installer build

Open GitHub Actions, choose `Build installers`, select `Run workflow`, and keep `releaseDraft` as `false` to upload platform artifacts only. Select `true` to create a draft release named `YoYoMusic manual build <run_number>`.

Artifacts:

- `yoyomusic-windows-installers`
- `yoyomusic-macos-installers`
- `yoyomusic-linux-installers`
```

- [ ] **Step 4: Commit**

Run:

```powershell
git add .github/workflows/build-installers.yml docs/building.md
git commit -m "ci: add manual installer builds"
```

## Task 17: Completion Audit and Release Readiness Check

**Files:**
- Modify: `docs/building.md`
- Modify: `README.md`

**Interfaces:**
- Produces final evidence that the explicit requirements are implemented or clearly identified as platform-gated.

- [ ] **Step 1: Run full local verification**

Run:

```powershell
npm test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
```

Expected: all pass.

- [ ] **Step 2: Verify feature evidence by search**

Run:

```powershell
rg -n "PlaylistPanel|PlayerControls|LyricsPanel|DesktopLyrics|MiniPlayer|VisualizationPanel|SkinManager|TagEditor|EqualizerPanel|build-installers|workflow_dispatch"
```

Expected: each named feature appears in committed source files.

- [ ] **Step 3: Verify packaging workflow exists**

Run:

```powershell
rg -n "windows-latest|macos-latest|ubuntu-latest|workflow_dispatch|tauri-apps/tauri-action" .github/workflows/build-installers.yml
```

Expected: all listed terms appear.

- [ ] **Step 4: Verify installer build on the current OS**

Run:

```powershell
npm run tauri build
```

Expected: the current operating system produces installer artifacts under `src-tauri/target/release/bundle/`.

- [ ] **Step 5: Commit readiness doc updates**

Run:

```powershell
git add README.md docs/building.md
git commit -m "docs: document release readiness checks"
```

- [ ] **Step 6: Report remaining platform evidence**

If local OS is Windows, report that macOS and Linux installers are verified by GitHub Actions run evidence, not local command output. If the workflow has not been run yet, report that the workflow file is present and local build commands pass, while remote platform artifacts remain unverified until a manual Actions run completes.
