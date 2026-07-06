import { useEffect, useState } from "react";
import "./styles/theme.css";
import "./styles/app.css";
import "./styles/skin-layouts.css";
import {
  DEFAULT_LAYOUT_SKIN_ID,
  builtInLayoutSkinSummaries,
  resolveLayoutSkin,
} from "./features/skin/layoutRegistry";
import type { SkinSummary } from "./features/skin/SkinManager";
import type { FeaturePanel } from "./features/skin/layoutTypes";
import type { TagDraft } from "./features/tags/TagEditor";
import { mapAppError } from "./shared/errors";
import { openAudioFiles, openAudioFolders, openSkinPackageFolder } from "./shared/fileDialog";
import {
  invokeCommand,
  isTauriRuntime,
  listenToAppEvent,
  type CommandName,
  type CommandPayload,
} from "./shared/tauri";
import type {
  AppSettings,
  LyricsDocument,
  PlaybackState,
  PlaylistSnapshot,
  Track,
  VisualizationMode,
} from "./shared/types";

interface SkinManifest {
  name: string;
  version: string;
  author: string;
}

const emptyPlaylist: PlaylistSnapshot = {
  playlist: {
    id: "default",
    name: "当前播放列表",
    trackIds: [],
    currentIndex: 0,
    playMode: "sequence",
  },
  tracks: [],
};

const initialPlayback: PlaybackState = {
  trackId: null,
  positionMs: 0,
  durationMs: 0,
  volume: 0.8,
  isPlaying: false,
  isMuted: false,
  playMode: "sequence",
  eqEnabled: false,
};

const defaultSettings: AppSettings = {
  defaultSkin: DEFAULT_LAYOUT_SKIN_ID,
  shortcuts: {
    toggle_playback: "Ctrl+Alt+P",
    previous_track: "Ctrl+Alt+Left",
    next_track: "Ctrl+Alt+Right",
  },
  enrichmentEnabled: false,
  cacheRetentionDays: 30,
  recentPlaylists: [],
  restoreSession: true,
  visualizationMode: "spectrum",
  equalizer: {
    enabled: false,
    preset: "flat",
    bands: Array(10).fill(0),
  },
};

