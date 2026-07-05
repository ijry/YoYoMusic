# YoYoMusic Layout Skins Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build five built-in layout-level skins for 悠悠乐听, with `经典蓝银分体机` as the default, so skin switching changes the main-window structure instead of only changing colors.

**Architecture:** Add a skin layout registry that maps skin ids to React Layout components. `App.tsx` continues to own playback state, settings, Tauri command callbacks, and data projection, then passes a shared `PlayerLayoutProps` object into the active Layout. Each Layout reuses existing feature components and only changes placement, hierarchy, and skin-specific wrapper classes.

**Tech Stack:** Tauri 2, React 19, TypeScript, Vitest, Testing Library, CSS Grid/Flexbox.

## Global Constraints

- 内置 5 套布局级皮肤。
- `经典蓝银分体机` 作为默认主打皮肤。
- 每套皮肤拥有不同主窗口骨架，而不是共享同一个 `.workspace` 再换色。
- 播放列表、播放控制、当前播放、可视化、歌词/功能面板等业务能力继续复用。
- 保持固定桌面播放器工作台体验，禁止回到整窗滚动。
- 保留现有导入皮肤包能力，但本轮不让第三方皮肤包控制布局。
- 不复制千千静听、Winamp 或其他软件的旧素材、图标、贴图。
- 不实现第三方布局 DSL。
- 不允许导入皮肤包执行脚本或注入任意 JSX/CSS。
- 不重写 Rust 播放逻辑、Tauri 命令或自动连播事件模型。
- 不改变迷你播放器和桌面歌词窗口。
- 不引入新的 UI 库、图标库、字体下载依赖。
- 不做像素级老软件复刻。
- 不提交视觉伴侣 `.superpowers/` 本地文件。

---

## File Structure

- `src/features/skin/layoutTypes.ts`: Shared skin layout ids, feature panel ids, layout props, and visualization frame type. This file contains no JSX.
- `src/features/skin/layoutRegistry.tsx`: Built-in skin metadata, default skin id, skin summary projection, and resolver with fallback.
- `src/features/skin/layouts.tsx`: Five layout-level React components. Task 1 starts with minimal shells; Task 3 replaces them with real layouts.
- `src/features/skin/layoutShared.tsx`: Shared rendering helpers used by all five Layout components: title actions, feature tabs, feature content, now-playing block, visualization block, playlist block, and controls block.
- `src/features/skin/layoutRegistry.test.tsx`: Registry and fallback behavior tests.
- `src/features/skin/layouts.test.tsx`: Accessibility and layout-class tests for all five Layout components.
- `src/features/skin/SkinManager.tsx`: Upgraded skin selector cards with built-in metadata, thumbnail class names, preview state, current state, apply, and import.
- `src/features/skin/SkinManager.test.tsx`: Skin selector behavior and error message tests.
- `src/App.tsx`: Uses registry to select the active Layout and passes shared props into it.
- `src/App.test.tsx`: Verifies default layout skin landmarks and switching to another layout skin in browser mode.
- `src/App.autoplay.test.tsx`: Existing autoplay test must stay green.
- `src/styles/app.css`: Keeps global shell, controls, panel, feature, mini-player, and desktop lyrics styles.
- `src/styles/skin-layouts.css`: Skin-specific main-window grid/flex structures and visual treatments for the five layout skins.
- `src/styles/skin-layouts.test.ts`: CSS contract test proving five distinct root layout classes and internal scroll containers exist.
- `src/styles/app-layout.test.ts`: Existing fixed-workbench test remains green.

## Task 1: Skin Layout Types and Registry

**Files:**
- Create: `src/features/skin/layoutTypes.ts`
- Create: `src/features/skin/layouts.tsx`
- Create: `src/features/skin/layoutRegistry.tsx`
- Create: `src/features/skin/layoutRegistry.test.tsx`

**Interfaces:**
- Produces: `FeaturePanel`
- Produces: `VisualizationFrame`
- Produces: `PlayerLayoutProps`
- Produces: `LayoutSkinDefinition`
- Produces: `DEFAULT_LAYOUT_SKIN_ID = "classic-blue-silver"`
- Produces: `builtInLayoutSkins: LayoutSkinDefinition[]`
- Produces: `builtInLayoutSkinSummaries: SkinSummary[]`
- Produces: `resolveLayoutSkin(skinId: string): LayoutSkinDefinition`
- Produces placeholder Layout components consumed by the registry; Task 3 replaces their bodies.

- [ ] **Step 1: Write the failing registry test**

Create `src/features/skin/layoutRegistry.test.tsx`:

```tsx
import { describe, expect, it } from "vitest";
import {
  DEFAULT_LAYOUT_SKIN_ID,
  builtInLayoutSkinSummaries,
  builtInLayoutSkins,
  resolveLayoutSkin,
} from "./layoutRegistry";

describe("layout skin registry", () => {
  it("registers the five built-in layout skins in the expected order", () => {
    expect(builtInLayoutSkins.map((skin) => skin.id)).toEqual([
      "classic-blue-silver",
      "dark-vinyl",
      "transparent-crystal",
      "metal-rack",
      "warm-wood",
    ]);
    expect(builtInLayoutSkins).toHaveLength(5);
    expect(builtInLayoutSkins[0].name).toBe("经典蓝银分体机");
    expect(builtInLayoutSkins.every((skin) => typeof skin.Layout === "function")).toBe(true);
  });

  it("exposes skin summaries with layout descriptions for the skin manager", () => {
    expect(builtInLayoutSkinSummaries).toHaveLength(5);
    expect(builtInLayoutSkinSummaries[0]).toMatchObject({
      id: "classic-blue-silver",
      name: "经典蓝银分体机",
      builtIn: true,
      thumbnailClassName: "skin-thumbnail--classic-blue-silver",
    });
    expect(builtInLayoutSkinSummaries.map((skin) => skin.description)).toEqual([
      "蓝银金属主控舱、抽屉式播放列表、机械控制条。",
      "黑胶唱片居中，播放列表和歌词收束到右侧窄栏。",
      "玻璃浮层叠放，列表和功能标签像透明抽屉。",
      "频谱和均衡器优先，整体像金属音频机架。",
      "木质唱机台面，封面像唱片套，列表像专辑内页。",
    ]);
  });

  it("falls back to the default classic skin for unknown ids", () => {
    expect(DEFAULT_LAYOUT_SKIN_ID).toBe("classic-blue-silver");
    expect(resolveLayoutSkin("unknown-skin").id).toBe(DEFAULT_LAYOUT_SKIN_ID);
    expect(resolveLayoutSkin("dark-vinyl").id).toBe("dark-vinyl");
  });
});
```

