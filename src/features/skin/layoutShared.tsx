import type { ReactNode } from "react";
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

interface DeviceModuleFrameProps {
  moduleLabel: string;
  eyebrow?: string;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

interface DeviceBlockProps {
  moduleLabel: string;
  eyebrow?: string;
  moduleClassName?: string;
}

function DeviceModuleFrame({
  moduleLabel,
  eyebrow,
  className,
  bodyClassName,
  children,
}: DeviceModuleFrameProps) {
  return (
    <section className={["device-module", className].filter(Boolean).join(" ")}>
      <header className="device-module__header">
        <p className="device-module__label">{moduleLabel}</p>
        {eyebrow ? <p className="device-module__eyebrow">{eyebrow}</p> : null}
      </header>
      <div className="device-module__trim" aria-hidden="true">
        <span className="device-module__trim-bar" />
        <span className="device-module__rivets">
          <span className="device-module__rivet" />
          <span className="device-module__rivet" />
        </span>
      </div>
      <div className={["device-module__body", bodyClassName].filter(Boolean).join(" ")}>{children}</div>
    </section>
  );
}

export function DeviceShellHardware() {
  return (
    <div className="device-shell__hardware" aria-hidden="true">
      <span className="device-shell__handle device-shell__handle--left" />
      <span className="device-shell__handle device-shell__handle--right" />
      <div className="device-shell__vent-bank">
        <span className="device-shell__vent" />
        <span className="device-shell__vent" />
        <span className="device-shell__vent" />
        <span className="device-shell__vent" />
      </div>
      <span className="device-shell__foot device-shell__foot--left" />
      <span className="device-shell__foot device-shell__foot--right" />
    </div>
  );
}

export function TitleActions(props: PlayerLayoutProps) {
  const panelLabel = featurePanels.find((panel) => panel.id === props.activePanel)?.label ?? "歌词";
  const currentTrackTitle = props.currentTrack?.title ?? "未装载曲目";

  return (
    <nav className="title-actions" aria-label="窗口操作">
      <div className="title-status-cluster">
        <span className="title-status-pill">{props.playback.isPlaying ? "播放中" : "待机"}</span>
        <span className="title-status-pill title-status-pill--track" title={currentTrackTitle}>
          {currentTrackTitle}
        </span>
        <span className="title-status-pill">面板 {panelLabel}</span>
      </div>
      <div className="title-actions__buttons">
        <button className="title-action-button" type="button" onClick={() => props.onActivePanelChange("skin")}>
          <span className="title-action-button__code" aria-hidden="true">
            SKN
          </span>
          <span className="title-action-button__label">皮肤</span>
        </button>
        <button className="title-action-button" type="button" onClick={() => props.onActivePanelChange("settings")}>
          <span className="title-action-button__code" aria-hidden="true">
            CFG
          </span>
          <span className="title-action-button__label">设置</span>
        </button>
        <button
          className="title-action-button"
          type="button"
          onClick={() => props.onPlayerCommand("open_mini_player", {})}
        >
          <span className="title-action-button__code" aria-hidden="true">
            MINI
          </span>
          <span className="title-action-button__label">迷你模式</span>
        </button>
        <button
          className="title-action-button"
          type="button"
          onClick={() => props.onPlayerCommand("toggle_desktop_lyrics", {})}
        >
          <span className="title-action-button__code" aria-hidden="true">
            LRC
          </span>
          <span className="title-action-button__label">桌面歌词</span>
        </button>
      </div>
    </nav>
  );
}

export function AppTitle({
  eyebrow = "YoYoMusic Desktop Player",
  model = "MODEL YY-01",
  serial = "Desktop Audio Console",
}: {
  eyebrow?: string;
  model?: string;
  serial?: string;
}) {
  return (
    <div className="app-title">
      <p className="eyebrow">{eyebrow}</p>
      <h1 id="app-title">悠悠乐听</h1>
      <div className="device-shell__plate" aria-label="机型铭牌">
        <span className="app-title__model">{model}</span>
        <span className="app-title__serial">{serial}</span>
      </div>
    </div>
  );
}

export function LayoutErrorBanner({ error }: { error: string | null }) {
  return <AppErrorBanner error={error} />;
}

export function PlaylistBlock({
  moduleLabel,
  eyebrow = "Playlist Drawer",
  moduleClassName,
  ...props
}: PlayerLayoutProps & DeviceBlockProps) {
  return (
    <DeviceModuleFrame
      moduleLabel={moduleLabel}
      eyebrow={eyebrow}
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
  eyebrow = "Now Playing Display",
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
      eyebrow={eyebrow}
      className={["device-module--now-playing", moduleClassName].filter(Boolean).join(" ")}
    >
      <section className={`now-playing now-playing--${variant}`} aria-label="当前播放">
        <div className={props.playback.isPlaying ? "cover-card is-playing" : "cover-card"} aria-hidden="true">
          <div className="cover-card__gloss" />
          <div className="disc-ring" />
          <div className="cover-card__hub" />
        </div>

        <div className="now-playing-copy now-playing-display">
          <div className="now-playing-display__header">
            <p className="eyebrow">Now Playing</p>
            <span className="now-playing-status">{props.playback.isPlaying ? "PLAYING" : "READY"}</span>
          </div>
          <div className="now-playing-display__body">
            <h2>{props.currentTrack?.title ?? "等待添加本地音乐"}</h2>
            <p className="subtitle">
              {props.currentTrack?.artist || props.currentTrack?.album || "选择文件或文件夹开始播放"}
            </p>
          </div>
        </div>
      </section>
    </DeviceModuleFrame>
  );
}

export function HeroVisualization({
  moduleLabel,
  eyebrow = "Spectrum Bridge",
  moduleClassName,
  ...props
}: PlayerLayoutProps & DeviceBlockProps) {
  return (
    <DeviceModuleFrame
      moduleLabel={moduleLabel}
      eyebrow={eyebrow}
      className={["device-module--visualization", moduleClassName].filter(Boolean).join(" ")}
    >
      <div className="workbench-visualization" role="img" aria-label="播放动态可视化">
        <div className="visualization-preview visualization-preview--hero" aria-hidden="true">
          {props.visualizationFrame.values.slice(0, 18).map((value, index) => (
            <span key={index} style={{ height: `${Math.max(10, value * 100)}%` }} />
          ))}
        </div>
      </div>
    </DeviceModuleFrame>
  );
}

export function FeatureTabs(props: PlayerLayoutProps) {
  return (
    <div className="feature-tabs" aria-label="功能面板标签">
      {featurePanels.map((panel, index) => (
        <button
          key={panel.id}
          className="feature-tab"
          type="button"
          aria-pressed={props.activePanel === panel.id}
          onClick={() => props.onActivePanelChange(panel.id)}
        >
          <span className="feature-tab__slot" aria-hidden="true">
            {String(index + 1).padStart(2, "0")}
          </span>
          <span className="feature-tab__label">{panel.label}</span>
        </button>
      ))}
    </div>
  );
}

export function FeatureContent(props: PlayerLayoutProps) {
  return <div className="feature-content">{renderFeaturePanel(props)}</div>;
}

export function FeatureSidebar({
  moduleLabel,
  eyebrow = "Expansion Bay",
  moduleClassName,
  ...props
}: PlayerLayoutProps & DeviceBlockProps) {
  return (
    <DeviceModuleFrame
      moduleLabel={moduleLabel}
      eyebrow={eyebrow}
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
  eyebrow = "Transport Console",
  moduleClassName,
  ...props
}: PlayerLayoutProps & DeviceBlockProps) {
  return (
    <DeviceModuleFrame
      moduleLabel={moduleLabel}
      eyebrow={eyebrow}
      className={["device-module--controls", moduleClassName].filter(Boolean).join(" ")}
    >
      <PlayerControls state={props.playback} onCommand={(command, payload) => props.onPlayerCommand(command, payload)} />
    </DeviceModuleFrame>
  );
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
