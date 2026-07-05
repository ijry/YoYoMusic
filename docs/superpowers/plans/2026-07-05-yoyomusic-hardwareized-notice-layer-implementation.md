# Hardwareized Notice Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn YoYoMusic's remaining empty, error, and explanatory notice text into skin-specific physical device notice hardware.

**Architecture:** Keep the implementation CSS-only. Add exact-selector Vitest coverage first, then layer shared notice hardware rules and five skin-specific overrides into `src/styles/skin-layouts.css` without changing React or Tauri behavior.

**Tech Stack:** Tauri, React, TypeScript, CSS, Vitest, Vite.

## Global Constraints

- 优先只修改 `src/styles/skin-layouts.css`。
- 不修改 Rust/Tauri 播放逻辑。
- 不修改迷你播放器和桌面歌词窗口路由。
- 不引入新依赖。
- 不新增窗口级滚动；仅保留已有内部滚动区域。
- 遵循现有皮肤选择器命名，例如 `.device-shell--classic .empty-state`。
- 如果测试依赖精确选择器匹配，应为皮肤专属规则拆出独立 rule，避免 grouped selector 匹配到错误规则。

---

## File Structure

- Modify: `src/styles/skin-layouts.test.ts`
  - Adds exact-selector assertions for shared notice hooks and five skin-specific notice hooks.
- Modify: `src/styles/skin-layouts.css`
  - Adds `.skin-layout` scoped notice hardware base rules.
  - Adds `.device-shell--classic`, `.device-shell--vinyl`, `.device-shell--crystal`, `.device-shell--rack`, and `.device-shell--wood` overrides for `.empty-state`, `.error-text`, and `.skin-manager__note`.
  - Splits the existing wood grouped rule so `.device-shell--wood .skin-manager__note` can own an exact rule for the test helper.

### Task 1: Shared Notice Hardware Base

**Files:**
- Modify: `src/styles/skin-layouts.test.ts`
- Modify: `src/styles/skin-layouts.css`

**Interfaces:**
- Consumes: Existing `rule(selector: string)` helper in `src/styles/skin-layouts.test.ts`.
- Produces: Shared CSS hooks `.skin-layout .empty-state`, `.skin-layout .error-text`, `.skin-layout .skin-manager__note`, and their `::before` indicators.

- [ ] **Step 1: Write the failing shared CSS test**

Add this test after the existing `"defines skin-specific native control residue hooks"` test in `src/styles/skin-layouts.test.ts`:

```ts
  it("defines shared hardwareized notice layer hooks", () => {
    expect(rule(".skin-layout .empty-state")).toContain("min-height: 76px;");
    expect(rule(".skin-layout .error-text")).toContain("border-color: rgba(255, 118, 118, 0.48);");
    expect(rule(".skin-layout .skin-manager__note")).toContain("padding: 12px 14px 12px 42px;");
    expect(rule(".skin-layout .empty-state::before")).toContain("width: 16px;");
    expect(rule(".skin-layout .error-text::before")).toContain("background: linear-gradient(180deg, #ff8a8a, #c92828);");
    expect(rule(".skin-layout .skin-manager__note::before")).toContain("border-radius: 4px;");
  });
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
npm test -- src/styles/skin-layouts.test.ts
```

Expected: FAIL with `Missing CSS rule for .skin-layout .empty-state`.

- [ ] **Step 3: Add the shared notice hardware CSS**

Insert these exact rules in `src/styles/skin-layouts.css` after the existing `.skin-card__meta` block:

