# YoYoMusic Skin Visual Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deepen the five built-in layout skins so they read as five distinct desktop music-player machines instead of modern web cards, while keeping the fixed workbench shell and all existing playback features intact.

**Architecture:** Keep the current layout registry, `PlayerLayoutProps`, and shared feature panels. Add machine-shell wrappers and device-module labels in `layoutShared.tsx` and `layouts.tsx`, then layer the hardware treatment in `skin-layouts.css` using new shell/module hook classes instead of changing Rust/Tauri logic. Refresh built-in skin catalog copy so the selector matches the stronger machine identities.

**Tech Stack:** Tauri 2, React 19, TypeScript, Vitest, Testing Library, CSS Grid/Flexbox, CSS gradients/pseudo-elements.

## Global Constraints

- 强化五套皮肤的机身轮廓、面板边界、控制件造型和显示窗语义。
- 让五套皮肤像五台不同风格、不同年代、不同定位的播放器设备。
- 保持当前布局系统和共享业务组件复用，不推翻既有布局成果。
- 继续保证主窗口是固定工作台，不恢复整窗滚动。
- 让默认皮肤 `经典蓝银分体机` 更接近“千千静听时代桌面旗舰播放器”的感觉。
- 不增加第六套皮肤。
- 不重构 Tauri / Rust 播放逻辑。
- 不改变迷你播放器或桌面歌词窗口。
- 不引入图片贴图、外部字体依赖或新的 UI 库。
- 不做像素级仿制某一款历史软件。
- 不把皮肤系统扩展为第三方布局 DSL。
- `body` 不允许恢复滚动。
- 最外层应用容器不允许因为内容变长而撑高。
- 允许滚动的区域仅限：播放列表区、歌词区、功能面板区、少数设置项较长的子面板。
- 播放 / 暂停、上一首、下一首、音量、进度始终可见且可访问。
- `prefers-reduced-motion` 下关闭扫描光、脉冲灯、频闪类装饰效果。

---

## File Structure

- `src/features/skin/layoutShared.tsx`: Shared machine-shell primitives and wrapped content blocks. This is where module labels such as `曲目仓`, `状态窗`, and `控制台` should live so the five layouts stay consistent.
- `src/features/skin/layouts.tsx`: Per-skin shell composition. This file should only decide shell class names, module ordering, and machine-specific labels.
- `src/features/skin/layouts.test.tsx`: Accessibility and visible machine-label contract for all five built-in skins.
- `src/features/skin/layoutRegistry.tsx`: Built-in tone/description copy that feeds the skin selector.
- `src/features/skin/layoutRegistry.test.tsx`: Verifies the five built-in summaries still exist and now advertise the stronger machine identities.
- `src/features/skin/SkinManager.tsx`: Selector copy and metadata presentation for “内置机型” vs imported token skins.
- `src/features/skin/SkinManager.test.tsx`: Verifies the selector note and card copy.
- `src/styles/skin-layouts.css`: All hardware shell, module-frame, per-skin visual treatment, and responsive fixed-workbench rules.
- `src/styles/skin-layouts.test.ts`: CSS contract proving the device shell/module hooks, distinct shell variables, and fixed-shell constraints exist.
- `src/styles/app-layout.test.ts`: Existing fixed-workbench guard. No planned code changes unless a compatibility expectation truly needs to move.

## Task 1: Add Machine-Shell Semantics to Shared Layout Blocks

**Files:**
- Modify: `src/features/skin/layoutShared.tsx`
- Modify: `src/features/skin/layouts.tsx`
- Modify: `src/features/skin/layouts.test.tsx`

**Interfaces:**
- Produces: `DeviceModuleFrame(props: DeviceModuleFrameProps)`
- Produces: `PlaylistBlock`, `NowPlayingBlock`, `HeroVisualization`, `FeatureSidebar`, and `ControlsBlock` variants that accept:
  - `moduleLabel: string`
  - `eyebrow?: string`
  - `moduleClassName?: string`
- Produces shell hook classes consumed later by CSS:
  - `.device-shell`
  - `.device-shell--classic`
  - `.device-shell--vinyl`
  - `.device-shell--crystal`
  - `.device-shell--rack`
  - `.device-shell--wood`
  - `.device-module--playlist`
  - `.device-module--now-playing`
  - `.device-module--visualization`
  - `.device-module--feature`
  - `.device-module--controls`

- [ ] **Step 1: Replace the layout test with machine-shell expectations**

Replace `src/features/skin/layouts.test.tsx` with:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { builtInLayoutSkins } from "./layoutRegistry";
import type { PlayerLayoutProps } from "./layoutTypes";

const machineLabels: Record<
  string,
  { shellClass: string; labels: string[] }
> = {
  "classic-blue-silver": {
    shellClass: "device-shell--classic",
    labels: ["主控舱", "曲目仓", "状态窗", "功能仓", "控制台"],
  },
  "dark-vinyl": {
    shellClass: "device-shell--vinyl",
    labels: ["唱盘舱", "舞台频谱", "曲目塔", "控制塔", "控制台"],
  },
  "transparent-crystal": {
    shellClass: "device-shell--crystal",
    labels: ["透明舱", "资料匣", "悬浮仓", "底座控制台"],
  },
  "metal-rack": {
    shellClass: "device-shell--rack",
    labels: ["频谱桥", "机柜面板", "状态机柜", "机架控制台"],
  },
  "warm-wood": {
    shellClass: "device-shell--wood",
    labels: ["陈列窗", "节目单仓", "暖光铭牌窗", "黄铜控制台"],
  },
};

