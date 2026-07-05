# YoYoMusic Native Control Residue Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the last browser-default feel from checkboxes, internal scrollbars, and disabled controls so the five built-in skins feel complete down to their smallest interactive parts.

**Architecture:** Keep the React structure unchanged and implement this pass entirely in `skin-layouts.css` plus the stylesheet contract tests. Reuse existing hooks such as `.equalizer-panel__toggle input[type="checkbox"]`, `.track-list`, `.feature-content`, `.lyrics-panel__viewport`, and the current button classes to give each skin its own native-control hardware language without changing logic or scroll boundaries.

**Tech Stack:** Tauri 2, React 19, TypeScript, Vitest, CSS gradients/pseudo-elements.

## Global Constraints

- 强化五套皮肤的机身轮廓、面板边界、控制件造型和显示窗语义。
- 让五套皮肤像五台不同风格、不同年代、不同定位的播放器设备。
- 保持当前布局系统和共享业务组件复用，不推翻既有布局成果。
- 继续保证主窗口是固定工作台，不恢复整窗滚动。
- 让默认皮肤 `经典蓝银分体机` 更接近“千千静听时代桌面旗舰播放器”的感觉。
- 不新增第六套皮肤。
- 不改 JSX 结构。
- 不重构表单组件或抽象通用控件系统。
- 不修改迷你播放器、桌面歌词窗口或 Rust / Tauri 逻辑。
- 不扩展到新的视觉子系统。
- 不恢复整窗滚动。
- `body` 不允许恢复滚动。
- 最外层应用容器不允许因为内容变长而撑高。
- 允许滚动的区域仅限：播放列表区、歌词区、功能面板区、少数设置项较长的子面板。
- 播放 / 暂停、上一首、下一首、音量、进度始终可见且可访问。
- `prefers-reduced-motion` 下关闭扫描光、脉冲灯、频闪类装饰效果。
- 不能因为重新画 `checkbox` 而降低键盘和屏幕阅读器可用性。
- 滚动条需要可见，但不能过重到影响内容阅读。
- `disabled` 态必须仍然清晰表达不可操作，不得只顾装饰忽略可理解性。

---

## File Structure

- `src/styles/skin-layouts.css`: Shared native-control base plus per-skin checkbox/scrollbar/disabled styling.
- `src/styles/skin-layouts.test.ts`: CSS contract for the final native-control cleanup hooks.

### Task 1: Lock In Native-Control Cleanup Hooks

**Files:**
- Modify: `src/styles/skin-layouts.test.ts`

**Interfaces:**
- Consumes: Existing selectors `.equalizer-panel__toggle input[type="checkbox"]`, `.track-list`, `.feature-content`, `.lyrics-panel__viewport`, `.playlist-action-button:disabled`, and the `.device-shell--*` wrappers
- Produces: Stable contract coverage for the native-control residue cleanup layer

- [ ] **Step 1: Add failing assertions for native-control hooks**

Add this assertion block to `src/styles/skin-layouts.test.ts`:

```ts
  it("defines skin-specific native control residue hooks", () => {
    expect(rule(".device-shell--classic .equalizer-panel__toggle input[type=\"checkbox\"]")).toContain("border-radius: 10px;");
    expect(rule(".device-shell--vinyl .track-list")).toContain("scrollbar-color: rgba(113, 245, 196, 0.52) rgba(255, 255, 255, 0.04);");
    expect(rule(".device-shell--crystal .feature-content::-webkit-scrollbar-thumb")).toContain("backdrop-filter: blur(10px);");
    expect(rule(".device-shell--rack .playlist-action-button:disabled")).toContain("border-style: dashed;");
    expect(rule(".device-shell--wood .lyrics-panel__viewport")).toContain("scrollbar-color: rgba(210, 150, 82, 0.66) rgba(54, 28, 14, 0.28);");
  });
```

- [ ] **Step 2: Run the stylesheet contract test and verify failure**

Run: `npm test -- src/styles/skin-layouts.test.ts`
Expected: FAIL because the final checkbox/scrollbar/disabled selectors are not styled yet.

### Task 2: Build Shared Native-Control Base Styling

**Files:**
- Modify: `src/styles/skin-layouts.css`

**Interfaces:**
- Consumes: Existing equalizer checkbox, internal scroll zones, and button classes already emitted by the current components
- Produces: A shared native-control base that strips the most obvious browser-default feel while preserving accessibility

- [ ] **Step 1: Add shared custom-checkbox base**

Add a shared checkbox base for `.equalizer-panel__toggle input[type="checkbox"]`:

```css
.equalizer-panel__toggle input[type="checkbox"] {
  appearance: none;
  width: 20px;
  height: 20px;
  border: 1px solid var(--skin-border);
  border-radius: 8px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.02)),
    rgba(2, 7, 14, 0.3);
}
```

- [ ] **Step 2: Add checked and focus-visible checkbox state**

Add explicit checked/focus hooks so the custom control remains accessible:

```css
.equalizer-panel__toggle input[type="checkbox"]:checked {
  border-color: color-mix(in srgb, var(--skin-primary) 62%, transparent);
  background:
    radial-gradient(circle at center, var(--skin-accent) 0 32%, transparent 33%),
    rgba(2, 7, 14, 0.34);
}

.equalizer-panel__toggle input[type="checkbox"]:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--skin-accent) 44%, transparent),
    0 0 0 4px rgba(255, 255, 255, 0.08);
}
```

- [ ] **Step 3: Add shared internal-scrollbar base**

Add a shared scrollbar base for `.track-list`, `.feature-content`, and `.lyrics-panel__viewport`:

```css
.skin-layout .track-list,
.skin-layout .feature-content,
.skin-layout .lyrics-panel__viewport {
  scrollbar-width: thin;
  scrollbar-color: color-mix(in srgb, var(--skin-primary) 56%, transparent) color-mix(in srgb, var(--skin-border) 28%, transparent);
}

.skin-layout .track-list::-webkit-scrollbar,
.skin-layout .feature-content::-webkit-scrollbar,
.skin-layout .lyrics-panel__viewport::-webkit-scrollbar {
  width: 10px;
}
```

- [ ] **Step 4: Add shared scrollbar track and thumb styling**

Add explicit WebKit track/thumb styling for the same internal scroll zones:

```css
.skin-layout .track-list::-webkit-scrollbar-track,
.skin-layout .feature-content::-webkit-scrollbar-track,
.skin-layout .lyrics-panel__viewport::-webkit-scrollbar-track {
  border-radius: 999px;
  background: color-mix(in srgb, var(--skin-border) 24%, transparent);
}

.skin-layout .track-list::-webkit-scrollbar-thumb,
.skin-layout .feature-content::-webkit-scrollbar-thumb,
.skin-layout .lyrics-panel__viewport::-webkit-scrollbar-thumb {
  border: 2px solid transparent;
  border-radius: 999px;
  background:
    linear-gradient(180deg, var(--skin-accent), var(--skin-primary)) padding-box;
}
```

- [ ] **Step 5: Add shared device-style disabled treatment**

Add disabled-state styling for current and future buttons inside the skin shell:

```css
.skin-layout .playlist-action-button:disabled,
.skin-layout .ghost-button:disabled,
.skin-layout .title-action-button:disabled,
.skin-layout .feature-tab:disabled,
.skin-layout .visualization-mode-button:disabled,
.skin-layout .equalizer-preset:disabled,
.skin-layout .transport-button:disabled,
.skin-layout .play-mode-button--deck:disabled,
.skin-layout .skin-card__actions button:disabled {
  opacity: 0.72;
  border-color: color-mix(in srgb, var(--skin-border) 78%, transparent);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.04);
}
```

### Task 3: Add Per-Skin Native-Control Hardware

**Files:**
- Modify: `src/styles/skin-layouts.css`

**Interfaces:**
- Consumes: Shared native-control base from Task 2 plus existing `.device-shell--*` wrappers
- Produces: Five distinct checkbox/scrollbar/disabled control languages without changing component structure

- [ ] **Step 1: Add classic instrument-control treatment**

Add classic overrides for checkbox, scrollbars, and disabled buttons:

```css
.device-shell--classic .equalizer-panel__toggle input[type="checkbox"] {
  border-radius: 10px;
}

.device-shell--classic .playlist-action-button:disabled {
  background:
    linear-gradient(180deg, rgba(226, 237, 249, 0.12), rgba(61, 87, 125, 0.02)),
    rgba(12, 22, 38, 0.34);
}
```

- [ ] **Step 2: Add vinyl stage-control treatment**

Add vinyl overrides, including an explicit track-list scrollbar color rule:

```css
.device-shell--vinyl .equalizer-panel__toggle input[type="checkbox"] {
  border-radius: 999px;
}

.device-shell--vinyl .track-list {
  scrollbar-color: rgba(113, 245, 196, 0.52) rgba(255, 255, 255, 0.04);
}
```

- [ ] **Step 3: Add crystal glass-control treatment**

Add crystal overrides for the checkbox and WebKit scrollbar thumb:

```css
.device-shell--crystal .equalizer-panel__toggle input[type="checkbox"] {
  backdrop-filter: blur(12px);
}

.device-shell--crystal .feature-content::-webkit-scrollbar-thumb {
  backdrop-filter: blur(10px);
}
```

- [ ] **Step 4: Add rack calibration-control treatment**

Add rack overrides for checkbox and disabled playlist action buttons:

```css
.device-shell--rack .equalizer-panel__toggle input[type="checkbox"] {
  border-radius: 6px;
}

.device-shell--rack .playlist-action-button:disabled {
  border-style: dashed;
}
```

- [ ] **Step 5: Add wood brass-control treatment**

Add wood overrides for the checkbox and lyrics scrollbar:

```css
.device-shell--wood .equalizer-panel__toggle input[type="checkbox"] {
  background:
    linear-gradient(180deg, rgba(255, 228, 184, 0.24), rgba(120, 53, 15, 0.08)),
    rgba(54, 28, 14, 0.72);
}

.device-shell--wood .lyrics-panel__viewport {
  scrollbar-color: rgba(210, 150, 82, 0.66) rgba(54, 28, 14, 0.28);
}
```

### Task 4: Verify and Commit

**Files:**
- Verify only unless a regression forces a fix

**Interfaces:**
- Consumes: Native-control CSS, the stylesheet contract, and current component tests
- Produces: Evidence that the last browser-default residues are removed without breaking accessibility or fixed-shell behavior

- [ ] **Step 1: Run focused native-control verification**

Run: `npm test -- src/styles/skin-layouts.test.ts src/features/skin/layouts.test.tsx src/features/equalizer/EqualizerPanel.test.tsx src/features/playlist/PlaylistPanel.test.tsx src/features/player/PlayerControls.test.tsx`
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
git commit -m "style: polish native control residue"
```

## Self-Review

Spec coverage:

- This plan covers all three surfaces called out in the approved spec: checkbox, internal scrollbar, and disabled states.
- It stays CSS-only and does not expand into component restructuring or new UI systems.

Placeholder scan:

- No `TODO`/`TBD` markers remain.
- Every task references exact files, selectors, and verification commands.

Type consistency:

- All selectors referenced in the plan already exist in the current JSX/CSS contract.
- Focused verification covers the exact components that emit the checkbox and currently disabled controls, plus the shared layout CSS contract.
