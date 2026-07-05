# Skin Manager Usability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework the skin manager into an obvious built-in skin switcher with card-body preview, one primary apply action, and clear active/preview states.

**Architecture:** Keep `SkinManager` as the only React component changed for the skin library UI. Preserve the existing `SkinSummary` type and `previewSkinId` state, then update tests and CSS hooks around the new card structure.

**Tech Stack:** Tauri, React, TypeScript, Vitest, Testing Library, CSS.

## Global Constraints

- This pass changes only the skin manager panel, its tests, and skin-manager-specific styling.
- It does not change playback behavior, audio state, the five layout skin structures, installer metadata, or app versioning.
- Card preview must be available by mouse click and keyboard activation.
- The preview control must expose an accessible name such as `预览 暗夜黑胶舱`.
- The apply button must expose an accessible name such as `应用 暗夜黑胶舱`.
- The active skin apply control must be disabled and visibly labeled as `使用中`.
- Error messages continue to render with `role="alert"`.
- Do not add new dependencies.
- Use Node `22.22.2` for all test and build commands.
- Do not stage or modify the untracked `.superpowers/` directory.

---

## File Structure

- Modify `src/features/skin/SkinManager.test.tsx`: lock new skin-library copy, card-body preview, one apply button per card, disabled active state, and error rendering.
- Modify `src/App.test.tsx`: update the skin panel heading expectation from `皮肤管理` to `皮肤库`.
- Modify `src/App.autoplay.test.tsx`: update the skin panel heading expectation from `皮肤管理` to `皮肤库`.
- Modify `src/features/skin/SkinManager.tsx`: restructure cards into preview button + status + single apply action without changing props or exported types.
- Modify `src/styles/skin-layouts.test.ts`: add CSS hook coverage for skin-manager usability selectors.
- Modify `src/styles/skin-layouts.css`: style the new skin-manager structure, active/preview states, larger thumbnails, and focus/hover affordances.

---

### Task 1: Lock Skin Manager Behavior With Tests

**Files:**
- Modify: `src/features/skin/SkinManager.test.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/App.autoplay.test.tsx`

**Interfaces:**
- Consumes: `SkinManager({ skins, activeSkinId, error, onApply, onImport })`.
- Produces: failing tests requiring heading `皮肤库`, card-body preview button `预览 暗夜黑胶舱`, disabled active apply button `使用中 经典蓝银分体机`, and inactive apply button `应用 暗夜黑胶舱`.

- [ ] **Step 1: Update imports in `src/features/skin/SkinManager.test.tsx`**

Change:

```tsx
import { render, screen } from "@testing-library/react";
```

to:

```tsx
import { render, screen, within } from "@testing-library/react";
```

- [ ] **Step 2: Replace the first SkinManager test body**

Replace the entire current test block whose name is `previews and applies a built-in machine skin` with this complete test:

```tsx
  it("previews from the card body and applies a built-in skin with one primary action", async () => {
    const user = userEvent.setup();
    const onApply = vi.fn();
    const { container } = render(
      <SkinManager
        skins={builtInSkins}
        activeSkinId="classic-blue-silver"
        error={null}
        onApply={onApply}
      />,
    );

    expect(screen.getByRole("heading", { name: "皮肤库" })).toBeInTheDocument();
    expect(screen.getByText("内置皮肤会切换整个播放器布局；导入皮肤包只替换颜色和资源。")).toBeInTheDocument();
    expect(container.querySelector(".skin-manager__status")).toHaveTextContent("2 套内置皮肤");
    expect(container.querySelectorAll(".skin-card__preview-button")).toHaveLength(2);
    expect(container.querySelectorAll(".skin-card__apply-button")).toHaveLength(2);
    expect(container.querySelectorAll(".skin-card__machine-id")).toHaveLength(0);

    const activeApplyButton = screen.getByRole("button", { name: "使用中 经典蓝银分体机" });
    expect(activeApplyButton).toBeDisabled();
    expect(activeApplyButton).toHaveTextContent("使用中");
    expect(screen.getByText("当前使用")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "预览 暗夜黑胶舱" }));
    expect(screen.getByText("预览中")).toBeInTheDocument();
    expect(container.querySelector(".skin-card.is-previewing")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "应用 暗夜黑胶舱" }));
    expect(onApply).toHaveBeenCalledWith("dark-vinyl");

    const previewButton = screen.getByRole("button", { name: "预览 暗夜黑胶舱" });
    expect(within(previewButton).getByText("暗夜黑胶舱")).toBeInTheDocument();
    expect(within(previewButton).getByText("沉浸唱盘机")).toBeInTheDocument();
  });
```

