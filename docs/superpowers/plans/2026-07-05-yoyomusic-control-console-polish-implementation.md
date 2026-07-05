# YoYoMusic Control Console Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deepen the five built-in skins so the playback controls read like five different hardware transport consoles instead of one shared web control strip.

**Architecture:** Keep `PlayerControls.tsx` unchanged and rely on the existing `device-module--*-controls`, `transport-button`, `progress-rail`, `volume-well`, and `play-mode-button--deck` hooks. Tighten the stylesheet contract first, then add per-skin control-console framing and compact-layout overrides in `skin-layouts.css`.

**Tech Stack:** Tauri 2, React 19, TypeScript, Vitest, CSS gradients/pseudo-elements.

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

- `src/styles/skin-layouts.css`: Per-skin control-console framing and responsive safety overrides.
- `src/styles/skin-layouts.test.ts`: CSS contract for per-skin control-console hooks.
- `src/features/player/PlayerControls.test.tsx`: Verify only; no markup changes planned.

### Task 1: Lock In Control-Console Differentiation Hooks

**Files:**
- Modify: `src/styles/skin-layouts.test.ts`

**Interfaces:**
- Consumes: Existing selectors `.device-module--classic-controls`, `.device-module--vinyl-controls`, `.device-module--crystal-controls`, `.device-module--rack-controls`, `.device-module--wood-controls`
- Produces: Stable contract coverage for per-skin control-console framing

- [ ] **Step 1: Add failing assertions for per-skin control consoles**

Add a focused assertion block to `src/styles/skin-layouts.test.ts` that checks:

```ts
  it("defines skin-specific control console framing hooks", () => {
    expect(rule(".device-module--classic-controls::before")).toContain("height: 12px;");
    expect(rule(".device-module--vinyl-controls::before")).toContain("border-radius: 999px 999px 26px 26px;");
    expect(rule(".device-module--crystal-controls")).toContain("transform: translateY(6px);");
    expect(rule(".device-module--rack-controls")).toContain("border-radius: 14px;");
    expect(rule(".device-module--wood-controls::before")).toContain("inset: 12px;");
  });
```

- [ ] **Step 2: Run the stylesheet contract test and verify failure**

Run: `npm test -- src/styles/skin-layouts.test.ts`
Expected: FAIL because the control-console selectors are not styled yet.

### Task 2: Implement Control-Console Framing

**Files:**
- Modify: `src/styles/skin-layouts.css`

**Interfaces:**
- Consumes: Existing control markup from `PlayerControls.tsx`
- Produces: Mechanical transport deck, arc console, floating glass base, rack transport bay, and brass/ivory console treatments without changing interaction logic

- [ ] **Step 1: Add classic mechanical transport framing**

Add rules for `.device-module--classic-controls::before`, `.device-module--classic-controls .transport-row--deck`, and `.device-module--classic-controls .progress-rail` so the classic skin reads like a mechanical transport bench.

- [ ] **Step 2: Add vinyl arc console framing**

Add rules for `.device-module--vinyl-controls::before`, `.device-module--vinyl-controls .transport-row--deck`, and `.device-module--vinyl-controls .progress-rail` so the vinyl skin reads like a curved performance dock.

- [ ] **Step 3: Add crystal floating base framing**

Add rules for `.device-module--crystal-controls`, `.device-module--crystal-controls .control-monitor`, and `.device-module--crystal-controls .play-mode-button--deck` so the crystal skin reads like a transparent floating base.

- [ ] **Step 4: Add rack transport bay framing**

Add rules for `.device-module--rack-controls`, `.device-module--rack-controls::before`, and `.device-module--rack-controls .transport-button` so the rack skin reads like a segmented studio transport console.

- [ ] **Step 5: Add wood brass/ivory console framing**

Add rules for `.device-module--wood-controls::before`, `.device-module--wood-controls .transport-button`, and `.device-module--wood-controls .volume-well__ring` so the wood skin reads like a brass-lined home cabinet control deck.

- [ ] **Step 6: Add narrow-layout safety overrides**

Inside the existing `@media (max-width: 760px)` block, disable the decorative control-console pseudo-elements or transforms that would crowd the compact shell.

### Task 3: Verify and Commit

**Files:**
- Verify only unless a regression forces a fix

**Interfaces:**
- Consumes: Control-console CSS and current layout/style tests
- Produces: Evidence that the new consoles preserve accessibility, layout locking, and build integrity

- [ ] **Step 1: Run focused layout/style verification**

Run: `npm test -- src/styles/skin-layouts.test.ts src/features/skin/layouts.test.tsx src/features/player/PlayerControls.test.tsx`
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
git commit -m "style: deepen control consoles"
```

## Self-Review

Spec coverage:

- This plan continues the approved skin-polish direction by differentiating the transport/volume/progress console area.
- It stays in stylesheet/test files, so playback logic and window behavior remain unchanged.

Placeholder scan:

- No `TODO`/`TBD` markers remain.
- Every task references exact files and selectors.

Type consistency:

- All selectors referenced here already exist in the current JSX/CSS contract.
- Verification remains aligned with the existing `src/styles/skin-layouts.test.ts` pattern.
