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
