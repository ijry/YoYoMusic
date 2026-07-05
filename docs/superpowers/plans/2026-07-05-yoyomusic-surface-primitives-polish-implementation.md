# YoYoMusic Surface Primitives Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the remaining cross-skin “generic web app” feel from the secondary UI surfaces by differentiating playlist rows, small action buttons, status chips, and keyboard focus treatment.

**Architecture:** Keep all existing React markup and work only in `skin-layouts.css` plus the stylesheet contract tests. Use the existing `.device-shell--*` wrappers and shared primitives such as `.track-item`, `.playlist-action-button`, `.ghost-button`, `.playlist-status-pill`, and `.track-flag` to give each skin more distinct surface language while adding explicit `:focus-visible` affordances for keyboard navigation.

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

- `src/styles/skin-layouts.css`: Surface-primitive differentiation and focus-visible treatment.
- `src/styles/skin-layouts.test.ts`: CSS contract for track rows, small buttons, and focus hooks.

### Task 1: Lock In Surface-Primitive Hooks

**Files:**
- Modify: `src/styles/skin-layouts.test.ts`

**Interfaces:**
- Consumes: Existing selectors `.track-item`, `.playlist-action-button`, `.ghost-button`, `.playlist-status-pill`, `.track-flag`, and the `.device-shell--*` wrappers
- Produces: Stable contract coverage for per-skin row/button differentiation and keyboard focus styling

- [ ] **Step 1: Add failing assertions for surface primitives**

Add a focused assertion block to `src/styles/skin-layouts.test.ts` that checks:

```ts
  it("defines skin-specific surface primitive hooks", () => {
    expect(rule(".device-shell--classic .track-item")).toContain("border-radius: 16px;");
    expect(rule(".device-shell--vinyl .track-item")).toContain("border-radius: 999px;");
    expect(rule(".device-shell--crystal .track-item")).toContain("backdrop-filter: blur(14px);");
    expect(rule(".device-shell--rack .track-item")).toContain("border-radius: 8px;");
    expect(rule(".device-shell--wood .track-item")).toContain("border-radius: 18px;");
    expect(rule(".skin-layout .ghost-button:focus-visible")).toContain("box-shadow: 0 0 0 2px");
  });
```

- [ ] **Step 2: Run the stylesheet contract test and verify failure**

Run: `npm test -- src/styles/skin-layouts.test.ts`
Expected: FAIL because the refined row/button/focus selectors are not styled yet.

### Task 2: Implement Surface-Primitive Differentiation

**Files:**
- Modify: `src/styles/skin-layouts.css`

**Interfaces:**
- Consumes: Existing playlist rows, action buttons, and small chips already emitted by the current components
- Produces: Distinct row/button surfaces plus visible keyboard focus without changing behavior

- [ ] **Step 1: Add shared hover/focus treatment for small interactive controls**

Add `transition`, `hover`, and `:focus-visible` treatment for `.playlist-action-button`, `.ghost-button`, `.title-action-button`, `.feature-tab`, `.visualization-mode-button`, `.equalizer-preset`, and skin-card action buttons so keyboard users and pointer users get explicit feedback.

- [ ] **Step 2: Add classic split-console row treatment**

Add rules for `.device-shell--classic .track-item`, `.device-shell--classic .playlist-action-button`, and `.device-shell--classic .ghost-button` so the classic skin reads like machined drawer rows.

- [ ] **Step 3: Add vinyl capsule/tape-strip treatment**

Add rules for `.device-shell--vinyl .track-item`, `.device-shell--vinyl .playlist-action-button`, and `.device-shell--vinyl .ghost-button` so the vinyl skin reads like rounded stage capsules.

- [ ] **Step 4: Add crystal glass-strip treatment**

Add rules for `.device-shell--crystal .track-item`, `.device-shell--crystal .playlist-action-button`, and `.device-shell--crystal .ghost-button` so the crystal skin reads like translucent suspended chips.

- [ ] **Step 5: Add rack bay-row treatment**

Add rules for `.device-shell--rack .track-item`, `.device-shell--rack .playlist-action-button`, and `.device-shell--rack .ghost-button` so the rack skin reads like studio equipment rows.

- [ ] **Step 6: Add wood ledger-strip treatment**

Add rules for `.device-shell--wood .track-item`, `.device-shell--wood .playlist-action-button`, and `.device-shell--wood .ghost-button` so the wood skin reads like cabinet note strips rather than flat web list items.

### Task 3: Verify and Commit

**Files:**
- Verify only unless a regression forces a fix

**Interfaces:**
- Consumes: Surface-primitive CSS and current layout/style tests
- Produces: Evidence that the cleanup pass preserves accessibility, fixed-shell behavior, and build integrity

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
git commit -m "style: refine surface primitives"
```

## Self-Review

Spec coverage:

- This plan targets the remaining shared secondary surfaces that still read too much like one generic web application.
- It adds explicit focus-visible treatment, which aligns with the accessibility constraints instead of trading polish for usability.

Placeholder scan:

- No `TODO`/`TBD` markers remain.
- Every task references exact files and selectors.

Type consistency:

- All selectors referenced here already exist in the current CSS/JSX contract.
- Verification remains aligned with the existing `src/styles/skin-layouts.test.ts` pattern.
