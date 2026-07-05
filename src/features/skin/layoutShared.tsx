import { EqualizerPanel } from "../equalizer/EqualizerPanel";
import { LyricsPanel } from "../lyrics/LyricsPanel";
import { PlayerControls } from "../player/PlayerControls";
import { PlaylistPanel } from "../playlist/PlaylistPanel";
import { SettingsPanel } from "../settings/SettingsPanel";
import { AppErrorBanner } from "../shell/AppErrorBanner";
import { TagEditor } from "../tags/TagEditor";
import { VisualizationPanel } from "../visualization/VisualizationPanel";
import { SkinManager } from "./SkinManager";
import type { FeaturePanel, PlayerLayoutProps } from "./layoutTypes";

export const featurePanels: Array<{ id: FeaturePanel; label: string }> = [
  { id: "lyrics", label: "歌词" },
  { id: "visualization", label: "可视化" },
  { id: "tags", label: "标签" },
  { id: "equalizer", label: "均衡器" },
  { id: "skin", label: "皮肤" },
  { id: "settings", label: "设置" },
];

export function TitleActions(props: PlayerLayoutProps) {
  return (
    <nav className="title-actions" aria-label="窗口操作">
      <button type="button" onClick={() => props.onActivePanelChange("skin")}>
        皮肤
      </button>
      <button type="button" onClick={() => props.onActivePanelChange("settings")}>
        设置
      </button>
      <button type="button" onClick={() => props.onPlayerCommand("open_mini_player", {})}>
        迷你模式
      </button>
      <button type="button" onClick={() => props.onPlayerCommand("toggle_desktop_lyrics", {})}>
        桌面歌词
      </button>
    </nav>
  );
}

export function AppTitle({ eyebrow = "YoYoMusic Desktop Player" }: { eyebrow?: string }) {
  return (
    <div>
      <p className="eyebrow">{eyebrow}</p>
      <h1 id="app-title">悠悠乐听</h1>
    </div>
  );
}

export function LayoutErrorBanner({ error }: { error: string | null }) {
  return <AppErrorBanner error={error} />;
}

export function PlaylistBlock(props: PlayerLayoutProps) {
  return (
    <PlaylistPanel
      currentTrackId={props.playback.trackId}
      tracks={props.playlist.tracks}
      onPlay={(trackId) => props.onPlayerCommand("play_track", { trackId })}
      onRemove={(trackId) => props.onPlayerCommand("remove_track", { trackId })}
      onAddFiles={props.onAddFiles}
      onAddFolder={props.onAddFolder}
      onClear={props.onClearPlaylist}
    />
  );
}

export function NowPlayingBlock({ variant = "standard", ...props }: PlayerLayoutProps & { variant?: string }) {
  return (
    <section className={`now-playing now-playing--${variant}`} aria-label="当前播放">
      <div className={props.playback.isPlaying ? "cover-card is-playing" : "cover-card"} aria-hidden="true">
        <div className="disc-ring" />
      </div>

      <div className="now-playing-copy">
        <p className="eyebrow">Now Playing</p>
        <h2>{props.currentTrack?.title ?? "等待添加本地音乐"}</h2>
        <p className="subtitle">{props.currentTrack?.artist || props.currentTrack?.album || "选择文件或文件夹开始播放"}</p>
      </div>
    </section>
  );
}

export function HeroVisualization(props: PlayerLayoutProps) {
  return (
    <div className="workbench-visualization" role="img" aria-label="播放动态可视化">
      <div className="visualization-preview visualization-preview--hero" aria-hidden="true">
        {props.visualizationFrame.values.slice(0, 18).map((value, index) => (
          <span key={index} style={{ height: `${Math.max(10, value * 100)}%` }} />
        ))}
      </div>
    </div>
  );
}

export function FeatureTabs(props: PlayerLayoutProps) {
  return (
    <div className="feature-tabs" aria-label="功能面板标签">
      {featurePanels.map((panel) => (
        <button
          key={panel.id}
          type="button"
          aria-pressed={props.activePanel === panel.id}
          onClick={() => props.onActivePanelChange(panel.id)}
        >
          {panel.label}
        </button>
      ))}
    </div>
  );
}

export function FeatureContent(props: PlayerLayoutProps) {
  return <div className="feature-content">{renderFeaturePanel(props)}</div>;
}

export function FeatureSidebar(props: PlayerLayoutProps) {
  return (
    <aside className="feature-sidebar" role="complementary" aria-label="功能面板">
      <FeatureTabs {...props} />
      <FeatureContent {...props} />
    </aside>
  );
}

export function ControlsBlock(props: PlayerLayoutProps) {
  return <PlayerControls state={props.playback} onCommand={(command, payload) => props.onPlayerCommand(command, payload)} />;
}

function renderFeaturePanel(props: PlayerLayoutProps) {
  if (props.activePanel === "visualization") {
    return (
      <VisualizationPanel
        mode={props.settings.visualizationMode}
        frame={props.visualizationFrame}
        onModeChange={props.onVisualizationModeChange}
      />
    );
  }

  if (props.activePanel === "tags") {
    return <TagEditor track={props.currentTrack} onSave={props.onSaveTags} />;
  }

  if (props.activePanel === "equalizer") {
    return (
      <EqualizerPanel
        settings={props.settings.equalizer}
        onChange={(equalizer) => props.onSettingsChange({ ...props.settings, equalizer })}
      />
    );
  }

  if (props.activePanel === "skin") {
    return (
      <SkinManager
        skins={props.skins}
        activeSkinId={props.settings.defaultSkin}
        error={props.skinError}
        onApply={props.onApplySkin}
        onImport={props.onImportSkin}
      />
    );
  }

  if (props.activePanel === "settings") {
    return (
      <SettingsPanel
        shortcuts={props.settings.shortcuts}
        enrichmentEnabled={props.settings.enrichmentEnabled}
        errorCode={props.settingsErrorCode}
        onShortcutChange={props.onShortcutChange}
      />
    );
  }

  return <LyricsPanel document={props.lyricsDocument} positionMs={props.playback.positionMs} />;
}
