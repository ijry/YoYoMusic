import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { visualizationModes } from "../visualization/modes";
import { builtInLayoutSkins } from "./layoutRegistry";
import type { PlayerLayoutProps } from "./layoutTypes";

function createProps(): PlayerLayoutProps {
  return {
    playlist: {
      playlist: {
        id: "default",
        name: "当前播放列表",
        trackIds: ["a"],
        currentIndex: 0,
        playMode: "sequence",
      },
      tracks: [
        {
          id: "a",
          filePath: "a.mp3",
          title: "Song A",
          artist: "Artist A",
          album: "Album A",
          durationMs: 180000,
          coverArtRef: null,
          lyricsRef: null,
          tagStatus: "clean",
          status: "ready",
        },
      ],
    },
    playback: {
      trackId: "a",
      positionMs: 12000,
      durationMs: 180000,
      volume: 0.8,
      isPlaying: false,
      isMuted: false,
      playMode: "sequence",
      eqEnabled: false,
    },
    currentTrack: {
      id: "a",
      filePath: "a.mp3",
      title: "Song A",
      artist: "Artist A",
      album: "Album A",
      durationMs: 180000,
      coverArtRef: null,
      lyricsRef: null,
      tagStatus: "clean",
      status: "ready",
    },
    lyricsDocument: null,
    settings: {
      defaultSkin: "aurora-glass",
      shortcuts: {},
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
    },
    skins: [],
    activePanel: "lyrics",
    libraryOpen: true,
    visualizerMaximized: false,
    error: null,
    skinError: null,
    settingsErrorCode: null,
    onActivePanelChange: vi.fn(),
    onToggleLibrary: vi.fn(),
    onToggleVisualizerMaximized: vi.fn(),
    onPlayerCommand: vi.fn(),
    onAddFiles: vi.fn(),
    onAddFolder: vi.fn(),
    onClearPlaylist: vi.fn(),
    onSaveTags: vi.fn(),
    onApplySkin: vi.fn(),
    onImportSkin: vi.fn(),
    onShortcutChange: vi.fn(),
    onVisualizationModeChange: vi.fn(),
    onSettingsChange: vi.fn(),
  };
}

