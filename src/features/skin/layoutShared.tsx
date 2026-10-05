import type { ReactNode } from "react";
import { Icon } from "../../shared/icons";
import { EqualizerPanel } from "../equalizer/EqualizerPanel";
import { LyricsPanel } from "../lyrics/LyricsPanel";
import { PlayerControls } from "../player/PlayerControls";
import { PlaylistPanel } from "../playlist/PlaylistPanel";
import { SettingsPanel } from "../settings/SettingsPanel";
import { AppErrorBanner } from "../shell/AppErrorBanner";
import { WindowButtons } from "../shell/WindowChrome";
import { TagEditor } from "../tags/TagEditor";
import { AudioVisualizer } from "../visualization/AudioVisualizer";
import { visualizationModes } from "../visualization/modes";
import { VisualizationPanel } from "../visualization/VisualizationPanel";
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

/*
 * Top bar.
 *
 * Button placement follows one rule: a control lives in exactly one place.
 *
 * - The right-hand feature rail owns the six *panels* (lyrics, visualiser,
 *   tags, equaliser, skin, settings). Skin and settings used to be duplicated
 *   here as well, which is what made the corner feel crowded.
 * - This bar therefore only carries *window-level* actions: layout toggle, the
 *   two secondary windows, and the window buttons that replace the OS title
 *   bar (see `decorations: false` in tauri.conf.json).
 * - The current track is not repeated here either — the transport bar already
 *   shows cover, title and artist.
 */
export function TitleActions(props: PlayerLayoutProps) {
  return (
    <nav className="title-actions" aria-label="窗口操作">
      <div className="title-actions__buttons">
        <button
          className="title-action-button"
          type="button"
          aria-label="播放列表"
          aria-pressed={props.libraryOpen}
          title={props.libraryOpen ? "隐藏播放列表" : "显示播放列表"}
          onClick={props.onToggleLibrary}
        >
          <Icon.panelLeft />
        </button>
        <button
          className="title-action-button"
          type="button"
          aria-label="迷你模式"
          title="迷你模式"
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
      <WindowButtons />
    </nav>
  );
}

export function AppTitle({ model = "现代玻璃拟态" }: { model?: string }) {
  return (
    <div className="app-title">
      <span className="app-title__mark" aria-hidden="true">
        <Icon.disc size={22} />
      </span>
      <span className="app-title__copy">
        <h1 id="app-title">悠悠乐听</h1>
        <span className="app-title__model">{model}</span>
      </span>
    </div>
  );
}

export function LayoutErrorBanner({ error }: { error: string | null }) {
  return <AppErrorBanner error={error} />;
}

export function PlaylistBlock({ className, ...props }: PlayerLayoutProps & { className?: string }) {
  return (
    <section className={["modern-panel", "modern-panel--library", className].filter(Boolean).join(" ")}>
      <PlaylistPanel
        currentTrackId={props.playback.trackId}
        tracks={props.playlist.tracks}
        onPlay={(trackId) => props.onPlayerCommand("play_track", { trackId })}
        onRemove={(trackId) => props.onPlayerCommand("remove_track", { trackId })}
        onAddFiles={props.onAddFiles}
        onAddFolder={props.onAddFolder}
        onClear={props.onClearPlaylist}
      />
    </section>
  );
}

export function HeroVisualization({ className, ...props }: PlayerLayoutProps & { className?: string }) {
  const mode = props.settings.visualizationMode;
  const hasTrack = Boolean(props.currentTrack);

  return (
    <section className={["modern-panel", "modern-panel--viz", className].filter(Boolean).join(" ")}>
      <div className="viz-stage" role="img" aria-label="播放动态可视化">
        <AudioVisualizer
          mode={mode}
          isPlaying={props.playback.isPlaying}
          hasTrack={hasTrack}
          seed={props.currentTrack?.id ?? ""}
          className="audio-visualizer--hero"
        />
      </div>

      <div className="viz-switcher" role="group" aria-label="可视化模式快捷切换">
        {visualizationModes.map((entry) => {
          const ModeIcon = entry.icon;
          return (
            <button
              key={entry.id}
              type="button"
              className="viz-switcher__chip"
              aria-pressed={entry.id === mode}
              aria-label={`切换到${entry.label}可视化`}
              title={entry.hint}
              onClick={() => props.onVisualizationModeChange(entry.id)}
            >
              <ModeIcon size={16} />
            </button>
          );
        })}
      </div>
    </section>
  );
}

