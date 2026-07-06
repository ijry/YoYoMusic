import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/styles/skin-layouts.css"), "utf8").replace(/\r\n/g, "\n");

function rule(selector: string) {
  const match = css.match(new RegExp(`${escapeRegExp(selector)}\\s*\\{([\\s\\S]*?)\\}`));
  if (!match) {
    throw new Error(`Missing CSS rule for ${selector}`);
  }
  return match[1];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("layout skin CSS", () => {
  it("defines base device-shell framing hooks", () => {
    expect(rule(".device-shell")).toContain("position: relative;");
    expect(rule(".device-shell")).toContain("isolation: isolate;");
    expect(rule(".device-shell__plate")).toContain("display: inline-grid;");
    expect(rule(".device-shell__handle")).toContain("position: absolute;");
    expect(rule(".device-shell__vent")).toContain("min-height: 4px;");
    expect(rule(".device-shell__foot")).toContain("position: absolute;");
    expect(rule(".device-shell__split-rail")).toContain("position: absolute;");
    expect(rule(".device-shell__arc-platter")).toContain("border-radius: 50%;");
    expect(rule(".device-shell__standoff")).toContain("border-radius: 999px;");
    expect(rule(".device-shell__rack-ear")).toContain("position: absolute;");
    expect(rule(".device-shell__molding")).toContain("position: absolute;");
    expect(rule(".device-module")).toContain("grid-template-rows: auto minmax(0, 1fr);");
    expect(rule(".device-module__trim")).toContain("min-height: 8px;");
    expect(rule(".device-module__rivet")).toContain("border-radius: 999px;");
    expect(rule(".device-module__body")).toContain("min-height: 0;");
    expect(rule(".device-module__label")).toContain("letter-spacing: 0.18em;");
  });

  it("defines distinct shell variables for the five built-in skins", () => {
    expect(rule(".skin-layout--classic-blue-silver")).toContain("--shell-edge: rgba(226, 237, 249, 0.72);");
    expect(rule(".skin-layout--dark-vinyl")).toContain("--shell-edge: rgba(113, 245, 196, 0.28);");
    expect(rule(".skin-layout--transparent-crystal")).toContain("--shell-edge: rgba(224, 250, 255, 0.5);");
    expect(rule(".skin-layout--metal-rack")).toContain("--shell-edge: rgba(250, 204, 21, 0.34);");
    expect(rule(".skin-layout--warm-wood")).toContain("--shell-edge: rgba(255, 228, 184, 0.34);");
  });

  it("defines skin-specific silhouette hardware hooks", () => {
    expect(rule(".device-shell__center-seam")).toContain("height: 8px;");
    expect(rule(".device-shell__arc-rail")).toContain("border-radius: 999px 999px 28px 28px;");
    expect(rule(".device-shell__glass-bracket")).toContain("backdrop-filter: blur(16px);");
    expect(rule(".device-shell__rack-rail")).toContain("height: 10px;");
    expect(rule(".device-shell__brass-plaque")).toContain("justify-content: center;");
  });

  it("defines skin-specific module compartment framing hooks", () => {
    expect(rule(".device-module--classic-playlist::before")).toContain("width: 16px;");
    expect(rule(".device-module--vinyl-playlist::before")).toContain("width: 4px;");
    expect(rule(".device-module--crystal-playlist")).toContain("transform: translateY(10px);");
    expect(rule(".device-module--rack-playlist::before")).toContain("width: 18px;");
    expect(rule(".device-module--wood-playlist::before")).toContain("inset: 14px;");
  });

  it("defines skin-specific title-cabin and feature-bay framing hooks", () => {
    expect(rule(".skin-title--classic::before")).toContain("width: 120px;");
    expect(rule(".skin-title--vinyl::after")).toContain("border-radius: 999px;");
    expect(rule(".skin-title--crystal::before")).toContain("backdrop-filter: blur(16px);");
    expect(rule(".device-module--rack-feature::before")).toContain("width: 18px;");
    expect(rule(".device-module--wood-feature::before")).toContain("inset: 12px;");
  });

  it("defines skin-specific control console framing hooks", () => {
    expect(rule(".device-module--classic-controls::before")).toContain("height: 12px;");
    expect(rule(".device-module--vinyl-controls::before")).toContain("border-radius: 999px 999px 26px 26px;");
    expect(rule(".device-module--crystal-controls")).toContain("transform: translateY(6px);");
    expect(rule(".device-module--rack-controls")).toContain("border-radius: 14px;");
    expect(rule(".device-module--wood-controls::before")).toContain("inset: 12px;");
  });

  it("defines skin-specific display window framing hooks", () => {
    expect(rule(".device-module--classic-status::before")).toContain("height: 10px;");
    expect(rule(".device-module--vinyl-visualization::before")).toContain("border-radius: 999px;");
    expect(rule(".device-module--crystal-status::before")).toContain("backdrop-filter: blur(16px);");
    expect(rule(".device-module--rack-visualization::before")).toContain("width: 16px;");
    expect(rule(".device-module--wood-visualization::before")).toContain("inset: 12px;");
  });

  it("defines skin-specific surface primitive hooks", () => {
    expect(rule(".device-shell--classic .track-item")).toContain("border-radius: 16px;");
    expect(rule(".device-shell--vinyl .track-item")).toContain("border-radius: 999px;");
    expect(rule(".device-shell--crystal .track-item")).toContain("backdrop-filter: blur(14px);");
    expect(rule(".device-shell--rack .track-item")).toContain("border-radius: 8px;");
    expect(rule(".device-shell--wood .track-item")).toContain("border-radius: 18px;");
    expect(rule(".skin-layout .ghost-button:focus-visible")).toContain("box-shadow: 0 0 0 2px");
  });

  it("defines skin-specific interior panel card hooks", () => {
    expect(rule(".device-shell--classic .skin-card")).toContain("grid-template-rows: auto minmax(0, 1fr) auto auto;");
    expect(rule(".device-shell--vinyl .skin-card__actions")).toContain("grid-template-columns: 1fr;");
    expect(rule(".device-shell--crystal .skin-card__frame::before")).toContain("backdrop-filter: blur(16px);");
    expect(rule(".device-shell--rack .settings-panel__field::before")).toContain("width: 14px;");
    expect(rule(".device-shell--wood .tag-editor__field::before")).toContain("inset: 10px;");
  });

  it("defines skin-specific signal readout hooks", () => {
    expect(rule(".device-shell--classic .lyric-line::before")).toContain("width: 56px;");
    expect(rule(".device-shell--vinyl .visualization-preview--panel")).toContain("border-radius: 999px;");
    expect(rule(".device-shell--crystal .eq-band-card::before")).toContain("backdrop-filter: blur(16px);");
    expect(rule(".device-shell--rack .equalizer-panel__toggle::before")).toContain("width: 14px;");
    expect(rule(".device-shell--wood .lyric-line::before")).toContain("inset: 10px;");
  });

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

  it("defines skin-specific native control residue hooks", () => {
    expect(rule('.device-shell--classic .equalizer-panel__toggle input[type="checkbox"]')).toContain("border-radius: 10px;");
    expect(rule(".device-shell--vinyl .track-list")).toContain("scrollbar-color: rgba(113, 245, 196, 0.52) rgba(255, 255, 255, 0.04);");
    expect(rule(".device-shell--crystal .feature-content::-webkit-scrollbar-thumb")).toContain("backdrop-filter: blur(10px);");
    expect(rule(".device-shell--rack .playlist-action-button:disabled")).toContain("border-style: dashed;");
    expect(rule(".device-shell--wood .lyrics-panel__viewport")).toContain("scrollbar-color: rgba(210, 150, 82, 0.66) rgba(54, 28, 14, 0.28);");
  });

  it("defines shared hardwareized notice layer hooks", () => {
    expect(rule(".skin-layout .empty-state")).toContain("min-height: 76px;");
    expect(rule(".skin-layout .error-text")).toContain("border-color: rgba(255, 118, 118, 0.48);");
    expect(rule(".skin-layout .skin-manager__note")).toContain("padding: 12px 14px 12px 42px;");
    expect(rule(".skin-layout .empty-state::before")).toContain("width: 16px;");
    expect(rule(".skin-layout .error-text::before")).toContain("background: linear-gradient(180deg, #ff8a8a, #c92828);");
    expect(rule(".skin-layout .skin-manager__note::before")).toContain("border-radius: 4px;");
  });

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

  it("keeps feature panels usable and decorative notice markers click-through", () => {
    expect(rule(".skin-layout .playlist-panel")).toContain("grid-template-rows: auto auto auto minmax(0, 1fr);");
    expect(rule(".skin-layout .playlist-actions")).toContain("flex-wrap: nowrap;");
    expect(rule(".skin-layout .playlist-action-button")).toContain("min-height: 38px;");
    expect(rule(".skin-layout .playlist-panel .empty-state")).toContain("min-height: 46px;");
    expect(rule(".skin-layout .feature-sidebar")).toContain("grid-template-rows: auto minmax(0, 1fr);");
    expect(rule(".skin-layout .feature-content")).toContain("overflow: auto;");
    expect(rule(".skin-layout .feature-tabs")).toContain("display: flex;");
    expect(rule(".skin-layout .feature-tabs")).toContain("flex-wrap: nowrap;");
    expect(rule(".feature-tab")).toContain("min-width: 104px;");
    expect(rule(".skin-layout button")).toContain("cursor: pointer;");
    expect(rule(".skin-layout .empty-state::before")).toContain("pointer-events: none;");
    expect(rule(".skin-layout .error-text::before")).toContain("pointer-events: none;");
    expect(rule(".skin-layout .skin-manager__note::before")).toContain("pointer-events: none;");
  });

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

  it("defines skin manager library card usability hooks", () => {
    expect(rule(".skin-layout .skin-manager")).toContain("grid-template-rows: auto minmax(0, 1fr);");
    expect(rule(".skin-manager__grid")).toContain("overflow-x: auto;");
    expect(rule(".skin-layout .skin-card")).toContain("flex: 0 0 176px;");
    expect(rule(".skin-layout .skin-card")).toContain("grid-template-rows: minmax(54px, 0.8fr) auto auto;");
    expect(rule(".skin-manager .eyebrow")).toContain("display: none;");
    expect(rule(".skin-layout .skin-manager__grid .skin-card")).toContain("height: 46px;");
    expect(rule(".skin-manager__grid .skin-card__preview-button")).toContain("grid-template-columns: 28px minmax(0, 1fr);");
    expect(rule(".skin-card__preview-button")).toContain("cursor: pointer;");
    expect(rule(".skin-card__preview-button")).toContain("text-align: left;");
    expect(rule(".skin-card__preview-button:hover")).toContain("border-color:");
    expect(rule(".skin-card__preview-button:focus-visible")).toContain("outline: none;");
    expect(rule(".skin-card.is-previewing")).toContain("border-color:");
    expect(rule(".skin-card__frame")).toContain("min-height: 54px;");
    expect(rule(".skin-card__name")).toContain("font-size: 1rem;");
    expect(rule(".skin-card__apply-button")).toContain("min-height: 38px;");
    expect(rule(".skin-card__apply-button:disabled")).toContain("cursor: default;");
  });

  it("preserves fixed shell and internal scroll zones", () => {
    expect(rule(".skin-chrome")).toContain("height: calc(100vh - 24px);");
    expect(rule(".skin-chrome")).toContain("overflow: hidden;");
    expect(rule(".skin-grid")).toContain("overflow: hidden;");
    expect(rule(".vinyl-side-rail")).toContain("overflow: hidden;");
    expect(rule(".wood-liner-notes")).toContain("overflow: hidden;");
  });

  it("keeps the narrow layout stack inside the shell", () => {
    expect(css).toContain("@media (max-width: 760px)");
    expect(css).toContain(".skin-grid--classic");
    expect(css).toContain("grid-template-columns: 1fr;");
  });

  it("styles the control deck with transport buttons, progress rail, and volume well hooks", () => {
    expect(css).toContain(".transport-button");
    expect(css).toContain(".progress-rail");
    expect(css).toContain(".volume-well");
    expect(css).toContain(".play-mode-button--deck");
    expect(css).toContain(".transport-status-strip");
    expect(css).toContain(".transport-status-light");
    expect(css).toContain(".control-monitor");
  });

  it("styles the now-playing display and playlist drawer hooks", () => {
    expect(css).toContain(".now-playing-display");
    expect(css).toContain(".cover-card__hub");
    expect(css).toContain(".track-index");
    expect(css).toContain(".playlist-panel__counter");
    expect(css).toContain(".playlist-panel__status");
    expect(css).toContain(".playlist-action-button");
    expect(css).toContain(".track-flag");
  });

  it("styles the title control cabin and feature bay hooks", () => {
    expect(css).toContain(".title-status-cluster");
    expect(css).toContain(".title-action-button");
    expect(css).toContain(".feature-tab__slot");
    expect(css).toContain(".settings-panel__status");
    expect(css).toContain(".settings-panel__field");
    expect(css).toContain(".app-title__model");
  });

  it("styles the interior feature-panel hardware hooks", () => {
    expect(css).toContain(".lyrics-panel__status");
    expect(css).toContain(".lyric-line__stamp");
    expect(css).toContain(".visualization-mode-button");
    expect(css).toContain(".visualization-panel__meter");
    expect(css).toContain(".equalizer-panel__status");
    expect(css).toContain(".equalizer-preset");
    expect(css).toContain(".eq-band-card");
    expect(css).toContain(".tag-editor__status");
    expect(css).toContain(".tag-editor__field");
    expect(css).toContain(".skin-manager__status");
    expect(css).toContain(".skin-card__machine-id");
  });
});
