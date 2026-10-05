import { describe, expect, it } from "vitest";
import {
  DEFAULT_DESKTOP_LYRICS_THEME,
  clampLyricsFontScale,
  desktopLyricsThemes,
  resolveDesktopLyricsTheme,
} from "./desktopLyricsTheme";

describe("desktopLyricsTheme", () => {
  it("exposes uniquely-identified presets", () => {
    const ids = desktopLyricsThemes.map((theme) => theme.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain(DEFAULT_DESKTOP_LYRICS_THEME);
  });

  it("gives every preset a plate-free or opaque plate, never a stray colour", () => {
    for (const theme of desktopLyricsThemes) {
      expect(theme.plate === "transparent" || theme.plate.startsWith("rgba(")).toBe(true);
      expect(theme.ink.startsWith("#")).toBe(true);
      expect(theme.glow.startsWith("rgba(")).toBe(true);
    }
  });

  it("falls back to the default for an unknown id from an older settings file", () => {
    expect(resolveDesktopLyricsTheme("does-not-exist").id).toBe(DEFAULT_DESKTOP_LYRICS_THEME);
    expect(resolveDesktopLyricsTheme(null).id).toBe(DEFAULT_DESKTOP_LYRICS_THEME);
    expect(resolveDesktopLyricsTheme(undefined).id).toBe(DEFAULT_DESKTOP_LYRICS_THEME);
  });

  it("clamps the font scale into the slider range", () => {
    expect(clampLyricsFontScale(0.1)).toBe(0.6);
    expect(clampLyricsFontScale(9)).toBe(2.4);
    expect(clampLyricsFontScale(Number.NaN)).toBe(1);
    expect(clampLyricsFontScale(1.4)).toBe(1.4);
  });
});
