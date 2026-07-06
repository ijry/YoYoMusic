# YoYoMusic Visualization Modes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `频谱柱`, `波形`, and `环形脉冲` render as visibly distinct visualizer modes in both the main stage and the visualization feature panel.

**Architecture:** Add a focused React `VisualizationPreview` component that renders mode-specific DOM from the existing synthetic `VisualizationFrame`. Wire `VisualizationPanel` and `HeroVisualization` to the shared component, then add CSS hooks for spectrum, waveform, radial, paused, playing, standby, and reduced-motion states.

**Tech Stack:** Tauri, React, TypeScript, Vitest, Testing Library, CSS.

## Global Constraints

- This pass changes only the visualization UI, visualization render helpers, related skin-layout CSS hooks, and tests.
- It does not change Rust playback, audio decoding, playlist behavior, lyrics, tags, settings persistence shape, skin switching, installer metadata, or app versioning.
- Do not add new dependencies.
- Keep `VisualizationMode` values exactly `spectrum`, `waveform`, and `radial`.
- Keep `VisualizationFrame` shape as `values`, `peak`, and `positionMs`.
- Mode buttons remain keyboard accessible buttons with `aria-pressed`.
- The selected mode must be visually clear without relying only on color.
- Mode selection remains persisted through the existing settings update path.
- Respect `prefers-reduced-motion`.
- Use Node `22.22.2` for all npm/test/build commands.
- Do not stage or modify the untracked `.superpowers/` directory.

---

## File Structure

- Create `src/features/visualization/VisualizationPreview.tsx`: shared DOM visualizer component with mode-specific markup.
- Create `src/features/visualization/VisualizationPreview.test.tsx`: component tests for spectrum, waveform, radial, playing, paused, standby, and clamped values.
- Modify `src/features/visualization/VisualizationPanel.tsx`: use `VisualizationPreview` in the feature panel and accept playback/track state.
- Modify `src/features/visualization/VisualizationPanel.test.tsx`: verify feature-panel mode markup and mode button behavior.
- Modify `src/features/skin/layoutShared.tsx`: use `VisualizationPreview` in `HeroVisualization` and pass playback/track state into `VisualizationPanel`.
- Modify `src/features/skin/layouts.test.tsx`: verify the main stage and feature panel receive selected visualization modes.
- Modify `src/styles/app.css`: neutralize the old generic visualizer span styling so new mode-specific child spans are not forced into the old bar layout.
- Modify `src/styles/skin-layouts.css`: add mode-specific visualizer styling and reduced-motion handling.
- Modify `src/styles/skin-layouts.test.ts`: add CSS hook coverage for the three visualizer modes and reduced-motion query.

---

### Task 1: Add Shared VisualizationPreview Component

**Files:**
- Create: `src/features/visualization/VisualizationPreview.tsx`
- Create: `src/features/visualization/VisualizationPreview.test.tsx`

**Interfaces:**
- Consumes: `VisualizationMode` from `src/shared/types.ts`.
- Consumes: `VisualizationFrame` and `normalizeFrameValues(values: number[]): number[]` from `src/features/visualization/renderers.ts`.
- Produces: `VisualizationPreview({ mode, frame, variant, isPlaying, hasTrack })`.
- Produces class hooks: `.visualization-preview--spectrum`, `.visualization-preview--waveform`, `.visualization-preview--radial`, `.is-playing`, `.is-paused`, `.is-standby`, `.has-track`.

- [ ] **Step 1: Create failing component tests**

Create `src/features/visualization/VisualizationPreview.test.tsx` with this complete content:

```tsx
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VisualizationPreview } from "./VisualizationPreview";
import type { VisualizationFrame } from "./renderers";

const frame: VisualizationFrame = {
  values: [-1, 0.25, 0.5, 0.75, 2],
  peak: 0.84,
  positionMs: 12345,
};

describe("VisualizationPreview", () => {
  it("renders clamped spectrum bars with playing and track state", () => {
    const { container } = render(
      <VisualizationPreview mode="spectrum" frame={frame} variant="panel" isPlaying={true} hasTrack={true} />,
    );

    const preview = container.querySelector(".visualization-preview");
    expect(preview).toHaveClass("visualization-preview--panel");
    expect(preview).toHaveClass("visualization-preview--spectrum");
    expect(preview).toHaveClass("is-playing");
    expect(preview).toHaveClass("has-track");

    const bars = container.querySelectorAll(".visualization-spectrum-bar");
    expect(bars).toHaveLength(5);
    expect(bars[0].getAttribute("style")).toContain("--viz-value: 0");
    expect(bars[4].getAttribute("style")).toContain("--viz-value: 1");
    expect(container.querySelectorAll(".visualization-spectrum-cap")).toHaveLength(5);
  });

  it("renders waveform points with paused state", () => {
    const { container } = render(
      <VisualizationPreview mode="waveform" frame={frame} variant="hero" isPlaying={false} hasTrack={true} />,
    );

    const preview = container.querySelector(".visualization-preview");
    expect(preview).toHaveClass("visualization-preview--hero");
    expect(preview).toHaveClass("visualization-preview--waveform");
    expect(preview).toHaveClass("is-paused");
    expect(preview).toHaveClass("has-track");
    expect(container.querySelector(".visualization-waveform-line")).toBeInTheDocument();
    expect(container.querySelectorAll(".visualization-waveform-point")).toHaveLength(5);
  });

  it("renders radial rings and standby ticks", () => {
    const { container } = render(
      <VisualizationPreview mode="radial" frame={frame} variant="panel" isPlaying={false} hasTrack={false} />,
    );

    const preview = container.querySelector(".visualization-preview");
    expect(preview).toHaveClass("visualization-preview--radial");
    expect(preview).toHaveClass("is-standby");
    expect(container.querySelector(".visualization-radial-ring--outer")).toBeInTheDocument();
    expect(container.querySelector(".visualization-radial-ring--inner")).toBeInTheDocument();
    expect(container.querySelectorAll(".visualization-radial-tick")).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run the new component test and verify it fails**

Run:

```powershell
nvm use 22.22.2; npm test -- src/features/visualization/VisualizationPreview.test.tsx
```

Expected: FAIL because `./VisualizationPreview` does not exist.

- [ ] **Step 3: Create `VisualizationPreview.tsx`**

Create `src/features/visualization/VisualizationPreview.tsx` with this complete content:

```tsx
import type { CSSProperties } from "react";
import type { VisualizationMode } from "../../shared/types";
import { normalizeFrameValues, type VisualizationFrame } from "./renderers";

type VisualizationVariant = "hero" | "panel";

type VisualizationStyle = CSSProperties & Record<`--${string}`, string | number>;

interface VisualizationPreviewProps {
  mode: VisualizationMode;
  frame: VisualizationFrame;
  variant: VisualizationVariant;
  isPlaying?: boolean;
  hasTrack?: boolean;
}

const standbyValues = [0.12, 0.18, 0.14, 0.22, 0.16, 0.2, 0.15, 0.19, 0.13, 0.17, 0.14, 0.18];

export function VisualizationPreview({
  mode,
  frame,
  variant,
  isPlaying = false,
  hasTrack = true,
}: VisualizationPreviewProps) {
  const values = normalizeFrameValues(frame.values.length > 0 ? frame.values : standbyValues);
  const visualValues = hasTrack ? values : standbyValues;
  const className = [
    "visualization-preview",
    `visualization-preview--${variant}`,
    `visualization-preview--${mode}`,
    isPlaying ? "is-playing" : "is-paused",
    hasTrack ? "has-track" : "is-standby",
  ].join(" ");

  return (
    <div
      className={className}
      aria-hidden="true"
      style={visualizationStyle({
        "--viz-count": visualValues.length,
        "--viz-peak": frame.peak.toFixed(3),
      })}
    >
      {mode === "waveform" ? renderWaveform(visualValues) : null}
      {mode === "radial" ? renderRadial(visualValues, frame.peak, frame.positionMs) : null}
      {mode === "spectrum" ? renderSpectrum(visualValues) : null}
    </div>
  );
}

function renderSpectrum(values: number[]) {
  return values.map((value, index) => (
    <span
      key={`spectrum-${index}`}
      className="visualization-spectrum-bar"
      style={visualizationStyle({
        "--viz-index": index,
        "--viz-count": values.length,
        "--viz-value": roundValue(value),
      })}
    >
      <span className="visualization-spectrum-fill" />
      <span className="visualization-spectrum-cap" />
    </span>
  ));
}

