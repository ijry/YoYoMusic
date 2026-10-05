import {
  Activity,
  Aperture,
  AreaChart,
  AudioLines,
  BarChart3,
  Disc3,
  FilePlus,
  FolderPlus,
  ListMusic,
  Minimize2,
  Palette,
  PanelLeft,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Settings,
  Shuffle,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  Tags,
  Trash2,
  Type,
  Volume2,
  VolumeX,
  Waves,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/*
 * Shared icon vocabulary.
 *
 * One import site keeps stroke width and sizing consistent across features.
 * Icons are always decorative (`aria-hidden`) — the accessible name belongs on
 * the surrounding button's `aria-label`, so screen readers and the existing
 * `getByRole("button", { name: ... })` tests keep working.
 */

const SIZE = 18;
const STROKE = 1.9;

export interface IconProps {
  size?: number;
  strokeWidth?: number;
}

function glyph(Component: LucideIcon) {
  return function IconGlyph({ size = SIZE, strokeWidth = STROKE }: IconProps = {}) {
    return <Component size={size} strokeWidth={strokeWidth} aria-hidden focusable={false} />;
  };
}

export const Icon = {
  play: glyph(Play),
  pause: glyph(Pause),
  prev: glyph(SkipBack),
  next: glyph(SkipForward),
  volume: glyph(Volume2),
  muted: glyph(VolumeX),
  sequence: glyph(AudioLines),
  repeatAll: glyph(Repeat),
  repeatOne: glyph(Repeat1),
  shuffle: glyph(Shuffle),
  lyrics: glyph(Type),
  visualization: glyph(AudioLines),
  tags: glyph(Tags),
  equalizer: glyph(SlidersHorizontal),
  skin: glyph(Palette),
  settings: glyph(Settings),
  mini: glyph(Minimize2),
  desktopLyrics: glyph(ListMusic),
  addFiles: glyph(FilePlus),
  addFolder: glyph(FolderPlus),
  clear: glyph(Trash2),
  remove: glyph(X),
  disc: glyph(Disc3),
  panelLeft: glyph(PanelLeft),

  /* Visualiser mode glyphs. */
  vizSpectrum: glyph(BarChart3),
  vizWaveform: glyph(Activity),
  vizRadial: glyph(Aperture),
  vizParticles: glyph(Sparkles),
  vizAurora: glyph(Waves),
  vizWaterfall: glyph(AreaChart),
};

export type IconName = keyof typeof Icon;
