import { useEffect, useState } from "react";
import "./styles/theme.css";
import "./styles/app.css";
import { EqualizerPanel } from "./features/equalizer/EqualizerPanel";
import { LyricsPanel } from "./features/lyrics/LyricsPanel";
import { PlayerControls } from "./features/player/PlayerControls";
import { PlaylistPanel } from "./features/playlist/PlaylistPanel";
import { SettingsPanel } from "./features/settings/SettingsPanel";
import { AppErrorBanner } from "./features/shell/AppErrorBanner";
import { SkinManager, type SkinSummary } from "./features/skin/SkinManager";
import { TagEditor, type TagDraft } from "./features/tags/TagEditor";
import { VisualizationPanel } from "./features/visualization/VisualizationPanel";
import { mapAppError } from "./shared/errors";
import { openAudioFiles, openAudioFolders, openSkinPackageFolder } from "./shared/fileDialog";
import { invokeCommand, isTauriRuntime, type CommandName, type CommandPayload } from "./shared/tauri";
import type {
  AppSettings,
  LyricsDocument,
  PlaybackState,
  PlaylistSnapshot,
  Track,
  VisualizationMode,
} from "./shared/types";

type FeaturePanel = "lyrics" | "visualization" | "tags" | "equalizer" | "skin" | "settings";

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
  defaultSkin: "default",
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
  const [skins, setSkins] = useState<SkinSummary[]>([
    { id: "default", name: "默认青绿", author: "YoYoMusic", version: "1.0.0" },
  ]);
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

    try {
      if (isPlaylistCommand(command)) {
        const snapshot = await invokeCommand<PlaylistSnapshot>(command, payload);
        setPlaylist(snapshot);
      } else if (isPlaybackCommand(command)) {
        const playbackState = await invokeCommand<PlaybackState>(command, payload);
        setPlayback(playbackState);
        if (command === "set_play_mode") {
          setPlaylist((current) => ({
            ...current,
            playlist: { ...current.playlist, playMode: playbackState.playMode },
          }));
        }
      } else {
        await invokeCommand<unknown>(command, payload);
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
    <main className="app-shell">
      <section className="chrome" aria-labelledby="app-title">
        <header className="title-bar">
          <div>
            <p className="eyebrow">YoYoMusic Desktop Player</p>
            <h1 id="app-title">悠悠乐听</h1>
          </div>
          <nav className="title-actions" aria-label="窗口操作">
            <button type="button" onClick={() => setActivePanel("skin")}>
              皮肤
            </button>
            <button type="button" onClick={() => setActivePanel("settings")}>
              设置
            </button>
            <button type="button" onClick={() => void handleCommand("open_mini_player")}>
              迷你模式
            </button>
            <button type="button" onClick={() => void handleCommand("toggle_desktop_lyrics")}>
              桌面歌词
            </button>
          </nav>
        </header>

        <AppErrorBanner error={error} />

        <div className="workspace">
          <PlaylistPanel
            currentTrackId={playback.trackId}
            tracks={playlist.tracks}
            onPlay={(trackId) => void handleCommand("play_track", { trackId })}
            onRemove={(trackId) => void handleCommand("remove_track", { trackId })}
            onAddFiles={() => void handleAddFiles()}
            onAddFolder={() => void handleAddFolder()}
            onClear={() => void handleCommand("clear_playlist")}
          />

          <section className="now-playing" aria-label="当前播放">
            <div className={playback.isPlaying ? "cover-card is-playing" : "cover-card"} aria-hidden="true">
              <div className="disc-ring" />
            </div>
            <div>
              <p className="eyebrow">Now Playing</p>
              <h2>{currentTrack?.title ?? "等待添加本地音乐"}</h2>
              <p className="subtitle">{currentTrack?.artist || currentTrack?.album || "选择文件或文件夹开始播放"}</p>
            </div>

            <div className="feature-tabs" aria-label="功能面板">
              {featurePanels.map((panel) => (
                <button
                  key={panel.id}
                  type="button"
                  aria-pressed={activePanel === panel.id}
                  onClick={() => setActivePanel(panel.id)}
                >
                  {panel.label}
                </button>
              ))}
            </div>

            {renderFeaturePanel({
              activePanel,
              currentTrack,
              lyricsDocument,
              playback,
              settings,
              skins,
              settingsErrorCode,
              skinError,
              onSaveTags: handleSaveTags,
              onApplySkin: (skinId) => void handleApplySkin(skinId),
              onImportSkin: () => void handleImportSkin(),
              onShortcutChange: handleShortcutChange,
              onVisualizationModeChange: handleVisualizationModeChange,
              onSettingsChange: updateSettings,
            })}
          </section>
        </div>

        <PlayerControls state={playback} onCommand={(command, payload) => void handleCommand(command, payload)} />
      </section>
    </main>
  );
}

const featurePanels: Array<{ id: FeaturePanel; label: string }> = [
  { id: "lyrics", label: "歌词" },
  { id: "visualization", label: "可视化" },
  { id: "tags", label: "标签" },
  { id: "equalizer", label: "均衡器" },
  { id: "skin", label: "皮肤" },
  { id: "settings", label: "设置" },
];

function renderFeaturePanel({
  activePanel,
  currentTrack,
  lyricsDocument,
  playback,
  settings,
  skins,
  settingsErrorCode,
  skinError,
  onSaveTags,
  onApplySkin,
  onImportSkin,
  onShortcutChange,
  onVisualizationModeChange,
  onSettingsChange,
}: {
  activePanel: FeaturePanel;
  currentTrack: Track | null;
  lyricsDocument: LyricsDocument | null;
  playback: PlaybackState;
  settings: AppSettings;
  skins: SkinSummary[];
  settingsErrorCode: string | null;
  skinError: string | null;
  onSaveTags: (draft: TagDraft) => void;
  onApplySkin: (skinId: string) => void;
  onImportSkin: () => void;
  onShortcutChange: (action: string, shortcut: string) => void;
  onVisualizationModeChange: (mode: VisualizationMode) => void;
  onSettingsChange: (settings: AppSettings) => void;
}) {
  if (activePanel === "visualization") {
    return (
      <VisualizationPanel
        mode={settings.visualizationMode}
        frame={createVisualizationFrame(playback.positionMs)}
        onModeChange={onVisualizationModeChange}
      />
    );
  }

  if (activePanel === "tags") {
    return <TagEditor track={currentTrack} onSave={onSaveTags} />;
  }

  if (activePanel === "equalizer") {
    return (
      <EqualizerPanel
        settings={settings.equalizer}
        onChange={(equalizer) => onSettingsChange({ ...settings, equalizer })}
      />
    );
  }

  if (activePanel === "skin") {
    return (
      <SkinManager
        skins={skins}
        activeSkinId={settings.defaultSkin}
        error={skinError}
        onApply={onApplySkin}
        onImport={onImportSkin}
      />
    );
  }

  if (activePanel === "settings") {
    return (
      <SettingsPanel
        shortcuts={settings.shortcuts}
        enrichmentEnabled={settings.enrichmentEnabled}
        errorCode={settingsErrorCode}
        onShortcutChange={onShortcutChange}
      />
    );
  }

  return <LyricsPanel document={lyricsDocument} positionMs={playback.positionMs} />;
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