- [ ] **Step 3: Update the imported-skin/error test in `src/features/skin/SkinManager.test.tsx`**

Replace the final expectation:

```tsx
    expect(screen.getByText("内置机型会改变整体机身布局；导入皮肤包只应用颜色和资源，不改变布局。")).toBeInTheDocument();
```

with:

```tsx
    expect(screen.getByRole("alert")).toHaveTextContent("manifest 缺失");
    expect(screen.getByText("内置皮肤会切换整个播放器布局；导入皮肤包只替换颜色和资源。")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "皮肤库" })).toBeInTheDocument();
```

- [ ] **Step 4: Update app-level heading expectations**

In `src/App.test.tsx`, replace:

```tsx
  expect(screen.getByRole("heading", { name: "皮肤管理" })).toBeInTheDocument();
```

with:

```tsx
  expect(screen.getByRole("heading", { name: "皮肤库" })).toBeInTheDocument();
```

In `src/App.autoplay.test.tsx`, replace:

```tsx
    expect(screen.getByRole("heading", { name: "皮肤管理" })).toBeInTheDocument();
```

with:

```tsx
    expect(screen.getByRole("heading", { name: "皮肤库" })).toBeInTheDocument();
```

- [ ] **Step 5: Run tests and verify they fail for the expected reason**

Run:

```powershell
nvm use 22.22.2; npm test -- src/features/skin/SkinManager.test.tsx src/App.test.tsx src/App.autoplay.test.tsx
```

Expected: FAIL. Failures should mention missing heading `皮肤库`, missing `.skin-card__preview-button`, missing disabled `使用中` button, or old skin note copy.

---

### Task 2: Implement SkinManager Card Preview And Single Apply Action

**Files:**
- Modify: `src/features/skin/SkinManager.tsx`

**Interfaces:**
- Consumes: existing `SkinSummary` fields: `id`, `name`, `author`, `version`, `description`, `tone`, `thumbnailClassName`, `builtIn`.
- Produces: same exported `SkinSummary` type and same `SkinManager` component props; new DOM hooks `.skin-card__preview-button` and `.skin-card__apply-button`.

- [ ] **Step 1: Replace heading and status copy**

In `SkinManager.tsx`, replace:

```tsx
          <p className="eyebrow">Skins</p>
          <h2 id="skin-manager-title">皮肤管理</h2>
```

with:

```tsx
          <p className="eyebrow">Skin Library</p>
          <h2 id="skin-manager-title">皮肤库</h2>
```

Replace the note and status block:

```tsx
      <p className="skin-manager__note">内置机型会改变整体机身布局；导入皮肤包只应用颜色和资源，不改变布局。</p>
      <p className="skin-manager__status">{builtInCount > 0 ? `${builtInCount} 套可用机型` : `${skins.length} 套可用主题`}</p>
```

with:

```tsx
      <p className="skin-manager__note">内置皮肤会切换整个播放器布局；导入皮肤包只替换颜色和资源。</p>
      <p className="skin-manager__status">{builtInCount > 0 ? `${builtInCount} 套内置皮肤` : `${skins.length} 套可用主题`}</p>
```

- [ ] **Step 2: Replace the card article markup**

Inside `skins.map`, replace the complete current card `<article>` element, from `<article key={skin.id} className={isActive ? "skin-card is-active" : "skin-card"}>` through its closing `</article>`, with:

```tsx
            <article
              key={skin.id}
              className={["skin-card", isActive ? "is-active" : "", isPreviewing ? "is-previewing" : ""]
                .filter(Boolean)
                .join(" ")}
            >
              <button
                type="button"
                className="skin-card__preview-button"
                aria-label={`预览 ${skin.name}`}
                aria-pressed={isPreviewing || isActive}
                onClick={() => setPreviewSkinId(skin.id)}
              >
                <span className="skin-card__frame" aria-hidden="true">
                  <span className={`skin-thumbnail ${thumbnailClassName}`}>
                    <span />
                    <span />
                    <span />
                  </span>
                </span>

                <span className="skin-card__copy">
                  <span className="skin-card__tone">{skin.tone ?? (skin.builtIn ? "内置皮肤" : "导入主题")}</span>
                  <span className="skin-card__name">{skin.name}</span>
                  <span className="skin-card__meta">
                    {skin.builtIn ? "内置皮肤" : "导入主题"} · {skin.author} · {skin.version}
                  </span>
                  {skin.description ? <span className="skin-card__description">{skin.description}</span> : null}
                </span>
              </button>

              <div className="skin-card__status">
                {isActive ? <span>当前使用</span> : null}
                {isPreviewing ? <span>预览中</span> : null}
              </div>

              <div className="skin-card__actions">
                <button
                  type="button"
                  className="skin-card__apply-button"
                  aria-label={isActive ? `使用中 ${skin.name}` : `应用 ${skin.name}`}
                  disabled={isActive}
                  onClick={() => onApply(skin.id)}
                >
                  {isActive ? "使用中" : "应用"}
                </button>
              </div>
            </article>
```