function createProps(): PlayerLayoutProps {
  return {
    playlist: {
      playlist: {
        id: "default",
        name: "当前播放列表",
        trackIds: ["a"],
        currentIndex: 0,
        playMode: "sequence",
      },
      tracks: [
        {
          id: "a",
          filePath: "a.mp3",
          title: "Song A",
          artist: "Artist A",
          album: "Album A",
          durationMs: 180000,
          coverArtRef: null,
          lyricsRef: null,
          tagStatus: "clean",
          status: "ready",
        },
      ],
    },
    playback: {
      trackId: "a",
      positionMs: 12000,
      durationMs: 180000,
      volume: 0.8,
      isPlaying: false,
      isMuted: false,
      playMode: "sequence",
      eqEnabled: false,
    },
    currentTrack: {
      id: "a",
      filePath: "a.mp3",
      title: "Song A",
      artist: "Artist A",
      album: "Album A",
      durationMs: 180000,
      coverArtRef: null,
      lyricsRef: null,
      tagStatus: "clean",
      status: "ready",
    },
    lyricsDocument: null,
    settings: {
      defaultSkin: "classic-blue-silver",
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
    },
    skins: [],
    activePanel: "lyrics",
    error: null,
    skinError: null,
    settingsErrorCode: null,
    visualizationFrame: {
      values: Array.from({ length: 24 }, (_, index) => 0.2 + index / 32),
      peak: 0.9,
      positionMs: 12000,
    },
    onActivePanelChange: vi.fn(),
    onPlayerCommand: vi.fn(),
    onAddFiles: vi.fn(),
    onAddFolder: vi.fn(),
    onClearPlaylist: vi.fn(),
    onSaveTags: vi.fn(),
    onApplySkin: vi.fn(),
    onImportSkin: vi.fn(),
    onShortcutChange: vi.fn(),
    onVisualizationModeChange: vi.fn(),
    onSettingsChange: vi.fn(),
  };
}

