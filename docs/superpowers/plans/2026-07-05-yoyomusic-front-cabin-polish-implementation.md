# YoYoMusic Front Cabin Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deepen the five built-in skins so the title cabin and feature bay read like five different machine front faces rather than one shared web header/sidebar.

**Architecture:** Keep the current JSX untouched and use the existing `skin-title--*`, `title-actions`, and `device-module--*-feature` hook classes already rendered by the layouts. Tighten the stylesheet contract first, then add per-skin cabin fascia, status strips, and feature-bay framing in `skin-layouts.css`, with narrow-layout overrides to preserve the fixed shell.

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

- `src/styles/skin-layouts.css`: Front-cabin fascia styling and feature-bay differentiation for the five built-in skins.
- `src/styles/skin-layouts.test.ts`: CSS contract for the new title-cabin and feature-bay hooks.

### Task 1: Lock In Front-Cabin Differentiation Hooks

**Files:**
- Modify: `src/styles/skin-layouts.test.ts`

**Interfaces:**
- Consumes: Existing selectors such as `.skin-title--classic`, `.skin-title--vinyl`, `.skin-title--crystal`, `.skin-title--rack`, `.skin-title--wood`, `.device-module--classic-feature`, `.device-module--vinyl-feature`, `.device-module--crystal-feature`, `.device-module--rack-feature`, `.device-module--wood-feature`
- Produces: Contract coverage for per-skin title-cabin and feature-bay framing

- [ ] **Step 1: Add failing assertions for front-cabin framing**

Add a focused assertion block to `src/styles/skin-layouts.test.ts` that checks:

```ts
  it("defines skin-specific title-cabin and feature-bay framing hooks", () => {
    expect(rule(".skin-title--classic::before")).toContain("width: 120px;");
    expect(rule(".skin-title--vinyl::after")).toContain("border-radius: 999px;");
    expect(rule(".skin-title--crystal::before")).toContain("backdrop-filter: blur(16px);");
    expect(rule(".device-module--rack-feature::before")).toContain("width: 18px;");
    expect(rule(".device-module--wood-feature::before")).toContain("inset: 12px;");
  });
```

- [ ] **Step 2: Run the stylesheet contract test and verify failure**

Run: `npm test -- src/styles/skin-layouts.test.ts`
Expected: FAIL because the new front-cabin selectors are not styled yet.

### Task 2: Implement Title-Cabin and Feature-Bay Framing

**Files:**
- Modify: `src/styles/skin-layouts.css`

**Interfaces:**
- Consumes: Existing cabin and feature classes already emitted by `layouts.tsx`
- Produces: Distinct fascia plates, indicator strips, visor pieces, and feature-bay surrounds without changing business logic

- [ ] **Step 1: Add classic fascia plate and expansion-bay dividers**

Add rules for `.skin-title--classic::before`, `.skin-title--classic .title-actions`, and `.device-module--classic-feature::before` so the classic skin reads like a split console face with serviceable expansion slots.

- [ ] **Step 2: Add vinyl marquee arc and side-tower bay**

Add rules for `.skin-title--vinyl::after`, `.skin-title--vinyl .title-status-cluster`, `.device-module--vinyl-feature`, and `.device-module--vinyl-feature::after` so the vinyl skin reads like a stage marquee plus control tower.

- [ ] **Step 3: Add crystal visor and floating capsule rail**

Add rules for `.skin-title--crystal::before`, `.skin-title--crystal .title-actions`, and `.device-module--crystal-feature::before` so the crystal skin reads like suspended glass hardware.

- [ ] **Step 4: Add rack label strip and utility bay screw column**

Add rules for `.skin-title--rack::before`, `.skin-title--rack .title-actions__buttons`, `.device-module--rack-feature::before`, and `.device-module--rack-feature .feature-tab` so the rack skin feels segmented like professional rack gear.

- [ ] **Step 5: Add wood pediment and cabinet insert rail**

Add rules for `.skin-title--wood::before`, `.skin-title--wood .title-actions`, `.device-module--wood-feature`, and `.device-module--wood-feature::before` so the wood skin reads like a cabinet face with brass-lined controls.

- [ ] **Step 6: Add compact-layout safety overrides**

Inside the existing `@media (max-width: 760px)` block, hide or neutralize front-cabin ornaments that would interfere with the narrow shell.

### Task 3: Verify and Commit

**Files:**
- Verify only unless a regression forces a fix

**Interfaces:**
- Consumes: Front-cabin CSS and current layout/style tests
- Produces: Evidence that the new fascia treatments preserve the fixed workbench and accessibility

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
git commit -m "style: deepen title cabin and feature bays"
```

## Self-Review

Spec coverage:

- This plan continues the approved skin-polish direction by pushing title cabin and feature bay identity, which were explicitly called out in the visual goals.
- It stays in stylesheet/test files, so playback behavior and shell layout semantics remain untouched.

Placeholder scan:

- No `TODO`/`TBD` markers remain.
- Every task names exact files and selectors.

Type consistency:

- All selectors referenced here already exist in the current CSS/JSX contract.
- Verification remains aligned with the current `src/styles/skin-layouts.test.ts` pattern.