- [ ] **Step 2: Run the registry test to verify it fails**

Run:

```powershell
npm test -- src/features/skin/layoutRegistry.test.tsx
```

Expected: FAIL because `layoutRegistry.tsx` does not exist.

- [ ] **Step 3: Create shared layout types**

Create `src/features/skin/layoutTypes.ts`:

```ts
import type { ComponentType } from "react";
import type { TagDraft } from "../tags/TagEditor";
import type { CommandName, CommandPayload } from "../../shared/tauri";
import type {
  AppSettings,
  LyricsDocument,
  PlaybackState,
  PlaylistSnapshot,
  Track,
  VisualizationMode,
} from "../../shared/types";
import type { SkinSummary } from "./SkinManager";

export type FeaturePanel = "lyrics" | "visualization" | "tags" | "equalizer" | "skin" | "settings";

export interface VisualizationFrame {
  values: number[];
  peak: number;
  positionMs: number;
}

export interface PlayerLayoutProps {
  playlist: PlaylistSnapshot;
  playback: PlaybackState;
  currentTrack: Track | null;
  lyricsDocument: LyricsDocument | null;
  settings: AppSettings;
  skins: SkinSummary[];
  activePanel: FeaturePanel;
  error: string | null;
  skinError: string | null;
  settingsErrorCode: string | null;
  visualizationFrame: VisualizationFrame;
  onActivePanelChange: (panel: FeaturePanel) => void;
  onPlayerCommand: (command: CommandName, payload?: CommandPayload) => void;
  onAddFiles: () => void;
  onAddFolder: () => void;
  onClearPlaylist: () => void;
  onSaveTags: (draft: TagDraft) => void;
  onApplySkin: (skinId: string) => void;
  onImportSkin: () => void;
  onShortcutChange: (action: string, shortcut: string) => void;
  onVisualizationModeChange: (mode: VisualizationMode) => void;
  onSettingsChange: (settings: AppSettings) => void;
}

export interface LayoutSkinDefinition {
  id: string;
  name: string;
  author: string;
  version: string;
  description: string;
  tone: string;
  thumbnailClassName: string;
  Layout: ComponentType<PlayerLayoutProps>;
}
```

- [ ] **Step 4: Create temporary layout component shells**

Create `src/features/skin/layouts.tsx`:

```tsx
import type { PlayerLayoutProps } from "./layoutTypes";

function LayoutShell({ className }: { className: string }) {
  return <main className={`app-shell skin-layout ${className}`} />;
}

export function ClassicBlueSilverLayout(_props: PlayerLayoutProps) {
  return <LayoutShell className="skin-layout--classic-blue-silver" />;
}

export function DarkVinylLayout(_props: PlayerLayoutProps) {
  return <LayoutShell className="skin-layout--dark-vinyl" />;
}

export function TransparentCrystalLayout(_props: PlayerLayoutProps) {
  return <LayoutShell className="skin-layout--transparent-crystal" />;
}

export function MetalRackLayout(_props: PlayerLayoutProps) {
  return <LayoutShell className="skin-layout--metal-rack" />;
}

export function WarmWoodLayout(_props: PlayerLayoutProps) {
  return <LayoutShell className="skin-layout--warm-wood" />;
}
```

- [ ] **Step 5: Create the built-in skin registry**

Create `src/features/skin/layoutRegistry.tsx`:

```tsx
import type { SkinSummary } from "./SkinManager";
import type { LayoutSkinDefinition } from "./layoutTypes";
import {
  ClassicBlueSilverLayout,
  DarkVinylLayout,
  MetalRackLayout,
  TransparentCrystalLayout,
  WarmWoodLayout,
} from "./layouts";

export const DEFAULT_LAYOUT_SKIN_ID = "classic-blue-silver";

export const builtInLayoutSkins: LayoutSkinDefinition[] = [
  {
    id: "classic-blue-silver",
    name: "经典蓝银分体机",
    author: "YoYoMusic",
    version: "1.0.0",
    description: "蓝银金属主控舱、抽屉式播放列表、机械控制条。",
    tone: "默认主打",
    thumbnailClassName: "skin-thumbnail--classic-blue-silver",
    Layout: ClassicBlueSilverLayout,
  },
  {
    id: "dark-vinyl",
    name: "暗夜黑胶舱",
    author: "YoYoMusic",
    version: "1.0.0",
    description: "黑胶唱片居中，播放列表和歌词收束到右侧窄栏。",
    tone: "沉浸播放",
    thumbnailClassName: "skin-thumbnail--dark-vinyl",
    Layout: DarkVinylLayout,
  },
  {
    id: "transparent-crystal",
    name: "透明水晶浮窗",
    author: "YoYoMusic",
    version: "1.0.0",
    description: "玻璃浮层叠放，列表和功能标签像透明抽屉。",
    tone: "轻盈透明",
    thumbnailClassName: "skin-thumbnail--transparent-crystal",
    Layout: TransparentCrystalLayout,
  },
  {
    id: "metal-rack",
    name: "金属机架均衡器",
    author: "YoYoMusic",
    version: "1.0.0",
    description: "频谱和均衡器优先，整体像金属音频机架。",
    tone: "发烧设备",
    thumbnailClassName: "skin-thumbnail--metal-rack",
    Layout: MetalRackLayout,
  },
  {
    id: "warm-wood",
    name: "暖木复古唱机",
    author: "YoYoMusic",
    version: "1.0.0",
    description: "木质唱机台面，封面像唱片套，列表像专辑内页。",
    tone: "温暖复古",
    thumbnailClassName: "skin-thumbnail--warm-wood",
    Layout: WarmWoodLayout,
  },
];

export const builtInLayoutSkinSummaries: SkinSummary[] = builtInLayoutSkins.map(
  ({ id, name, author, version, description, tone, thumbnailClassName }) => ({
    id,
    name,
    author,
    version,
    description,
    tone,
    thumbnailClassName,
    builtIn: true,
  }),
);

export function resolveLayoutSkin(skinId: string) {
  return builtInLayoutSkins.find((skin) => skin.id === skinId) ?? builtInLayoutSkins[0];
}
```