describe("layout skins", () => {
  it.each(builtInLayoutSkins)("renders machine-shell labels and controls for $name", (skin) => {
    const props = createProps();
    const expected = machineLabels[skin.id];
    const { container } = render(<skin.Layout {...props} />);

    expect(container.querySelector(`.${expected.shellClass}`)).toBeInTheDocument();
    expected.labels.forEach((label) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });

    expect(screen.getByRole("heading", { name: "悠悠乐听" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "当前播放列表" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "当前播放" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "功能面板" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "播放动态可视化" })).toBeInTheDocument();

    const controls = screen.getByRole("region", { name: "播放控制" });
    expect(within(controls).getByRole("button", { name: "播放" })).toBeInTheDocument();
    expect(within(controls).getByRole("slider", { name: "播放进度" })).toBeInTheDocument();
    expect(within(controls).getByRole("spinbutton", { name: "音量" })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the layout test to verify it fails**

Run:

```powershell
npm test -- src/features/skin/layouts.test.tsx
```

Expected: FAIL because the current layouts do not render `.device-shell--*` classes or visible machine-module labels.

- [ ] **Step 3: Add a reusable device-module frame in `layoutShared.tsx`**

In `src/features/skin/layoutShared.tsx`, add `ReactNode` to the import list and insert the shared wrapper above `TitleActions`:

```tsx
import type { ReactNode } from "react";

interface DeviceModuleFrameProps {
  moduleLabel: string;
  eyebrow?: string;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

function DeviceModuleFrame({
  moduleLabel,
  eyebrow,
  className,
  bodyClassName,
  children,
}: DeviceModuleFrameProps) {
  return (
    <section className={["device-module", className].filter(Boolean).join(" ")}>
      <header className="device-module__header">
        <p className="device-module__label">{moduleLabel}</p>
        {eyebrow ? <p className="device-module__eyebrow">{eyebrow}</p> : null}
      </header>
      <div className={["device-module__body", bodyClassName].filter(Boolean).join(" ")}>{children}</div>
    </section>
  );
}
```

Add a shared prop type under `featurePanels`:

```tsx
interface DeviceBlockProps {
  moduleLabel: string;
  eyebrow?: string;
  moduleClassName?: string;
}
```

Replace the five shared block helpers with wrapped versions:

```tsx
export function PlaylistBlock({
  moduleLabel,
  eyebrow = "Playlist Drawer",
  moduleClassName,
  ...props
}: PlayerLayoutProps & DeviceBlockProps) {
  return (
    <DeviceModuleFrame
      moduleLabel={moduleLabel}
      eyebrow={eyebrow}
      className={["device-module--playlist", moduleClassName].filter(Boolean).join(" ")}
    >
      <PlaylistPanel
        currentTrackId={props.playback.trackId}
        tracks={props.playlist.tracks}
        onPlay={(trackId) => props.onPlayerCommand("play_track", { trackId })}
        onRemove={(trackId) => props.onPlayerCommand("remove_track", { trackId })}
        onAddFiles={props.onAddFiles}
        onAddFolder={props.onAddFolder}
        onClear={props.onClearPlaylist}
      />
    </DeviceModuleFrame>
  );
}

export function NowPlayingBlock({
  moduleLabel,
  eyebrow = "Now Playing Display",
  moduleClassName,
  variant = "standard",
  ...props
}: PlayerLayoutProps &
  DeviceBlockProps & {
    variant?: string;
  }) {
  return (
    <DeviceModuleFrame
      moduleLabel={moduleLabel}
      eyebrow={eyebrow}
      className={["device-module--now-playing", moduleClassName].filter(Boolean).join(" ")}
    >
      <section className={`now-playing now-playing--${variant}`} aria-label="当前播放">
        <div className={props.playback.isPlaying ? "cover-card is-playing" : "cover-card"} aria-hidden="true">
          <div className="disc-ring" />
        </div>

        <div className="now-playing-copy">
          <p className="eyebrow">Now Playing</p>
          <h2>{props.currentTrack?.title ?? "等待添加本地音乐"}</h2>
          <p className="subtitle">
            {props.currentTrack?.artist || props.currentTrack?.album || "选择文件或文件夹开始播放"}
          </p>
        </div>
      </section>
    </DeviceModuleFrame>
  );
}

export function HeroVisualization({
  moduleLabel,
  eyebrow = "Spectrum Bridge",
  moduleClassName,
  ...props
}: PlayerLayoutProps & DeviceBlockProps) {
  return (
    <DeviceModuleFrame
      moduleLabel={moduleLabel}
      eyebrow={eyebrow}
      className={["device-module--visualization", moduleClassName].filter(Boolean).join(" ")}
    >
      <div className="workbench-visualization" role="img" aria-label="播放动态可视化">
        <div className="visualization-preview visualization-preview--hero" aria-hidden="true">
          {props.visualizationFrame.values.slice(0, 18).map((value, index) => (
            <span key={index} style={{ height: `${Math.max(10, value * 100)}%` }} />
          ))}
        </div>
      </div>
    </DeviceModuleFrame>
  );
}

export function FeatureSidebar({
  moduleLabel,
  eyebrow = "Expansion Bay",
  moduleClassName,
  ...props
}: PlayerLayoutProps & DeviceBlockProps) {
  return (
    <DeviceModuleFrame
      moduleLabel={moduleLabel}
      eyebrow={eyebrow}
      className={["device-module--feature", moduleClassName].filter(Boolean).join(" ")}
      bodyClassName="device-module__body--feature"
    >
      <aside className="feature-sidebar" role="complementary" aria-label="功能面板">
        <FeatureTabs {...props} />
        <FeatureContent {...props} />
      </aside>
    </DeviceModuleFrame>
  );
}

export function ControlsBlock({
  moduleLabel,
  eyebrow = "Transport Console",
  moduleClassName,
  ...props
}: PlayerLayoutProps & DeviceBlockProps) {
  return (
    <DeviceModuleFrame
      moduleLabel={moduleLabel}
      eyebrow={eyebrow}
      className={["device-module--controls", moduleClassName].filter(Boolean).join(" ")}
    >
      <PlayerControls state={props.playback} onCommand={(command, payload) => props.onPlayerCommand(command, payload)} />
    </DeviceModuleFrame>
  );
}
```

- [ ] **Step 4: Recompose the five layouts with machine labels and shell classes**

Replace `src/features/skin/layouts.tsx` with:

```tsx
import {
  AppTitle,
  ControlsBlock,
  FeatureSidebar,
  HeroVisualization,
  LayoutErrorBanner,
  NowPlayingBlock,
  PlaylistBlock,
  TitleActions,
} from "./layoutShared";
import type { PlayerLayoutProps } from "./layoutTypes";

export function ClassicBlueSilverLayout(props: PlayerLayoutProps) {
  return (
    <main className="app-shell skin-layout skin-layout--classic-blue-silver">
      <section className="chrome skin-chrome skin-chrome--classic device-shell device-shell--classic" aria-labelledby="app-title">
        <header className="title-bar skin-title skin-title--classic device-shell__header">
          <AppTitle eyebrow="Classic Blue Silver Player" />
          <TitleActions {...props} />
        </header>
        <LayoutErrorBanner error={props.error} />
        <div className="skin-grid skin-grid--classic">
          <PlaylistBlock {...props} moduleLabel="曲目仓" eyebrow="Drawer Playlist" moduleClassName="device-module--classic-playlist" />
          <div className="classic-center-deck">
            <NowPlayingBlock {...props} variant="classic" moduleLabel="状态窗" eyebrow="Blue Backlit Display" moduleClassName="device-module--classic-status" />
            <HeroVisualization {...props} moduleLabel="主控舱" eyebrow="Spectrum Bridge" moduleClassName="device-module--classic-visualization" />
          </div>
          <FeatureSidebar {...props} moduleLabel="功能仓" eyebrow="Expansion Bay" moduleClassName="device-module--classic-feature" />
        </div>
        <ControlsBlock {...props} moduleLabel="控制台" eyebrow="Mechanical Transport" moduleClassName="device-module--classic-controls" />
      </section>
    </main>
  );
}

export function DarkVinylLayout(props: PlayerLayoutProps) {
  return (
    <main className="app-shell skin-layout skin-layout--dark-vinyl">
      <section className="chrome skin-chrome skin-chrome--vinyl device-shell device-shell--vinyl" aria-labelledby="app-title">
        <header className="title-bar skin-title skin-title--vinyl device-shell__header">
          <AppTitle eyebrow="Night Vinyl Chamber" />
          <TitleActions {...props} />
        </header>
        <LayoutErrorBanner error={props.error} />
        <div className="skin-grid skin-grid--vinyl">
          <div className="vinyl-stage">
            <NowPlayingBlock {...props} variant="vinyl" moduleLabel="唱盘舱" eyebrow="Center Turntable" moduleClassName="device-module--vinyl-stage" />
            <HeroVisualization {...props} moduleLabel="舞台频谱" eyebrow="Stage Spectrum" moduleClassName="device-module--vinyl-visualization" />
            <ControlsBlock {...props} moduleLabel="控制台" eyebrow="Arc Transport" moduleClassName="device-module--vinyl-controls" />
          </div>
          <div className="vinyl-side-rail">
            <PlaylistBlock {...props} moduleLabel="曲目塔" eyebrow="Track Tower" moduleClassName="device-module--vinyl-playlist" />
            <FeatureSidebar {...props} moduleLabel="控制塔" eyebrow="Side Control Tower" moduleClassName="device-module--vinyl-feature" />
          </div>
        </div>
      </section>
    </main>
  );
}

export function TransparentCrystalLayout(props: PlayerLayoutProps) {
  return (
    <main className="app-shell skin-layout skin-layout--transparent-crystal">
      <section className="chrome skin-chrome skin-chrome--crystal device-shell device-shell--crystal" aria-labelledby="app-title">
        <header className="title-bar skin-title skin-title--crystal device-shell__header">
          <AppTitle eyebrow="Crystal Floating Console" />
          <TitleActions {...props} />
        </header>
        <LayoutErrorBanner error={props.error} />
        <div className="skin-grid skin-grid--crystal">
          <div className="crystal-now-panel">
            <NowPlayingBlock {...props} variant="crystal" moduleLabel="透明舱" eyebrow="HUD Display" moduleClassName="device-module--crystal-status" />
            <HeroVisualization {...props} moduleLabel="悬浮仓" eyebrow="Glass Spectrum" moduleClassName="device-module--crystal-visualization" />
          </div>
          <div className="crystal-playlist-drawer">
            <PlaylistBlock {...props} moduleLabel="资料匣" eyebrow="Slide Drawer" moduleClassName="device-module--crystal-playlist" />
          </div>
          <FeatureSidebar {...props} moduleLabel="悬浮仓" eyebrow="Floating Capsules" moduleClassName="device-module--crystal-feature" />
        </div>
        <ControlsBlock {...props} moduleLabel="底座控制台" eyebrow="Floating Base" moduleClassName="device-module--crystal-controls" />
      </section>
    </main>
  );
}

export function MetalRackLayout(props: PlayerLayoutProps) {
  return (
    <main className="app-shell skin-layout skin-layout--metal-rack">
      <section className="chrome skin-chrome skin-chrome--rack device-shell device-shell--rack" aria-labelledby="app-title">
        <header className="title-bar skin-title skin-title--rack device-shell__header">
          <AppTitle eyebrow="Metal Rack Equalizer" />
          <TitleActions {...props} />
        </header>
        <LayoutErrorBanner error={props.error} />
        <div className="skin-grid skin-grid--rack">
          <div className="rack-meter-bridge">
            <HeroVisualization {...props} moduleLabel="频谱桥" eyebrow="Dual Meter Bridge" moduleClassName="device-module--rack-visualization" />
            <FeatureSidebar {...props} moduleLabel="机柜面板" eyebrow="Utility Rack" moduleClassName="device-module--rack-feature" />
          </div>
          <div className="rack-lower-console">
            <PlaylistBlock {...props} moduleLabel="状态机柜" eyebrow="Information Screen" moduleClassName="device-module--rack-playlist" />
            <NowPlayingBlock {...props} variant="rack" moduleLabel="状态机柜" eyebrow="Playback Display" moduleClassName="device-module--rack-status" />
          </div>
        </div>
        <ControlsBlock {...props} moduleLabel="机架控制台" eyebrow="Rack Transport" moduleClassName="device-module--rack-controls" />
      </section>
    </main>
  );
}

export function WarmWoodLayout(props: PlayerLayoutProps) {
  return (
    <main className="app-shell skin-layout skin-layout--warm-wood">
      <section className="chrome skin-chrome skin-chrome--wood device-shell device-shell--wood" aria-labelledby="app-title">
        <header className="title-bar skin-title skin-title--wood device-shell__header">
          <AppTitle eyebrow="Warm Wood Turntable" />
          <TitleActions {...props} />
        </header>
        <LayoutErrorBanner error={props.error} />
        <div className="skin-grid skin-grid--wood">
          <div className="wood-album-sleeve">
            <NowPlayingBlock {...props} variant="wood" moduleLabel="陈列窗" eyebrow="Album Display" moduleClassName="device-module--wood-status" />
            <HeroVisualization {...props} moduleLabel="暖光铭牌窗" eyebrow="Warm Spectrum" moduleClassName="device-module--wood-visualization" />
          </div>
          <div className="wood-liner-notes">
            <PlaylistBlock {...props} moduleLabel="节目单仓" eyebrow="Liner Notes" moduleClassName="device-module--wood-playlist" />
            <FeatureSidebar {...props} moduleLabel="黄铜控制台" eyebrow="Brass Options" moduleClassName="device-module--wood-feature" />
          </div>
        </div>
        <ControlsBlock {...props} moduleLabel="黄铜控制台" eyebrow="Ivory Transport" moduleClassName="device-module--wood-controls" />
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Run the layout test to verify it passes**

Run:

```powershell
npm test -- src/features/skin/layouts.test.tsx
```

Expected: PASS. Each built-in skin should now render a `device-shell--*` class and the expected visible machine-module labels.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/features/skin/layoutShared.tsx src/features/skin/layouts.tsx src/features/skin/layouts.test.tsx
git commit -m "refactor: add device shell primitives to skin layouts"
```

## Task 2: Refresh Built-In Skin Catalog Copy

**Files:**
- Modify: `src/features/skin/layoutRegistry.tsx`
- Modify: `src/features/skin/layoutRegistry.test.tsx`
- Modify: `src/features/skin/SkinManager.tsx`
- Modify: `src/features/skin/SkinManager.test.tsx`

**Interfaces:**
- Produces revised built-in skin summary copy:
  - `tone`
  - `description`
- Produces selector note copy: `内置机型会改变整体机身布局；导入皮肤包只应用颜色和资源，不改变布局。`
- Produces metadata line format: `内置机型 · {author} · {version}`

- [ ] **Step 1: Tighten the registry and skin-manager tests around the new machine copy**

Replace the summary assertion inside `src/features/skin/layoutRegistry.test.tsx` with:

```tsx
  it("exposes machine-oriented skin summaries for the skin manager", () => {
    expect(builtInLayoutSkinSummaries).toHaveLength(5);
    expect(builtInLayoutSkinSummaries).toEqual([
      expect.objectContaining({
        id: "classic-blue-silver",
        name: "经典蓝银分体机",
        tone: "旗舰分体机",
        description: "蓝背光主控舱、抽屉曲目仓、机械运输控制台。",
      }),
      expect.objectContaining({
        id: "dark-vinyl",
        tone: "沉浸唱盘机",
        description: "中心唱盘舱、暗场字幕屏、竖向控制塔。",
      }),
      expect.objectContaining({
        id: "transparent-crystal",
        tone: "概念透明机",
        description: "厚边透明外壳、抽拉资料匣、悬浮控制底座。",
      }),
      expect.objectContaining({
        id: "metal-rack",
        tone: "专业机架机",
        description: "双仪表频谱桥、机柜信息屏、硬朗金属机架。",
      }),
      expect.objectContaining({
        id: "warm-wood",
        tone: "家居唱机柜",
        description: "木质陈列窗、暖光铭牌屏、黄铜拨杆控制台。",
      }),
    ]);
  });
```

Replace `src/features/skin/SkinManager.test.tsx` with:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { SkinManager, type SkinSummary } from "./SkinManager";

const builtInSkins: SkinSummary[] = [
  {
    id: "classic-blue-silver",
    name: "经典蓝银分体机",
    author: "YoYoMusic",
    version: "1.0.0",
    description: "蓝背光主控舱、抽屉曲目仓、机械运输控制台。",
    tone: "旗舰分体机",
    thumbnailClassName: "skin-thumbnail--classic-blue-silver",
    builtIn: true,
  },
  {
    id: "dark-vinyl",
    name: "暗夜黑胶舱",
    author: "YoYoMusic",
    version: "1.0.0",
    description: "中心唱盘舱、暗场字幕屏、竖向控制塔。",
    tone: "沉浸唱盘机",
    thumbnailClassName: "skin-thumbnail--dark-vinyl",
    builtIn: true,
  },
];

describe("SkinManager", () => {
  it("previews and applies a built-in machine skin", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    render(
      <SkinManager
        skins={builtInSkins}
        activeSkinId="classic-blue-silver"
        error={null}
        onApply={onApply}
      />,
    );

    expect(screen.getByText("内置机型会改变整体机身布局；导入皮肤包只应用颜色和资源，不改变布局。")).toBeInTheDocument();
    expect(screen.getByText("旗舰分体机")).toBeInTheDocument();
    expect(screen.getByText("内置机型 · YoYoMusic · 1.0.0")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "预览 暗夜黑胶舱" }));
    expect(screen.getByText("预览中")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "应用 暗夜黑胶舱" }));
    expect(onApply).toHaveBeenCalledWith("dark-vinyl");
  });

  it("shows imported skin limitation copy and invalid package messages", () => {
    render(
      <SkinManager
        skins={[{ id: "imported", name: "导入皮肤", author: "User", version: "1.0.0" }]}
        activeSkinId="classic-blue-silver"
        error="manifest 缺失"
        onApply={() => undefined}
      />,
    );

    expect(screen.getByText("manifest 缺失")).toBeInTheDocument();
    expect(screen.getByText("内置机型会改变整体机身布局；导入皮肤包只应用颜色和资源，不改变布局。")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the registry and skin-manager tests to verify they fail**

Run:

```powershell
npm test -- src/features/skin/layoutRegistry.test.tsx src/features/skin/SkinManager.test.tsx
```

Expected: FAIL because the existing descriptions, tones, and selector note still use the previous lighter copy.

- [ ] **Step 3: Update the built-in machine descriptions in `layoutRegistry.tsx`**

In `src/features/skin/layoutRegistry.tsx`, replace the five `tone` / `description` pairs with:

```tsx
    description: "蓝背光主控舱、抽屉曲目仓、机械运输控制台。",
    tone: "旗舰分体机",
```

```tsx
    description: "中心唱盘舱、暗场字幕屏、竖向控制塔。",
    tone: "沉浸唱盘机",
```

```tsx
    description: "厚边透明外壳、抽拉资料匣、悬浮控制底座。",
    tone: "概念透明机",
```

```tsx
    description: "双仪表频谱桥、机柜信息屏、硬朗金属机架。",
    tone: "专业机架机",
```

```tsx
    description: "木质陈列窗、暖光铭牌屏、黄铜拨杆控制台。",
    tone: "家居唱机柜",
```

- [ ] **Step 4: Update the skin selector note and metadata line**

In `src/features/skin/SkinManager.tsx`, replace the note:

```tsx
      <p className="skin-manager__note">导入皮肤包只应用颜色和资源，不改变布局。</p>
```

with:

```tsx
      <p className="skin-manager__note">内置机型会改变整体机身布局；导入皮肤包只应用颜色和资源，不改变布局。</p>
```

Replace the metadata paragraph inside `.skin-card__copy`:

```tsx
                <p>
                  {skin.author} · {skin.version}
                </p>
```

with:

```tsx
                <p className="skin-card__meta">
                  {skin.builtIn ? "内置机型" : "导入主题"} · {skin.author} · {skin.version}
                </p>
```

- [ ] **Step 5: Run the catalog tests to verify they pass**

Run:

```powershell
npm test -- src/features/skin/layoutRegistry.test.tsx src/features/skin/SkinManager.test.tsx
```

Expected: PASS. The selector should now present the five skins as built-in machine models instead of generic themes.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/features/skin/layoutRegistry.tsx src/features/skin/layoutRegistry.test.tsx src/features/skin/SkinManager.tsx src/features/skin/SkinManager.test.tsx
git commit -m "feat: refine built-in skin machine copy"
```

## Task 3: Apply Hardware Styling and Preserve Fixed-Shell Contracts

**Files:**
- Modify: `src/styles/skin-layouts.css`
- Modify: `src/styles/skin-layouts.test.ts`
- Verify: `src/styles/app-layout.test.ts`
- Verify: `src/features/skin/layouts.test.tsx`

**Interfaces:**
- Consumes the shell/module hook classes from Task 1.
- Produces base shell/module CSS:
  - `.device-shell`
  - `.device-shell__header`
  - `.device-module`
  - `.device-module__header`
  - `.device-module__label`
  - `.device-module__eyebrow`
  - `.device-module__body`
- Produces per-skin shell variables:
  - `--shell-edge`
  - `--shell-gloss`
  - `--shell-shadow`
- Preserves:
  - fixed shell height
  - internal scroll zones only
  - mobile stacking inside the shell rather than page scrolling

- [ ] **Step 1: Replace the skin-layout CSS contract test with hardware-shell assertions**

Replace `src/styles/skin-layouts.test.ts` with:

```ts
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/styles/skin-layouts.css"), "utf8").replace(/\r\n/g, "\n");

function rule(selector: string) {
  const match = css.match(new RegExp(`${escapeRegExp(selector)}\\s*\\{([\\s\\S]*?)\\}`));
  if (!match) throw new Error(`Missing CSS rule for ${selector}`);
  return match[1];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("layout skin CSS", () => {
  it("defines base device-shell framing hooks", () => {
    expect(rule(".device-shell")).toContain("position: relative;");
    expect(rule(".device-shell")).toContain("isolation: isolate;");
    expect(rule(".device-module")).toContain("grid-template-rows: auto minmax(0, 1fr);");
    expect(rule(".device-module__body")).toContain("min-height: 0;");
    expect(rule(".device-module__label")).toContain("letter-spacing: 0.18em;");
  });

  it("defines distinct shell variables for the five built-in skins", () => {
    expect(rule(".skin-layout--classic-blue-silver")).toContain("--shell-edge: rgba(226, 237, 249, 0.72);");
    expect(rule(".skin-layout--dark-vinyl")).toContain("--shell-edge: rgba(113, 245, 196, 0.28);");
    expect(rule(".skin-layout--transparent-crystal")).toContain("--shell-edge: rgba(224, 250, 255, 0.5);");
    expect(rule(".skin-layout--metal-rack")).toContain("--shell-edge: rgba(250, 204, 21, 0.34);");
    expect(rule(".skin-layout--warm-wood")).toContain("--shell-edge: rgba(255, 228, 184, 0.34);");
  });

  it("preserves fixed shell and internal scroll zones", () => {
    expect(rule(".skin-chrome")).toContain("height: calc(100vh - 24px);");
    expect(rule(".skin-chrome")).toContain("overflow: hidden;");
    expect(rule(".skin-grid")).toContain("overflow: hidden;");
    expect(rule(".vinyl-side-rail")).toContain("overflow: hidden;");
    expect(rule(".wood-liner-notes")).toContain("overflow: hidden;");
  });

  it("keeps the narrow layout stack inside the shell", () => {
    expect(css).toContain("@media (max-width: 760px)");
    expect(css).toContain(".skin-grid--classic");
    expect(css).toContain("grid-template-columns: 1fr;");
  });
});
```

- [ ] **Step 2: Run the CSS contract test to verify it fails**

Run:

```powershell
npm test -- src/styles/skin-layouts.test.ts
```

Expected: FAIL because the current stylesheet has no `.device-shell`, `.device-module`, or `--shell-edge` rules.

- [ ] **Step 3: Add the hardware shell and module styling to `skin-layouts.css`**

In `src/styles/skin-layouts.css`, extend each skin root with shell variables:

```css
.skin-layout--classic-blue-silver {
  --skin-primary: #6f8fb8;
  --skin-accent: #d9e8fb;
  --skin-panel: rgba(19, 34, 55, 0.82);
  --skin-border: rgba(218, 232, 251, 0.34);
  --shell-edge: rgba(226, 237, 249, 0.72);
  --shell-gloss: rgba(255, 255, 255, 0.18);
  --shell-shadow: rgba(8, 18, 34, 0.48);
}

.skin-layout--dark-vinyl {
  --skin-primary: #d8dde8;
  --skin-accent: #71f5c4;
  --skin-panel: rgba(4, 5, 8, 0.88);
  --skin-border: rgba(216, 221, 232, 0.18);
  --shell-edge: rgba(113, 245, 196, 0.28);
  --shell-gloss: rgba(255, 255, 255, 0.08);
  --shell-shadow: rgba(0, 0, 0, 0.6);
}

.skin-layout--transparent-crystal {
  --skin-primary: #7dd3fc;
  --skin-accent: #e0faff;
  --skin-panel: rgba(186, 230, 253, 0.16);
  --skin-border: rgba(224, 250, 255, 0.48);
  --shell-edge: rgba(224, 250, 255, 0.5);
  --shell-gloss: rgba(255, 255, 255, 0.22);
  --shell-shadow: rgba(7, 18, 33, 0.34);
}

.skin-layout--metal-rack {
  --skin-primary: #facc15;
  --skin-accent: #22c55e;
  --skin-panel: rgba(15, 23, 42, 0.9);
  --skin-border: rgba(250, 204, 21, 0.22);
  --shell-edge: rgba(250, 204, 21, 0.34);
  --shell-gloss: rgba(255, 255, 255, 0.08);
  --shell-shadow: rgba(0, 0, 0, 0.58);
}

.skin-layout--warm-wood {
  --skin-primary: #f3b56b;
  --skin-accent: #ffe4b8;
  --skin-panel: rgba(73, 36, 18, 0.84);
  --skin-border: rgba(255, 228, 184, 0.28);
  --shell-edge: rgba(255, 228, 184, 0.34);
  --shell-gloss: rgba(255, 244, 214, 0.14);
  --shell-shadow: rgba(28, 13, 6, 0.56);
}
```

Insert the shared shell/module rules after `.skin-grid`:

```css
.device-shell {
  position: relative;
  isolation: isolate;
  border-radius: 30px;
  overflow: hidden;
  box-shadow:
    inset 0 1px 0 var(--shell-gloss),
    inset 0 -18px 28px rgba(0, 0, 0, 0.16),
    0 28px 64px var(--shell-shadow);
}

.device-shell::before {
  content: "";
  position: absolute;
  inset: 10px;
  border: 1px solid var(--shell-edge);
  border-radius: 24px;
  pointer-events: none;
}

.device-shell::after {
  content: "";
  position: absolute;
  inset: 0 0 auto;
  height: 74px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.12), transparent);
  pointer-events: none;
}

.device-shell__header {
  position: relative;
  z-index: 1;
}

.device-module {
  position: relative;
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--skin-border);
  border-radius: 24px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.11), rgba(255, 255, 255, 0.02)),
    rgba(3, 8, 16, 0.18);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    inset 0 -10px 20px rgba(0, 0, 0, 0.14);
}

