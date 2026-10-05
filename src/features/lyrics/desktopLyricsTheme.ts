/*
 * Desktop-lyrics appearance presets.
 *
 * The window is transparent and always-on-top, so the theme is expressed as the
 * handful of properties that actually read against arbitrary wallpaper:
 * text colour, outline strength, background tint and size. Keeping it to a small
 * enum (rather than free colour pickers) means every preset is guaranteed
 * legible — the outline is what keeps white text readable on a white desktop.
 */

export type DesktopLyricsThemeId = "aurora" | "sunset" | "mint" | "ink" | "candy";

export interface DesktopLyricsTheme {
  id: DesktopLyricsThemeId;
  name: string;
  /** Lyric text colour. */
  ink: string;
  /** Glow / outline colour. */
  glow: string;
  /** Optional plate behind the text; `transparent` means no plate at all. */
  plate: string;
  /** Secondary line (track title) colour. */
  muted: string;
  swatch: string;
}

export const desktopLyricsThemes: DesktopLyricsTheme[] = [
  {
    id: "aurora",
    name: "极光",
    ink: "#f4f7ff",
    glow: "rgba(90, 200, 250, 0.85)",
    plate: "rgba(12, 18, 32, 0.42)",
    muted: "rgba(226, 240, 255, 0.72)",
    swatch: "linear-gradient(135deg, #5ac8fa, #a78bfa)",
  },
  {
    id: "sunset",
    name: "熔金",
    ink: "#fff6e8",
    glow: "rgba(255, 168, 76, 0.9)",
    plate: "rgba(48, 20, 8, 0.46)",
    muted: "rgba(255, 226, 194, 0.76)",
    swatch: "linear-gradient(135deg, #ffb347, #ff5f6d)",
  },
  {
    id: "mint",
    name: "薄荷",
    ink: "#eafff7",
    glow: "rgba(94, 234, 212, 0.85)",
    plate: "rgba(6, 34, 32, 0.42)",
    muted: "rgba(214, 255, 244, 0.72)",
    swatch: "linear-gradient(135deg, #5eead4, #34d399)",
  },
  {
    id: "ink",
    name: "水墨",
    ink: "#f6f6f4",
    glow: "rgba(0, 0, 0, 0.92)",
    plate: "transparent",
    muted: "rgba(240, 240, 236, 0.62)",
    swatch: "linear-gradient(135deg, #f6f6f4, #8a8a86)",
  },
  {
    id: "candy",
    name: "糖果",
    ink: "#fff0fb",
    glow: "rgba(244, 114, 182, 0.88)",
    plate: "rgba(40, 8, 32, 0.42)",
    muted: "rgba(255, 214, 240, 0.75)",
    swatch: "linear-gradient(135deg, #f472b6, #c084fc)",
  },
];

export const DEFAULT_DESKTOP_LYRICS_THEME: DesktopLyricsThemeId = "aurora";

export function resolveDesktopLyricsTheme(id: string | null | undefined): DesktopLyricsTheme {
  return (
    desktopLyricsThemes.find((theme) => theme.id === id) ??
    desktopLyricsThemes.find((theme) => theme.id === DEFAULT_DESKTOP_LYRICS_THEME)!
  );
}

/** Clamp helper for the font-size slider, persisted in `AppSettings`. */
export function clampLyricsFontScale(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(2.4, Math.max(0.6, value));
}
