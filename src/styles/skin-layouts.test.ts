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

describe("modern skin palettes", () => {
  it("keeps the skin root contained and isolated", () => {
    expect(rule(".skin-layout")).toContain("height: 100%;");
    expect(rule(".skin-layout")).toContain("overflow: hidden;");
    expect(rule(".skin-layout")).toContain("isolation: isolate;");
  });

  it("defines a distinct accent and visualiser palette per skin", () => {
    const aurora = rule(".skin-layout--aurora-glass");
    expect(aurora).toContain("--skin-primary: #8b5cf6;");
    expect(aurora).toContain("--skin-accent: #22d3ee;");
    expect(aurora).toContain("--viz-a: #a78bfa;");
    expect(aurora).toContain("--viz-b: #22d3ee;");

    expect(rule(".skin-layout--midnight-neon")).toContain("--skin-primary: #ff2d95;");
    expect(rule(".skin-layout--sunset-blaze")).toContain("--skin-accent: #ffc857;");
    expect(rule(".skin-layout--mint-studio")).toContain("--skin-primary: #14e0a8;");
  });

  it("drives the canvas, surface and ink tokens from the skin", () => {
    const neon = rule(".skin-layout--midnight-neon");
    expect(neon).toContain("--skin-canvas: #0a0616;");
    expect(neon).toContain("--skin-canvas-deep: #05030c;");
    expect(neon).toContain("--skin-ink: #0a0616;");
    expect(neon).toContain("--color-surface:");
  });

  it("gives every built-in thumbnail its own literal gradient", () => {
    expect(rule(".skin-thumbnail--aurora-glass span")).toContain("linear-gradient(160deg, #a78bfa, #22d3ee)");
    expect(rule(".skin-thumbnail--midnight-neon span")).toContain("linear-gradient(160deg, #ff5fb0, #8b6cff)");
    expect(rule(".skin-thumbnail--sunset-blaze span")).toContain("linear-gradient(160deg, #ff9457, #ffd166)");
    expect(rule(".skin-thumbnail--mint-studio span")).toContain("linear-gradient(160deg, #34e5b5, #4fb4ff)");
  });
});