.device-module__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.device-module__label,
.device-module__eyebrow {
  margin: 0;
}

.device-module__label {
  color: var(--skin-accent);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.device-module__eyebrow {
  color: var(--color-muted);
  font-size: 0.76rem;
}

.device-module__body {
  min-height: 0;
  display: grid;
  overflow: hidden;
}

.device-module__body--feature {
  min-height: 0;
}

.device-module .playlist-panel,
.device-module .feature-sidebar,
.device-module .now-playing,
.device-module .workbench-visualization,
.device-module .player-controls {
  height: 100%;
}
```

Add the skin-specific hardware treatments below the existing `.skin-title--wood` rule:

```css
.device-shell--classic {
  background:
    linear-gradient(180deg, rgba(226, 237, 249, 0.16), rgba(111, 143, 184, 0.04) 18%, transparent 24%),
    radial-gradient(circle at 14% 12%, rgba(217, 232, 251, 0.18), transparent 22rem),
    linear-gradient(160deg, rgba(24, 38, 59, 0.92), rgba(8, 15, 26, 0.98));
}

.device-shell--classic .device-module--controls {
  background:
    linear-gradient(180deg, rgba(221, 232, 247, 0.18), rgba(39, 58, 86, 0.08)),
    rgba(8, 15, 26, 0.62);
}

.device-shell--vinyl {
  border-radius: 34px;
  background:
    radial-gradient(circle at 32% 34%, rgba(113, 245, 196, 0.08), transparent 18rem),
    linear-gradient(165deg, rgba(10, 12, 17, 0.98), rgba(2, 4, 8, 1));
}

.device-shell--vinyl .device-module--now-playing .cover-card,
.device-shell--vinyl .device-module--visualization .workbench-visualization {
  border-radius: 999px;
}

.device-shell--crystal {
  background:
    linear-gradient(145deg, rgba(236, 254, 255, 0.18), rgba(125, 211, 252, 0.06)),
    rgba(9, 18, 31, 0.72);
}

.device-shell--crystal .device-module {
  backdrop-filter: blur(18px);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.16), rgba(224, 250, 255, 0.06)),
    rgba(14, 24, 38, 0.2);
}

