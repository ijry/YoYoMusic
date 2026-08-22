import type { ReactNode } from "react";
import { Icon } from "../../shared/icons";
import { EqualizerPanel } from "../equalizer/EqualizerPanel";
import { LyricsPanel } from "../lyrics/LyricsPanel";
import { PlayerControls } from "../player/PlayerControls";
import { PlaylistPanel } from "../playlist/PlaylistPanel";
import { SettingsPanel } from "../settings/SettingsPanel";
import { AppErrorBanner } from "../shell/AppErrorBanner";
import { TagEditor } from "../tags/TagEditor";
import { VisualizationPanel } from "../visualization/VisualizationPanel";
import { VisualizationPreview } from "../visualization/VisualizationPreview";
import { SkinManager } from "./SkinManager";
import type { FeaturePanel, PlayerLayoutProps } from "./layoutTypes";

export const featurePanels: Array<{ id: FeaturePanel; label: string; icon: () => ReactNode }> = [
  { id: "lyrics", label: "歌词", icon: Icon.lyrics },
  { id: "visualization", label: "可视化", icon: Icon.visualization },
  { id: "tags", label: "标签", icon: Icon.tags },
  { id: "equalizer", label: "均衡器", icon: Icon.equalizer },
  { id: "skin", label: "皮肤", icon: Icon.skin },
  { id: "settings", label: "设置", icon: Icon.settings },
];