- [ ] **Step 3: Run targeted tests**

Run:

```powershell
nvm use 22.22.2; npm test -- src/features/skin/SkinManager.test.tsx src/App.test.tsx src/App.autoplay.test.tsx
```

Expected: PASS for these three files.

- [ ] **Step 4: Commit component and behavior changes**

Run:

```powershell
git add -- src/features/skin/SkinManager.test.tsx src/App.test.tsx src/App.autoplay.test.tsx src/features/skin/SkinManager.tsx
git commit -m "feat: make skin manager cards directly previewable"
```

---

### Task 3: Lock Skin Manager CSS Hooks With Tests

**Files:**
- Modify: `src/styles/skin-layouts.test.ts`

**Interfaces:**
- Consumes: `rule(selector)` helper in `src/styles/skin-layouts.test.ts`.
- Produces: failing CSS test for `.skin-card__preview-button`, `.skin-card.is-previewing`, `.skin-card__apply-button`, and active disabled affordance.

- [ ] **Step 1: Add CSS hook assertions**

Add this test after `defines compact default classic usability overrides`:

```ts
  it("defines skin manager library card usability hooks", () => {
    expect(rule(".skin-layout .skin-card")).toContain("grid-template-rows: minmax(150px, 0.92fr) auto auto;");
    expect(rule(".skin-card__preview-button")).toContain("cursor: pointer;");
    expect(rule(".skin-card__preview-button")).toContain("text-align: left;");
    expect(rule(".skin-card__preview-button:hover")).toContain("border-color:");
    expect(rule(".skin-card__preview-button:focus-visible")).toContain("outline: none;");
    expect(rule(".skin-card.is-previewing")).toContain("border-color:");
    expect(rule(".skin-card__frame")).toContain("min-height: 132px;");
    expect(rule(".skin-card__name")).toContain("font-size: 1rem;");
    expect(rule(".skin-card__apply-button")).toContain("min-height: 38px;");
    expect(rule(".skin-card__apply-button:disabled")).toContain("cursor: default;");
  });
```

- [ ] **Step 2: Run CSS test and verify it fails**

Run:

```powershell
nvm use 22.22.2; npm test -- src/styles/skin-layouts.test.ts
```

Expected: FAIL because `.skin-card__preview-button`, `.skin-card__name`, and `.skin-card__apply-button` rules do not exist yet.

---

### Task 4: Implement Skin Manager CSS

**Files:**
- Modify: `src/styles/skin-layouts.css`

**Interfaces:**
- Consumes: new `SkinManager` DOM hooks from Task 2.
- Produces: visible preview/apply affordances while preserving the fixed shell and internal feature-content scroll behavior.

- [ ] **Step 1: Replace the shared skin card layout rules**

Find this existing block:

```css
.skin-layout .skin-card {
  display: grid;
  gap: 12px;
  padding: 12px;
}
```

Replace it with:

```css
.skin-layout .skin-card {
  display: grid;
  grid-template-rows: minmax(150px, 0.92fr) auto auto;
  gap: 10px;
  padding: 10px;
}
```

- [ ] **Step 2: Replace frame/copy/action rules**

Replace the existing `.skin-card__frame`, `.skin-card__copy`, `.skin-card__actions`, `.skin-card__actions button`, and `.skin-card__machine-id` rules with:

```css
.skin-card__preview-button {
  min-width: 0;
  display: grid;
  grid-template-rows: minmax(132px, 1fr) auto;
  gap: 10px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 18px;
  color: inherit;
  text-align: left;
  cursor: pointer;
  background: transparent;
}

.skin-card__preview-button:hover {
  border-color: color-mix(in srgb, var(--skin-primary) 48%, transparent);
  background: color-mix(in srgb, var(--skin-primary) 10%, transparent);
}

.skin-card__preview-button:focus-visible {
  outline: none;
  box-shadow:
    0 0 0 2px color-mix(in srgb, var(--skin-accent) 44%, transparent),
    0 0 0 4px rgba(255, 255, 255, 0.08);
}

.skin-card__frame {
  min-height: 132px;
  display: grid;
  padding: 10px;
}

.skin-card__frame .skin-thumbnail {
  min-height: 112px;
}

.skin-card__copy {
  display: grid;
  gap: 6px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--skin-border) 78%, transparent);
  border-radius: 16px;
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02)),
    rgba(2, 7, 14, 0.14);
}

.skin-card__name {
  color: var(--color-text);
  font-size: 1rem;
  font-weight: 800;
}

.skin-card__description {
  color: var(--color-muted);
  font-size: 0.8rem;
  line-height: 1.45;
}

.skin-card__actions {
  display: grid;
}

.skin-card__apply-button {
  min-height: 38px;
  width: 100%;
  border: 1px solid var(--skin-border);
  border-radius: 14px;
  color: var(--color-text);
  font-weight: 800;
  cursor: pointer;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--skin-accent) 24%, transparent), transparent),
    rgba(3, 8, 16, 0.36);
}

.skin-card__apply-button:disabled {
  cursor: default;
  opacity: 0.82;
}
```