function renderWaveform(values: number[]) {
  return (
    <>
      <span className="visualization-waveform-line" />
      {values.map((value, index) => (
        <span
          key={`waveform-${index}`}
          className="visualization-waveform-point"
          style={visualizationStyle({
            "--viz-index": index,
            "--viz-count": values.length,
            "--viz-x": `${roundValue((index / Math.max(values.length - 1, 1)) * 100)}%`,
            "--viz-value": roundValue(value),
          })}
        />
      ))}
    </>
  );
}

function renderRadial(values: number[], peak: number, positionMs: number) {
  const phase = Math.round(positionMs % 3600);

  return (
    <>
      <span
        className="visualization-radial-ring visualization-radial-ring--outer"
        style={visualizationStyle({ "--viz-peak": roundValue(peak), "--viz-phase": phase })}
      />
      <span
        className="visualization-radial-ring visualization-radial-ring--inner"
        style={visualizationStyle({ "--viz-peak": roundValue(peak), "--viz-phase": phase })}
      />
      {values.map((value, index) => (
        <span
          key={`radial-${index}`}
          className="visualization-radial-tick"
          style={visualizationStyle({
            "--viz-index": index,
            "--viz-count": values.length,
            "--viz-value": roundValue(value),
            "--viz-angle": `${Math.round((index / Math.max(values.length, 1)) * 360)}deg`,
          })}
        />
      ))}
    </>
  );
}

function visualizationStyle(vars: Record<`--${string}`, string | number>): VisualizationStyle {
  return vars as VisualizationStyle;
}

function roundValue(value: number) {
  return Number(value.toFixed(3));
}
```

- [ ] **Step 4: Run component tests and verify they pass**

Run:

```powershell
nvm use 22.22.2; npm test -- src/features/visualization/VisualizationPreview.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit shared component**

Run:

```powershell
git add -- src/features/visualization/VisualizationPreview.tsx src/features/visualization/VisualizationPreview.test.tsx
git commit -m "feat: add shared visualization preview component"
```

Expected: commit succeeds and `.superpowers/` remains untracked.

---

### Task 2: Wire Mode-Specific Visualizer Into Panel And Hero Stage

**Files:**
- Modify: `src/features/visualization/VisualizationPanel.tsx`
- Modify: `src/features/visualization/VisualizationPanel.test.tsx`
- Modify: `src/features/skin/layoutShared.tsx`
- Modify: `src/features/skin/layouts.test.tsx`

**Interfaces:**
- Consumes: `VisualizationPreview({ mode, frame, variant, isPlaying, hasTrack })` from Task 1.
- Produces: `VisualizationPanelProps` with optional `isPlaying?: boolean` and `hasTrack?: boolean`.
- Produces: `HeroVisualization` rendering `.visualization-preview--hero.visualization-preview--<mode>`.

- [ ] **Step 1: Replace `VisualizationPanel.test.tsx` with failing mode-specific assertions**

Replace `src/features/visualization/VisualizationPanel.test.tsx` with this complete content:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VisualizationPanel } from "./VisualizationPanel";

const frame = {
  values: Array.from({ length: 12 }, (_, index) => 0.2 + index * 0.05),
  peak: 0.92,
  positionMs: 12000,
};

