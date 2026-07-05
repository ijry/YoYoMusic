import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/styles/skin-layouts.css"), "utf8").replace(/\r\n/g, "\n");

function rule(selector: string) {
  const match = css.match(new RegExp(`${escapeRegExp(selector)}\\s*\\{([\\s\\S]*?)\\}`));
  if (!match) throw new Error(`Missing CSS rule for ${selector}`);
  return match[1];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

describe("layout skin CSS", () => {
  it("defines all five built-in layout skin roots", () => {
    expect(rule(".skin-layout--classic-blue-silver")).toContain("--skin-primary: #6f8fb8;");
    expect(rule(".skin-layout--dark-vinyl")).toContain("--skin-primary: #d8dde8;");
    expect(rule(".skin-layout--transparent-crystal")).toContain("--skin-primary: #7dd3fc;");
    expect(rule(".skin-layout--metal-rack")).toContain("--skin-primary: #facc15;");
    expect(rule(".skin-layout--warm-wood")).toContain("--skin-primary: #f3b56b;");
  });

  it("gives the five skins different layout structures", () => {
    expect(rule(".skin-grid--classic")).toContain(
      "grid-template-columns: minmax(260px, 0.82fr) minmax(320px, 1.18fr) minmax(280px, 0.9fr);",
    );
    expect(rule(".skin-grid--vinyl")).toContain("grid-template-columns: minmax(0, 1.25fr) minmax(300px, 0.75fr);");
    expect(rule(".skin-grid--crystal")).toContain("grid-template-columns: minmax(260px, 0.85fr) minmax(320px, 1.15fr);");
    expect(rule(".skin-grid--rack")).toContain("grid-template-rows: minmax(0, 1.1fr) minmax(180px, 0.72fr);");
    expect(rule(".skin-grid--wood")).toContain("grid-template-columns: minmax(320px, 1fr) minmax(320px, 1fr);");
  });

  it("preserves fixed shell and internal scroll zones", () => {
    expect(rule(".skin-chrome")).toContain("height: calc(100vh - 24px);");
    expect(rule(".skin-chrome")).toContain("overflow: hidden;");
    expect(rule(".skin-grid")).toContain("overflow: hidden;");
    expect(rule(".vinyl-side-rail")).toContain("overflow: hidden;");
    expect(rule(".wood-liner-notes")).toContain("overflow: hidden;");
  });
});
