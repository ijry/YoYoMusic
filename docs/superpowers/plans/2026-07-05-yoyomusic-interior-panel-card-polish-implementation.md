# YoYoMusic Interior Panel Card Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the last “shared web form/card” feeling from the interior feature panels by turning settings fields, tag-editor fields, and skin-manager cards into skin-specific device submodules.

**Architecture:** Keep the existing React markup and work only in `skin-layouts.css` plus the stylesheet contract tests. Reuse the current `.device-shell--*` wrappers and hooks such as `.settings-panel__field`, `.tag-editor__field`, `.skin-card`, `.skin-card__frame`, `.skin-card__actions`, and `.skin-manager__note` to give each skin a distinct service-bay language without touching playback logic or window structure.

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

- `src/styles/skin-layouts.css`: Interior panel/card differentiation for settings, tag editor, and skin manager.
- `src/styles/skin-layouts.test.ts`: CSS contract for the new per-skin interior panel hooks.

### Task 1: Lock In Interior Panel Card Hooks

**Files:**
- Modify: `src/styles/skin-layouts.test.ts`

**Interfaces:**
- Consumes: Existing selectors `.settings-panel__field`, `.tag-editor__field`, `.skin-card`, `.skin-card__frame`, `.skin-card__actions`, and the `.device-shell--*` wrappers
- Produces: Stable contract coverage for the interior panel/card differentiation layer

- [ ] **Step 1: Add failing assertions for interior panel cards**

Add a focused assertion block to `src/styles/skin-layouts.test.ts` that checks:

```ts
  it("defines skin-specific interior panel card hooks", () => {
    expect(rule(".device-shell--classic .skin-card")).toContain("grid-template-rows: auto minmax(0, 1fr) auto auto;");
    expect(rule(".device-shell--vinyl .skin-card__actions")).toContain("grid-template-columns: 1fr;");
    expect(rule(".device-shell--crystal .skin-card__frame::before")).toContain("backdrop-filter: blur(16px);");
    expect(rule(".device-shell--rack .settings-panel__field::before")).toContain("width: 14px;");
    expect(rule(".device-shell--wood .tag-editor__field::before")).toContain("inset: 10px;");
  });
```

- [ ] **Step 2: Run the stylesheet contract test and verify failure**

Run: `npm test -- src/styles/skin-layouts.test.ts`
Expected: FAIL because the refined interior panel/card selectors are not styled yet.

### Task 2: Implement Interior Panel/Card Differentiation

**Files:**
- Modify: `src/styles/skin-layouts.css`

**Interfaces:**
- Consumes: Existing settings, tag editor, and skin manager markup from the current shared feature panels
- Produces: Device-like form trays and management cards that continue the five-skin hardware language without changing component behavior

- [ ] **Step 1: Add shared field/input/card sub-surface treatment**

Add shared rules for `.settings-panel__field`, `.settings-panel__field input`, `.tag-editor__field`, `.tag-editor__field input`, `.skin-card__copy`, `.skin-card__actions`, and `.skin-manager__note` so the panels feel like nested device trays instead of plain form labels.

- [ ] **Step 2: Add classic split-service drawer treatment**

Add rules for `.device-shell--classic .skin-card`, `.device-shell--classic .skin-card__frame`, `.device-shell--classic .settings-panel__field`, and `.device-shell--classic .tag-editor__field` so the classic skin reads like blue-silver service drawers with rigid compartments.

- [ ] **Step 3: Add vinyl capsule/cartridge treatment**

Add rules for `.device-shell--vinyl .skin-card`, `.device-shell--vinyl .skin-card__actions`, `.device-shell--vinyl .settings-panel__field`, and `.device-shell--vinyl .tag-editor__field` so the vinyl skin reads like rounded cartridges and stage capsules instead of web cards.

- [ ] **Step 4: Add crystal suspended dossier treatment**

Add rules for `.device-shell--crystal .skin-card__frame::before`, `.device-shell--crystal .skin-card`, `.device-shell--crystal .settings-panel__field`, and `.device-shell--crystal .tag-editor__field` so the crystal skin reads like layered glass documents floating inside the shell.

- [ ] **Step 5: Add rack service-bay treatment**

Add rules for `.device-shell--rack .settings-panel__field::before`, `.device-shell--rack .tag-editor__field::before`, `.device-shell--rack .skin-card`, and `.device-shell--rack .skin-card__actions` so the rack skin reads like numbered maintenance bays with rail hardware.

- [ ] **Step 6: Add wood cabinet ledger treatment**

Add rules for `.device-shell--wood .tag-editor__field::before`, `.device-shell--wood .settings-panel__field`, `.device-shell--wood .skin-card`, and `.device-shell--wood .skin-manager__note` so the wood skin reads like framed liner-note slips and cabinet folders.

- [ ] **Step 7: Add narrow-layout safety overrides**

Inside the existing `@media (max-width: 760px)` block, disable or simplify any large decorative pseudo-elements added for these interior cards so the compact fixed shell remains legible.

### Task 3: Verify and Commit

**Files:**
- Verify only unless a regression forces a fix

**Interfaces:**
- Consumes: Interior panel/card CSS and the current layout/style tests
- Produces: Evidence that the new panel hardware preserves accessibility, fixed-shell behavior, and build integrity

- [ ] **Step 1: Run focused layout/style verification**

Run: `npm test -- src/styles/skin-layouts.test.ts src/features/skin/layouts.test.tsx src/features/skin/SkinManager.test.tsx`
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
git commit -m "style: refine interior panel cards"
```

## Self-Review

Spec coverage:

- This plan targets the remaining settings/tag/skin-manager surfaces that still feel too shared across skins.
- It continues the approved “different machine, not different colorway” direction without expanding scope beyond CSS/test work.

Placeholder scan:

- No `TODO`/`TBD` markers remain.
- Every task references exact files and selectors.

Type consistency:

- All selectors referenced here already exist in the current JSX/CSS contract.
- Verification remains aligned with the existing `src/styles/skin-layouts.test.ts` pattern.
