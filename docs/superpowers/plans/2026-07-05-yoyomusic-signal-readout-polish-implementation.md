# YoYoMusic Signal Readout Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the remaining shared “web panel” feel from lyrics, visualization, and equalizer surfaces by turning them into skin-specific signal readout hardware.

**Architecture:** Keep the current React structure untouched and work only in `skin-layouts.css` plus the stylesheet contract tests. Reuse the stable hooks already emitted by `LyricsPanel`, `VisualizationPanel`, and `EqualizerPanel` so the five built-in skins can diverge at the signal-readout layer without changing playback, EQ, or lyric logic.

**Tech Stack:** Tauri 2, React 19, TypeScript, Vitest, CSS gradients/pseudo-elements.

## Global Constraints

- 强化五套皮肤的机身轮廓、面板边界、控制件造型和显示窗语义。
- 让五套皮肤像五台不同风格、不同年代、不同定位的播放器设备。
- 保持当前布局系统和共享业务组件复用，不推翻既有布局成果。
- 继续保证主窗口是固定工作台，不恢复整窗滚动。
- 让默认皮肤 `经典蓝银分体机` 更接近“千千静听时代桌面旗舰播放器”的感觉。
- 不新增第六套皮肤。
- 不改 JSX 信息架构，不新增复杂包装结构。
- 不重构播放、均衡器、歌词或可视化逻辑。
- 不修改迷你播放器或桌面歌词窗口。
- 不恢复整窗滚动。
- 不引入新依赖、图片贴图或外部字体。
- `body` 不允许恢复滚动。
- 最外层应用容器不允许因为内容变长而撑高。
- 允许滚动的区域仅限：播放列表区、歌词区、功能面板区、少数设置项较长的子面板。
- 播放 / 暂停、上一首、下一首、音量、进度始终可见且可访问。
- `prefers-reduced-motion` 下关闭扫描光、脉冲灯、频闪类装饰效果。
- 不能因为强调读出层而降低歌词可读性。
- 滑杆和按钮的命中区不能缩小。
- 小窗口下必须优先保留信息可读性，必要时隐藏大装饰伪元素。

---

## File Structure

- `src/styles/skin-layouts.css`: Shared signal-readout base plus per-skin lyric/visualization/EQ differentiation.
- `src/styles/skin-layouts.test.ts`: CSS contract for signal-readout hooks.

### Task 1: Lock In Signal-Readout Hooks

**Files:**
- Modify: `src/styles/skin-layouts.test.ts`

**Interfaces:**
- Consumes: Existing selectors `.lyric-line`, `.visualization-preview--panel`, `.equalizer-panel__toggle`, `.eq-band-card`, and the `.device-shell--*` wrappers
- Produces: Stable contract coverage for the signal-readout differentiation layer

- [ ] **Step 1: Add failing assertions for signal-readout hooks**

Add this assertion block to `src/styles/skin-layouts.test.ts`:

```ts
  it("defines skin-specific signal readout hooks", () => {
    expect(rule(".device-shell--classic .lyric-line::before")).toContain("width: 56px;");
    expect(rule(".device-shell--vinyl .visualization-preview--panel")).toContain("border-radius: 999px;");
    expect(rule(".device-shell--crystal .eq-band-card::before")).toContain("backdrop-filter: blur(16px);");
    expect(rule(".device-shell--rack .equalizer-panel__toggle::before")).toContain("width: 14px;");
    expect(rule(".device-shell--wood .lyric-line::before")).toContain("inset: 10px;");
  });
```

- [ ] **Step 2: Run the stylesheet contract test and verify failure**

Run: `npm test -- src/styles/skin-layouts.test.ts`
Expected: FAIL with missing selector/rule coverage for the new signal-readout hooks.

### Task 2: Build Shared Signal-Readout Base Styling

**Files:**
- Modify: `src/styles/skin-layouts.css`

**Interfaces:**
- Consumes: Existing markup from `src/features/lyrics/LyricsPanel.tsx`, `src/features/visualization/VisualizationPanel.tsx`, and `src/features/equalizer/EqualizerPanel.tsx`
- Produces: Shared readout primitives that every skin can override without changing component structure

- [ ] **Step 1: Add shared readout-surface primitives**

Add shared positioning and overflow hooks for lyric rows, meter windows, and EQ cards:

```css
.skin-layout .lyric-line,
.visualization-panel__meter,
.visualization-preview--panel,
.eq-band-card,
.equalizer-panel__toggle {
  position: relative;
  isolation: isolate;
  overflow: hidden;
}
```

- [ ] **Step 2: Add shared visualization meter and mode-button treatment**

Add a denser panel-style base for the visualization window, the bar columns, and the visualization mode buttons:

```css
.visualization-preview--panel {
  min-height: 180px;
  align-items: end;
  padding: 12px 10px 10px;
  border: 1px solid color-mix(in srgb, var(--skin-border) 82%, transparent);
  border-radius: 16px;
}

.visualization-preview--panel span {
  min-width: 0;
  box-shadow:
    inset 0 -2px 0 rgba(0, 0, 0, 0.16),
    0 0 14px color-mix(in srgb, var(--skin-primary) 24%, transparent);
}

.visualization-mode-button[aria-pressed="true"] {
  transform: translateY(-1px);
}
```

