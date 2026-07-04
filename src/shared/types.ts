export type PlayMode = "sequence" | "repeat_all" | "repeat_one" | "shuffle";
export type TrackStatus = "ready" | "missing" | "unplayable";
export type TagStatus = "clean" | "dirty" | "saving" | "failed";
export type VisualizationMode = "spectrum" | "waveform" | "radial";

export interface Track {
  id: string;
  filePath: string;
  title: string;
  artist: string;
  album: string;
  durationMs: number;
  coverArtRef: string | null;
  lyricsRef: string | null;
  tagStatus: TagStatus;
  status: TrackStatus;
}

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
  currentIndex: number;
  playMode: PlayMode;
}

export interface PlaylistSnapshot {
  playlist: Playlist;
  tracks: Track[];
}

export interface PlaybackState {
  trackId: string | null;
  positionMs: number;
  durationMs: number;
  volume: number;
  isPlaying: boolean;
  isMuted: boolean;
  playMode: PlayMode;
  eqEnabled: boolean;
}

export interface LyricsLine {
  timeMs: number;
  text: string;
  translation?: string;
}

export interface LyricsDocument {
  id: string;
  sourceType: "embedded" | "local_file" | "cache" | "online";
  language: string;
  offsetMs: number;
  lines: LyricsLine[];
}

export interface SkinPackage {
  id: string;
  name: string;
  version: string;
  author: string;
  manifestPath: string;
  themePath: string;
  assetRoot: string;
}

export interface WindowPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
  alwaysOnTop: boolean;
}

export interface WindowPreferences {
  main: WindowPlacement;
  mini: WindowPlacement;
  lyrics: WindowPlacement & {
    opacity: number;
    clickThrough: boolean;
  };
}

export interface EqualizerSettings {
  enabled: boolean;
  preset: string;
  bands: number[];
}

export interface AppSettings {
  defaultSkin: string;
  shortcuts: Record<string, string>;
  enrichmentEnabled: boolean;
  cacheRetentionDays: number;
  recentPlaylists: string[];
  restoreSession: boolean;
  visualizationMode: VisualizationMode;
  equalizer: EqualizerSettings;
}
