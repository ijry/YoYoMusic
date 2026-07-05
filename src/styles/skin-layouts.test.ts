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
    expect(rule(".device-module")).toContain("grid-template-rows: auto minmax(0, 1fr);");
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
  });

  it("styles the now-playing display and playlist drawer hooks", () => {
    expect(css).toContain(".now-playing-display");
    expect(css).toContain(".cover-card__hub");
    expect(css).toContain(".track-index");
    expect(css).toContain(".playlist-panel__counter");
  });
});
