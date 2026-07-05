# YoYoMusic Fixed Workbench UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the YoYoMusic main window from a page-like scrolling shell into a fixed-height desktop music workbench with internal scrolling zones.

**Architecture:** Keep existing React state, Tauri commands, and feature components. Restructure only the `App.tsx` main-window DOM into three workbench columns and update `app.css` so the viewport, chrome shell, work area, playlist, feature panel, and control bar have explicit fixed-height responsibilities. Add tests for landmarks and CSS scroll contracts.

**Tech Stack:** Tauri 2, React 19, TypeScript, Vitest, Testing Library, CSS Grid.

## Global Constraints

- 主窗口在桌面尺寸下固定为 `100vh` 工作台，禁止 `body`/整窗滚动。
- 播放列表和右侧功能面板各自拥有内部滚动，不影响整体窗口。
- 底部播放控制条固定在主窗口底部，始终可见。
- 保留现有青绿科技感和皮肤 token，不引入新的设计系统依赖。
- 不新增播放功能或改动 Rust 播放逻辑。
- 不重写皮肤包格式。
- 不实现 Winamp/千千静听 1:1 复古皮肤系统。
- 不以手机竖屏作为主要验收目标。
- 不引入新依赖。
- 不改变 Tauri/Rust 命令。
- 不改变已完成的自动连播事件模型。
- 不影响迷你播放器和桌面歌词路由。

---

## File Structure

- `src/App.tsx`: Split the main window into playlist column, now-playing column, and right feature sidebar; add a permanent workbench visualization in the center column.
- `src/App.test.tsx`: Assert the main workbench landmarks and fixed player controls remain accessible.
- `src/App.autoplay.test.tsx`: Existing autoplay UI test must remain green after the DOM move.
- `src/styles/app.css`: Replace page-style layout with fixed viewport shell, three-column grid, internal scroll regions, compact title bar, and hardware-like control bar.
- `src/styles/app-layout.test.ts`: New CSS contract test that checks the selectors/declarations preventing body-level scrolling and preserving internal scroll zones.
- `src/styles/theme.css`: No planned changes. Do not edit unless a CSS variable is required by the implementation; this plan does not require one.

## Task 1: Main Workbench DOM and Landmarks

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Verify: `src/App.autoplay.test.tsx`

**Interfaces:**
- Consumes: `PlaylistPanel`, `PlayerControls`, `VisualizationPanel`, `renderFeaturePanel(...)`, `createVisualizationFrame(positionMs: number)`
- Produces: `.workspace` with three children: `.playlist-panel`, `.now-playing`, `.feature-sidebar`
- Produces: right sidebar landmark `<aside className="feature-sidebar" role="complementary" aria-label="功能面板">`
- Produces: `.feature-content` wrapping the active feature panel
- Produces: `.workbench-visualization` with `role="img"` and `aria-label="播放动态可视化"`

- [ ] **Step 1: Write failing main workbench landmark test**

Replace `src/App.test.tsx` with:

```tsx
import { render, screen, within } from "@testing-library/react";
import App from "./App";

it("renders the fixed workbench landmarks", () => {
  render(<App />);

  expect(screen.getByRole("heading", { name: "悠悠乐听" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "当前播放列表" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "当前播放" })).toBeInTheDocument();
  expect(screen.getByRole("complementary", { name: "功能面板" })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "播放动态可视化" })).toBeInTheDocument();

  const controls = screen.getByRole("region", { name: "播放控制" });
  expect(within(controls).getByRole("button", { name: "播放" })).toBeInTheDocument();
  expect(within(controls).getByRole("slider", { name: "播放进度" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- src/App.test.tsx
```

Expected: fails because `功能面板` complementary landmark and `播放动态可视化` image do not exist.

- [ ] **Step 3: Add center visualization data in `App.tsx`**

In `src/App.tsx`, after:

```tsx
const currentTrack = findCurrentTrack(playlist, playback.trackId);
```

add:

```tsx
const visualizationFrame = createVisualizationFrame(playback.positionMs);
```

- [ ] **Step 4: Replace the workspace JSX in `App.tsx`**

In `src/App.tsx`, replace the entire `<div className="workspace">...</div>` block that currently contains `PlaylistPanel` and `<section className="now-playing" ...>` with:

```tsx
<div className="workspace">
  <PlaylistPanel
    currentTrackId={playback.trackId}
    tracks={playlist.tracks}
    onPlay={(trackId) => void handleCommand("play_track", { trackId })}
    onRemove={(trackId) => void handleCommand("remove_track", { trackId })}
    onAddFiles={() => void handleAddFiles()}
    onAddFolder={() => void handleAddFolder()}
    onClear={() => void handleCommand("clear_playlist")}
  />

  <section className="now-playing" aria-label="当前播放">
    <div className={playback.isPlaying ? "cover-card is-playing" : "cover-card"} aria-hidden="true">
      <div className="disc-ring" />
    </div>

    <div className="now-playing-copy">
      <p className="eyebrow">Now Playing</p>
      <h2>{currentTrack?.title ?? "等待添加本地音乐"}</h2>
      <p className="subtitle">{currentTrack?.artist || currentTrack?.album || "选择文件或文件夹开始播放"}</p>
    </div>

    <div className="workbench-visualization" role="img" aria-label="播放动态可视化">
      <div className="visualization-preview visualization-preview--hero" aria-hidden="true">
        {visualizationFrame.values.slice(0, 18).map((value, index) => (
          <span key={index} style={{ height: `${Math.max(10, value * 100)}%` }} />
        ))}
      </div>
    </div>
  </section>

  <aside className="feature-sidebar" role="complementary" aria-label="功能面板">
    <div className="feature-tabs" aria-label="功能面板标签">
      {featurePanels.map((panel) => (
        <button
          key={panel.id}
          type="button"
          aria-pressed={activePanel === panel.id}
          onClick={() => setActivePanel(panel.id)}
        >
          {panel.label}
        </button>
      ))}
    </div>

    <div className="feature-content">
      {renderFeaturePanel({
        activePanel,
        currentTrack,
        lyricsDocument,
        playback,
        settings,
        skins,
        settingsErrorCode,
        skinError,
        onSaveTags: handleSaveTags,
        onApplySkin: (skinId) => void handleApplySkin(skinId),
        onImportSkin: () => void handleImportSkin(),
        onShortcutChange: handleShortcutChange,
        onVisualizationModeChange: handleVisualizationModeChange,
        onSettingsChange: updateSettings,
      })}
    </div>
  </aside>
</div>
```

- [ ] **Step 5: Verify App workbench and autoplay tests pass**

Run:

```powershell
npm test -- src/App.test.tsx src/App.autoplay.test.tsx
```

Expected: both test files pass. `src/App.autoplay.test.tsx` must still find the current track heading and pause button after playback events.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/App.tsx src/App.test.tsx
git commit -m "feat: restructure main window workbench"
```

## Task 2: Fixed Viewport CSS and Internal Scroll Contracts

**Files:**
- Create: `src/styles/app-layout.test.ts`
- Modify: `src/styles/app.css`

**Interfaces:**
- Consumes: `.feature-sidebar`, `.feature-content`, `.workbench-visualization`, `.now-playing-copy` from Task 1
- Produces: fixed root scroll contract: `html, body, #root { height: 100%; overflow: hidden; }`
- Produces: `.chrome { height: calc(100vh - 24px); grid-template-rows: auto minmax(0, 1fr) auto; overflow: hidden; }`
- Produces: `.track-list { overflow: auto; }`
- Produces: `.feature-content { overflow: auto; }`

- [ ] **Step 1: Write failing CSS layout contract test**

Create `src/styles/app-layout.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./app.css", import.meta.url), "utf8").replace(/\r\n/g, "\n");

function rule(selector: string) {
  const match = css.match(new RegExp(`${escapeRegExp(selector)}\\s*\\{([\\s\\S]*?)\\}`));
  if (!match) throw new Error(`Missing CSS rule for ${selector}`);
  return match[1];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("fixed workbench layout CSS", () => {
  it("locks the app root to the viewport instead of document scrolling", () => {
    const rootRule = rule("html,\nbody,\n#root");

    expect(rootRule).toContain("height: 100%;");
    expect(rootRule).toContain("overflow: hidden;");
  });

  it("keeps chrome, playlist, feature panel, and controls in fixed workbench zones", () => {
    expect(rule(".chrome")).toContain("grid-template-rows: auto minmax(0, 1fr) auto;");
    expect(rule(".chrome")).toContain("height: calc(100vh - 24px);");
    expect(rule(".workspace")).toContain(
      "grid-template-columns: minmax(260px, 0.85fr) minmax(320px, 1.15fr) minmax(280px, 0.95fr);",
    );
    expect(rule(".playlist-panel")).toContain("grid-template-rows: auto auto minmax(0, 1fr);");
    expect(rule(".track-list")).toContain("overflow: auto;");
    expect(rule(".feature-content")).toContain("overflow: auto;");
    expect(rule(".player-controls")).toContain("grid-row: 3;");
  });
});
```