/*
 * Feature inspector.
 *
 * Collapsed by default: the icon rail is always visible and picking an icon
 * opens the drawer beside it. Clicking the active icon again (or the drawer's
 * close button) collapses it back to the rail.
 */
export function FeatureSidebar({ className, ...props }: PlayerLayoutProps & { className?: string }) {
  const open = props.activePanel !== null;

  return (
    <section
      className={["modern-panel", "modern-panel--inspector", className].filter(Boolean).join(" ")}
      data-state={open ? "open" : "closed"}
    >
      <aside className="feature-sidebar" role="complementary" aria-label="功能面板">
        <div className="feature-rail" role="group" aria-label="功能面板标签">
          {featurePanels.map((panel) => {
            const TabIcon = panel.icon;
            const isActive = props.activePanel === panel.id;
            return (
              <button
                key={panel.id}
                className="feature-tab"
                type="button"
                aria-pressed={isActive}
                aria-label={panel.label}
                title={panel.label}
                onClick={() => props.onActivePanelChange(isActive ? null : panel.id)}
              >
                <span className="feature-tab__icon" aria-hidden="true">
                  <TabIcon />
                </span>
              </button>
            );
          })}
        </div>

        {props.activePanel ? (
          <div className="feature-drawer">
            <header className="feature-drawer__header">
              <span className="feature-drawer__title">
                {featurePanels.find((panel) => panel.id === props.activePanel)?.label}
              </span>
              <button
                type="button"
                className="feature-drawer__close"
                aria-label="收起功能面板"
                title="收起"
                onClick={() => props.onActivePanelChange(null)}
              >
                <Icon.remove />
              </button>
            </header>
            <div className="feature-content">{renderFeaturePanel(props, props.activePanel)}</div>
          </div>
        ) : null}
      </aside>
    </section>
  );
}

export function ControlsBlock({ className, ...props }: PlayerLayoutProps & { className?: string }) {
  const hasPlayableTrack = props.playlist.tracks.some((track) => track.status === "ready");

  return (
    <section className={["modern-panel", "modern-panel--transport", className].filter(Boolean).join(" ")}>
      <PlayerControls
        state={props.playback}
        hasPlayableTrack={hasPlayableTrack}
        track={props.currentTrack}
        onCommand={(command, payload) => props.onPlayerCommand(command, payload)}
      />
    </section>
  );
}

function renderFeaturePanel(props: PlayerLayoutProps, panel: FeaturePanel) {
  if (panel === "visualization") {
    return (
      <VisualizationPanel
        mode={props.settings.visualizationMode}
        isPlaying={props.playback.isPlaying}
        hasTrack={Boolean(props.currentTrack)}
        seed={props.currentTrack?.id ?? ""}
        onModeChange={props.onVisualizationModeChange}
      />
    );
  }

  if (panel === "tags") {
    return <TagEditor track={props.currentTrack} onSave={props.onSaveTags} />;
  }

  if (panel === "equalizer") {
    return (
      <EqualizerPanel
        settings={props.settings.equalizer}
        onChange={(equalizer) => props.onSettingsChange({ ...props.settings, equalizer })}
      />
    );
  }

  if (panel === "skin") {
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

  if (panel === "settings") {
    return (
      <SettingsPanel
        shortcuts={props.settings.shortcuts}
        enrichmentEnabled={props.settings.enrichmentEnabled}
        errorCode={props.settingsErrorCode}
        onShortcutChange={props.onShortcutChange}
      />
    );
  }

  return (
    <LyricsPanel
      document={props.lyricsDocument}
      positionMs={props.playback.positionMs}
      desktopLyrics={props.settings.desktopLyrics}
      onDesktopLyricsChange={(desktopLyrics) =>
        props.onSettingsChange({ ...props.settings, desktopLyrics })
      }
      onToggleDesktopLyricsWindow={() => props.onPlayerCommand("toggle_desktop_lyrics", {})}
    />
  );
}