- [ ] **Step 6: Run the registry test to verify it passes**

Run:

```powershell
npm test -- src/features/skin/layoutRegistry.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```powershell
git add src/features/skin/layoutTypes.ts src/features/skin/layouts.tsx src/features/skin/layoutRegistry.tsx src/features/skin/layoutRegistry.test.tsx
git commit -m "feat: add built-in layout skin registry"
```

## Task 2: Skin Manager Built-In Layout Skin Cards

**Files:**
- Modify: `src/features/skin/SkinManager.tsx`
- Modify: `src/features/skin/SkinManager.test.tsx`

**Interfaces:**
- Consumes: extended `SkinSummary` metadata from Task 1.
- Produces: optional `description`, `tone`, `thumbnailClassName`, and `builtIn` fields on `SkinSummary`.
- Produces: card thumbnails using `role="img"` and `aria-label="{skin.name} 布局缩略图"`.
- Produces: explicit text for imported token skins: `导入皮肤包只应用颜色和资源，不改变布局。`

- [ ] **Step 1: Replace the SkinManager tests with built-in skin card tests**

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
    description: "蓝银金属主控舱、抽屉式播放列表、机械控制条。",
    tone: "默认主打",
    thumbnailClassName: "skin-thumbnail--classic-blue-silver",
    builtIn: true,
  },
  {
    id: "dark-vinyl",
    name: "暗夜黑胶舱",
    author: "YoYoMusic",
    version: "1.0.0",
    description: "黑胶唱片居中，播放列表和歌词收束到右侧窄栏。",
    tone: "沉浸播放",
    thumbnailClassName: "skin-thumbnail--dark-vinyl",
    builtIn: true,
  },
];

describe("SkinManager", () => {
  it("previews and applies a built-in layout skin", async () => {
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

    expect(screen.getByRole("img", { name: "经典蓝银分体机 布局缩略图" })).toBeInTheDocument();
    expect(screen.getByText("默认主打")).toBeInTheDocument();
    expect(screen.getByText("蓝银金属主控舱、抽屉式播放列表、机械控制条。")).toBeInTheDocument();
    expect(screen.getByText("当前皮肤")).toBeInTheDocument();

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
    expect(screen.getByText("导入皮肤包只应用颜色和资源，不改变布局。")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the SkinManager tests to verify they fail**

Run:

```powershell
npm test -- src/features/skin/SkinManager.test.tsx
```

Expected: FAIL because `SkinSummary` has no layout metadata fields and the thumbnail/limitation copy does not exist.

- [ ] **Step 3: Replace SkinManager with card-based selector**

Replace `src/features/skin/SkinManager.tsx` with:

```tsx
import { useEffect, useState } from "react";

export interface SkinSummary {
  id: string;
  name: string;
  author: string;
  version: string;
  description?: string;
  tone?: string;
  thumbnailClassName?: string;
  builtIn?: boolean;
}

interface SkinManagerProps {
  skins: SkinSummary[];
  activeSkinId: string;
  error: string | null;
  onApply: (skinId: string) => void;
  onImport?: () => void;
}