- [ ] **Step 2: Run CSS test to verify it fails**

Run:

```powershell
npm test -- src/styles/app-layout.test.ts
```

Expected: fails because the root `html, body, #root` rule and `.feature-content` rule do not exist, and `.chrome` is not yet a fixed three-row grid.

- [ ] **Step 3: Replace `src/styles/app.css` with the fixed workbench CSS**

Replace the entire contents of `src/styles/app.css` with:

```css
* {
  box-sizing: border-box;
}

html,
body,
#root {
  height: 100%;
  overflow: hidden;
}

body {
  margin: 0;
  min-width: 320px;
  color: var(--color-text);
  background:
    radial-gradient(circle at 18% 18%, rgba(49, 214, 163, 0.24), transparent 30rem),
    radial-gradient(circle at 82% 24%, rgba(143, 211, 255, 0.2), transparent 28rem),
    linear-gradient(135deg, #080b12 0%, #101625 52%, #05070c 100%);
}

button,
input,
select,
textarea {
  font: inherit;
}

.app-shell {
  height: 100%;
  overflow: hidden;
  display: grid;
  place-items: center;
  padding: 12px;
}

.chrome {
  width: min(1280px, calc(100vw - 24px));
  height: calc(100vh - 24px);
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 14px;
  overflow: hidden;
  padding: 18px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: var(--radius-panel);
  background:
    linear-gradient(145deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.025)),
    var(--color-surface);
  box-shadow: var(--shadow-panel);
}

.title-bar,
.panel-heading,
.transport-row,
.track-item,
.feature-tabs,
.player-controls {
  display: flex;
}

.title-bar {
  min-height: 60px;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  padding: 4px 2px 10px;
}

.title-actions,
.playlist-actions,
.transport-row,
.feature-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.eyebrow {
  margin: 0 0 8px;
  color: var(--color-primary);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  font-size: clamp(2rem, 4vw, 3.2rem);
  line-height: 0.95;
  letter-spacing: -0.06em;
}

h2 {
  margin: 0;
  font-size: clamp(1.5rem, 3vw, 2.55rem);
  line-height: 1.05;
}

.subtitle {
  max-width: 28rem;
  margin: 12px 0 0;
  color: var(--color-muted);
  font-size: clamp(0.96rem, 1.3vw, 1.08rem);
  line-height: 1.55;
}

.workspace {
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(260px, 0.85fr) minmax(320px, 1.15fr) minmax(280px, 0.95fr);
  gap: 14px;
  overflow: hidden;
}

.playlist-panel,
.feature-sidebar,
.now-playing,
.player-controls {
  min-width: 0;
  min-height: 0;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 24px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.075), rgba(255, 255, 255, 0.025)),
    rgba(4, 8, 15, 0.46);
}

.playlist-panel {
  display: grid;
  grid-template-rows: auto auto minmax(0, 1fr);
  padding: 18px;
  overflow: hidden;
}

.feature-sidebar {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 12px;
  padding: 18px;
  overflow: hidden;
}

.now-playing {
  display: grid;
  grid-template-rows: minmax(150px, 0.85fr) auto minmax(110px, 0.55fr);
  align-items: center;
  justify-items: center;
  gap: 18px;
  position: relative;
  overflow: hidden;
  padding: clamp(16px, 2.2vh, 24px);
}

.panel-heading {
  align-items: center;
  justify-content: space-between;
  gap: 14px;
}

.panel-heading h2 {
  font-size: 1.18rem;
  letter-spacing: -0.03em;
}

.playlist-actions {
  margin: 14px 0 0;
}

.empty-state {
  color: var(--color-muted);
}

.track-list {
  min-height: 0;
  display: grid;
  align-content: start;
  gap: 10px;
  overflow: auto;
  padding: 2px 4px 2px 0;
  margin: 14px 0 0;
  list-style: none;
  scrollbar-color: rgba(49, 214, 163, 0.48) rgba(255, 255, 255, 0.06);
}

.track-item {
  align-items: center;
  gap: 10px;
  padding: 10px;
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.045);
}

.track-item.is-current {
  border-color: rgba(49, 214, 163, 0.34);
  background: linear-gradient(90deg, rgba(49, 214, 163, 0.2), rgba(255, 255, 255, 0.05));
  box-shadow: inset 3px 0 0 var(--color-primary);
}

.track-main {
  min-width: 0;
  flex: 1;
  padding: 0;
  text-align: left;
  background: transparent;
}

.track-main strong,
.track-main span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.track-main span,
.track-badges {
  color: var(--color-muted);
  font-size: 0.82rem;
}

.track-badges {
  display: grid;
  gap: 4px;
}

.cover-card {
  width: clamp(148px, 28vh, 260px);
  aspect-ratio: 1;
  display: grid;
  place-items: center;
  border: 1px solid rgba(143, 211, 255, 0.18);
  border-radius: 34px;
  background:
    radial-gradient(circle, rgba(49, 214, 163, 0.3), transparent 34%),
    linear-gradient(135deg, rgba(143, 211, 255, 0.24), rgba(49, 214, 163, 0.08));
  box-shadow:
    inset 0 0 40px rgba(255, 255, 255, 0.05),
    0 24px 60px rgba(0, 0, 0, 0.32);
}

.cover-card.is-playing .disc-ring {
  animation: disc-spin 8s linear infinite;
}

.disc-ring {
  width: 68%;
  aspect-ratio: 1;
  border: clamp(16px, 3vh, 28px) solid rgba(255, 255, 255, 0.14);
  border-radius: 50%;
  box-shadow: inset 0 0 0 clamp(10px, 2vh, 18px) rgba(0, 0, 0, 0.2);
}

.now-playing-copy {
  max-width: 100%;
  text-align: center;
}

.now-playing-copy h2,
.now-playing-copy .subtitle {
  overflow: hidden;
  text-overflow: ellipsis;
}

.workbench-visualization {
  width: 100%;
  min-height: 0;
  align-self: stretch;
  display: grid;
  align-items: end;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.035);
}

.feature-content {
  min-height: 0;
  overflow: auto;
  scrollbar-color: rgba(49, 214, 163, 0.48) rgba(255, 255, 255, 0.06);
}

.lyrics-panel,
.visualization-panel,
.tag-editor,
.equalizer-panel,
.skin-manager,
.settings-panel {
  min-height: 100%;
  display: grid;
  align-content: start;
  gap: 14px;
  overflow: visible;
  padding: 16px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  background: rgba(255, 255, 255, 0.04);
}

.lyric-line {
  margin: 0;
  color: var(--color-muted);
}

.lyric-line.is-active {
  color: var(--color-primary);
  font-weight: 800;
}

.visualization-preview {
  height: 130px;
  display: flex;
  align-items: end;
  gap: 5px;
}

.visualization-preview--hero {
  height: 100%;
  min-height: 86px;
}

.visualization-preview span {
  flex: 1;
  min-width: 4px;
  border-radius: 999px 999px 2px 2px;
  background: linear-gradient(180deg, var(--color-accent), var(--color-primary));
  box-shadow: 0 0 18px rgba(49, 214, 163, 0.2);
}

.tag-editor label,
.settings-panel label,
.eq-bands label {
  display: grid;
  gap: 6px;
  color: var(--color-muted);
}

.toggle-row {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--color-muted);
}

.eq-bands,
.skin-grid {
  display: grid;
  gap: 10px;
}

.skin-card {
  padding: 14px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.06);
}

.skin-card h3,
.skin-card p {
  margin: 0 0 8px;
}

.player-controls {
  grid-row: 3;
  align-items: center;
  gap: 14px;
  overflow: hidden;
  padding: 14px 16px;
  background:
    linear-gradient(180deg, rgba(143, 211, 255, 0.1), rgba(49, 214, 163, 0.035)),
    rgba(2, 6, 12, 0.68);
}

.control-field {
  min-width: 180px;
  display: grid;
  flex: 1;
  gap: 6px;
  color: var(--color-muted);
}

.control-field--compact {
  max-width: 128px;
}

button,
input {
  border: 0;
  border-radius: 999px;
}

button {
  color: var(--color-text);
  background: rgba(255, 255, 255, 0.1);
  cursor: pointer;
  padding: 9px 13px;
  transition:
    background 180ms ease,
    border-color 180ms ease,
    color 180ms ease;
}

button:hover {
  background: rgba(49, 214, 163, 0.22);
}

button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

input {
  color: var(--color-text);
  background: rgba(255, 255, 255, 0.1);
  padding: 8px 12px;
}

.ghost-button {
  color: var(--color-muted);
}

.app-error-banner,
.error-text {
  margin: 0;
  padding: 10px 12px;
  border: 1px solid rgba(255, 118, 118, 0.35);
  border-radius: 16px;
  color: #ffd6d6;
  background: rgba(130, 24, 26, 0.32);
}

.mini-player {
  min-height: 100vh;
  display: grid;
  grid-template-columns: 72px minmax(0, 1fr) auto;
  align-items: center;
  gap: 16px;
  padding: 18px;
  color: var(--color-text);
  background: rgba(8, 11, 18, 0.86);
}

.mini-cover {
  width: 72px;
  aspect-ratio: 1;
  border-radius: 18px;
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
}

.mini-copy {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.mini-copy span {
  color: var(--color-muted);
}

.desktop-lyrics {
  min-height: 100vh;
  display: grid;
  place-items: center;
  gap: 12px;
  padding: 18px;
  color: #fff;
  background: transparent;
}

.desktop-lyrics__line {
  margin: 0;
  font-size: clamp(2rem, 7vw, 4.8rem);
  font-weight: 800;
  text-align: center;
  text-shadow:
    0 3px 10px rgba(0, 0, 0, 0.9),
    0 0 24px rgba(49, 214, 163, 0.7);
}

@keyframes disc-spin {
  to {
    transform: rotate(360deg);
  }
}

@media (max-width: 980px) {
  .chrome {
    height: calc(100vh - 16px);
    width: calc(100vw - 16px);
    padding: 14px;
  }

  .workspace {
    grid-template-columns: minmax(240px, 0.9fr) minmax(320px, 1.1fr);
  }

  .feature-sidebar {
    grid-column: 1 / -1;
    min-height: 180px;
  }
}

@media (max-width: 760px) {
  .app-shell {
    padding: 8px;
  }

  .chrome {
    width: calc(100vw - 16px);
    height: calc(100vh - 16px);
    overflow: hidden;
  }

  .title-bar,
  .player-controls {
    align-items: stretch;
    flex-direction: column;
  }

  .workspace {
    grid-template-columns: 1fr;
    overflow: auto;
  }
}

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

- [ ] **Step 4: Verify CSS contract test passes**

Run:

```powershell
npm test -- src/styles/app-layout.test.ts
```

Expected: test passes.

- [ ] **Step 5: Verify main UI tests still pass**

Run:

```powershell
npm test -- src/App.test.tsx src/App.autoplay.test.tsx src/styles/app-layout.test.ts
```

Expected: all listed tests pass.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/styles/app.css src/styles/app-layout.test.ts
git commit -m "style: lock main window workbench layout"
```