interface DeviceModuleFrameProps {
  moduleLabel: string;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

interface DeviceBlockProps {
  moduleLabel: string;
  /* Accepted for layout compatibility; no longer rendered. */
  eyebrow?: string;
  moduleClassName?: string;
}

type DeviceShellVariant = "classic" | "vinyl" | "crystal" | "rack" | "wood";

/*
 * Module frame. The decorative trim (bar + rivets) and the English sub-caption
 * were removed: every module carried both a Chinese and an English label, which
 * doubled the reading load without adding information.
 */
function DeviceModuleFrame({ moduleLabel, className, bodyClassName, children }: DeviceModuleFrameProps) {
  return (
    <section className={["device-module", className].filter(Boolean).join(" ")}>
      <header className="device-module__header">
        <p className="device-module__label">{moduleLabel}</p>
      </header>
      <div className={["device-module__body", bodyClassName].filter(Boolean).join(" ")}>{children}</div>
    </section>
  );
}

/*
 * Shell hardware. Handles, vents, feet, rivets and rack ears were removed —
 * they read as clutter at the real window size and were what pushed content out
 * of the layout. Each skin keeps a single signature element, expressed through
 * material and colour in CSS rather than extra DOM.
 */
export function DeviceShellHardware({ variant }: { variant: DeviceShellVariant }) {
  const signature =
    variant === "vinyl" ? (
      <span className="device-shell__arc-platter" />
    ) : variant === "wood" ? (
      <span className="device-shell__molding device-shell__molding--top" />
    ) : null;

  return (
    <div className="device-shell__hardware" aria-hidden="true">
      {signature}
    </div>
  );
}

export function TitleActions(props: PlayerLayoutProps) {
  const currentTrackTitle = props.currentTrack?.title ?? "未装载曲目";

  return (
    <nav className="title-actions" aria-label="窗口操作">
      <div className="title-status-cluster">
        <span className="title-status-pill title-status-pill--track" title={currentTrackTitle}>
          {currentTrackTitle}
        </span>
      </div>
      <div className="title-actions__buttons">
        <button
          className="title-action-button"
          type="button"
          aria-label="皮肤"
          title="皮肤"
          onClick={() => props.onActivePanelChange("skin")}
        >
          <Icon.skin />
        </button>
        <button
          className="title-action-button"
          type="button"
          aria-label="设置"
          title="设置"
          onClick={() => props.onActivePanelChange("settings")}
        >
          <Icon.settings />
        </button>
        <button
          className="title-action-button"
          type="button"
          aria-label="迷你"
          title="迷你"
          onClick={() => props.onPlayerCommand("open_mini_player", {})}
        >
          <Icon.mini />
        </button>
        <button
          className="title-action-button"
          type="button"
          aria-label="桌面歌词"
          title="桌面歌词"
          onClick={() => props.onPlayerCommand("toggle_desktop_lyrics", {})}
        >
          <Icon.desktopLyrics />
        </button>
      </div>
    </nav>
  );
}

/*
 * Title. The model nameplate and serial line were device-cosplay rather than
 * information; `model` is kept as a quiet subtitle so each skin still says what
 * it is, and the props stay compatible with the five layouts.
 */
export function AppTitle({
  model = "MODEL YY-01",
}: {
  eyebrow?: string;
  model?: string;
  serial?: string;
}) {
  return (
    <div className="app-title">
      <h1 id="app-title">悠悠乐听</h1>
      <span className="app-title__model">{model}</span>
    </div>
  );
}

export function LayoutErrorBanner({ error }: { error: string | null }) {
  return <AppErrorBanner error={error} />;
}

export function PlaylistBlock({
  moduleLabel,
  moduleClassName,
  ...props
}: PlayerLayoutProps & DeviceBlockProps) {
  return (
    <DeviceModuleFrame
      moduleLabel={moduleLabel}
      className={["device-module--playlist", moduleClassName].filter(Boolean).join(" ")}
    >
      <PlaylistPanel
        currentTrackId={props.playback.trackId}
        tracks={props.playlist.tracks}
        onPlay={(trackId) => props.onPlayerCommand("play_track", { trackId })}
        onRemove={(trackId) => props.onPlayerCommand("remove_track", { trackId })}
        onAddFiles={props.onAddFiles}
        onAddFolder={props.onAddFolder}
        onClear={props.onClearPlaylist}
      />
    </DeviceModuleFrame>
  );
}

export function NowPlayingBlock({
  moduleLabel,
  moduleClassName,
  variant = "standard",
  ...props
}: PlayerLayoutProps &
  DeviceBlockProps & {
    variant?: string;
  }) {
  return (
    <DeviceModuleFrame
      moduleLabel={moduleLabel}
      className={["device-module--now-playing", moduleClassName].filter(Boolean).join(" ")}
    >
      <section className={`now-playing now-playing--${variant}`} aria-label="当前播放">
        <div className={props.playback.isPlaying ? "cover-card is-playing" : "cover-card"} aria-hidden="true">
          <div className="cover-card__gloss" />
          <div className="disc-ring" />
          <div className="cover-card__hub" />
        </div>

        {/* Title and artist only — the play state is already carried by the
            transport's play/pause icon and the track row's "正在播放" flag. */}
        <div className="now-playing-copy now-playing-display">
          <h2>{props.currentTrack?.title ?? "等待添加本地音乐"}</h2>
          <p className="subtitle">
            {props.currentTrack?.artist || props.currentTrack?.album || "选择文件或文件夹开始播放"}
          </p>
        </div>
      </section>
    </DeviceModuleFrame>
  );
}

export function HeroVisualization({
  moduleLabel,
  moduleClassName,
  ...props
}: PlayerLayoutProps & DeviceBlockProps) {
  return (
    <DeviceModuleFrame
      moduleLabel={moduleLabel}
      className={["device-module--visualization", moduleClassName].filter(Boolean).join(" ")}
    >
      <div className="workbench-visualization" role="img" aria-label="播放动态可视化">
        <VisualizationPreview
          mode={props.settings.visualizationMode}
          frame={props.visualizationFrame}
          variant="hero"
          isPlaying={props.playback.isPlaying}
          hasTrack={Boolean(props.currentTrack)}
        />
      </div>
    </DeviceModuleFrame>
  );
}

export function FeatureTabs(props: PlayerLayoutProps) {
  return (
    <div className="feature-tabs" aria-label="功能面板标签">
      {featurePanels.map((panel) => {
        const TabIcon = panel.icon;
        return (
          <button
            key={panel.id}
            className="feature-tab"
            type="button"
            aria-pressed={props.activePanel === panel.id}
            aria-label={panel.label}
            title={panel.label}
            onClick={() => props.onActivePanelChange(panel.id)}
          >
            <TabIcon />
          </button>
        );
      })}
    </div>
  );
}

export function FeatureContent(props: PlayerLayoutProps) {
  return <div className="feature-content">{renderFeaturePanel(props)}</div>;
}

export function FeatureSidebar({
  moduleLabel,
  moduleClassName,
  ...props
}: PlayerLayoutProps & DeviceBlockProps) {
  return (
    <DeviceModuleFrame
      moduleLabel={moduleLabel}
      className={["device-module--feature", moduleClassName].filter(Boolean).join(" ")}
      bodyClassName="device-module__body--feature"
    >
      <aside className="feature-sidebar" role="complementary" aria-label="功能面板">
        <FeatureTabs {...props} />
        <FeatureContent {...props} />
      </aside>
    </DeviceModuleFrame>
  );
}

export function ControlsBlock({
  moduleLabel,
  moduleClassName,
  ...props
}: PlayerLayoutProps & DeviceBlockProps) {
  const hasPlayableTrack = props.playlist.tracks.some((track) => track.status === "ready");

  return (
    <DeviceModuleFrame
      moduleLabel={moduleLabel}
      className={["device-module--controls", moduleClassName].filter(Boolean).join(" ")}
    >
      <PlayerControls
        state={props.playback}
        hasPlayableTrack={hasPlayableTrack}
        onCommand={(command, payload) => props.onPlayerCommand(command, payload)}
      />
    </DeviceModuleFrame>
  );
}

function renderFeaturePanel(props: PlayerLayoutProps) {
  if (props.activePanel === "visualization") {
    return (
      <VisualizationPanel
        mode={props.settings.visualizationMode}
        frame={props.visualizationFrame}
        isPlaying={props.playback.isPlaying}
        hasTrack={Boolean(props.currentTrack)}
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