.device-shell--rack {
  border-radius: 20px;
  background:
    linear-gradient(180deg, rgba(100, 116, 139, 0.14), transparent 12%),
    linear-gradient(180deg, rgba(17, 24, 39, 0.98), rgba(5, 9, 15, 1));
}

.device-shell--rack .device-module,
.device-shell--rack .player-controls {
  border-radius: 16px;
}

.device-shell--rack .device-module__label {
  letter-spacing: 0.24em;
}

.device-shell--wood {
  background:
    linear-gradient(180deg, rgba(255, 228, 184, 0.12), transparent 18%),
    linear-gradient(135deg, rgba(92, 49, 24, 0.94), rgba(32, 17, 9, 1));
}

.device-shell--wood .device-module {
  background:
    linear-gradient(180deg, rgba(255, 228, 184, 0.08), rgba(73, 36, 18, 0.05)),
    rgba(39, 18, 9, 0.66);
}
```

Add the selector metadata rule near the existing `.skin-card__copy` block:

```css
.skin-card__meta {
  color: var(--color-muted);
  font-size: 0.82rem;
}
```

Keep the existing `@media (max-width: 760px)` block, but ensure the shell remains fixed and only the internal grid stacks:

```css
@media (max-width: 760px) {
  .skin-grid,
  .skin-grid--classic,
  .skin-grid--vinyl,
  .skin-grid--crystal,
  .skin-grid--rack,
  .skin-grid--wood {
    grid-template-columns: 1fr;
    overflow: auto;
  }

  .device-module__header {
    align-items: flex-start;
    flex-direction: column;
  }
}
```

- [ ] **Step 4: Run the CSS and layout contracts**

Run:

```powershell
npm test -- src/styles/skin-layouts.test.ts src/styles/app-layout.test.ts src/features/skin/layouts.test.tsx
```

Expected: PASS. `app-layout.test.ts` should still stay green because the viewport lock remains in `app.css`, while the new hardware-shell assertions pass in `skin-layouts.test.ts`.

- [ ] **Step 5: Run focused UI tests that cover the selector and skin shell**

Run:

```powershell
npm test -- src/features/skin/SkinManager.test.tsx src/features/skin/layoutRegistry.test.tsx src/features/skin/layouts.test.tsx src/styles/skin-layouts.test.ts src/styles/app-layout.test.ts
```

Expected: PASS. This confirms the copy, shell semantics, and CSS contracts move together.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/styles/skin-layouts.css src/styles/skin-layouts.test.ts
git commit -m "style: harden hardware skin treatments"
```