- [ ] **Step 3: Add preview state styling**

After the existing `.skin-card.is-active` rule, add:

```css
.skin-card.is-previewing {
  border-color: color-mix(in srgb, var(--skin-accent) 56%, transparent);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--skin-accent) 28%, transparent),
    0 12px 22px rgba(0, 0, 0, 0.16);
}
```

- [ ] **Step 4: Update shared display rule**

Find:

```css
.skin-card__copy,
.skin-card__actions,
.skin-card__status {
  display: grid;
  gap: 8px;
}
```

Replace it with:

```css
.skin-card__status {
  display: grid;
  gap: 8px;
}
```

- [ ] **Step 5: Run CSS tests**

Run:

```powershell
nvm use 22.22.2; npm test -- src/styles/skin-layouts.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit CSS changes**

Run:

```powershell
git add -- src/styles/skin-layouts.test.ts src/styles/skin-layouts.css
git commit -m "style: clarify skin manager card interactions"
```

---

### Task 5: Full Verification, Package, Install, Push

**Files:**
- Read: `src-tauri/target/release/bundle/msi/`
- Read: Windows Start Menu shortcut entries.

**Interfaces:**
- Consumes: Tasks 1-4.
- Produces: passing tests/build/package, installed MSI, pushed commits.

- [ ] **Step 1: Run targeted tests**

Run:

```powershell
nvm use 22.22.2; npm test -- src/features/skin/SkinManager.test.tsx src/App.test.tsx src/App.autoplay.test.tsx src/styles/skin-layouts.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run the full test suite**

Run:

```powershell
nvm use 22.22.2; npm test
```

Expected: PASS.

- [ ] **Step 3: Build the web bundle**

Run:

```powershell
nvm use 22.22.2; npm run build
```

Expected: PASS.

- [ ] **Step 4: Build the Tauri package**

Run:

```powershell
nvm use 22.22.2; npm run tauri build
```

Expected: PASS and a new MSI under `src-tauri/target/release/bundle/msi/`.

- [ ] **Step 5: Install newest MSI**

Run:

```powershell
$installed = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*','HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*','HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -eq '悠悠乐听' } | Select-Object -First 1
if ($installed?.PSChildName) {
  $uninstall = Start-Process msiexec.exe -ArgumentList @('/x', $installed.PSChildName, '/passive', '/norestart') -Wait -PassThru -WindowStyle Hidden
  if ($uninstall.ExitCode -ne 0 -and $uninstall.ExitCode -ne 3010) { exit $uninstall.ExitCode }
}
$msi = Get-ChildItem 'src-tauri\target\release\bundle\msi' -Filter '*.msi' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
$install = Start-Process msiexec.exe -ArgumentList @('/i', $msi.FullName, '/passive', '/norestart') -Wait -PassThru -WindowStyle Hidden
if ($install.ExitCode -ne 0 -and $install.ExitCode -ne 3010) { exit $install.ExitCode }
```

Expected: MSI install exits `0` or `3010`.

- [ ] **Step 6: Verify installed shortcut target**

Run:

```powershell
$roots = @("$env:APPDATA\Microsoft\Windows\Start Menu\Programs", "$env:ProgramData\Microsoft\Windows\Start Menu\Programs")
foreach ($root in $roots) {
  Get-ChildItem $root -Recurse -Filter '*.lnk' -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like '*悠悠乐听*' } |
    ForEach-Object {
      $shell = New-Object -ComObject WScript.Shell
      $lnk = $shell.CreateShortcut($_.FullName)
      [PSCustomObject]@{ Shortcut = $_.FullName; Target = $lnk.TargetPath }
    }
}
```

Expected: a shortcut target points to `C:\Users\Admin\AppData\Local\悠悠乐听\yoyomusic.exe`.

- [ ] **Step 7: Check status and push**

Run:

```powershell
git status --short
git push origin main
```

Expected: only `.superpowers/` remains untracked before push, and `main` pushes successfully.
