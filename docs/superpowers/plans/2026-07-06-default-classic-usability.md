# Default Classic Usability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the default `classic-blue-silver` first-run UI cleaner, more Chinese-localized, and more obviously clickable without changing playback behavior.

**Architecture:** Keep the existing Tauri + React layout architecture. Update shared layout copy where it directly affects the first screen, update the default classic layout labels, and add scoped classic CSS overrides so other built-in skins keep their identities.

**Tech Stack:** Tauri, React, TypeScript, Vitest, Testing Library, CSS.

## Global Constraints

- Only change the default `classic-blue-silver` skin and shared text/hooks that directly affect that skin's first screen.
- Keep playlist, current playback, visualization, feature panel, and bottom playback controls in their current major regions.
- Keep `skin-chrome` fixed with `height: calc(100vh - 24px)` and `overflow: hidden`.
- Do not reintroduce full-window scrolling.
- Do not add new dependencies.
- Use Node `22.22.2` for all test and build commands.
- Do not stage or modify the untracked `.superpowers/` directory.

---

## File Structure

- Modify `src/App.test.tsx`: verify the default first screen uses Chinese player copy and the top skin action still opens the skin manager.
- Modify `src/features/skin/layouts.test.tsx`: update expected classic labels and assert the shared title action code spans are gone from rendered layouts.
- Modify `src/styles/skin-layouts.test.ts`: add CSS assertions for compact classic title/buttons/tabs and reduced classic decorative hardware.
- Modify `src/features/skin/layoutShared.tsx`: remove visible engineering code spans from title actions and localize the now-playing readout.
- Modify `src/features/skin/layouts.tsx`: replace classic skin English/machine labels with Chinese music-player labels.
- Modify `src/styles/skin-layouts.css`: add scoped classic usability overrides for compact title, reduced decoration, clearer controls, and visible interaction states.

---

### Task 1: Lock Default First-Screen Copy With Tests

**Files:**
- Modify: `src/App.test.tsx`
- Modify: `src/features/skin/layouts.test.tsx`

**Interfaces:**
- Consumes: `<App />`, `builtInLayoutSkins`, `PlayerLayoutProps`, and accessible button names from `TitleActions`.
- Produces: failing tests that require Chinese classic copy and no rendered `SKN`, `CFG`, `MINI`, or `LRC` text nodes.

- [ ] **Step 1: Add first-screen copy assertions to `src/App.test.tsx`**

Add these assertions inside `renders the default classic layout skin landmarks` after the heading assertion:

```tsx
  expect(screen.getByText("本地音乐播放器")).toBeInTheDocument();
  expect(screen.getByText("经典蓝银分体机")).toBeInTheDocument();
  expect(screen.getByText("蓝银经典皮肤")).toBeInTheDocument();
  expect(screen.getAllByText("正在播放").length).toBeGreaterThanOrEqual(1);
  expect(screen.getByText("就绪")).toBeInTheDocument();

  const windowActions = screen.getByRole("navigation", { name: "窗口操作" });
  expect(within(windowActions).getByRole("button", { name: "皮肤" })).toBeInTheDocument();
  expect(within(windowActions).getByRole("button", { name: "设置" })).toBeInTheDocument();
  expect(within(windowActions).getByRole("button", { name: "迷你" })).toBeInTheDocument();
  expect(within(windowActions).getByRole("button", { name: "桌面歌词" })).toBeInTheDocument();
  expect(screen.queryByText("SKN")).not.toBeInTheDocument();
  expect(screen.queryByText("CFG")).not.toBeInTheDocument();
  expect(screen.queryByText("MINI")).not.toBeInTheDocument();
  expect(screen.queryByText("LRC")).not.toBeInTheDocument();
```

- [ ] **Step 2: Update the existing skin-switch test button name in `src/App.test.tsx`**

Keep this existing interaction, with the same accessible name:

```tsx
  const windowActions = screen.getByRole("navigation", { name: "窗口操作" });
  await user.click(within(windowActions).getByRole("button", { name: "皮肤" }));
  expect(screen.getByRole("heading", { name: "皮肤管理" })).toBeInTheDocument();
```

- [ ] **Step 3: Update classic labels in `src/features/skin/layouts.test.tsx`**

Change the `classic-blue-silver` entry in `machineLabels` to this:

```tsx
  "classic-blue-silver": {
    shellClass: "device-shell--classic",
    labels: ["频谱可视化", "播放列表", "正在播放", "功能面板", "播放控制"],
    hardware: [
      { selector: ".device-shell__split-rail", count: 2 },
      { selector: ".device-shell__center-seam", count: 1 },
    ],
  },
```

