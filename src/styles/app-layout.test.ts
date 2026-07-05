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

describe("fixed workbench layout CSS", () => {
  it("locks the app root to the viewport instead of document scrolling", () => {
    const rootRule = rule("html,\nbody,\n#root");

    expect(rootRule).toContain("height: 100%;");
    expect(rootRule).toContain("overflow: hidden;");
  });

  it("keeps chrome, playlist, feature panel, and controls in fixed workbench zones", () => {
    expect(rule(".chrome")).toContain("grid-template-rows: auto minmax(0, 1fr) auto;");
    expect(rule(".chrome")).toContain("height: calc(100vh - 24px);");
    expect(rule(".workspace")).toContain(
      "grid-template-columns: minmax(260px, 0.85fr) minmax(320px, 1.15fr) minmax(280px, 0.95fr);",
    );
    expect(rule(".playlist-panel")).toContain("grid-template-rows: auto auto minmax(0, 1fr);");
    expect(rule(".track-list")).toContain("overflow: auto;");
    expect(rule(".feature-content")).toContain("overflow: auto;");
    expect(rule(".player-controls")).toContain("grid-row: 3;");
  });
});