export default function App() {
  const [playlist, setPlaylist] = useState<PlaylistSnapshot>(emptyPlaylist);
  const [playback, setPlayback] = useState<PlaybackState>(initialPlayback);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [skins, setSkins] = useState<SkinSummary[]>(builtInLayoutSkinSummaries);
  const [lyricsDocument] = useState<LyricsDocument | null>(null);
  const [activePanel, setActivePanel] = useState<FeaturePanel>("lyrics");
  const [error, setError] = useState<string | null>(null);
  const [settingsErrorCode, setSettingsErrorCode] = useState<string | null>(null);
  const [skinError, setSkinError] = useState<string | null>(null);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    let cancelled = false;
    async function loadInitialState() {
      try {
        const [playlistSnapshot, playbackState, appSettings] = await Promise.all([
          invokeCommand<PlaylistSnapshot>("get_playlist"),
          invokeCommand<PlaybackState>("get_playback_state"),
          invokeCommand<AppSettings>("load_settings"),
        ]);

        if (!cancelled) {
          setPlaylist(playlistSnapshot);
          setPlayback(playbackState);
          setSettings(appSettings);
          setError(null);
        }
      } catch (loadError) {
        if (!cancelled) setError(toUserMessage(loadError));
      }
    }

    void loadInitialState();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    let cancelled = false;
    const unlisteners: Array<() => void> = [];

    void listenToAppEvent<PlaylistSnapshot>("playlist_changed", setPlaylist).then((unlisten) => {
      if (cancelled) {
        unlisten();
      } else {
        unlisteners.push(unlisten);
      }
    });
    void listenToAppEvent<PlaybackState>("playback_state_changed", setPlayback).then((unlisten) => {
      if (cancelled) {
        unlisten();
      } else {
        unlisteners.push(unlisten);
      }
    });

    return () => {
      cancelled = true;
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, []);

  useEffect(() => {
    if (!isTauriRuntime() || !playback.isPlaying) return;

    const intervalId = window.setInterval(async () => {
      try {
        setPlayback(await invokeCommand<PlaybackState>("get_playback_state"));
      } catch (pollError) {
        setError(toUserMessage(pollError));
      }
    }, 500);

    return () => window.clearInterval(intervalId);
  }, [playback.isPlaying]);

  const currentTrack = findCurrentTrack(playlist, playback.trackId);
  const visualizationFrame = createVisualizationFrame(playback.positionMs);
  const activeLayoutSkin = resolveLayoutSkin(settings.defaultSkin);
  const ActiveLayout = activeLayoutSkin.Layout;

  async function addPaths(paths: string[]) {
    if (paths.length === 0) return;

    try {
      const snapshot = await invokeCommand<PlaylistSnapshot>("add_tracks", { paths });
      setPlaylist(snapshot);
      setError(null);
    } catch (addError) {
      setError(toUserMessage(addError));
    }
  }

  async function handleAddFiles() {
    if (!isTauriRuntime()) {
      setError("请在桌面应用中导入本地音乐。");
      return;
    }

    try {
      await addPaths(await openAudioFiles());
    } catch (dialogError) {
      setError(toUserMessage(dialogError));
    }
  }

  async function handleAddFolder() {
    if (!isTauriRuntime()) {
      setError("请在桌面应用中导入本地音乐文件夹。");
      return;
    }

    try {
      await addPaths(await openAudioFolders());
    } catch (dialogError) {
      setError(toUserMessage(dialogError));
    }
  }

  async function handleCommand(command: CommandName, payload: CommandPayload = {}) {
    if (!isTauriRuntime()) {
      console.debug("player command", command, payload);
      return;
    }

    const resolved = resolvePlaybackCommand(command, payload, playback, playlist);

    try {
      if (isPlaylistCommand(resolved.command)) {
        const snapshot = await invokeCommand<PlaylistSnapshot>(resolved.command, resolved.payload);
        setPlaylist(snapshot);
      } else if (isPlaybackCommand(resolved.command)) {
        const playbackState = await invokeCommand<PlaybackState>(resolved.command, resolved.payload);
        setPlayback(playbackState);
        if (resolved.command === "set_play_mode") {
          setPlaylist((current) => ({
            ...current,
            playlist: { ...current.playlist, playMode: playbackState.playMode },
          }));
        } else if (commandCanChangeSelectedTrack(resolved.command)) {
          setPlaylist((current) => syncPlaylistSelection(current, playbackState.trackId));
        }
      } else {
        await invokeCommand<unknown>(resolved.command, resolved.payload);
      }
      setError(null);
    } catch (commandError) {
      setError(toUserMessage(commandError));
    }
  }

  async function handleSaveTags(draft: TagDraft) {
    if (!currentTrack || !isTauriRuntime()) return;

    try {
      const updated = await invokeCommand<Track>("save_tags", {
        trackId: currentTrack.id,
        title: draft.title,
        artist: draft.artist,
        album: draft.album,
        coverPath: draft.coverPath,
      });
      setPlaylist((current) => ({
        ...current,
        tracks: current.tracks.map((track) => (track.id === updated.id ? updated : track)),
      }));
      setError(null);
    } catch (saveError) {
      setError(toUserMessage(saveError));
    }
  }

  function updateSettings(nextSettings: AppSettings) {
    setSettings(nextSettings);
    if (!isTauriRuntime()) return;

    void invokeCommand<AppSettings>("save_settings", { settings: nextSettings })
      .then((saved) => {
        setSettings(saved);
        setSettingsErrorCode(null);
      })
      .catch((saveError) => {
        setSettingsErrorCode(readErrorCode(saveError));
        setError(toUserMessage(saveError));
      });
  }

  function handleVisualizationModeChange(mode: VisualizationMode) {
    updateSettings({ ...settings, visualizationMode: mode });
  }

  function handleShortcutChange(action: string, shortcut: string) {
    updateSettings({
      ...settings,
      shortcuts: { ...settings.shortcuts, [action]: shortcut },
    });
  }

  async function handleApplySkin(skinId: string) {
    if (!isTauriRuntime()) {
      updateSettings({ ...settings, defaultSkin: skinId });
      return;
    }

    try {
      const appliedSkinId = await invokeCommand<string>("apply_skin", { skinId });
      setSkinError(null);
      updateSettings({ ...settings, defaultSkin: appliedSkinId });
    } catch (skinApplyError) {
      setSkinError(toUserMessage(skinApplyError));
    }
  }

  async function handleImportSkin() {
    if (!isTauriRuntime()) {
      setSkinError("请在桌面应用中导入皮肤包目录。");
      return;
    }

    try {
      const path = await openSkinPackageFolder();
      if (!path) return;

      const manifest = await invokeCommand<SkinManifest>("validate_skin_package", { path });
      const importedSkin: SkinSummary = {
        id: path,
        name: manifest.name,
        author: manifest.author,
        version: manifest.version,
      };

      setSkins((current) => {
        const withoutExisting = current.filter((skin) => skin.id !== importedSkin.id);
        return [...withoutExisting, importedSkin];
      });
      setSkinError(null);
      setActivePanel("skin");
    } catch (importError) {
      setSkinError(toUserMessage(importError));
    }
  }

  return (
    <ActiveLayout
      playlist={playlist}
      playback={playback}
      currentTrack={currentTrack}
      lyricsDocument={lyricsDocument}
      settings={settings}
      skins={skins}
      activePanel={activePanel}
      error={error}
      skinError={skinError}
      settingsErrorCode={settingsErrorCode}
      visualizationFrame={visualizationFrame}
      onActivePanelChange={setActivePanel}
      onPlayerCommand={(command, payload = {}) => void handleCommand(command, payload)}
      onAddFiles={() => void handleAddFiles()}
      onAddFolder={() => void handleAddFolder()}
      onClearPlaylist={() => void handleCommand("clear_playlist")}
      onSaveTags={handleSaveTags}
      onApplySkin={(skinId) => void handleApplySkin(skinId)}
      onImportSkin={() => void handleImportSkin()}
      onShortcutChange={handleShortcutChange}
      onVisualizationModeChange={handleVisualizationModeChange}
      onSettingsChange={updateSettings}
    />
  );
}

