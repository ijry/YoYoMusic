import type { ComponentType } from "react";
import type { CommandName, CommandPayload } from "../../shared/tauri";
import type {
  AppSettings,
  LyricsDocument,
  PlaybackState,
  PlaylistSnapshot,
  Track,
  VisualizationMode,
} from "../../shared/types";
import type { TagDraft } from "../tags/TagEditor";
import type { SkinSummary } from "./SkinManager";

export type FeaturePanel = "lyrics" | "visualization" | "tags" | "equalizer" | "skin" | "settings";

export interface VisualizationFrame {
  values: number[];
  peak: number;
  positionMs: number;
}

export interface PlayerLayoutProps {
  playlist: PlaylistSnapshot;
  playback: PlaybackState;
  currentTrack: Track | null;
  lyricsDocument: LyricsDocument | null;
  settings: AppSettings;
  skins: SkinSummary[];
  activePanel: FeaturePanel;
  error: string | null;
  skinError: string | null;
  settingsErrorCode: string | null;
  visualizationFrame: VisualizationFrame;
  onActivePanelChange: (panel: FeaturePanel) => void;
  onPlayerCommand: (command: CommandName, payload?: CommandPayload) => void;
  onAddFiles: () => void;
  onAddFolder: () => void;
  onClearPlaylist: () => void;
  onSaveTags: (draft: TagDraft) => void;
  onApplySkin: (skinId: string) => void;
  onImportSkin: () => void;
  onShortcutChange: (action: string, shortcut: string) => void;
  onVisualizationModeChange: (mode: VisualizationMode) => void;
  onSettingsChange: (settings: AppSettings) => void;
}

export interface LayoutSkinDefinition {
  id: string;
  name: string;
  author: string;
  version: string;
  description: string;
  tone: string;
  thumbnailClassName: string;
  Layout: ComponentType<PlayerLayoutProps>;
}