- [ ] **Step 4: Assert rendered title codes are removed in `src/features/skin/layouts.test.tsx`**

Update the label loop in the layout test so duplicate visible labels such as `正在播放` do not fail the query:

```tsx
    expected.labels.forEach((label) => {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    });
```

Add these assertions after `expect(container.querySelectorAll(".title-action-button")).toHaveLength(4);`:

```tsx
    expect(container.querySelector(".title-action-button__code")).not.toBeInTheDocument();
    expect(screen.queryByText("SKN")).not.toBeInTheDocument();
    expect(screen.queryByText("CFG")).not.toBeInTheDocument();
    expect(screen.queryByText("MINI")).not.toBeInTheDocument();
    expect(screen.queryByText("LRC")).not.toBeInTheDocument();
```

- [ ] **Step 5: Run targeted tests to verify they fail**

Run:

```powershell
nvm use 22.22.2; npm test -- src/App.test.tsx src/features/skin/layouts.test.tsx
```

Expected: FAIL. The failures should mention missing Chinese copy, old classic labels, or existing title action code text.

---

### Task 2: Localize Layout Copy And Remove Title Codes

**Files:**
- Modify: `src/features/skin/layoutShared.tsx`
- Modify: `src/features/skin/layouts.tsx`

**Interfaces:**
- Consumes: `PlayerLayoutProps`, `TitleActions`, `AppTitle`, and `NowPlayingBlock`.
- Produces: rendered Chinese first-screen copy and direct title action labels without engineering code spans.

- [ ] **Step 1: Replace `TitleActions` button children in `src/features/skin/layoutShared.tsx`**

Change the four title action buttons so their children are only labels:

```tsx
        <button className="title-action-button" type="button" onClick={() => props.onActivePanelChange("skin")}>
          <span className="title-action-button__label">皮肤</span>
        </button>
        <button className="title-action-button" type="button" onClick={() => props.onActivePanelChange("settings")}>
          <span className="title-action-button__label">设置</span>
        </button>
        <button
          className="title-action-button"
          type="button"
          onClick={() => props.onPlayerCommand("open_mini_player", {})}
        >
          <span className="title-action-button__label">迷你</span>
        </button>
        <button
          className="title-action-button"
          type="button"
          onClick={() => props.onPlayerCommand("toggle_desktop_lyrics", {})}
        >
          <span className="title-action-button__label">桌面歌词</span>
        </button>
```

- [ ] **Step 2: Localize `NowPlayingBlock` readout in `src/features/skin/layoutShared.tsx`**

Replace the visible English readout:

```tsx
            <p className="eyebrow">正在播放</p>
            <span className="now-playing-status">{props.playback.isPlaying ? "播放中" : "就绪"}</span>
```

- [ ] **Step 3: Replace classic title copy in `src/features/skin/layouts.tsx`**

Update the `AppTitle` props in `ClassicBlueSilverLayout`:

```tsx
          <AppTitle
            eyebrow="本地音乐播放器"
            model="经典蓝银分体机"
            serial="蓝银经典皮肤"
          />
```

- [ ] **Step 4: Replace classic module labels in `src/features/skin/layouts.tsx`**

Update only the `ClassicBlueSilverLayout` module labels:

```tsx
          <PlaylistBlock
            {...props}
            moduleLabel="播放列表"
            eyebrow="本地曲目"
            moduleClassName="device-module--classic-playlist"
          />
```

```tsx
            <NowPlayingBlock
              {...props}
              variant="classic"
              moduleLabel="正在播放"
              eyebrow="歌曲信息"
              moduleClassName="device-module--classic-status"
            />
```

```tsx
            <HeroVisualization
              {...props}
              moduleLabel="频谱可视化"
              eyebrow="音乐动态"
              moduleClassName="device-module--classic-visualization"
            />
```

```tsx
          <FeatureSidebar
            {...props}
            moduleLabel="功能面板"
            eyebrow="歌词 / 皮肤 / 设置"
            moduleClassName="device-module--classic-feature"
          />
```

```tsx
        <ControlsBlock
          {...props}
          moduleLabel="播放控制"
          eyebrow="播放 / 进度 / 音量"
          moduleClassName="device-module--classic-controls"
        />
```

- [ ] **Step 5: Run targeted tests to verify copy changes pass**

Run:

```powershell
nvm use 22.22.2; npm test -- src/App.test.tsx src/features/skin/layouts.test.tsx
```

Expected: PASS for these two files.

- [ ] **Step 6: Commit copy and component changes**

Run:

```powershell
git add -- src/App.test.tsx src/features/skin/layouts.test.tsx src/features/skin/layoutShared.tsx src/features/skin/layouts.tsx
git commit -m "style: localize default classic player chrome"
```