```css
.skin-layout .empty-state {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  margin: 0;
  min-height: 76px;
  display: grid;
  align-content: center;
  padding: 16px 18px 16px 46px;
  border: 1px solid var(--skin-border);
  border-radius: 18px;
  color: var(--color-muted);
  font-size: 0.9rem;
  font-weight: 800;
  line-height: 1.45;
  letter-spacing: 0.03em;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.11), rgba(255, 255, 255, 0.02)),
    rgba(3, 8, 16, 0.24);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.1),
    inset 0 -10px 18px rgba(0, 0, 0, 0.14);
}

.skin-layout .error-text {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  margin: 0;
  padding: 14px 16px 14px 44px;
  border: 1px solid rgba(255, 118, 118, 0.48);
  border-radius: 18px;
  color: #ffdada;
  font-size: 0.88rem;
  font-weight: 850;
  line-height: 1.45;
  letter-spacing: 0.04em;
  background:
    linear-gradient(180deg, rgba(255, 118, 118, 0.18), rgba(127, 29, 29, 0.08)),
    rgba(69, 10, 10, 0.3);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 12px 24px rgba(127, 29, 29, 0.16);
}

.skin-layout .skin-manager__note {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  margin: 0;
  padding: 12px 14px 12px 42px;
  border: 1px solid var(--skin-border);
  border-radius: 18px;
  color: var(--color-text);
  font-size: 0.84rem;
  font-weight: 700;
  line-height: 1.5;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.02)),
    rgba(3, 8, 16, 0.2);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.skin-layout .empty-state::before {
  content: "";
  position: absolute;
  left: 16px;
  top: 50%;
  width: 16px;
  height: 16px;
  border: 1px solid var(--skin-border);
  border-radius: 999px;
  background: linear-gradient(180deg, var(--skin-accent), var(--skin-primary));
  box-shadow: 0 0 14px color-mix(in srgb, var(--skin-primary) 42%, transparent);
  transform: translateY(-50%);
}

.skin-layout .error-text::before {
  content: "";
  position: absolute;
  left: 16px;
  top: 50%;
  width: 14px;
  height: 22px;
  border-radius: 999px;
  background: linear-gradient(180deg, #ff8a8a, #c92828);
  box-shadow: 0 0 16px rgba(248, 113, 113, 0.42);
  transform: translateY(-50%);
}

.skin-layout .skin-manager__note::before {
  content: "";
  position: absolute;
  left: 16px;
  top: 50%;
  width: 12px;
  height: 22px;
  border: 1px solid var(--skin-border);
  border-radius: 4px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.22), rgba(255, 255, 255, 0.04)),
    var(--skin-panel);
  transform: translateY(-50%);
}
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run:

```powershell
npm test -- src/styles/skin-layouts.test.ts
```

Expected: PASS for `src/styles/skin-layouts.test.ts`.

- [ ] **Step 5: Commit the shared notice base**

Run:

```powershell
git add -- src/styles/skin-layouts.test.ts src/styles/skin-layouts.css
git commit -m "style: add shared notice layer hardware"
```

Expected: Commit succeeds with only the two listed files staged.

### Task 2: Five Skin-Specific Notice Hardware Shapes

**Files:**
- Modify: `src/styles/skin-layouts.test.ts`
- Modify: `src/styles/skin-layouts.css`

**Interfaces:**
- Consumes: Shared notice base from Task 1.
- Produces: Exact skin-specific notice selectors for all five built-in machine shells.

- [ ] **Step 1: Write the failing skin-specific CSS test**

Add this test after the shared notice test in `src/styles/skin-layouts.test.ts`:

```ts
  it("defines skin-specific hardwareized notice layer hooks", () => {
    expect(rule(".device-shell--classic .empty-state")).toContain("border-radius: 12px;");
    expect(rule(".device-shell--classic .error-text")).toContain("box-shadow: inset 0 -4px 0 rgba(255, 97, 97, 0.42)");
    expect(rule(".device-shell--classic .skin-manager__note")).toContain("letter-spacing: 0.08em;");
    expect(rule(".device-shell--vinyl .empty-state")).toContain("border-radius: 999px;");
    expect(rule(".device-shell--vinyl .error-text")).toContain("transform: rotate(-1deg);");
    expect(rule(".device-shell--vinyl .skin-manager__note")).toContain("border-left: 4px solid rgba(113, 245, 196, 0.52);");
    expect(rule(".device-shell--crystal .empty-state")).toContain("backdrop-filter: blur(16px);");
    expect(rule(".device-shell--crystal .error-text")).toContain("clip-path: polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 0 100%);");
    expect(rule(".device-shell--crystal .skin-manager__note")).toContain("border-radius: 999px;");
    expect(rule(".device-shell--rack .empty-state")).toContain("border-radius: 6px;");
    expect(rule(".device-shell--rack .error-text")).toContain("border-left: 14px solid rgba(248, 113, 113, 0.78);");
    expect(rule(".device-shell--rack .skin-manager__note")).toContain('font-family: "JetBrains Mono", "Cascadia Code", monospace;');
    expect(rule(".device-shell--wood .empty-state")).toContain("border-radius: 22px 10px 24px 12px;");
    expect(rule(".device-shell--wood .error-text")).toContain("border: 1px solid rgba(146, 64, 14, 0.62);");
    expect(rule(".device-shell--wood .skin-manager__note")).toContain("color: rgba(255, 239, 205, 0.9);");
  });
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run:

```powershell
npm test -- src/styles/skin-layouts.test.ts
```

Expected: FAIL with `Missing CSS rule for .device-shell--classic .empty-state`.

- [ ] **Step 3: Split the existing wood grouped rule**

Replace this existing rule in `src/styles/skin-layouts.css`:

```css
.device-shell--wood .settings-panel__field,
.device-shell--wood .tag-editor__field,
.device-shell--wood .skin-manager__note {
  border-radius: 20px;
}
```

With this exact rule:

```css
.device-shell--wood .settings-panel__field,
.device-shell--wood .tag-editor__field {
  border-radius: 20px;
}
```

- [ ] **Step 4: Add the five skin-specific notice CSS blocks**

Insert these exact rules after the shared notice rules from Task 1:

```css
.device-shell--classic .empty-state {
  padding-left: 54px;
  border-radius: 12px;
  background:
    linear-gradient(90deg, rgba(95, 163, 255, 0.2), rgba(8, 23, 43, 0.62)),
    rgba(8, 18, 34, 0.58);
  box-shadow:
    inset 0 0 0 2px rgba(221, 237, 255, 0.1),
    inset 0 -4px 0 rgba(92, 139, 190, 0.3);
}

.device-shell--classic .error-text {
  border-radius: 10px;
  border-color: rgba(255, 110, 110, 0.62);
  box-shadow: inset 0 -4px 0 rgba(255, 97, 97, 0.42), 0 0 18px rgba(255, 80, 80, 0.18);
}

.device-shell--classic .skin-manager__note {
  border-radius: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background:
    linear-gradient(90deg, rgba(226, 237, 249, 0.22), rgba(55, 80, 112, 0.12)),
    rgba(8, 18, 34, 0.42);
}

.device-shell--vinyl .empty-state {
  min-height: 68px;
  border-radius: 999px;
  padding-inline: 52px 24px;
  background:
    radial-gradient(circle at 24px 50%, rgba(113, 245, 196, 0.32), transparent 18px),
    linear-gradient(90deg, rgba(5, 150, 105, 0.16), rgba(2, 6, 23, 0.7));
}

.device-shell--vinyl .error-text {
  border-radius: 6px 20px 6px 20px;
  transform: rotate(-1deg);
  background:
    linear-gradient(135deg, rgba(248, 113, 113, 0.24), rgba(76, 5, 25, 0.42)),
    rgba(10, 8, 16, 0.7);
}

.device-shell--vinyl .skin-manager__note {
  border-left: 4px solid rgba(113, 245, 196, 0.52);
  border-radius: 24px 10px 24px 10px;
  background:
    linear-gradient(90deg, rgba(113, 245, 196, 0.13), rgba(255, 255, 255, 0.03)),
    rgba(2, 6, 23, 0.58);
}

.device-shell--crystal .empty-state {
  border-radius: 28px;
  border-color: rgba(224, 250, 255, 0.44);
  background:
    linear-gradient(135deg, rgba(224, 250, 255, 0.24), rgba(14, 165, 233, 0.08)),
    rgba(8, 47, 73, 0.24);
  backdrop-filter: blur(16px);
}

.device-shell--crystal .error-text {
  border-color: rgba(255, 205, 205, 0.56);
  border-radius: 0;
  clip-path: polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 0 100%);
  backdrop-filter: blur(14px);
}

.device-shell--crystal .skin-manager__note {
  border-radius: 999px;
  border-color: rgba(224, 250, 255, 0.4);
  background:
    linear-gradient(90deg, rgba(255, 255, 255, 0.26), rgba(103, 232, 249, 0.08)),
    rgba(8, 47, 73, 0.2);
  backdrop-filter: blur(14px);
}

.device-shell--rack .empty-state {
  border-radius: 6px;
  border-left: 18px solid rgba(250, 204, 21, 0.46);
  background:
    linear-gradient(90deg, rgba(15, 23, 42, 0.92), rgba(31, 41, 55, 0.72)),
    repeating-linear-gradient(0deg, rgba(255, 255, 255, 0.04) 0 1px, transparent 1px 7px);
}

.device-shell--rack .error-text {
  border-radius: 4px;
  border-left: 14px solid rgba(248, 113, 113, 0.78);
  background:
    linear-gradient(90deg, rgba(127, 29, 29, 0.42), rgba(15, 23, 42, 0.8)),
    rgba(3, 7, 18, 0.76);
}

.device-shell--rack .skin-manager__note {
  border-radius: 4px;
  font-family: "JetBrains Mono", "Cascadia Code", monospace;
  text-transform: uppercase;
  background:
    linear-gradient(90deg, rgba(250, 204, 21, 0.14), rgba(15, 23, 42, 0.76)),
    rgba(3, 7, 18, 0.78);
}

.device-shell--wood .empty-state {
  border-radius: 22px 10px 24px 12px;
  color: rgba(255, 239, 205, 0.82);
  background:
    linear-gradient(135deg, rgba(255, 248, 220, 0.14), rgba(120, 53, 15, 0.16)),
    rgba(49, 24, 12, 0.6);
  box-shadow:
    inset 0 0 0 1px rgba(255, 228, 184, 0.14),
    inset 8px 0 0 rgba(210, 150, 82, 0.24);
}

.device-shell--wood .error-text {
  border: 1px solid rgba(146, 64, 14, 0.62);
  border-radius: 12px 22px 12px 20px;
  color: rgba(255, 239, 205, 0.92);
  background:
    linear-gradient(135deg, rgba(180, 83, 9, 0.36), rgba(69, 26, 3, 0.42)),
    rgba(53, 23, 10, 0.68);
}

.device-shell--wood .skin-manager__note {
  border-radius: 18px 8px 18px 8px;
  color: rgba(255, 239, 205, 0.9);
  background:
    linear-gradient(90deg, rgba(255, 228, 184, 0.18), rgba(120, 53, 15, 0.12)),
    rgba(45, 20, 10, 0.62);
  box-shadow:
    inset 0 0 0 1px rgba(255, 228, 184, 0.18),
    inset 0 -8px 16px rgba(30, 12, 5, 0.18);
}
```