describe("VisualizationPanel", () => {
  it("renders mode controls and a mode-specific waveform preview", async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();
    const { container } = render(
      <VisualizationPanel
        mode="waveform"
        frame={frame}
        isPlaying={true}
        hasTrack={true}
        onModeChange={onModeChange}
      />,
    );

    expect(container.querySelector(".visualization-panel__status")).toHaveTextContent("峰值 0.92");
    expect(container.querySelectorAll(".visualization-mode-button")).toHaveLength(3);
    expect(container.querySelector(".visualization-preview--panel")).toHaveClass("visualization-preview--waveform");
    expect(container.querySelector(".visualization-preview--panel")).toHaveClass("is-playing");
    expect(container.querySelector(".visualization-waveform-line")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "波形" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "环形脉冲" }));
    expect(onModeChange).toHaveBeenCalledWith("radial");
  });

  it("marks the preview as standby when no track is loaded", () => {
    const { container } = render(
      <VisualizationPanel mode="radial" frame={frame} hasTrack={false} onModeChange={() => undefined} />,
    );

    expect(container.querySelector(".visualization-preview--radial")).toHaveClass("is-standby");
    expect(container.querySelector(".visualization-radial-ring--outer")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run visualization panel tests and verify they fail**

Run:

```powershell
nvm use 22.22.2; npm test -- src/features/visualization/VisualizationPanel.test.tsx
```

Expected: FAIL because `VisualizationPanel` does not accept `isPlaying` or `hasTrack`, and it does not render `VisualizationPreview`.

- [ ] **Step 3: Replace `VisualizationPanel.tsx`**

Replace `src/features/visualization/VisualizationPanel.tsx` with this complete content:

```tsx
import type { VisualizationMode } from "../../shared/types";
import { VisualizationPreview } from "./VisualizationPreview";
import type { VisualizationFrame } from "./renderers";

interface VisualizationPanelProps {
  mode: VisualizationMode;
  frame: VisualizationFrame;
  isPlaying?: boolean;
  hasTrack?: boolean;
  onModeChange: (mode: VisualizationMode) => void;
}

const visualizationModes: Array<{ id: VisualizationMode; label: string }> = [
  { id: "spectrum", label: "频谱柱" },
  { id: "waveform", label: "波形" },
  { id: "radial", label: "环形脉冲" },
];

export function VisualizationPanel({
  mode,
  frame,
  isPlaying = false,
  hasTrack = true,
  onModeChange,
}: VisualizationPanelProps) {
  return (
    <section className="visualization-panel" aria-label="音乐可视化">
      <div className="visualization-panel__header">
        <div>
          <p className="eyebrow">Visualization Bay</p>
          <h2>音乐可视化</h2>
        </div>
        <span className="visualization-panel__status">峰值 {frame.peak.toFixed(2)}</span>
      </div>
      <div className="visualization-panel__modes">
        {visualizationModes.map((visualMode, index) => (
          <button
            key={visualMode.id}
            className="visualization-mode-button"
            type="button"
            aria-pressed={mode === visualMode.id}
            onClick={() => onModeChange(visualMode.id)}
          >
            <span className="visualization-mode-button__slot" aria-hidden="true">
              V{index + 1}
            </span>
            <span className="visualization-mode-button__label">{visualMode.label}</span>
          </button>
        ))}
      </div>
      <div className="visualization-panel__meter">
        <VisualizationPreview mode={mode} frame={frame} variant="panel" isPlaying={isPlaying} hasTrack={hasTrack} />
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Update `layoutShared.tsx` imports and `HeroVisualization`**

In `src/features/skin/layoutShared.tsx`, add this import next to the existing visualization import:

```tsx
import { VisualizationPreview } from "../visualization/VisualizationPreview";
```

Replace the entire `HeroVisualization` function with this complete function:

```tsx
export function HeroVisualization({
  moduleLabel,
  eyebrow = "Spectrum Bridge",
  moduleClassName,
  ...props
}: PlayerLayoutProps & DeviceBlockProps) {
  return (
    <DeviceModuleFrame
      moduleLabel={moduleLabel}
      eyebrow={eyebrow}
      className={["device-module--visualization", moduleClassName].filter(Boolean).join(" ")}
    >
      <div className="workbench-visualization" role="img" aria-label="播放动态可视化">
        <VisualizationPreview
          mode={props.settings.visualizationMode}
          frame={props.visualizationFrame}
          variant="hero"
          isPlaying={props.playback.isPlaying}
          hasTrack={Boolean(props.currentTrack)}
        />
      </div>
    </DeviceModuleFrame>
  );
}
```

In the `renderFeaturePanel` branch for `props.activePanel === "visualization"`, replace the `<VisualizationPanel />` call with this exact call:

```tsx
      <VisualizationPanel
        mode={props.settings.visualizationMode}
        frame={props.visualizationFrame}
        isPlaying={props.playback.isPlaying}
        hasTrack={Boolean(props.currentTrack)}
        onModeChange={props.onVisualizationModeChange}
      />
```

- [ ] **Step 5: Add layout tests for hero and feature-panel mode wiring**

In `src/features/skin/layouts.test.tsx`, add these assertions inside the existing `it.each(builtInLayoutSkins)` test after the existing `expect(screen.getByRole("img", { name: "播放动态可视化" })).toBeInTheDocument();` assertion:

```tsx
    expect(container.querySelector(".workbench-visualization .visualization-preview--spectrum")).toBeInTheDocument();
    expect(container.querySelector(".workbench-visualization .visualization-preview--hero")).toBeInTheDocument();
```

Then add this new test after the existing `it.each(builtInLayoutSkins)` test:

```tsx
  it("renders the selected visualization mode in the feature panel", () => {
    const props = createProps();
    props.activePanel = "visualization";
    props.settings.visualizationMode = "radial";
    props.playback.isPlaying = true;
    const ClassicLayout = builtInLayoutSkins[0].Layout;
    const { container } = render(<ClassicLayout {...props} />);

    expect(container.querySelector(".feature-content .visualization-preview--radial")).toBeInTheDocument();
    expect(container.querySelector(".feature-content .visualization-radial-ring--outer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "环形脉冲" })).toHaveAttribute("aria-pressed", "true");
  });
```

- [ ] **Step 6: Run targeted tests and verify they pass**

Run:

```powershell
nvm use 22.22.2; npm test -- src/features/visualization/VisualizationPreview.test.tsx src/features/visualization/VisualizationPanel.test.tsx src/features/skin/layouts.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit component wiring**

Run:

```powershell
git add -- src/features/visualization/VisualizationPanel.tsx src/features/visualization/VisualizationPanel.test.tsx src/features/skin/layoutShared.tsx src/features/skin/layouts.test.tsx
git commit -m "feat: wire visualization modes into panels"
```

Expected: commit succeeds and `.superpowers/` remains untracked.

---

### Task 3: Add Mode-Specific Skin CSS And Contract Tests

**Files:**
- Modify: `src/styles/skin-layouts.test.ts`
- Modify: `src/styles/app.css`
- Modify: `src/styles/skin-layouts.css`

**Interfaces:**
- Consumes class hooks from Task 1 and Task 2.
- Produces neutral base visualizer CSS in `app.css` and visually distinct skin CSS for `.visualization-preview--spectrum`, `.visualization-preview--waveform`, and `.visualization-preview--radial`.
- Produces reduced-motion CSS under `@media (prefers-reduced-motion: reduce)`.

- [ ] **Step 1: Add failing CSS contract test**

In `src/styles/skin-layouts.test.ts`, add this test after `defines skin-specific signal readout hooks`:

```ts
  it("defines distinct visualization mode hooks", () => {
    expect(rule(".visualization-preview--spectrum")).toContain("grid-template-columns:");
    expect(rule(".visualization-spectrum-bar")).toContain("transform: scaleY(var(--viz-value));");
    expect(rule(".visualization-spectrum-cap")).toContain("height: 4px;");
    expect(rule(".visualization-preview--waveform")).toContain("position: relative;");
    expect(rule(".visualization-waveform-line")).toContain("border-top:");
    expect(rule(".visualization-waveform-point")).toContain("left: var(--viz-x);");
    expect(rule(".visualization-preview--radial")).toContain("place-items: center;");
    expect(rule(".visualization-radial-ring")).toContain("border-radius: 999px;");
    expect(rule(".visualization-radial-tick")).toContain("transform: rotate(var(--viz-angle))");
    expect(rule(".visualization-preview.is-standby")).toContain("opacity: 0.72;");
    expect(rule(".skin-layout .visualization-spectrum-bar")).toContain("background: linear-gradient(180deg, var(--skin-accent), var(--skin-primary));");
    expect(css).not.toContain(".visualization-preview--panel span");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain(".visualization-preview *");
  });
```

- [ ] **Step 2: Run CSS tests and verify they fail**

Run:

```powershell
nvm use 22.22.2; npm test -- src/styles/skin-layouts.test.ts
```

Expected: FAIL because the mode-specific CSS hooks do not exist yet.

- [ ] **Step 3: Neutralize legacy base visualizer CSS**

In `src/styles/app.css`, replace these existing blocks:

```css
.visualization-preview {
  height: 130px;
  display: flex;
  align-items: end;
  gap: 5px;
}

.visualization-preview--hero {
  height: 100%;
  min-height: 86px;
}

.visualization-preview span {
  flex: 1;
  min-width: 4px;
  border-radius: 999px 999px 2px 2px;
  background: linear-gradient(180deg, var(--color-accent), var(--color-primary));
  box-shadow: 0 0 18px rgba(49, 214, 163, 0.2);
}
```

with this complete block:

```css
.visualization-preview {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  height: 130px;
  min-height: 86px;
}

.visualization-preview--hero {
  height: 100%;
  min-height: 86px;
}

.visualization-preview--panel {
  min-height: 180px;
}

.visualization-preview > span {
  min-width: 0;
}
```

- [ ] **Step 4: Retarget old span selectors to spectrum bars**

In `src/styles/skin-layouts.css`, replace:

```css
.skin-layout .visualization-preview span {
  background: linear-gradient(180deg, var(--skin-accent), var(--skin-primary));
}
```

with:

```css
.skin-layout .visualization-spectrum-bar {
  background: linear-gradient(180deg, var(--skin-accent), var(--skin-primary));
}
```

Then replace these five selectors exactly:

```css
.device-shell--classic .visualization-preview--panel span
.device-shell--vinyl .visualization-preview--panel span
.device-shell--crystal .visualization-preview--panel span
.device-shell--rack .visualization-preview--panel span
.device-shell--wood .visualization-preview--panel span
```

with these corresponding selectors:

```css
.device-shell--classic .visualization-spectrum-bar
.device-shell--vinyl .visualization-spectrum-bar
.device-shell--crystal .visualization-spectrum-bar
.device-shell--rack .visualization-spectrum-bar
.device-shell--wood .visualization-spectrum-bar
```

- [ ] **Step 5: Add shared mode-specific visualizer CSS**

In `src/styles/skin-layouts.css`, replace the existing `.visualization-preview--panel span` rule block with this complete block:

```css
.visualization-preview--spectrum {
  display: grid;
  grid-template-columns: repeat(var(--viz-count, 24), minmax(3px, 1fr));
  align-items: end;
  gap: clamp(3px, 1.2vw, 10px);
}

.visualization-spectrum-bar {
  position: relative;
  z-index: 1;
  min-width: 0;
  min-height: 14px;
  display: grid;
  align-items: end;
  transform: scaleY(var(--viz-value));
  transform-origin: bottom;
  border: 1px solid color-mix(in srgb, var(--skin-border) 62%, transparent);
  border-radius: 999px 999px 5px 5px;
  background:
    linear-gradient(180deg, color-mix(in srgb, var(--skin-accent) 78%, transparent), color-mix(in srgb, var(--skin-primary) 46%, transparent)),
    rgba(2, 7, 14, 0.28);
  box-shadow:
    inset 0 -2px 0 rgba(0, 0, 0, 0.16),
    0 0 14px color-mix(in srgb, var(--skin-primary) 24%, transparent);
}

.visualization-spectrum-fill {
  min-height: 100%;
  border-radius: inherit;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.24), transparent 40%);
}

.visualization-spectrum-cap {
  position: absolute;
  left: 20%;
  right: 20%;
  top: -7px;
  height: 4px;
  border-radius: 999px;
  background: var(--skin-accent);
  box-shadow: 0 0 12px color-mix(in srgb, var(--skin-accent) 72%, transparent);
}

.visualization-preview--waveform {
  position: relative;
  display: block;
  overflow: hidden;
}

.visualization-waveform-line {
  position: absolute;
  z-index: 1;
  left: 8px;
  right: 8px;
  top: 50%;
  border-top: 2px solid color-mix(in srgb, var(--skin-accent) 56%, transparent);
  filter: drop-shadow(0 0 10px color-mix(in srgb, var(--skin-primary) 30%, transparent));
}

.visualization-waveform-point {
  position: absolute;
  z-index: 2;
  left: var(--viz-x);
  top: calc(50% + ((0.5 - var(--viz-value)) * 72%));
  width: 10px;
  height: 10px;
  border: 1px solid color-mix(in srgb, var(--skin-accent) 76%, transparent);
  border-radius: 999px;
  background: var(--skin-accent);
  box-shadow: 0 0 14px color-mix(in srgb, var(--skin-accent) 62%, transparent);
  transform: translate(-50%, -50%);
}

.visualization-waveform-point::before {
  content: "";
  position: absolute;
  left: 50%;
  top: 50%;
  width: 28px;
  height: 1px;
  background: color-mix(in srgb, var(--skin-primary) 42%, transparent);
  transform: translateY(-50%);
}

.visualization-preview--radial {
  position: relative;
  display: grid;
  place-items: center;
  overflow: hidden;
}

.visualization-radial-ring {
  position: absolute;
  border: 1px solid color-mix(in srgb, var(--skin-accent) 64%, transparent);
  border-radius: 999px;
  box-shadow:
    inset 0 0 22px color-mix(in srgb, var(--skin-primary) 18%, transparent),
    0 0 24px color-mix(in srgb, var(--skin-accent) 22%, transparent);
}

.visualization-radial-ring--outer {
  width: calc(46% + (var(--viz-peak) * 20%));
  aspect-ratio: 1;
}

.visualization-radial-ring--inner {
  width: calc(22% + (var(--viz-peak) * 12%));
  aspect-ratio: 1;
  background: radial-gradient(circle, color-mix(in srgb, var(--skin-accent) 22%, transparent), transparent 62%);
}

.visualization-radial-tick {
  position: absolute;
  z-index: 2;
  width: 4px;
  height: calc(18px + (var(--viz-value) * 42px));
  border-radius: 999px;
  background: linear-gradient(180deg, var(--skin-accent), color-mix(in srgb, var(--skin-primary) 36%, transparent));
  box-shadow: 0 0 14px color-mix(in srgb, var(--skin-accent) 42%, transparent);
  transform: rotate(var(--viz-angle)) translateY(calc(-42px - (var(--viz-value) * 46px)));
  transform-origin: center calc(100% + 42px);
}

.visualization-preview.is-paused {
  filter: saturate(0.72);
}

.visualization-preview.is-standby {
  opacity: 0.72;
}

@media (prefers-reduced-motion: reduce) {
  .visualization-preview *,
  .visualization-preview *::before,
  .visualization-preview *::after {
    animation: none !important;
    transition: none !important;
  }
}
```

- [ ] **Step 6: Run CSS and visualization tests**

Run:

```powershell
nvm use 22.22.2; npm test -- src/styles/skin-layouts.test.ts src/features/visualization/VisualizationPreview.test.tsx src/features/visualization/VisualizationPanel.test.tsx src/features/skin/layouts.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit CSS mode styling**

Run:

```powershell
git add -- src/styles/app.css src/styles/skin-layouts.css src/styles/skin-layouts.test.ts
git commit -m "style: distinguish visualization modes"
```

Expected: commit succeeds and `.superpowers/` remains untracked.

---

### Task 4: Full Verification, Package, Install, And Push

**Files:**
- Read: `src-tauri/target/release/bundle/msi/`
- Read: Windows Start Menu shortcut entries.
- Do not modify source files in this task unless verification exposes a defect.

**Interfaces:**
- Consumes: Tasks 1-3 completed and committed.
- Produces: passing tests/build/package, installed MSI, visual smoke evidence, pushed commits.

- [ ] **Step 1: Run targeted visualization verification**

Run:

```powershell
nvm use 22.22.2; npm test -- src/features/visualization/VisualizationPreview.test.tsx src/features/visualization/VisualizationPanel.test.tsx src/features/visualization/renderers.test.ts src/features/skin/layouts.test.tsx src/styles/skin-layouts.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run the full test suite**

Run:

```powershell
nvm use 22.22.2; npm test
```

Expected: PASS with all test files and tests passing.

- [ ] **Step 3: Build the web bundle**

Run:

```powershell
nvm use 22.22.2; npm run build
```

Expected: PASS and `dist/` is rebuilt.

- [ ] **Step 4: Build the Tauri package**

Run:

```powershell
nvm use 22.22.2; npm run tauri build
```

Expected: PASS and bundles are produced under:

```text
src-tauri/target/release/bundle/msi/
src-tauri/target/release/bundle/nsis/
```

- [ ] **Step 5: Install newest MSI**

Run:

```powershell
$ErrorActionPreference = 'Stop'
$installed = Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*','HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*','HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -eq '悠悠乐听' } | Select-Object -First 1
if ($installed -and $installed.PSChildName) {
  $uninstall = Start-Process msiexec.exe -ArgumentList @('/x', $installed.PSChildName, '/passive', '/norestart') -Wait -PassThru -WindowStyle Hidden
  if ($uninstall.ExitCode -ne 0 -and $uninstall.ExitCode -ne 3010) { throw "Uninstall failed with exit code $($uninstall.ExitCode)" }
}
$msi = Get-ChildItem 'src-tauri\target\release\bundle\msi' -Filter '*.msi' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $msi) { throw 'No MSI found' }
$install = Start-Process msiexec.exe -ArgumentList @('/i', $msi.FullName, '/passive', '/norestart') -Wait -PassThru -WindowStyle Hidden
if ($install.ExitCode -ne 0 -and $install.ExitCode -ne 3010) { throw "Install failed with exit code $($install.ExitCode)" }
"Installed $($msi.FullName) with exit code $($install.ExitCode)"
```

Expected: MSI install exits `0` or `3010`.

- [ ] **Step 6: Verify installed shortcut target**

Run:

```powershell
$shell = New-Object -ComObject WScript.Shell
$roots = @("$env:APPDATA\Microsoft\Windows\Start Menu\Programs", "$env:ProgramData\Microsoft\Windows\Start Menu\Programs")
$shortcuts = foreach ($root in $roots) {
  Get-ChildItem $root -Recurse -Filter '*.lnk' -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -like '*悠悠乐听*' } |
    ForEach-Object {
      $lnk = $shell.CreateShortcut($_.FullName)
      [PSCustomObject]@{ Shortcut = $_.FullName; Target = $lnk.TargetPath }
    }
}
$shortcuts | Format-List
```

Expected: one shortcut target points to:

```text
C:\Users\Admin\AppData\Local\悠悠乐听\yoyomusic.exe
```

- [ ] **Step 7: Run visual smoke check for visualization mode switching**

Use a fresh strict Vite port. If port `5175` is occupied by an old Vite process, stop only the process whose command line contains `vite`, `npm`, `node`, or `5175`.

Run:

```powershell
$ErrorActionPreference = 'Stop'
$log = Join-Path (Get-Location) 'tmp-yoyomusic-visualization-vite.log'
if (Test-Path $log) { Remove-Item -LiteralPath $log -Force }
$command = "nvm use 22.22.2; npm run dev -- --host 127.0.0.1 --port 5175 --strictPort *> '$log'"
$process = Start-Process powershell.exe -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $command) -PassThru -WindowStyle Hidden
$ready = $false
for ($i = 0; $i -lt 40; $i++) {
  Start-Sleep -Milliseconds 500
  try {
    $response = Invoke-WebRequest 'http://127.0.0.1:5175' -UseBasicParsing -TimeoutSec 2
    if ($response.StatusCode -eq 200) { $ready = $true; break }
  } catch {}
}
if (-not $ready) {
  if (Test-Path $log) { Get-Content $log -Tail 80 }
  throw 'Dev server did not become ready on 5175'
}
"Started dev server process $($process.Id) on 5175"
```

Then use a headless browser or manual installed app check to verify:

```text
Click 可视化
Click 频谱柱: .visualization-preview--spectrum is visible in feature panel and hero stage
Click 波形: .visualization-preview--waveform is visible in feature panel and hero stage
Click 环形脉冲: .visualization-preview--radial is visible in feature panel and hero stage
No window-level scrolling is introduced
```

After smoke verification, stop the Vite process and remove:

```text
tmp-yoyomusic-visualization-vite.log
tmp-yoyomusic-visualization.png
tmp-yoyomusic-chrome-profile
```

- [ ] **Step 8: Check status and push**

Run:

```powershell
git status --short
git push origin main
```

Expected: only `.superpowers/` remains untracked before push, and `main` pushes successfully.

---

## Self-Review Notes

- Spec coverage: Task 1 creates mode-specific shared markup, Task 2 wires it into both visualization surfaces and state, Task 3 adds distinct CSS and reduced-motion handling, Task 4 covers tests/build/package/install/smoke/push.
- Type consistency: `VisualizationPreview` uses existing `VisualizationMode` and `VisualizationFrame` types; `VisualizationPanel` adds optional `isPlaying` and `hasTrack` props and keeps existing `onModeChange`.
- Scope: This plan does not change Rust playback, real FFT analysis, playlist behavior, lyrics, skins, tags, shortcuts, installer metadata, or app versioning.
