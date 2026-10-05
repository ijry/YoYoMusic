import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/styles/app.css"), "utf8").replace(/\r\n/g, "\n");

function rule(selector: string) {
  const match = css.match(new RegExp(`${escapeRegExp(selector)}\\s*\\{([\\s\\S]*?)\\}`));
  if (!match) throw new Error(`Missing CSS rule for ${selector}`);
  return match[1];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("modern player layout CSS", () => {
  it("locks the app root to the viewport instead of document scrolling", () => {
    const rootRule = rule("html,\nbody,\n#root");

    expect(rootRule).toContain("height: 100%;");
    expect(rootRule).toContain("overflow: hidden;");
  });

  it("keeps the frame in fixed top / body / transport zones", () => {
    expect(rule(".chrome")).toContain("grid-template-rows: auto minmax(0, 1fr) auto;");
    expect(rule(".chrome")).toContain("height: calc(100vh - 24px);");
    expect(rule(".chrome")).toContain("backdrop-filter: blur(var(--glass-blur)) saturate(150%);");
    // The error banner is conditional, so it floats rather than owning a row.
    expect(rule(".app-error-banner")).toContain("position: absolute;");
    expect(rule(".playlist-panel")).toContain("grid-template-rows: auto auto minmax(0, 1fr);");
    expect(rule(".track-list")).toContain("overflow: auto;");
    expect(rule(".feature-content")).toContain("overflow: auto;");
  });

  it("switches the column template with the collapsible panels", () => {
    expect(rule(".modern-grid")).toContain(
      "grid-template-columns: var(--library-col) minmax(0, 1fr) var(--inspector-col);",
    );
    // The library column leaves the DOM when hidden, so the template must
    // drop a track with it or the remaining panels shift left.
    expect(rule('.modern-grid[data-library="closed"]')).toContain(
      "grid-template-columns: minmax(0, 1fr) var(--inspector-col);",
    );
    expect(rule('.modern-grid[data-inspector="open"]')).toContain("var(--inspector-open-col)");
    expect(rule('.modern-grid[data-library="closed"][data-inspector="open"]')).toContain(
      "grid-template-columns: minmax(0, 1fr) var(--inspector-open-col);",
    );
  });

  it("collapses the feature inspector to a vertical icon rail", () => {
    expect(rule(".feature-rail")).toContain("flex-direction: column;");
    expect(rule(".feature-rail")).toContain("order: 2;");
    expect(rule(".feature-drawer")).toContain("order: 1;");
    expect(rule(".feature-drawer")).toContain("grid-template-rows: auto minmax(0, 1fr);");
    expect(rule(".feature-tab")).toContain("width: 44px;");
    expect(rule(".feature-drawer__close")).toContain("border-radius: 9px;");
  });

  it("gives the visualiser a real box to draw into", () => {
    expect(rule(".viz-stage")).toContain("position: absolute;");
    expect(rule(".audio-visualizer__canvas")).toContain("width: 100%;");
    expect(rule(".audio-visualizer--panel")).toContain("min-height: 190px;");
    expect(rule(".viz-switcher__chip[aria-pressed=\"true\"]")).toContain("linear-gradient(135deg");
  });

  it("styles the transport deck and its progress rail", () => {
    expect(rule(".transport-button--play")).toContain("width: 52px;");
    expect(rule(".progress-rail")).toContain("var(--progress, 0%)");
    expect(rule(".volume-input")).toContain("text-align: center;");
    expect(rule(".control-label")).toContain("clip-path: inset(50%);");
  });

  it("styles the modern playlist rows and generated cover art", () => {
    expect(rule(".track-item")).toContain("border-radius: var(--radius-md);");
    expect(rule(".track-eq i")).toContain("animation: eq-bounce");
    expect(rule(".cover-art")).toContain("var(--cover-a, var(--skin-primary))");
    expect(rule(".cover-art.is-playing .cover-art__disc")).toContain("animation: disc-spin");
  });

  it("honours reduced motion", () => {
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });

  it("keeps the narrow layout stack inside the shell", () => {
    expect(css).toContain("@media (max-width: 900px)");
    expect(rule(".modern-grid")).toContain("grid-template-columns:");
  });
});
