# YoYoMusic Module Compartment Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deepen the five built-in skins so their playlist, display, feature, and control compartments feel like different physical machine modules instead of the same panels with different materials.

**Architecture:** Reuse the existing per-skin `device-module--*` hook classes and layout container classes already present in `layouts.tsx`. Add module-level compartment framing in `skin-layouts.css` with pseudo-elements and focused container styling, then tighten the stylesheet contract tests so the new machine-specific hooks remain stable.

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

- `src/styles/skin-layouts.css`: Module-level compartment framing for the five built-in skins.
- `src/styles/skin-layouts.test.ts`: CSS contract that locks in the new per-skin module hook rules.
- `src/features/skin/layouts.test.tsx`: Existing layout shell contract; verify only unless a new structural hook must be rendered in JSX.

### Task 1: Lock In Module-Level Differentiation Hooks

**Files:**
- Modify: `src/styles/skin-layouts.test.ts`

**Interfaces:**
- Consumes: Existing module classes such as `.device-module--classic-playlist`, `.device-module--vinyl-playlist`, `.device-module--crystal-playlist`, `.device-module--rack-playlist`, `.device-module--wood-playlist`
- Produces: CSS test coverage for the new module-compartment framing rules

- [ ] **Step 1: Add failing assertions for per-skin module compartments**

Add one focused assertion block to `src/styles/skin-layouts.test.ts` that checks:

```ts
  it("defines skin-specific module compartment framing hooks", () => {
    expect(rule(".device-module--classic-playlist::before")).toContain("width: 16px;");
    expect(rule(".device-module--vinyl-playlist::before")).toContain("width: 4px;");
    expect(rule(".device-module--crystal-playlist")).toContain("transform: translateY(10px);");
    expect(rule(".device-module--rack-playlist::before")).toContain("width: 18px;");
    expect(rule(".device-module--wood-playlist::before")).toContain("inset: 14px;");
  });
```

- [ ] **Step 2: Run the stylesheet contract test and verify failure**

Run: `npm test -- src/styles/skin-layouts.test.ts`
Expected: FAIL because those compartment selectors are not styled yet.

### Task 2: Implement Module Compartment Framing

**Files:**
- Modify: `src/styles/skin-layouts.css`

**Interfaces:**
- Consumes: The per-skin module classes already rendered by `src/features/skin/layouts.tsx`
- Produces: Drawer rails, tower spines, floating glass trays, rack screw columns, and cabinet insets without changing playback logic

- [ ] **Step 1: Add classic drawer rails and status bezel**

Add rules for `.device-module--classic-playlist::before`, `.device-module--classic-playlist::after`, and `.device-module--classic-status .now-playing-display` so the classic skin reads like a split-body drawer plus LCD display.

- [ ] **Step 2: Add vinyl tower spine and stage surround**

Add rules for `.device-module--vinyl-playlist::before`, `.device-module--vinyl-feature::before`, `.device-module--vinyl-controls`, and `.vinyl-stage::before` so the vinyl skin feels like a circular stage with a side control tower.

- [ ] **Step 3: Add crystal floating tray treatments**

Add rules for `.device-module--crystal-playlist`, `.crystal-playlist-drawer::before`, and `.device-module--crystal-feature` so the crystal skin reads as a lifted glass drawer with floating capsules.

- [ ] **Step 4: Add rack screw-column framing**

Add rules for `.device-module--rack-playlist::before`, `.device-module--rack-status::before`, `.device-module--rack-feature::before`, and `.rack-lower-console::before` so the rack skin feels segmented like professional equipment bays.

- [ ] **Step 5: Add wood cabinet inset framing**

Add rules for `.device-module--wood-playlist::before`, `.device-module--wood-status .now-playing-display`, `.device-module--wood-feature`, and `.wood-liner-notes::before` so the wood skin reads like a cabinet insert instead of a flat panel.

- [ ] **Step 6: Add narrow-layout safety overrides**

Inside the existing `@media (max-width: 760px)` block, neutralize the module translations or oversized ornaments that would crowd the compact shell.

### Task 3: Verify and Commit

**Files:**
- Verify only unless a regression forces a follow-up fix

**Interfaces:**
- Consumes: Module compartment CSS and current shell/layout tests
- Produces: Evidence that the new framing keeps the app fixed, accessible, and buildable

- [ ] **Step 1: Run focused layout/style verification**

Run: `npm test -- src/styles/skin-layouts.test.ts src/features/skin/layouts.test.tsx`
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
git commit -m "style: deepen skin module compartments"
```

## Self-Review

Spec coverage:

- This plan deepens per-skin module identity after the shell and silhouette passes already landed.
- It stays in CSS and tests, so playback logic, mini-player, desktop lyrics, and shell scroll constraints remain untouched.

Placeholder scan:

- No `TODO`/`TBD` markers remain.
- Every task points to exact files and exact selectors.

Type consistency:

- All selectors referenced here already exist in `layouts.tsx`.
- The verification scope matches the current CSS contract approach used in `src/styles/skin-layouts.test.ts`.