describe("layout skins", () => {
  it.each(builtInLayoutSkins)("renders the modern shell for $name", (skin) => {
    const props = createProps();
    const { container } = render(<skin.Layout {...props} />);

    expect(container.querySelector(`.skin-layout--${skin.id}`)).toBeInTheDocument();
    expect(container.querySelector(".modern-frame")).toBeInTheDocument();
    expect(container.querySelector(".modern-grid")).toBeInTheDocument();

    expect(screen.getByRole("heading", { name: "悠悠乐听" })).toBeInTheDocument();
    expect(container.querySelector(".app-title__model")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "当前播放列表" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "功能面板" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "播放动态可视化" })).toBeInTheDocument();

    // Every mode is reachable straight from the stage, plus the expand chip
    // that takes the canvas full-frame.
    expect(container.querySelectorAll(".viz-switcher__chip")).toHaveLength(
      visualizationModes.length + 1,
    );
    expect(container.querySelector(".audio-visualizer--hero")).toBeInTheDocument();
    expect(container.querySelector(".viz-backdrop")).not.toBeInTheDocument();
    expect(container.querySelector(".chrome")).toHaveAttribute("data-viz", "docked");

    // The now-playing display lives in the transport bar, cover included.
    const controls = screen.getByRole("region", { name: "播放控制" });
    expect(container.querySelector(".player-controls .cover-art")).toBeInTheDocument();
    expect(container.querySelector(".player-controls__copy strong")).toHaveTextContent("Song A");
    expect(within(controls).getByRole("button", { name: "播放" })).toBeInTheDocument();
    expect(within(controls).getByRole("slider", { name: "播放进度" })).toBeInTheDocument();
    // Volume is behind the speaker button; the slider is not in the deck until
    // it is opened.
    expect(within(controls).getByRole("button", { name: "音量" })).toBeInTheDocument();
    expect(within(controls).queryByRole("slider", { name: "音量大小" })).not.toBeInTheDocument();

    // Feature icons always visible; the drawer only when a panel is selected.
    expect(container.querySelectorAll(".feature-rail .feature-tab")).toHaveLength(6);
    expect(container.querySelector(".feature-drawer")).toBeInTheDocument();

    // The top bar carries window-level actions only: skin/settings live in the
    // feature rail, so a duplicated copy here would be the redundant button the
    // redesign removed.
    expect(container.querySelectorAll(".title-action-button")).toHaveLength(3);
    const windowActions = screen.getByRole("navigation", { name: "窗口操作" });
    expect(within(windowActions).getByRole("button", { name: "播放列表" })).toBeInTheDocument();
    expect(within(windowActions).getByRole("button", { name: "迷你模式" })).toBeInTheDocument();
    expect(within(windowActions).getByRole("button", { name: "桌面歌词" })).toBeInTheDocument();
    expect(container.querySelector(".feature-tab .lucide")).toBeInTheDocument();
  });

  it("collapses the inspector to its icon rail when no panel is selected", () => {
    const props = createProps();
    props.activePanel = null;
    const AuroraLayout = builtInLayoutSkins[0].Layout;
    const { container } = render(<AuroraLayout {...props} />);

    expect(container.querySelector(".feature-rail")).toBeInTheDocument();
    expect(container.querySelector(".feature-drawer")).not.toBeInTheDocument();
    expect(container.querySelector(".modern-grid")).toHaveAttribute("data-inspector", "closed");
    expect(screen.getByRole("complementary", { name: "功能面板" })).toBeInTheDocument();
  });

  it("drops the library column when the playlist is hidden", () => {
    const props = createProps();
    props.libraryOpen = false;
    const AuroraLayout = builtInLayoutSkins[0].Layout;
    const { container } = render(<AuroraLayout {...props} />);

    expect(screen.queryByRole("region", { name: "当前播放列表" })).not.toBeInTheDocument();
    expect(container.querySelector(".modern-grid")).toHaveAttribute("data-library", "closed");
    expect(container.querySelector(".modern-panel--viz")).toBeInTheDocument();
  });

  it("renders the selected visualization mode in the feature panel", () => {
    const props = createProps();
    props.activePanel = "visualization";
    props.settings.visualizationMode = "radial";
    props.playback.isPlaying = true;
    const AuroraLayout = builtInLayoutSkins[0].Layout;
    const { container } = render(<AuroraLayout {...props} />);

    expect(container.querySelector(".feature-content .audio-visualizer--panel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "环形律动" })).toHaveAttribute("aria-pressed", "true");
    expect(container.querySelectorAll(".visualization-mode-button")).toHaveLength(
      visualizationModes.length,
    );
  });

  it("toggles a panel off when its rail icon is clicked again", async () => {
    const user = userEvent.setup();
    const props = createProps();
    props.activePanel = "lyrics";
    const AuroraLayout = builtInLayoutSkins[0].Layout;
    render(<AuroraLayout {...props} />);

    await user.click(screen.getByRole("button", { name: "歌词" }));
    expect(props.onActivePanelChange).toHaveBeenCalledWith(null);
  });

  describe("maximised visualiser", () => {
    function renderMaximized() {
      const props = createProps();
      props.visualizerMaximized = true;
      const AuroraLayout = builtInLayoutSkins[0].Layout;
      return { props, ...render(<AuroraLayout {...props} />) };
    }

    it("moves the canvas to a frame-level layer behind the chrome", () => {
      const { container } = renderMaximized();

      expect(container.querySelector(".chrome")).toHaveAttribute("data-viz", "maximized");
      expect(container.querySelector(".viz-backdrop .audio-visualizer--backdrop")).toBeInTheDocument();
      // Only one canvas is ever mounted — a second would be a second animation
      // loop drawing the same thing.
      expect(container.querySelectorAll("canvas")).toHaveLength(1);
      expect(container.querySelector(".audio-visualizer--hero")).not.toBeInTheDocument();
    });

    /*
     * The placeholder keeps the middle grid column occupied. Without it the
     * column would collapse and the inspector would slide left.
     */
    it("keeps the middle grid column occupied", () => {
      const { container } = renderMaximized();

      expect(container.querySelector(".modern-panel--viz")).toHaveClass("is-maximized-placeholder");
      expect(container.querySelector(".modern-grid")).toBeInTheDocument();
      expect(container.querySelector(".modern-panel--inspector")).toBeInTheDocument();
    });

    /*
     * The switcher stays in the middle column rather than moving into the
     * backdrop, which would bury it under the window controls.
     */
    it("keeps the mode switcher reachable, in the same place", () => {
      const { container } = renderMaximized();

      expect(container.querySelector(".viz-backdrop .viz-switcher")).not.toBeInTheDocument();
      expect(container.querySelector(".modern-panel--viz .viz-switcher")).toBeInTheDocument();
      expect(container.querySelectorAll(".viz-switcher__chip")).toHaveLength(
      visualizationModes.length + 1,
    );
      expect(screen.getByRole("button", { name: "还原可视化" })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "最大化可视化" })).not.toBeInTheDocument();
    });

    it("reports the toggle back to the app", async () => {
      const user = userEvent.setup();
      const { props } = renderMaximized();

      await user.click(screen.getByRole("button", { name: "还原可视化" }));
      expect(props.onToggleVisualizerMaximized).toHaveBeenCalledTimes(1);
    });

    it("leaves the rest of the chrome mounted so it can float on top", () => {
      const { container } = renderMaximized();

      expect(container.querySelector(".modern-topbar")).toBeInTheDocument();
      expect(screen.getByRole("region", { name: "播放控制" })).toBeInTheDocument();
      expect(screen.getByRole("region", { name: "当前播放列表" })).toBeInTheDocument();
      // The decorative blobs would muddy the canvas.
      expect(container.querySelector(".modern-aurora")).toBeInTheDocument();
    });
  });
});