- [ ] **Step 3: Add shared equalizer preset, toggle, and slider treatment**

Add explicit framing for the preset buttons, the enable toggle, and the band sliders:

```css
.equalizer-preset[aria-pressed="true"] {
  transform: translateY(-1px);
}

.equalizer-panel__toggle {
  grid-template-columns: auto 1fr;
  min-height: 54px;
}

.eq-band-card input[type="range"] {
  width: 100%;
  height: 12px;
  appearance: none;
  background: transparent;
}

.eq-band-card input[type="range"]::-webkit-slider-runnable-track,
.eq-band-card input[type="range"]::-moz-range-track {
  height: 10px;
  border-radius: 999px;
}
```

- [ ] **Step 4: Add shared lyric readout emphasis**

Add a more device-like readout treatment for the active lyric row while preserving readability:

```css
.skin-layout .lyric-line.is-active {
  transform: translateX(2px);
}

.lyric-line__text {
  position: relative;
  z-index: 1;
  line-height: 1.45;
}
```

### Task 3: Add Per-Skin Signal-Readout Hardware

**Files:**
- Modify: `src/styles/skin-layouts.css`

**Interfaces:**
- Consumes: The shared signal-readout base from Task 2 and existing `.device-shell--*` wrappers
- Produces: Five distinct lyric/visualization/EQ readout identities without JSX changes

- [ ] **Step 1: Add classic LCD-slot readout treatment**

Add exact classic overrides for the lyric slots, visualization bridge, and EQ sliders:

```css
.device-shell--classic .lyric-line::before {
  content: "";
  position: absolute;
  top: 8px;
  bottom: 8px;
  left: 10px;
  width: 56px;
  border-radius: 12px;
}

.device-shell--classic .visualization-preview--panel {
  padding: 16px 12px 14px;
}
```

- [ ] **Step 2: Add vinyl stage-band readout treatment**

Add rounded stage-strip treatment for the vinyl lyric rows and visualization meter:

```css
.device-shell--vinyl .lyric-line {
  border-radius: 999px;
  padding-inline: 16px;
}

.device-shell--vinyl .visualization-preview--panel {
  border-radius: 999px;
  padding-inline: 18px;
}
```

- [ ] **Step 3: Add crystal floating HUD treatment**

Add glass overlays for the crystal EQ cards and meter surfaces:

```css
.device-shell--crystal .eq-band-card::before {
  content: "";
  position: absolute;
  inset: 10px;
  border-radius: 14px;
  backdrop-filter: blur(16px);
  pointer-events: none;
}
```

- [ ] **Step 4: Add rack calibration-bay treatment**

Add rack-side index hardware and LED-style calibration framing:

```css
.device-shell--rack .equalizer-panel__toggle::before {
  content: "";
  position: absolute;
  top: 10px;
  bottom: 10px;
  left: 10px;
  width: 14px;
  border-radius: 8px;
  pointer-events: none;
}
```

- [ ] **Step 5: Add wood backlit plaque treatment**

Add wood-framed lyric slips and warm observation-window treatment:

```css
.device-shell--wood .lyric-line::before {
  content: "";
  position: absolute;
  inset: 10px;
  border-radius: 14px;
  pointer-events: none;
}
```

- [ ] **Step 6: Add narrow-layout safety overrides**

Inside the existing `@media (max-width: 760px)` block, hide or simplify the new signal-readout pseudo-elements so the compact shell stays readable:

```css
  .device-shell--classic .lyric-line::before,
  .device-shell--crystal .eq-band-card::before,
  .device-shell--rack .equalizer-panel__toggle::before,
  .device-shell--wood .lyric-line::before {
    display: none;
  }
```

### Task 4: Verify and Commit

**Files:**
- Verify only unless a regression forces a fix

**Interfaces:**
- Consumes: Signal-readout CSS, the stylesheet contract, and current component tests
- Produces: Evidence that the new readout layer preserves fixed-shell behavior, readability, and build integrity

- [ ] **Step 1: Run focused readout verification**

Run: `npm test -- src/styles/skin-layouts.test.ts src/features/skin/layouts.test.tsx src/features/lyrics/LyricsPanel.test.tsx src/features/visualization/VisualizationPanel.test.tsx src/features/equalizer/EqualizerPanel.test.tsx`
Expected: PASS.

- [ ] **Step 2: Run full frontend tests**

Run: `npm test`
Expected: PASS for all Vitest files.

- [ ] **Step 3: Run production build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

Run:

```powershell
git add src/styles/skin-layouts.css src/styles/skin-layouts.test.ts
git commit -m "style: refine signal readout hardware"
```

## Self-Review

Spec coverage:

- This plan targets the exact surfaces called out in the approved signal-readout spec: lyric rows, visualization meter surfaces, visualization mode buttons, EQ toggles, EQ presets, and EQ sliders.
- It stays CSS-only and does not expand into layout or component-structure work.

Placeholder scan:

- No `TODO`/`TBD` markers remain.
- Every task references exact files, selectors, and commands.

Type consistency:

- All selectors referenced in the plan already exist in the current JSX/CSS contract.
- Focused verification matches the exact feature components that emit the signal-readout hooks.