function findCurrentTrack(snapshot: PlaylistSnapshot, trackId: string | null) {
  if (trackId) {
    const match = snapshot.tracks.find((track) => track.id === trackId);
    if (match) return match;
  }

  const fallbackId = snapshot.playlist.trackIds[snapshot.playlist.currentIndex];
  return snapshot.tracks.find((track) => track.id === fallbackId) ?? null;
}

function isPlaylistCommand(command: CommandName) {
  return command === "add_tracks" || command === "remove_track" || command === "clear_playlist";
}

function isPlaybackCommand(command: CommandName) {
  return [
    "play_track",
    "toggle_playback",
    "pause_playback",
    "next_track",
    "previous_track",
    "seek",
    "set_volume",
    "set_muted",
    "set_play_mode",
    "get_playback_state",
  ].includes(command);
}

function resolvePlaybackCommand(
  command: CommandName,
  payload: CommandPayload,
  playback: PlaybackState,
  playlist: PlaylistSnapshot,
): { command: CommandName; payload: CommandPayload } {
  if (command === "toggle_playback" && !playback.trackId && !playback.isPlaying) {
    const fallbackTrack = findCurrentTrack(playlist, null);
    if (fallbackTrack?.status === "ready") {
      return { command: "play_track", payload: { trackId: fallbackTrack.id } };
    }
  }

  return { command, payload };
}

function syncPlaylistSelection(snapshot: PlaylistSnapshot, trackId: string | null): PlaylistSnapshot {
  if (!trackId) return snapshot;

  const currentIndex = snapshot.playlist.trackIds.indexOf(trackId);
  if (currentIndex < 0 || currentIndex === snapshot.playlist.currentIndex) return snapshot;

  return {
    ...snapshot,
    playlist: {
      ...snapshot.playlist,
      currentIndex,
    },
  };
}

function commandCanChangeSelectedTrack(command: CommandName) {
  return command === "play_track" || command === "next_track" || command === "previous_track";
}

function createVisualizationFrame(positionMs: number) {
  const values = Array.from({ length: 24 }, (_, index) => {
    const wave = Math.sin(positionMs / 300 + index * 0.65);
    return 0.15 + Math.abs(wave) * 0.85;
  });

  return {
    values,
    peak: Math.max(...values),
    positionMs,
  };
}

function toUserMessage(error: unknown) {
  if (isAppErrorPayload(error)) return mapAppError(error);
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "未知错误";
}

function readErrorCode(error: unknown) {
  return isAppErrorPayload(error) ? error.code : null;
}

function isAppErrorPayload(error: unknown): error is { code: string; message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    typeof error.code === "string" &&
    typeof error.message === "string"
  );
}
