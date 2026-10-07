import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/*
 * Guards the text colour used on the skin gradient.
 *
 * Every skin accent in this project is light — `#22d3ee`, `#ffc857`, `#14e0a8` —
 * so white text on them measured as low as 1.54 : 1. The `--skin-ink` token
 * (`#08090f`) is what the design already uses for text on a skin-coloured
 * surface, and it clears 4.5 : 1 (WCAG AA) against every accent in all four
 * built-in skins: 4.57 : 1 at worst, against 午夜霓虹's `#7c5cff`.
 *
 * This reads the stylesheet as text rather than parsing it, so it pulls in no
 * dependency. It is not a full CSS parser — it is enough for the one rule it
 * enforces: a rule that paints a skin gradient behind its own text must not
 * also set that text to white.
 */

const APP_CSS = path.resolve(__dirname, "app.css");
const SKIN_LAYOUTS_CSS = path.resolve(__dirname, "skin-layouts.css");
const THEME_CSS = path.resolve(__dirname, "theme.css");

/** Splits a stylesheet into top-level rules, ignoring nested at-rule blocks. */
function* rules(source: string): Generator<{ selector: string; body: string }> {
  // Strip comments so a commented-out declaration cannot trip the check.
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
  let depth = 0;
  let start = 0;
  let selector = "";

  for (let index = 0; index < withoutComments.length; index += 1) {
    const char = withoutComments[index];

    if (char === "{") {
      if (depth === 0) selector = withoutComments.slice(start, index).trim();
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        const bodyStart = withoutComments.indexOf("{", start);
        yield { selector, body: withoutComments.slice(bodyStart + 1, index) };
        start = index + 1;
      }
    }
  }
}

/** A declaration's value, ignoring `!important`. */
function declaration(body: string, property: string): string | null {
  const pattern = new RegExp(`(?:^|[;{])\\s*${property}\\s*:([^;}]+)`, "i");
  return body.match(pattern)?.[1]?.trim() ?? null;
}

interface Rule {
  selector: string;
  body: string;
  background: string;
  color: string;
}