## Task 3: Final UI Verification

**Files:**
- Verify only; no planned file changes.

**Interfaces:**
- Consumes: Task 1 DOM classes and Task 2 CSS contracts.
- Produces: Verification evidence that the fixed workbench UI is testable and buildable.

- [ ] **Step 1: Run full frontend verification**

Run:

```powershell
npm test
npm run build
```

Expected:

- `npm test` passes all frontend tests.
- `npm run build` completes TypeScript and Vite production build.

- [ ] **Step 2: Verify layout evidence by search**

Run:

```powershell
rg -n "html,|#root|height: calc\\(100vh - 24px\\)|grid-template-rows: auto minmax\\(0, 1fr\\) auto|feature-sidebar|feature-content|workbench-visualization|overflow: hidden|overflow: auto" src/App.tsx src/styles/app.css src/styles/app-layout.test.ts
```

Expected: results show fixed root/chrome sizing, the three workbench zones, and internal scroll declarations.

- [ ] **Step 3: Confirm git status**

Run:

```powershell
git status --short --branch
```

Expected: clean working tree on `feature/yoyomusic-full-app`.

## Self-Review Checklist

- Spec coverage: Task 1 implements the three-zone DOM and center visualization. Task 2 implements viewport locking, internal scroll regions, compact shell styling, and responsive rules. Task 3 verifies test/build/search evidence.
- Placeholder scan: This plan contains no placeholder markers, deferred work, or unspecified implementation steps.
- Type consistency: Produced class names match across tasks: `.feature-sidebar`, `.feature-content`, `.workbench-visualization`, `.now-playing-copy`, `.track-list`, `.player-controls`.
- Scope check: No Rust playback logic, Tauri command, skin package format, new dependency, or mini/desktop lyrics route change is included.
