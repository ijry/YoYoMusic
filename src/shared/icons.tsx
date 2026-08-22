import {
  AudioLines,
  FilePlus,
  FolderPlus,
  ListMusic,
  Minimize2,
  Palette,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Settings,
  Shuffle,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Tags,
  Trash2,
  Type,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";

/*
 * Shared icon vocabulary.
 *
 * One import site keeps stroke width and sizing consistent across features.
 * Icons are always decorative (`aria-hidden`) — the accessible name belongs on
 * the surrounding button's `aria-label`, so screen readers and the existing
 * `getByRole("button", { name: ... })` tests keep working.
 */

const SIZE = 17;
const STROKE = 1.9;

const baseProps = {
  size: SIZE,
  strokeWidth: STROKE,
  "aria-hidden": true as const,
  focusable: false as const,
};

export const Icon = {
  play: () => <Play {...baseProps} />,
  pause: () => <Pause {...baseProps} />,
  prev: () => <SkipBack {...baseProps} />,
  next: () => <SkipForward {...baseProps} />,
  volume: () => <Volume2 {...baseProps} />,
  muted: () => <VolumeX {...baseProps} />,
  sequence: () => <AudioLines {...baseProps} />,
  repeatAll: () => <Repeat {...baseProps} />,
  repeatOne: () => <Repeat1 {...baseProps} />,
  shuffle: () => <Shuffle {...baseProps} />,
  lyrics: () => <Type {...baseProps} />,
  visualization: () => <AudioLines {...baseProps} />,
  tags: () => <Tags {...baseProps} />,
  equalizer: () => <SlidersHorizontal {...baseProps} />,
  skin: () => <Palette {...baseProps} />,
  settings: () => <Settings {...baseProps} />,
  mini: () => <Minimize2 {...baseProps} />,
  desktopLyrics: () => <ListMusic {...baseProps} />,
  addFiles: () => <FilePlus {...baseProps} />,
  addFolder: () => <FolderPlus {...baseProps} />,
  clear: () => <Trash2 {...baseProps} />,
  remove: () => <X {...baseProps} />,
};

export type IconName = keyof typeof Icon;
