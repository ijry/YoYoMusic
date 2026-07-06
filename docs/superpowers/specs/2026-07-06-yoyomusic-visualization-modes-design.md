# YoYoMusic Visualization Modes Design

## Goal

Make the three visualization choices in YoYoMusic feel like real, distinct music visualizers instead of three labels driving the same bar display. A user should be able to click `频谱柱`, `波形`, or `环形脉冲` and immediately see a different visual language in both the main stage visualization and the feature-panel visualization.

## Scope

This pass changes only the visualization UI, visualization render helpers, related skin-layout CSS hooks, and tests. It does not change Rust playback, audio decoding, playlist behavior, lyrics, tags, settings persistence shape, skin switching, installer metadata, or app versioning.

## Current Problems

- The mode buttons exist, but the visible result is too similar across modes.
- The large stage visualization and the feature-panel visualization do not strongly communicate the selected mode.
- The current frame is synthetic, so the UI must avoid implying real FFT audio analysis.
- The paused and empty states are visually close to active playback.
- The existing renderer helper is not fully reflected in the React panel markup.

## User-Facing Design

- `频谱柱` renders a vertical multi-bar meter with staggered peaks and a clear peak/status readout.
- `波形` renders a horizontal oscilloscope-style line or filled ribbon so it is visually different from bars.
- `环形脉冲` renders a center-ring pulse with radial ticks or orbiting segments, matching the turntable/mechanical skin direction.
- The main stage visualization and the right feature-panel visualization use the same selected mode.
- When playback is active, visuals use the current synthetic frame and position to feel alive.
- When paused, visuals freeze into a stable low-motion frame instead of continuing to suggest active playback.
- When no track is loaded, visuals show a deliberate standby state rather than an empty or broken panel.

## Interaction Rules

- Mode buttons remain keyboard accessible buttons with `aria-pressed`.
- The selected mode must be visually clear without relying only on color.
- The feature panel status continues to show peak/readout data.
- Mode selection remains persisted through the existing settings update path.
- The app respects `prefers-reduced-motion`; reduced-motion users get simplified visuals without continuous decorative animation.

## Component Design

Visualization rendering becomes a shared UI concern instead of being duplicated as generic bars in multiple places.

- Add or adapt a reusable visualizer component or helper for rendering mode-specific markup.
- `VisualizationPanel` uses that shared visualizer for the feature-panel meter.
- `layoutShared` uses the same mode-aware rendering for the large stage visualization.
- The existing `VisualizationFrame` shape remains sufficient: `values`, `peak`, and `positionMs`.
- The app can continue generating synthetic frame data from `positionMs`; this pass makes the presentation mode-specific, not audio-accurate FFT.

## CSS Design

CSS should introduce explicit hooks for each visualizer mode:

- `.visualization-preview--spectrum`
- `.visualization-preview--waveform`
- `.visualization-preview--radial`
- mode-specific child hooks for bars, waveform points/segments, radial ticks, and pulse rings
- clear standby/paused styling if represented in markup

The styling should preserve the fixed shell and internal panel scroll constraints. It should avoid long-running decorative animations unless guarded by `prefers-reduced-motion`.

## Testing Requirements

- Update `VisualizationPanel.test.tsx` to verify that selecting a mode renders mode-specific markup or class hooks.
- Update layout tests so the large stage visualization receives the selected mode.
- Update renderer tests or add component tests for spectrum, waveform, and radial output.
- Update CSS contract tests for the new mode hooks and reduced-motion handling if the existing CSS test suite covers those selectors.
- Run targeted visualization/layout tests, then the full test suite.

## Packaging Requirements

After implementation:

- Run targeted tests for visualization components, skin layouts, and CSS.
- Run the full test suite.
- Build the web bundle.
- Build the Tauri package.
- Install the newest MSI cleanly if same-version behavior prevents overwrite.
- Verify the installed shortcut still points to `C:\Users\Admin\AppData\Local\悠悠乐听\yoyomusic.exe`.
- Run a visual smoke check that switches between the three visualization modes.

## Out Of Scope

- Real FFT/audio spectrum analysis from the Rust audio backend.
- New visualization mode names beyond the existing three modes.
- Changing playlist, playback, skin manager, lyrics, tags, mini-player, desktop lyrics, tray, or shortcut behavior.
- Changing app version or installer product metadata.