- [ ] **Step 5: Run the focused test and verify it passes**

Run:

```powershell
npm test -- src/styles/skin-layouts.test.ts
```

Expected: PASS for `src/styles/skin-layouts.test.ts`.

- [ ] **Step 6: Commit the skin-specific notice hardware**

Run:

```powershell
git add -- src/styles/skin-layouts.test.ts src/styles/skin-layouts.css
git commit -m "style: hardwareize notice layers per skin"
```

Expected: Commit succeeds with only the two listed files staged.

### Task 3: Full Verification

**Files:**
- No source files modified in this task.

**Interfaces:**
- Consumes: Passing focused CSS tests from Tasks 1 and 2.
- Produces: Verified project state with tests and production build passing.

- [ ] **Step 1: Run focused CSS verification**

Run:

```powershell
npm test -- src/styles/skin-layouts.test.ts
```

Expected: PASS for `src/styles/skin-layouts.test.ts`.

- [ ] **Step 2: Run the full test suite**

Run:

```powershell
npm test
```

Expected: PASS for all test files.

- [ ] **Step 3: Run the production build**

Run:

```powershell
npm run build
```

Expected: PASS with Vite build output and no TypeScript errors.

- [ ] **Step 4: Check final git status**

Run:

```powershell
git status --short
```

Expected: Only pre-existing untracked `.superpowers/` remains.
