import {
  Activity,
  AlignLeft,
  Aperture,
  AreaChart,
  AudioWaveform,
  BarChart3,
  Disc3,
  Expand,
  FilePlus,
  FolderPlus,
  ListOrdered,
  Lock,
  Maximize2,
  Minimize,
  Minimize2,
  MousePointerClick,
  Palette,
  PanelLeft,
  Pause,
  PictureInPicture2,
  Play,
  RectangleHorizontal,
  Repeat,
  Repeat1,
  Settings,
  Shrink,
  Shuffle,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Sparkles,
  Tags,
  Trash2,
  Unlock,
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
 *
 * **One glyph, one meaning.** The same shape must never stand for two ideas,
 * and two different ideas that sit next to each other must not look alike.
 * Both were violated before: `Minimize2` meant *both* "mini mode" and "restore
 * window" while sitting one button away from the real minimise (`Minimize`),
 * and the lyrics panel (`Type`, a letter T) and the desktop-lyrics window
 * (`ListMusic`) used unrelated glyphs for the same concept.
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
  /* Play modes. `ListOrdered` for plain sequence, so the waveform glyph below
   * stays free to mean "visualiser" and nothing else. */
  sequence: glyph(ListOrdered),
  repeatAll: glyph(Repeat),
  repeatOne: glyph(Repeat1),
  shuffle: glyph(Shuffle),
  /* Lyrics: the panel is lines of text, the floating window is an overlay. */
  lyrics: glyph(AlignLeft),
  desktopLyrics: glyph(PictureInPicture2),
  visualization: glyph(AudioWaveform),
  tags: glyph(Tags),
  equalizer: glyph(SlidersHorizontal),
  skin: glyph(Palette),
  settings: glyph(Settings),
  /* Mini mode is a short wide strip — deliberately not a window-control arrow. */
  mini: glyph(RectangleHorizontal),
  addFiles: glyph(FilePlus),
  addFolder: glyph(FolderPlus),
  clear: glyph(Trash2),
  remove: glyph(X),
  disc: glyph(Disc3),
  panelLeft: glyph(PanelLeft),

  /* Window chrome. `minimize` / `restore` / `maximize` are the OS trio and are
   * never reused for app features. */
  minimize: glyph(Minimize),
  maximize: glyph(Maximize2),
  restore: glyph(Minimize2),
  lock: glyph(Lock),
  unlock: glyph(Unlock),
  clickThrough: glyph(MousePointerClick),

  /* Visualiser mode glyphs. */
  vizSpectrum: glyph(BarChart3),
  vizWaveform: glyph(Activity),
  vizRadial: glyph(Aperture),
  vizParticles: glyph(Sparkles),
  vizAurora: glyph(Waves),
  vizWaterfall: glyph(AreaChart),

  /*
   * Expand the visualiser to the base layer, and the way back. Deliberately
   * `Expand` / `Shrink` rather than the `Maximize2` / `Minimize2` pair, which
   * already mean "maximise / restore the window" a few pixels away.
   */
  vizExpand: glyph(Expand),
  vizRestore: glyph(Shrink),
};

export type IconName = keyof typeof Icon;
