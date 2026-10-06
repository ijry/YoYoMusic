import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/styles/app.css"), "utf8").replace(/\r\n/g, "\n");

/*
 * Comments are stripped before parsing. A `/* ... *\/` banner carries no
 * braces, so a naive `([^{}]+)\{` swallows it into the following selector —
 * turning `.chrome` into `---- *\/\n\n.chrome` and making the rule unfindable.
 */
const cssWithoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");

/**
 * Returns the body of the CSS rule for `selector`.
 *
 * A selector can appear in more than one block: shared "base" rules list it
 * alongside siblings (`.a, .b, .c { ... }`) and carry only the common
 * declarations. The *standalone* block is the one holding that selector's own
 * metrics, so it wins — otherwise `rule(".feature-tab")` would return the
 * grouped base and miss the `width` the assertion is looking for.
 */
function rule(selector: string) {
  const blocks = [...cssWithoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selectors: match[1].split(",").map((part) => part.trim()),
    body: match[2],
  }));

  // A comma-joined request (e.g. `html,\nbody,\n#root`) asks for that exact group.
  const wanted = selector.split(",").map((part) => part.trim()).filter(Boolean);
  const exact = blocks.find((block) => block.selectors.join(",") === wanted.join(","));
  if (exact) return exact.body;

  const candidates = blocks.filter((block) => block.selectors.includes(selector));
  if (candidates.length === 0) throw new Error(`Missing CSS rule for ${selector}`);

  return (candidates.find((block) => block.selectors.length === 1) ?? candidates[0]).body;
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

  describe("window chrome buttons", () => {
    it("shares one base across the top bar, window controls and the rail", () => {
      // These three groups used to carry unrelated metrics (36/32/44px boxes,
      // 12/8/14px radii) and two hover treatments, so the same window looked
      // like three toolkits. The grouped base is what keeps them in step.
      const base = rule(".title-action-button,\n.window-button,\n.feature-tab");
      expect(base).toContain("display: grid;");
      expect(base).toContain("border: 1px solid transparent;");
      expect(base).toContain("transition:");
    });

    it("matches the top-bar actions and the window controls in size", () => {
      expect(rule(".title-action-button")).toContain("width: 36px;");
      expect(rule(".title-action-button")).toContain("border-radius: 12px;");
      expect(rule(".window-button")).toContain("width: 36px;");
      expect(rule(".window-button")).toContain("border-radius: 12px;");
    });

    it("keeps only the close button's hover destructive", () => {
      expect(rule(".window-button--close:hover")).toContain("background: #e5484d;");
    });

    it("styles the toggled-on state identically everywhere", () => {
      // The playlist toggle set `aria-pressed` with no styling at all, so it
      // gave no feedback while the rail buttons lit up.
      const active = rule('.title-action-button[aria-pressed="true"],\n.feature-tab[aria-pressed="true"]');
      expect(active).toContain("linear-gradient(135deg");
      expect(active).toContain("box-shadow: var(--shadow-glow);");
    });

    it("separates app actions from the OS window controls", () => {
      expect(rule(".title-actions__divider")).toContain("width: 1px;");
    });

    it("sizes the mini player's own buttons to match the close button beside them", () => {
      // The close button lives in that row, so a 32px neighbour would read as
      // unfinished.
      expect(rule(".mini-icon-button")).toContain("width: 36px;");
      expect(rule(".mini-icon-button")).toContain("border-radius: 12px;");
    });
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
    expect(rule(".control-label")).toContain("clip-path: inset(50%);");
  });

  it("floats the volume popover so it escapes the panel's overflow clip", () => {
    // Every `.modern-panel` sets `overflow: hidden` so its content cannot spill
    // past the rounded corners. The popover is portalled to <body> and
    // fixed-positioned, so neither the clip nor the deck's height can affect it.
    expect(rule(".volume-popover")).toContain("position: fixed;");
    const volumeControl = readFileSync(
      join(process.cwd(), "src/features/player/VolumeControl.tsx"),
      "utf8",
    ).replace(/\r\n/g, "\n");
    expect(volumeControl).toContain("createPortal(");
    // Shares the progress rail's fill language.
    expect(rule(".volume-slider")).toContain("var(--progress, 0%)");
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
