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
 * - This bar carries *window-level* actions only, split into two groups by a
 *   divider: what the app does (toggle the playlist, open a secondary window)
 *   and what the window does (minimise / maximise / close). Without the split
 *   the six buttons read as one undifferentiated row.
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

      <span className="title-actions__divider" aria-hidden="true" />

      <WindowButtons />
    </nav>
  );
}

export function AppTitle({ model = "现代玻璃拟态" }: { model?: string }) {
  return (
    <div className="app-title">
      {/*
       * The real logo — the same artwork as the app icon and the docs site,
       * served from `public/favicon.svg` so there is one copy in the repo.
       * It carries its own gradient and rounded corners, so
       * `.app-title__mark` must not paint a background behind it.
       */}
      <span className="app-title__mark">
        <img src="/favicon.svg" alt="" width={40} height={40} className="app-title__logo" />
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

/*
 * Mode chips, shared by the docked stage and the maximised backdrop so the two
 * cannot drift. The expand / restore chip rides along, because that is where a
 * user looks for it — next to the thing it affects.
 */
function VizSwitcher({ props, maximized }: { props: PlayerLayoutProps; maximized: boolean }) {
  const mode = props.settings.visualizationMode;

  return (
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

      <span className="viz-switcher__divider" aria-hidden="true" />

      <button
        type="button"
        className="viz-switcher__chip"
        aria-pressed={maximized}
        aria-label={maximized ? "还原可视化" : "最大化可视化"}
        title={maximized ? "还原" : "最大化：可视化铺满整个界面"}
        onClick={props.onToggleVisualizerMaximized}
      >
        {maximized ? <Icon.vizRestore size={16} /> : <Icon.vizExpand size={16} />}
      </button>
    </div>
  );
}

export function HeroVisualization({ className, ...props }: PlayerLayoutProps & { className?: string }) {
  const hasTrack = Boolean(props.currentTrack);
  const maximized = props.visualizerMaximized;

  /*
   * While maximised, the canvas lives in `VisualizerBackdrop` at the frame
   * level — it has to, because `.modern-grid` clips its overflow and would cut
   * a full-bleed layer down to the middle column. This panel stays in the DOM to
   * keep the middle grid column occupied (so the column template never has to
   * change) and to hold the switcher, which therefore does not move when the
   * mode toggles: the restore chip lands exactly where the expand chip was.
   */
  if (maximized) {
    return (
      <section
        className={["modern-panel", "modern-panel--viz", "is-maximized-placeholder", className]
          .filter(Boolean)
          .join(" ")}
      >
        <VizSwitcher props={props} maximized={true} />
      </section>
    );
  }

  return (
    <section className={["modern-panel", "modern-panel--viz", className].filter(Boolean).join(" ")}>
      <div className="viz-stage" role="img" aria-label="播放动态可视化">
        <AudioVisualizer
          mode={props.settings.visualizationMode}
          isPlaying={props.playback.isPlaying}
          hasTrack={hasTrack}
          seed={props.currentTrack?.id ?? ""}
          className="audio-visualizer--hero"
        />
      </div>

      <VizSwitcher props={props} maximized={false} />
    </section>
  );
}

/*
 * The maximised visualiser: one full-bleed layer sitting at the bottom of the
 * frame, with the top bar, panels and transport floating above it on their own
 * glass. Rendered as a direct child of `.chrome` and absolutely positioned, for
 * two reasons — `.modern-grid` would clip it, and an in-flow child would claim
 * a fourth row of the frame's grid.
 *
 * The mode switcher deliberately stays in the middle column's placeholder panel
 * rather than living here: the frame-level layer would put it underneath the
 * window controls, where it could not be clicked.
 */
export function VisualizerBackdrop(props: PlayerLayoutProps) {
  return (
    <div className="viz-backdrop">
      <AudioVisualizer
        mode={props.settings.visualizationMode}
        isPlaying={props.playback.isPlaying}
        hasTrack={Boolean(props.currentTrack)}
        seed={props.currentTrack?.id ?? ""}
        className="audio-visualizer--backdrop"
      />
    </div>
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
    />
  );
}