export function SkinManager({ skins, activeSkinId, error, onApply, onImport }: SkinManagerProps) {
  const [previewSkinId, setPreviewSkinId] = useState(activeSkinId);

  useEffect(() => {
    setPreviewSkinId(activeSkinId);
  }, [activeSkinId]);

  return (
    <section className="skin-manager" aria-labelledby="skin-manager-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Skins</p>
          <h2 id="skin-manager-title">皮肤管理</h2>
        </div>
        <button type="button" onClick={onImport}>
          导入皮肤包
        </button>
      </div>

      <p className="skin-manager__note">内置皮肤会改变整体布局；导入皮肤包只应用颜色和资源，不改变布局。</p>

      {error ? (
        <p role="alert" className="error-text">
          {error}
        </p>
      ) : null}

      <div className="skin-grid">
        {skins.map((skin) => {
          const isActive = skin.id === activeSkinId;
          const isPreviewing = skin.id === previewSkinId && !isActive;
          const thumbnailClassName = skin.thumbnailClassName ?? "skin-thumbnail--custom";

          return (
            <article key={skin.id} className={isActive ? "skin-card is-active" : "skin-card"}>
              <div className={`skin-thumbnail ${thumbnailClassName}`} role="img" aria-label={`${skin.name} 布局缩略图`}>
                <span />
                <span />
                <span />
              </div>

              <div className="skin-card__copy">
                <p className="skin-card__tone">{skin.tone ?? (skin.builtIn ? "内置布局" : "导入主题")}</p>
                <h3>{skin.name}</h3>
                <p>
                  {skin.author} · {skin.version}
                </p>
                {skin.description ? <p>{skin.description}</p> : null}
              </div>

              <div className="skin-card__status">
                {isActive ? <span>当前皮肤</span> : null}
                {isPreviewing ? <span>预览中</span> : null}
              </div>

              <div className="skin-card__actions">
                <button type="button" onClick={() => setPreviewSkinId(skin.id)}>
                  预览 {skin.name}
                </button>
                <button type="button" onClick={() => onApply(skin.id)}>
                  应用 {skin.name}
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run the SkinManager and registry tests**

Run:

```powershell
npm test -- src/features/skin/SkinManager.test.tsx src/features/skin/layoutRegistry.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```powershell
git add src/features/skin/SkinManager.tsx src/features/skin/SkinManager.test.tsx
git commit -m "feat: upgrade skin manager for layout skins"
```

## Task 3: Shared Layout Rendering and Five Layout Components

**Files:**
- Create: `src/features/skin/layoutShared.tsx`
- Modify: `src/features/skin/layouts.tsx`
- Create: `src/features/skin/layouts.test.tsx`

**Interfaces:**
- Consumes: `PlayerLayoutProps` from Task 1.
- Consumes: existing feature components.
- Produces: `FeatureTabs(props)`, `FeatureContent(props)`, `TitleActions(props)`, `PlaylistBlock(props)`, `NowPlayingBlock(props)`, `HeroVisualization(props)`, and `ControlsBlock(props)`.
- Produces: five real Layout components with root classes:
  - `.skin-layout--classic-blue-silver`
  - `.skin-layout--dark-vinyl`
  - `.skin-layout--transparent-crystal`
  - `.skin-layout--metal-rack`
  - `.skin-layout--warm-wood`

- [ ] **Step 1: Write the failing layout accessibility test**

Create `src/features/skin/layouts.test.tsx`:

```tsx
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { builtInLayoutSkins } from "./layoutRegistry";
import type { PlayerLayoutProps } from "./layoutTypes";

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
  it.each(builtInLayoutSkins)("renders accessible shell controls for $name", (skin) => {
    const props = createProps();
    const { container } = render(<skin.Layout {...props} />);

    expect(container.firstElementChild).toHaveClass(`skin-layout--${skin.id}`);
    expect(screen.getByRole("heading", { name: "悠悠乐听" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "当前播放列表" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "当前播放" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "功能面板" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "播放动态可视化" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Song A" })).toBeInTheDocument();

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

Expected: FAIL because placeholder layout shells do not render landmarks.

- [ ] **Step 3: Create shared layout rendering helpers**

Create `src/features/skin/layoutShared.tsx`:

```tsx
import { EqualizerPanel } from "../equalizer/EqualizerPanel";
import { LyricsPanel } from "../lyrics/LyricsPanel";
import { PlayerControls } from "../player/PlayerControls";
import { PlaylistPanel } from "../playlist/PlaylistPanel";
import { SettingsPanel } from "../settings/SettingsPanel";
import { AppErrorBanner } from "../shell/AppErrorBanner";
import { SkinManager } from "./SkinManager";
import { TagEditor } from "../tags/TagEditor";
import { VisualizationPanel } from "../visualization/VisualizationPanel";
import type { FeaturePanel, PlayerLayoutProps } from "./layoutTypes";

export const featurePanels: Array<{ id: FeaturePanel; label: string }> = [
  { id: "lyrics", label: "歌词" },
  { id: "visualization", label: "可视化" },
  { id: "tags", label: "标签" },
  { id: "equalizer", label: "均衡器" },
  { id: "skin", label: "皮肤" },
  { id: "settings", label: "设置" },
];

export function TitleActions(props: PlayerLayoutProps) {
  return (
    <nav className="title-actions" aria-label="窗口操作">
      <button type="button" onClick={() => props.onActivePanelChange("skin")}>
        皮肤
      </button>
      <button type="button" onClick={() => props.onActivePanelChange("settings")}>
        设置
      </button>
      <button type="button" onClick={() => props.onPlayerCommand("open_mini_player", {})}>
        迷你模式
      </button>
      <button type="button" onClick={() => props.onPlayerCommand("toggle_desktop_lyrics", {})}>
        桌面歌词
      </button>
    </nav>
  );
}

export function AppTitle({ eyebrow = "YoYoMusic Desktop Player" }: { eyebrow?: string }) {
  return (
    <div>
      <p className="eyebrow">{eyebrow}</p>
      <h1 id="app-title">悠悠乐听</h1>
    </div>
  );
}

export function LayoutErrorBanner({ error }: { error: string | null }) {
  return <AppErrorBanner error={error} />;
}

export function PlaylistBlock(props: PlayerLayoutProps) {
  return (
    <PlaylistPanel
      currentTrackId={props.playback.trackId}
      tracks={props.playlist.tracks}
      onPlay={(trackId) => props.onPlayerCommand("play_track", { trackId })}
      onRemove={(trackId) => props.onPlayerCommand("remove_track", { trackId })}
      onAddFiles={props.onAddFiles}
      onAddFolder={props.onAddFolder}
      onClear={props.onClearPlaylist}
    />
  );
}

export function NowPlayingBlock({ variant = "standard", ...props }: PlayerLayoutProps & { variant?: string }) {
  return (
    <section className={`now-playing now-playing--${variant}`} aria-label="当前播放">
      <div className={props.playback.isPlaying ? "cover-card is-playing" : "cover-card"} aria-hidden="true">
        <div className="disc-ring" />
      </div>

      <div className="now-playing-copy">
        <p className="eyebrow">Now Playing</p>
        <h2>{props.currentTrack?.title ?? "等待添加本地音乐"}</h2>
        <p className="subtitle">{props.currentTrack?.artist || props.currentTrack?.album || "选择文件或文件夹开始播放"}</p>
      </div>
    </section>
  );
}

export function HeroVisualization(props: PlayerLayoutProps) {
  return (
    <div className="workbench-visualization" role="img" aria-label="播放动态可视化">
      <div className="visualization-preview visualization-preview--hero" aria-hidden="true">
        {props.visualizationFrame.values.slice(0, 18).map((value, index) => (
          <span key={index} style={{ height: `${Math.max(10, value * 100)}%` }} />
        ))}
      </div>
    </div>
  );
}

export function FeatureTabs(props: PlayerLayoutProps) {
  return (
    <div className="feature-tabs" aria-label="功能面板标签">
      {featurePanels.map((panel) => (
        <button
          key={panel.id}
          type="button"
          aria-pressed={props.activePanel === panel.id}
          onClick={() => props.onActivePanelChange(panel.id)}
        >
          {panel.label}
        </button>
      ))}
    </div>
  );
}

export function FeatureContent(props: PlayerLayoutProps) {
  return <div className="feature-content">{renderFeaturePanel(props)}</div>;
}

export function FeatureSidebar(props: PlayerLayoutProps) {
  return (
    <aside className="feature-sidebar" role="complementary" aria-label="功能面板">
      <FeatureTabs {...props} />
      <FeatureContent {...props} />
    </aside>
  );
}

export function ControlsBlock(props: PlayerLayoutProps) {
  return <PlayerControls state={props.playback} onCommand={(command, payload) => props.onPlayerCommand(command, payload)} />;
}

function renderFeaturePanel(props: PlayerLayoutProps) {
  if (props.activePanel === "visualization") {
    return (
      <VisualizationPanel
        mode={props.settings.visualizationMode}
        frame={props.visualizationFrame}
        onModeChange={props.onVisualizationModeChange}
      />
    );
  }

  if (props.activePanel === "tags") {
    return <TagEditor track={props.currentTrack} onSave={props.onSaveTags} />;
  }

  if (props.activePanel === "equalizer") {
    return (
      <EqualizerPanel
        settings={props.settings.equalizer}
        onChange={(equalizer) => props.onSettingsChange({ ...props.settings, equalizer })}
      />
    );
  }

  if (props.activePanel === "skin") {
    return (
      <SkinManager
        skins={props.skins}
        activeSkinId={props.settings.defaultSkin}
        error={props.skinError}
        onApply={props.onApplySkin}
        onImport={props.onImportSkin}
      />
    );
  }

  if (props.activePanel === "settings") {
    return (
      <SettingsPanel
        shortcuts={props.settings.shortcuts}
        enrichmentEnabled={props.settings.enrichmentEnabled}
        errorCode={props.settingsErrorCode}
        onShortcutChange={props.onShortcutChange}
      />
    );
  }

  return <LyricsPanel document={props.lyricsDocument} positionMs={props.playback.positionMs} />;
}
```

- [ ] **Step 4: Replace placeholder layouts with real distinct structures**

Replace `src/features/skin/layouts.tsx` with:

```tsx
import {
  AppTitle,
  ControlsBlock,
  FeatureContent,
  FeatureSidebar,
  FeatureTabs,
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
      <section className="chrome skin-chrome skin-chrome--classic" aria-labelledby="app-title">
        <header className="title-bar skin-title skin-title--classic">
          <AppTitle eyebrow="Classic Blue Silver Player" />
          <TitleActions {...props} />
        </header>
        <LayoutErrorBanner error={props.error} />
        <div className="skin-grid skin-grid--classic">
          <PlaylistBlock {...props} />
          <div className="classic-center-deck">
            <NowPlayingBlock {...props} variant="classic" />
            <HeroVisualization {...props} />
          </div>
          <FeatureSidebar {...props} />
        </div>
        <ControlsBlock {...props} />
      </section>
    </main>
  );
}

export function DarkVinylLayout(props: PlayerLayoutProps) {
  return (
    <main className="app-shell skin-layout skin-layout--dark-vinyl">
      <section className="chrome skin-chrome skin-chrome--vinyl" aria-labelledby="app-title">
        <header className="title-bar skin-title skin-title--vinyl">
          <AppTitle eyebrow="Night Vinyl Chamber" />
          <TitleActions {...props} />
        </header>
        <LayoutErrorBanner error={props.error} />
        <div className="skin-grid skin-grid--vinyl">
          <div className="vinyl-stage">
            <NowPlayingBlock {...props} variant="vinyl" />
            <HeroVisualization {...props} />
            <ControlsBlock {...props} />
          </div>
          <div className="vinyl-side-rail">
            <PlaylistBlock {...props} />
            <FeatureSidebar {...props} />
          </div>
        </div>
      </section>
    </main>
  );
}

export function TransparentCrystalLayout(props: PlayerLayoutProps) {
  return (
    <main className="app-shell skin-layout skin-layout--transparent-crystal">
      <section className="chrome skin-chrome skin-chrome--crystal" aria-labelledby="app-title">
        <header className="title-bar skin-title skin-title--crystal">
          <AppTitle eyebrow="Crystal Floating Console" />
          <TitleActions {...props} />
        </header>
        <LayoutErrorBanner error={props.error} />
        <div className="skin-grid skin-grid--crystal">
          <div className="crystal-now-panel">
            <NowPlayingBlock {...props} variant="crystal" />
            <HeroVisualization {...props} />
          </div>
          <div className="crystal-playlist-drawer">
            <PlaylistBlock {...props} />
          </div>
          <aside className="feature-sidebar crystal-feature-float" role="complementary" aria-label="功能面板">
            <FeatureTabs {...props} />
            <FeatureContent {...props} />
          </aside>
        </div>
        <ControlsBlock {...props} />
      </section>
    </main>
  );
}

export function MetalRackLayout(props: PlayerLayoutProps) {
  return (
    <main className="app-shell skin-layout skin-layout--metal-rack">
      <section className="chrome skin-chrome skin-chrome--rack" aria-labelledby="app-title">
        <header className="title-bar skin-title skin-title--rack">
          <AppTitle eyebrow="Metal Rack Equalizer" />
          <TitleActions {...props} />
        </header>
        <LayoutErrorBanner error={props.error} />
        <div className="skin-grid skin-grid--rack">
          <div className="rack-meter-bridge">
            <HeroVisualization {...props} />
            <FeatureSidebar {...props} />
          </div>
          <div className="rack-lower-console">
            <PlaylistBlock {...props} />
            <NowPlayingBlock {...props} variant="rack" />
          </div>
        </div>
        <ControlsBlock {...props} />
      </section>
    </main>
  );
}

export function WarmWoodLayout(props: PlayerLayoutProps) {
  return (
    <main className="app-shell skin-layout skin-layout--warm-wood">
      <section className="chrome skin-chrome skin-chrome--wood" aria-labelledby="app-title">
        <header className="title-bar skin-title skin-title--wood">
          <AppTitle eyebrow="Warm Wood Turntable" />
          <TitleActions {...props} />
        </header>
        <LayoutErrorBanner error={props.error} />
        <div className="skin-grid skin-grid--wood">
          <div className="wood-album-sleeve">
            <NowPlayingBlock {...props} variant="wood" />
            <HeroVisualization {...props} />
          </div>
          <div className="wood-liner-notes">
            <PlaylistBlock {...props} />
            <FeatureSidebar {...props} />
          </div>
        </div>
        <ControlsBlock {...props} />
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Run layout and registry tests**

Run:

```powershell
npm test -- src/features/skin/layouts.test.tsx src/features/skin/layoutRegistry.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/features/skin/layoutShared.tsx src/features/skin/layouts.tsx src/features/skin/layouts.test.tsx
git commit -m "feat: add five layout skin components"
```

## Task 4: App Wiring to Active Layout Skin

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/App.test.tsx`
- Verify: `src/App.autoplay.test.tsx`

**Interfaces:**
- Consumes: `DEFAULT_LAYOUT_SKIN_ID`, `builtInLayoutSkinSummaries`, `resolveLayoutSkin`, `FeaturePanel`.
- Produces: `App.tsx` rendering the resolved active Layout instead of hard-coded workspace JSX.
- Produces: default setting `defaultSkin: DEFAULT_LAYOUT_SKIN_ID`.
- Produces: browser-mode skin switching test proving layout class changes.

- [ ] **Step 1: Replace the App test with layout-skin assertions**

Replace `src/App.test.tsx` with:

```tsx
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import App from "./App";

it("renders the default classic layout skin landmarks", () => {
  const { container } = render(<App />);

  expect(container.querySelector(".skin-layout--classic-blue-silver")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: "悠悠乐听" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "当前播放列表" })).toBeInTheDocument();
  expect(screen.getByRole("region", { name: "当前播放" })).toBeInTheDocument();
  expect(screen.getByRole("complementary", { name: "功能面板" })).toBeInTheDocument();
  expect(screen.getByRole("img", { name: "播放动态可视化" })).toBeInTheDocument();

  const controls = screen.getByRole("region", { name: "播放控制" });
  expect(within(controls).getByRole("button", { name: "播放" })).toBeInTheDocument();
  expect(within(controls).getByRole("slider", { name: "播放进度" })).toBeInTheDocument();
});

it("switches built-in layout skins in browser mode", async () => {
  const user = userEvent.setup();
  const { container } = render(<App />);

  await user.click(screen.getByRole("button", { name: "皮肤" }));
  await user.click(screen.getByRole("button", { name: "应用 暗夜黑胶舱" }));

  expect(container.querySelector(".skin-layout--classic-blue-silver")).not.toBeInTheDocument();
  expect(container.querySelector(".skin-layout--dark-vinyl")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run App tests to verify they fail**

Run:

```powershell
npm test -- src/App.test.tsx
```

Expected: FAIL because `App.tsx` still renders the old hard-coded `.workspace` structure and does not expose built-in layout skin summaries.

- [ ] **Step 3: Update App imports**

In `src/App.tsx`, add the skin layout stylesheet and registry imports near the top:

```tsx
import "./styles/theme.css";
import "./styles/app.css";
import "./styles/skin-layouts.css";
import {
  DEFAULT_LAYOUT_SKIN_ID,
  builtInLayoutSkinSummaries,
  resolveLayoutSkin,
} from "./features/skin/layoutRegistry";
import type { FeaturePanel } from "./features/skin/layoutTypes";
```

Remove these direct component imports from `src/App.tsx` because layout components now use them:

```tsx
import { EqualizerPanel } from "./features/equalizer/EqualizerPanel";
import { LyricsPanel } from "./features/lyrics/LyricsPanel";
import { PlayerControls } from "./features/player/PlayerControls";
import { PlaylistPanel } from "./features/playlist/PlaylistPanel";
import { SettingsPanel } from "./features/settings/SettingsPanel";
import { SkinManager, type SkinSummary } from "./features/skin/SkinManager";
import { TagEditor, type TagDraft } from "./features/tags/TagEditor";
import { VisualizationPanel } from "./features/visualization/VisualizationPanel";
```

Add these type-only imports after the registry import:

```tsx
import type { SkinSummary } from "./features/skin/SkinManager";
import type { TagDraft } from "./features/tags/TagEditor";
```

- [ ] **Step 4: Update default settings and initial skins**

In `src/App.tsx`, replace:

```tsx
defaultSkin: "default",
```

with:

```tsx
defaultSkin: DEFAULT_LAYOUT_SKIN_ID,
```

Replace the skins state initializer:

```tsx
const [skins, setSkins] = useState<SkinSummary[]>([
  { id: "default", name: "默认青绿", author: "YoYoMusic", version: "1.0.0" },
]);
```

with:

```tsx
const [skins, setSkins] = useState<SkinSummary[]>(builtInLayoutSkinSummaries);
```

- [ ] **Step 5: Resolve the active layout in App**

In `src/App.tsx`, after:

```tsx
const visualizationFrame = createVisualizationFrame(playback.positionMs);
```

add:

```tsx
const activeLayoutSkin = resolveLayoutSkin(settings.defaultSkin);
const ActiveLayout = activeLayoutSkin.Layout;
```

- [ ] **Step 6: Replace the App return with the active layout component**

In `src/App.tsx`, replace the entire current `return (...)` block with:

```tsx
return (
  <ActiveLayout
    playlist={playlist}
    playback={playback}
    currentTrack={currentTrack}
    lyricsDocument={lyricsDocument}
    settings={settings}
    skins={skins}
    activePanel={activePanel}
    error={error}
    skinError={skinError}
    settingsErrorCode={settingsErrorCode}
    visualizationFrame={visualizationFrame}
    onActivePanelChange={setActivePanel}
    onPlayerCommand={(command, payload = {}) => void handleCommand(command, payload)}
    onAddFiles={() => void handleAddFiles()}
    onAddFolder={() => void handleAddFolder()}
    onClearPlaylist={() => void handleCommand("clear_playlist")}
    onSaveTags={handleSaveTags}
    onApplySkin={(skinId) => void handleApplySkin(skinId)}
    onImportSkin={() => void handleImportSkin()}
    onShortcutChange={handleShortcutChange}
    onVisualizationModeChange={handleVisualizationModeChange}
    onSettingsChange={updateSettings}
  />
);
```

- [ ] **Step 7: Delete old App-local layout helpers**

In `src/App.tsx`, delete the local `featurePanels` array and the entire `renderFeaturePanel(...)` function. Keep these functions:

```tsx
findCurrentTrack
isPlaylistCommand
isPlaybackCommand
createVisualizationFrame
toUserMessage
readErrorCode
isAppErrorPayload
```

- [ ] **Step 8: Run App and layout tests**

Run:

```powershell
npm test -- src/App.test.tsx src/App.autoplay.test.tsx src/features/skin/layouts.test.tsx src/features/skin/SkinManager.test.tsx
```

Expected: PASS. `src/App.autoplay.test.tsx` must still find the current track heading and pause button after playback events.

- [ ] **Step 9: Commit**

Run:

```powershell
git add src/App.tsx src/App.test.tsx
git commit -m "feat: render active layout skin"
```

## Task 5: Skin Layout CSS and Scroll Contracts

**Files:**
- Create: `src/styles/skin-layouts.css`
- Create: `src/styles/skin-layouts.test.ts`
- Modify: `src/styles/app-layout.test.ts`
- Verify: `src/styles/app.css`

**Interfaces:**
- Consumes: root classes and layout wrappers from Task 3.
- Produces: CSS contract for five distinct layout skins.
- Produces: internal scroll declarations for `.track-list` and `.feature-content` remain valid.
- Produces: no `body` scrolling regression.

- [ ] **Step 1: Write failing skin layout CSS contract test**

Create `src/styles/skin-layouts.test.ts`:

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
  it("defines all five built-in layout skin roots", () => {
    expect(rule(".skin-layout--classic-blue-silver")).toContain("--skin-primary: #6f8fb8;");
    expect(rule(".skin-layout--dark-vinyl")).toContain("--skin-primary: #d8dde8;");
    expect(rule(".skin-layout--transparent-crystal")).toContain("--skin-primary: #7dd3fc;");
    expect(rule(".skin-layout--metal-rack")).toContain("--skin-primary: #facc15;");
    expect(rule(".skin-layout--warm-wood")).toContain("--skin-primary: #f3b56b;");
  });

  it("gives the five skins different layout structures", () => {
    expect(rule(".skin-grid--classic")).toContain("grid-template-columns: minmax(260px, 0.82fr) minmax(320px, 1.18fr) minmax(280px, 0.9fr);");
    expect(rule(".skin-grid--vinyl")).toContain("grid-template-columns: minmax(0, 1.25fr) minmax(300px, 0.75fr);");
    expect(rule(".skin-grid--crystal")).toContain("grid-template-columns: minmax(260px, 0.85fr) minmax(320px, 1.15fr);");
    expect(rule(".skin-grid--rack")).toContain("grid-template-rows: minmax(0, 1.1fr) minmax(180px, 0.72fr);");
    expect(rule(".skin-grid--wood")).toContain("grid-template-columns: minmax(320px, 1fr) minmax(320px, 1fr);");
  });

  it("preserves fixed shell and internal scroll zones", () => {
    expect(rule(".skin-chrome")).toContain("height: calc(100vh - 24px);");
    expect(rule(".skin-chrome")).toContain("overflow: hidden;");
    expect(rule(".skin-grid")).toContain("overflow: hidden;");
    expect(rule(".vinyl-side-rail")).toContain("overflow: hidden;");
    expect(rule(".wood-liner-notes")).toContain("overflow: hidden;");
  });
});
```

- [ ] **Step 2: Run CSS test to verify it fails**

Run:

```powershell
npm test -- src/styles/skin-layouts.test.ts
```

Expected: FAIL because `skin-layouts.css` does not exist.

- [ ] **Step 3: Create skin layout CSS**

Create `src/styles/skin-layouts.css` with the following structure. Keep the declarations shown in the test exactly:

```css
.skin-layout {
  height: 100%;
  overflow: hidden;
  color: var(--color-text);
}

.skin-layout--classic-blue-silver {
  --skin-primary: #6f8fb8;
  --skin-accent: #d9e8fb;
  --skin-panel: rgba(19, 34, 55, 0.82);
  --skin-border: rgba(218, 232, 251, 0.34);
}

.skin-layout--dark-vinyl {
  --skin-primary: #d8dde8;
  --skin-accent: #71f5c4;
  --skin-panel: rgba(4, 5, 8, 0.88);
  --skin-border: rgba(216, 221, 232, 0.18);
}

.skin-layout--transparent-crystal {
  --skin-primary: #7dd3fc;
  --skin-accent: #e0faff;
  --skin-panel: rgba(186, 230, 253, 0.16);
  --skin-border: rgba(224, 250, 255, 0.48);
}

.skin-layout--metal-rack {
  --skin-primary: #facc15;
  --skin-accent: #22c55e;
  --skin-panel: rgba(15, 23, 42, 0.9);
  --skin-border: rgba(250, 204, 21, 0.22);
}

.skin-layout--warm-wood {
  --skin-primary: #f3b56b;
  --skin-accent: #ffe4b8;
  --skin-panel: rgba(73, 36, 18, 0.84);
  --skin-border: rgba(255, 228, 184, 0.28);
}

.skin-chrome {
  width: min(1280px, calc(100vw - 24px));
  height: calc(100vh - 24px);
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 12px;
  overflow: hidden;
  padding: 16px;
  border: 1px solid var(--skin-border);
  border-radius: var(--radius-panel);
  background:
    radial-gradient(circle at 12% 14%, color-mix(in srgb, var(--skin-primary) 28%, transparent), transparent 28rem),
    linear-gradient(145deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.025)),
    var(--color-surface);
  box-shadow: var(--shadow-panel);
}

.skin-grid {
  min-width: 0;
  min-height: 0;
  display: grid;
  gap: 12px;
  overflow: hidden;
}

.skin-grid--classic {
  grid-template-columns: minmax(260px, 0.82fr) minmax(320px, 1.18fr) minmax(280px, 0.9fr);
}

.skin-grid--vinyl {
  grid-template-columns: minmax(0, 1.25fr) minmax(300px, 0.75fr);
}

.skin-grid--crystal {
  grid-template-columns: minmax(260px, 0.85fr) minmax(320px, 1.15fr);
  grid-template-rows: minmax(0, 1fr) minmax(160px, 0.45fr);
}

.skin-grid--rack {
  grid-template-rows: minmax(0, 1.1fr) minmax(180px, 0.72fr);
}

.skin-grid--wood {
  grid-template-columns: minmax(320px, 1fr) minmax(320px, 1fr);
}

.classic-center-deck,
.vinyl-stage,
.vinyl-side-rail,
.crystal-now-panel,
.crystal-playlist-drawer,
.crystal-feature-float,
.rack-meter-bridge,
.rack-lower-console,
.wood-album-sleeve,
.wood-liner-notes {
  min-width: 0;
  min-height: 0;
}

.classic-center-deck,
.vinyl-stage,
.crystal-now-panel,
.wood-album-sleeve {
  display: grid;
  grid-template-rows: minmax(0, 1fr) minmax(100px, 0.42fr);
  gap: 12px;
  overflow: hidden;
}

.vinyl-side-rail,
.wood-liner-notes {
  display: grid;
  grid-template-rows: minmax(160px, 0.72fr) minmax(0, 1fr);
  gap: 12px;
  overflow: hidden;
}

.rack-meter-bridge,
.rack-lower-console {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 0.82fr);
  gap: 12px;
  overflow: hidden;
}

.skin-layout .playlist-panel,
.skin-layout .feature-sidebar,
.skin-layout .now-playing,
.skin-layout .workbench-visualization,
.skin-layout .player-controls {
  border-color: var(--skin-border);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.085), rgba(255, 255, 255, 0.025)),
    var(--skin-panel);
}

.skin-layout .track-item.is-current {
  border-color: color-mix(in srgb, var(--skin-primary) 62%, transparent);
  box-shadow: inset 3px 0 0 var(--skin-primary);
}

.skin-layout .visualization-preview span {
  background: linear-gradient(180deg, var(--skin-accent), var(--skin-primary));
}

.skin-title--classic {
  background: linear-gradient(90deg, rgba(217, 232, 251, 0.16), rgba(111, 143, 184, 0.08));
}

.skin-title--vinyl,
.skin-chrome--vinyl .cover-card {
  border-radius: 999px;
}

.skin-title--crystal,
.skin-chrome--crystal .playlist-panel,
.skin-chrome--crystal .feature-sidebar {
  backdrop-filter: blur(18px);
}

.skin-title--rack,
.skin-chrome--rack .player-controls {
  box-shadow: inset 0 0 0 1px rgba(250, 204, 21, 0.16);
}

.skin-title--wood,
.skin-chrome--wood .player-controls {
  background:
    linear-gradient(90deg, rgba(255, 228, 184, 0.16), rgba(120, 53, 15, 0.2)),
    var(--skin-panel);
}

.skin-thumbnail {
  height: 86px;
  display: grid;
  gap: 6px;
  padding: 8px;
  border-radius: 14px;
  overflow: hidden;
  background: rgba(15, 23, 42, 0.72);
}

.skin-thumbnail span {
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.24);
}

.skin-thumbnail--classic-blue-silver {
  grid-template-columns: 0.9fr 1.1fr;
  background: linear-gradient(135deg, #e2edf9, #6985aa 48%, #162033);
}

.skin-thumbnail--dark-vinyl {
  grid-template-columns: 1fr 0.7fr;
  background: radial-gradient(circle at 30% 50%, #e5e7eb 0 9%, #020617 10% 38%, #111827 39%), #020617;
}

.skin-thumbnail--transparent-crystal {
  grid-template-columns: 1fr 1fr;
  background: linear-gradient(135deg, rgba(236, 254, 255, 0.82), rgba(15, 23, 42, 0.62));
}

.skin-thumbnail--metal-rack {
  grid-template-rows: 0.4fr 0.6fr 1fr;
  background: linear-gradient(180deg, #64748b, #111827);
}

.skin-thumbnail--warm-wood {
  grid-template-columns: 0.85fr 1.15fr;
  background: linear-gradient(90deg, #4a2412, #b8743c, #2f160b);
}

.skin-thumbnail--custom {
  background: linear-gradient(135deg, var(--color-primary), var(--color-accent));
}

.skin-manager__note,
.skin-card__tone,
.skin-card__status {
  color: var(--color-muted);
}

.skin-card.is-active {
  border-color: color-mix(in srgb, var(--skin-primary, var(--color-primary)) 52%, transparent);
}

.skin-card__copy,
.skin-card__actions,
.skin-card__status {
  display: grid;
  gap: 8px;
}

@media (max-width: 980px) {
  .skin-chrome {
    width: calc(100vw - 16px);
    height: calc(100vh - 16px);
    padding: 14px;
  }

  .skin-grid--classic,
  .skin-grid--vinyl,
  .skin-grid--wood {
    grid-template-columns: 1fr 1fr;
  }

  .skin-grid--crystal {
    grid-template-columns: 1fr;
  }

  .rack-meter-bridge,
  .rack-lower-console {
    grid-template-columns: 1fr;
  }
}

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
}
```

- [ ] **Step 4: Keep the existing app layout contract green**

Run:

```powershell
npm test -- src/styles/app-layout.test.ts src/styles/skin-layouts.test.ts
```

Expected: PASS. If `src/styles/app-layout.test.ts` fails because it only inspects old `.workspace` selectors, keep those existing compatibility rules in `app.css` rather than deleting them. The new `skin-layouts.test.ts` is the contract for active layout skins.

- [ ] **Step 5: Run UI tests with CSS contracts**

Run:

```powershell
npm test -- src/App.test.tsx src/App.autoplay.test.tsx src/features/skin/layouts.test.tsx src/features/skin/SkinManager.test.tsx src/styles/app-layout.test.ts src/styles/skin-layouts.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```powershell
git add src/styles/skin-layouts.css src/styles/skin-layouts.test.ts src/styles/app-layout.test.ts
git commit -m "style: add five layout skin workbenches"
```

## Task 6: Final Verification and Evidence

**Files:**
- Verify only; no planned file changes.

**Interfaces:**
- Consumes: registry, five layout components, SkinManager cards, App wiring, and skin CSS contracts.
- Produces: verification evidence that tests/build pass and the working tree is clean except ignored or intentionally untracked visual companion files.

- [ ] **Step 1: Run full frontend tests**

Run:

```powershell
npm test
```

Expected: PASS for all Vitest files.

- [ ] **Step 2: Run production build**

Run:

```powershell
npm run build
```

Expected: PASS for TypeScript build and Vite production build.

- [ ] **Step 3: Search layout skin evidence**

Run:

```powershell
rg -n "classic-blue-silver|dark-vinyl|transparent-crystal|metal-rack|warm-wood|resolveLayoutSkin|builtInLayoutSkins|skin-layout--|skin-grid--|导入皮肤包只应用颜色和资源" src docs/superpowers/specs/2026-07-05-yoyomusic-layout-skins-design.md
```

Expected: results show five ids in registry, layout components, CSS, tests, and SkinManager copy.

- [ ] **Step 4: Confirm git status**

Run:

```powershell
git status --short --branch
```

Expected: working tree is clean except `.superpowers/` if the visual companion session is still present. Do not add `.superpowers/` to the commit.

## Self-Review

Spec coverage:

- Five built-in layout skins are covered by Tasks 1, 3, and 5.
- `经典蓝银分体机` default is covered by Tasks 1 and 4.
- Real layout differences are covered by Tasks 3 and 5.
- Shared playback, playlist, lyrics, visualization, and settings logic is preserved by Tasks 3 and 4.
- SkinManager built-in cards and import limitation copy are covered by Task 2.
- No Rust/Tauri command changes are included.
- Mini-player and desktop lyrics routes are untouched.
- Fixed shell and internal scroll contracts are covered by Task 5.

Placeholder scan:

- This plan contains no placeholder sections, no unspecified implementation tasks, and no dependency additions.

Type consistency:

- `FeaturePanel`, `VisualizationFrame`, `PlayerLayoutProps`, `LayoutSkinDefinition`, `DEFAULT_LAYOUT_SKIN_ID`, `builtInLayoutSkins`, `builtInLayoutSkinSummaries`, and `resolveLayoutSkin` are defined before use.
- Layout class names match across registry, tests, components, and CSS.
- Existing `CommandName` values are used for mini-player and desktop lyrics actions.