---

### Task 3: Lock Classic Usability CSS With Tests

**Files:**
- Modify: `src/styles/skin-layouts.test.ts`

**Interfaces:**
- Consumes: `rule(selector)` CSS helper.
- Produces: failing CSS tests for compact classic title/action/tab styling and reduced classic decoration.

- [ ] **Step 1: Add a CSS test for default classic usability overrides**

Add this test inside `describe("layout skin CSS", () => { ... })` after `keeps feature panels usable and decorative notice markers click-through`:

```ts
  it("defines compact default classic usability overrides", () => {
    expect(rule(".device-shell--classic .device-module__trim")).toContain("display: none;");
    expect(rule(".device-shell--classic .device-module--classic-playlist::before")).toContain("display: none;");
    expect(rule(".device-shell--classic .device-module--classic-playlist::after")).toContain("display: none;");
    expect(rule(".device-shell--classic .device-shell__plate")).toContain("background: transparent;");
    expect(rule(".device-shell--classic .title-action-button")).toContain("min-height: 40px;");
    expect(rule(".device-shell--classic .title-action-button")).toContain("cursor: pointer;");
    expect(rule(".device-shell--classic .title-action-button:hover")).toContain("background:");
    expect(rule(".device-shell--classic .title-action-button:active")).toContain("transform: translateY(0);");
    expect(rule(".device-shell--classic .feature-tab")).toContain("min-width: 88px;");
    expect(rule(".device-shell--classic .feature-tab__slot")).toContain("display: none;");
  });
```

- [ ] **Step 2: Run the CSS test to verify it fails**

Run:

```powershell
nvm use 22.22.2; npm test -- src/styles/skin-layouts.test.ts
```

Expected: FAIL with missing rules or missing declarations for the new classic usability selectors.

---

### Task 4: Implement Scoped Classic CSS Cleanup

**Files:**
- Modify: `src/styles/skin-layouts.css`

**Interfaces:**
- Consumes: existing `.device-shell--classic`, `.skin-title--classic`, `.title-action-button`, `.feature-tab`, and device module selectors.
- Produces: scoped classic CSS overrides that reduce ornamentation and strengthen interaction feedback.

- [ ] **Step 1: Replace the final classic override block in `src/styles/skin-layouts.css`**

Find the current block starting at `.device-shell--classic {` near the end of the file and keep its intent, then add these scoped declarations in the same classic section:

```css
.device-shell--classic {
  border-radius: 18px;
  background:
    radial-gradient(circle at 18% 12%, rgba(111, 143, 184, 0.2), transparent 26rem),
    linear-gradient(180deg, rgba(39, 57, 82, 0.94), rgba(13, 24, 39, 0.98)),
    var(--color-surface);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.08),
    0 18px 42px rgba(2, 7, 14, 0.42);
}
```

- [ ] **Step 2: Add compact classic title rules**

Add these rules after the `.device-shell--classic::after` rule:

```css
.device-shell--classic .skin-title--classic {
  min-height: 0;
  padding: 12px 14px;
  border-radius: 14px;
  background:
    linear-gradient(180deg, rgba(226, 237, 249, 0.12), rgba(21, 36, 58, 0.48)),
    rgba(10, 22, 38, 0.58);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.08);
}

.device-shell--classic .app-title {
  gap: 4px;
}

.device-shell--classic .app-title h1 {
  font-size: 2rem;
  letter-spacing: 0;
}

.device-shell--classic .device-shell__plate {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
}

.device-shell--classic .app-title__model,
.device-shell--classic .app-title__serial {
  letter-spacing: 0.04em;
}
```

- [ ] **Step 3: Suppress classic decorative hardware and trims**

Add or update these rules in the classic override section:

```css
.device-shell--classic .device-shell__handle,
.device-shell--classic .device-shell__foot,
.device-shell--classic .device-shell__split-rail,
.device-shell--classic .device-shell__center-seam,
.device-shell--classic .device-module__rivets {
  display: none;
}

.device-shell--classic .device-module__trim {
  display: none;
}

.device-shell--classic .device-module--classic-playlist::before {
  display: none;
}

.device-shell--classic .device-module--classic-playlist::after {
  display: none;
}

.device-shell--classic .device-module--classic-feature::before {
  display: none;
}

.device-shell--classic .device-module--classic-controls::before {
  display: none;
}

.device-shell--classic .device-module--classic-status::before {
  display: none;
}

.device-shell--classic .device-module--classic-visualization::before {
  display: none;
}
```

- [ ] **Step 4: Add compact classic module and action rules**

Add or update these rules in the classic override section:

```css
.device-shell--classic .device-module {
  gap: 8px;
  padding: 10px;
  border-radius: 14px;
  border-color: rgba(226, 237, 249, 0.2);
  background:
    linear-gradient(180deg, rgba(255, 255, 255, 0.07), rgba(255, 255, 255, 0.015)),
    rgba(12, 24, 40, 0.64);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.07),
    0 8px 18px rgba(2, 7, 14, 0.14);
}

.device-shell--classic .device-module__label {
  letter-spacing: 0.08em;
  text-transform: none;
}

.device-shell--classic .device-module__eyebrow {
  letter-spacing: 0;
}

.device-shell--classic .title-actions {
  gap: 8px;
}

.device-shell--classic .title-action-button {
  min-height: 40px;
  padding: 8px 12px;
  border-radius: 12px;
  cursor: pointer;
  background:
    linear-gradient(180deg, rgba(217, 232, 251, 0.18), rgba(88, 117, 153, 0.08)),
    rgba(11, 24, 40, 0.72);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.1);
}

.device-shell--classic .title-action-button:hover {
  background:
    linear-gradient(180deg, rgba(217, 232, 251, 0.28), rgba(111, 143, 184, 0.14)),
    rgba(16, 35, 58, 0.82);
}

.device-shell--classic .title-action-button:active {
  transform: translateY(0);
}
```

- [ ] **Step 5: Add compact classic feature tab rules**

Add or update these rules in the classic override section:

```css
.device-shell--classic .feature-tab {
  min-width: 88px;
  min-height: 36px;
  padding: 8px 10px;
  border-radius: 12px;
  cursor: pointer;
}

.device-shell--classic .feature-tab__slot {
  display: none;
}

.device-shell--classic .feature-tab[aria-pressed="true"] {
  background:
    linear-gradient(180deg, rgba(217, 232, 251, 0.24), rgba(111, 143, 184, 0.12)),
    rgba(16, 35, 58, 0.86);
}
```

- [ ] **Step 6: Run CSS tests to verify they pass**

Run:

```powershell
nvm use 22.22.2; npm test -- src/styles/skin-layouts.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit CSS changes**

Run:

```powershell
git add -- src/styles/skin-layouts.test.ts src/styles/skin-layouts.css
git commit -m "style: simplify default classic skin chrome"
```

---

### Task 5: Verify Interaction, Build, Package, Install, And Push

**Files:**
- Read: `src-tauri/target/release/bundle/msi/`
- Read: Windows uninstall entries if installation cleanup is required.

**Interfaces:**
- Consumes: all changes from Tasks 1-4.
- Produces: passing test/build/package results, locally installed current build, and pushed commits.

- [ ] **Step 1: Run targeted UI tests**

Run:

```powershell
nvm use 22.22.2; npm test -- src/App.test.tsx src/features/skin/layouts.test.tsx src/styles/skin-layouts.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run the full test suite**

Run:

```powershell
nvm use 22.22.2; npm test
```

Expected: PASS. Current expected scale is about 24 test files and 56 or more tests.

- [ ] **Step 3: Build the web bundle**

Run:

```powershell
nvm use 22.22.2; npm run build
```

Expected: PASS and `dist/` generated.

- [ ] **Step 4: Build the Tauri package**

Run:

```powershell
nvm use 22.22.2; npm run tauri build
```

Expected: PASS and a new MSI under `src-tauri/target/release/bundle/msi/`.

- [ ] **Step 5: Install the new MSI cleanly**

If same-version MSI behavior leaves the old executable installed, remove old installs first using Windows uninstall entries, then install the newest MSI:

```powershell
$msi = Get-ChildItem 'src-tauri\target\release\bundle\msi' -Filter '*.msi' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
$msi.FullName
msiexec.exe /i $msi.FullName /passive /norestart
```

Expected: MSI installation completes without requiring a reboot.

- [ ] **Step 6: Verify Start Menu shortcut target**

Run:

```powershell
$shortcut = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\悠悠乐听\悠悠乐听.lnk"
$shell = New-Object -ComObject WScript.Shell
$shell.CreateShortcut($shortcut).TargetPath
```

Expected: Target points to the installed `yoyomusic.exe`, usually `C:\Users\Admin\AppData\Local\悠悠乐听\yoyomusic.exe`.

- [ ] **Step 7: Review git status**

Run:

```powershell
git status --short
```

Expected: Only `.superpowers/` remains untracked, or the working tree is clean if that directory is ignored outside this plan.

- [ ] **Step 8: Push commits**

Run:

```powershell
git push origin main
```

Expected: Push succeeds and includes the spec, plan, and implementation commits.