## Task 4: Final Verification and Handoff Evidence

**Files:**
- Verify only; no planned file changes.

**Interfaces:**
- Consumes layout shell semantics, machine copy, and hardware CSS from Tasks 1-3.
- Produces verification evidence for tests, build, and git status.

- [ ] **Step 1: Run the high-signal app tests**

Run:

```powershell
npm test -- src/App.test.tsx src/App.autoplay.test.tsx
```

Expected: PASS. The app should still switch skins and preserve autoplay behavior after the shell markup changes.

- [ ] **Step 2: Run the full frontend test suite**

Run:

```powershell
npm test
```

Expected: PASS for all Vitest files.

- [ ] **Step 3: Run the production build**

Run:

```powershell
npm run build
```

Expected: PASS for TypeScript compilation and the Vite production build.

- [ ] **Step 4: Confirm the working tree state**

Run:

```powershell
git status --short --branch
```

Expected: clean branch state except `.superpowers/` if the local visual-companion session still exists. Do not add `.superpowers/`.

## Self-Review

Spec coverage:

- Stronger machine-shell semantics are covered by Task 1.
- Stronger built-in machine identity copy is covered by Task 2.
- Hardware material treatment, responsive stacking, and fixed-shell protection are covered by Task 3.
- App behavior, autoplay, full tests, and build verification are covered by Task 4.

Placeholder scan:

- No placeholder markers or deferred implementation notes remain.
- Every task includes exact file paths, concrete code snippets, and exact commands.

Type consistency:

- `moduleLabel`, `eyebrow`, and `moduleClassName` are introduced in Task 1 before any CSS or tests rely on them.
- The CSS hook names in Task 3 match the JSX class names from Task 1.
- The revised registry `tone` / `description` strings from Task 2 are the same strings asserted in the tests.
