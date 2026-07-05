# YoYoMusic Display Window Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deepen the five built-in skins so their status windows and visualization windows read like five different display devices instead of one shared web information card.

**Architecture:** Keep the existing `NowPlayingBlock` and `HeroVisualization` JSX untouched and rely on the current per-skin module classes from `layouts.tsx`. Tighten the stylesheet contract first, then add per-skin display-window framing in `skin-layouts.css`, with responsive overrides that remove oversized ornaments inside the narrow fixed shell.

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

- `src/styles/skin-layouts.css`: Per-skin status-window and visualization-window framing.
- `src/styles/skin-layouts.test.ts`: CSS contract for per-skin display-window hooks.

### Task 1: Lock In Display-Window Differentiation Hooks

**Files:**
- Modify: `src/styles/skin-layouts.test.ts`

**Interfaces:**
- Consumes: Existing selectors `.device-module--classic-status`, `.device-module--classic-visualization`, `.device-module--vinyl-stage`, `.device-module--vinyl-visualization`, `.device-module--crystal-status`, `.device-module--crystal-visualization`, `.device-module--rack-status`, `.device-module--rack-visualization`, `.device-module--wood-status`, `.device-module--wood-visualization`
- Produces: Stable contract coverage for per-skin display-window framing

- [ ] **Step 1: Add failing assertions for display windows**

Add a focused assertion block to `src/styles/skin-layouts.test.ts` that checks:

```ts
  it("defines skin-specific display window framing hooks", () => {
    expect(rule(".device-module--classic-status::before")).toContain("height: 10px;");
    expect(rule(".device-module--vinyl-visualization::before")).toContain("border-radius: 999px;");
    expect(rule(".device-module--crystal-status::before")).toContain("backdrop-filter: blur(16px);");
    expect(rule(".device-module--rack-visualization::before")).toContain("width: 16px;");
    expect(rule(".device-module--wood-visualization::before")).toContain("inset: 12px;");
  });
```

- [ ] **Step 2: Run the stylesheet contract test and verify failure**

Run: `npm test -- src/styles/skin-layouts.test.ts`
Expected: FAIL because the display-window selectors are not styled yet.

### Task 2: Implement Display-Window Framing

**Files:**
- Modify: `src/styles/skin-layouts.css`

**Interfaces:**
- Consumes: Existing status/visualization modules rendered by `layouts.tsx`
- Produces: LCD bezel, stage spectrum ring, glass HUD, rack meter bay, and warm backlit display framing without changing player logic

- [ ] **Step 1: Add classic LCD bezel and spectrum bridge trim**

Add rules for `.device-module--classic-status::before`, `.device-module--classic-status .now-playing-display`, and `.device-module--classic-visualization::before` so the classic skin reads like a blue-backlit desktop display bridge.

- [ ] **Step 2: Add vinyl stage spectrum framing**

Add rules for `.device-module--vinyl-stage .now-playing-display`, `.device-module--vinyl-visualization::before`, and `.device-module--vinyl-visualization .workbench-visualization` so the vinyl skin reads like a stage monitor and platter spectrum ring.

- [ ] **Step 3: Add crystal HUD framing**

Add rules for `.device-module--crystal-status::before`, `.device-module--crystal-status .now-playing-display`, and `.device-module--crystal-visualization::before` so the crystal skin reads like suspended glass information hardware.

- [ ] **Step 4: Add rack meter-bay framing**

Add rules for `.device-module--rack-visualization::before`, `.device-module--rack-status .now-playing-display`, and `.device-module--rack-status .now-playing-status` so the rack skin reads like a professional LED/VU display bank.

- [ ] **Step 5: Add wood cabinet display framing**

Add rules for `.device-module--wood-status .now-playing-display`, `.device-module--wood-visualization::before`, and `.device-module--wood-visualization .workbench-visualization` so the wood skin reads like a warm backlit nameplate and framed viewing window.

- [ ] **Step 6: Add narrow-layout safety overrides**

Inside the existing `@media (max-width: 760px)` block, disable any large decorative display-window pseudo-elements or transforms that would crowd the compact shell.

### Task 3: Verify and Commit

**Files:**
- Verify only unless a regression forces a fix

**Interfaces:**
- Consumes: Display-window CSS and current layout/style tests
- Produces: Evidence that the new display windows preserve readability, fixed-shell behavior, and build integrity

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
git commit -m "style: deepen display windows"
```

## Self-Review

Spec coverage:

- This plan continues the approved skin-polish direction by differentiating the state-display and visualization-display hardware.
- It stays in stylesheet/test files, so player logic, mini-player, desktop lyrics, and shell layout remain untouched.

Placeholder scan:

- No `TODO`/`TBD` markers remain.
- Every task points to exact files and selectors.

Type consistency:

- All selectors referenced here already exist in the current JSX/CSS contract.
- Verification remains aligned with the current `src/styles/skin-layouts.test.ts` pattern.
