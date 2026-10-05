import type { CSSProperties } from "react";

interface CoverArtProps {
  /** Track id — drives the generated gradient, stable across sessions. */
  seed: string;
  title?: string;
  isPlaying?: boolean;
  className?: string;
}

/*
 * Generated cover art.
 *
 * The Rust core exposes `coverArtRef` as an opaque reference and the webview
 * has no asset protocol wired up, so real artwork is not available yet. Until
 * it is, each track gets a deterministic gradient derived from its id —
 * distinct per song, and it feeds the skin's glow.
 */
export function CoverArt({ seed, title, isPlaying = false, className }: CoverArtProps) {
  const classes = ["cover-art", isPlaying ? "is-playing" : "", className].filter(Boolean).join(" ");

  return (
    <div className={classes} style={coverStyle(seed)} aria-hidden="true">
      <span className="cover-art__aura" />
      <span className="cover-art__disc" />
      <span className="cover-art__glyph">{title ? firstGlyph(title) : "♪"}</span>
    </div>
  );
}

export function coverStyle(seed: string): CSSProperties {
  const hash = seedHash(seed || "yoyomusic");
  const hue = hash % 360;
  const hueTwo = (hue + 48 + ((hash >> 8) % 72)) % 360;

  return {
    "--cover-a": `hsl(${hue} 82% 62%)`,
    "--cover-b": `hsl(${hueTwo} 86% 48%)`,
  } as CSSProperties;
}

export function formatDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function seedHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function firstGlyph(value: string) {
  return Array.from(value.trim())[0] ?? "♪";
}