function readRules(): Rule[] {
  const source = readFileSync(APP_CSS, "utf8");
  const out: Rule[] = [];

  for (const { selector, body } of rules(source)) {
    // Selectors at this level only; skip keyframe steps and at-rule preludes.
    if (!/^[.#[:a-zA-Z]/.test(selector)) continue;

    const background = declaration(body, "background") ?? declaration(body, "background-image") ?? "";
    const color = declaration(body, "color") ?? "";

    out.push({ selector, body, background, color });
  }

  return out;
}

/** Rules that paint the skin accent as an *opaque* gradient. */
function skinGradientRules(): Rule[] {
  return readRules().filter(
    (rule) =>
      /var\(--skin-(?:primary|accent)\)/.test(rule.background) &&
      /*
       * A translucent tint mentions the skin colour too, but it composits over
       * the dark panel — so light text on it is correct. Only a solid gradient
       * makes the background light enough to need dark text.
       */
      !/color-mix|transparent/.test(rule.background),
  );
}

describe("text on the skin gradient", () => {
  it("finds the rules this check is meant to cover", () => {
    // If the selector or gradient syntax ever changes shape, the assertions
    // below would vacuously pass. This makes that failure loud.
    const found = skinGradientRules();
    expect(found.length).toBeGreaterThanOrEqual(12);

    const selectors = found.map((rule) => rule.selector).join("\n");
    for (const expected of [
      ".track-flag--current",
      ".transport-button--play",
      ".visualization-panel__live",
      ".equalizer-preset",
      ".update-button--primary",
      ".title-action-button",
      ".feature-tab",
      ".volume-popover__mute",
      ".lyrics-desktop-toggle",
    ]) {
      expect(selectors, `${expected} should be covered by this check`).toContain(expected);
    }
  });

  it("never uses white text on it", () => {
    /*
     * White on these accents measures as low as 1.54 : 1. `--color-text` is
     * included because it is #f5f6fc, near enough to white to fail the same
     * way — and the first pass of this fix missed exactly that on the
     * title-bar, feature-rail, mute and desktop-lyrics pressed states.
     */
    const lightText = ["#fff", "#ffffff", "white", "rgb(255,255,255)"];
    for (const rule of skinGradientRules()) {
      const color = rule.color.toLowerCase().replace(/\s/g, "");
      expect(
        lightText.includes(color) || color.includes("--color-text"),
        `${rule.selector} paints the skin gradient and sets near-white text on it; use var(--skin-ink)`,
      ).toBe(false);
    }
  });

  it("uses the ink token wherever it sets a colour", () => {
    for (const rule of skinGradientRules()) {
      // Rules with no `color` inherit, or paint no text at all (a bar fill, a
      // range track, a checkbox) — nothing to enforce there.
      if (!rule.color) continue;
      expect(rule.color, `${rule.selector} should use the ink token`).toContain("--skin-ink");
    }
  });

  it("does not flag translucent tints, where light text is correct", () => {
    // Guards against the check being widened back into false positives: a
    // skin-coloured wash over the dark panel keeps its light text.
    const tints = readRules().filter(
      (rule) =>
        /var\(--skin-(?:primary|accent)\)/.test(rule.background) &&
        /color-mix|transparent/.test(rule.background),
    );

    expect(tints.length).toBeGreaterThan(0);
    for (const rule of skinGradientRules()) {
      expect(rule.background).not.toMatch(/color-mix|transparent/);
    }
  });
});

describe("the ink token itself", () => {
  /** WCAG relative luminance. */
  function luminance(hex: string): number {
    const value = hex.replace("#", "");
    const channels = [0, 2, 4].map((offset) => {
      const raw = parseInt(value.slice(offset, offset + 2), 16) / 255;
      return raw <= 0.03928 ? raw / 12.92 : Math.pow((raw + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  }

  function contrast(a: string, b: string): number {
    const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  }

  /*
   * Each skin declares its own `--skin-ink`, tuned to its own accents, so read
   * them rather than assuming one value fits all. The fallback in theme.css is
   * covered too, because surfaces outside a `.skin-layout` (mini player,
   * desktop lyrics) resolve against it.
   */
  function skinPalettes(): Array<{ name: string; primary: string; accent: string; ink: string }> {
    const source = readFileSync(SKIN_LAYOUTS_CSS, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const palettes: Array<{ name: string; primary: string; accent: string; ink: string }> = [];

    for (const match of source.matchAll(/(\.skin-layout--[\w-]+)\s*\{([\s\S]*?)\n\}/g)) {
      const [, selector, body] = match;
      const value = (property: string) =>
        body.match(new RegExp(`--skin-${property}:\\s*(#[0-9a-fA-F]{6})`))?.[1];
      const primary = value("primary");
      const accent = value("accent");
      const ink = value("ink");
      if (primary && accent && ink) palettes.push({ name: selector, primary, accent, ink });
    }

    const fallback = readFileSync(THEME_CSS, "utf8").match(/--skin-ink:\s*(#[0-9a-fA-F]{6})/)?.[1];
    if (fallback) {
      const primary = readFileSync(THEME_CSS, "utf8").match(/--color-primary:\s*(#[0-9a-fA-F]{6})/)?.[1];
      const accent = readFileSync(THEME_CSS, "utf8").match(/--color-accent:\s*(#[0-9a-fA-F]{6})/)?.[1];
      if (primary && accent) palettes.push({ name: "theme.css fallback", primary, accent, ink: fallback });
    }

    return palettes;
  }

  it("covers every built-in skin", () => {
    const palettes = skinPalettes();
    expect(palettes.length).toBeGreaterThanOrEqual(5);
    expect(palettes.map((p) => p.name).join()).toContain("skin-layout--aurora-glass");
    expect(palettes.map((p) => p.name).join()).toContain("theme.css fallback");
  });

  it("clears AA against every accent of its own skin", () => {
    for (const { name, primary, accent, ink } of skinPalettes()) {
      for (const [label, stop] of [["primary", primary], ["accent", accent]] as const) {
        const value = contrast(ink, stop);
        expect(
          value,
          `${name}: ink ${ink} on ${label} ${stop} is only ${value.toFixed(2)} : 1`,
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("is a better choice than white for every accent", () => {
    // The measurement that started this: white failed on all four skins.
    for (const { name, primary, accent, ink } of skinPalettes()) {
      for (const stop of [primary, accent]) {
        expect(
          contrast(ink, stop),
          `${name}: ink should beat white on ${stop}`,
        ).toBeGreaterThan(contrast("#ffffff", stop));
      }
    }
  });
});
