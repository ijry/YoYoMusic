import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { builtInLayoutSkins } from "./layoutRegistry";
import type { PlayerLayoutProps } from "./layoutTypes";

const machineLabels: Record<string, { shellClass: string; labels: string[] }> = {
  "classic-blue-silver": {
    shellClass: "device-shell--classic",
    labels: ["频谱可视化", "播放列表", "正在播放", "功能面板", "播放控制"],
  },
  "dark-vinyl": {
    shellClass: "device-shell--vinyl",
    labels: ["唱盘舱", "舞台频谱", "曲目塔", "控制塔", "控制台"],
  },
  "transparent-crystal": {
    shellClass: "device-shell--crystal",
    labels: ["透明舱", "资料匣", "悬浮仓", "底座控制台"],
  },
  "metal-rack": {
    shellClass: "device-shell--rack",
    labels: ["频谱桥", "机柜面板", "状态机柜", "机架控制台"],
  },
  "warm-wood": {
    shellClass: "device-shell--wood",
    labels: ["陈列窗", "节目单仓", "暖光铭牌窗", "黄铜控制台"],
  },
};

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
      defaultSkin: "classic-blue-silver",
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
    error: null,
    skinError: null,
    settingsErrorCode: null,
    visualizationFrame: {
      values: Array.from({ length: 24 }, (_, index) => 0.2 + index / 32),
      peak: 0.9,
      positionMs: 12000,
    },
    onActivePanelChange: vi.fn(),
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
  it.each(builtInLayoutSkins)("renders machine-shell labels and controls for $name", (skin) => {
    const props = createProps();
    const expected = machineLabels[skin.id];
    const { container } = render(<skin.Layout {...props} />);

    expect(container.querySelector(`.${expected.shellClass}`)).toBeInTheDocument();
    expected.labels.forEach((label) => {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    });

    expect(screen.getByRole("heading", { name: "悠悠乐听" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "当前播放列表" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "当前播放" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "功能面板" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "播放动态可视化" })).toBeInTheDocument();
    expect(container.querySelector(".workbench-visualization .visualization-preview--spectrum")).toBeInTheDocument();
    expect(container.querySelector(".workbench-visualization .visualization-preview--hero")).toBeInTheDocument();
    expect(container.querySelector(".app-title__model")).toBeInTheDocument();
    expect(container.querySelector(".now-playing-display")).toBeInTheDocument();
    expect(container.querySelector(".cover-card__hub")).toBeInTheDocument();

    // Faux hardware (handles, vents, feet, rivets, rack ears, nameplate) was
    // removed: it read as clutter and was what squeezed content out of the
    // layout. Only a per-skin signature element remains.
    expect(container.querySelector(".device-shell__handle")).not.toBeInTheDocument();
    expect(container.querySelector(".device-shell__vent")).not.toBeInTheDocument();
    expect(container.querySelector(".device-shell__foot")).not.toBeInTheDocument();
    expect(container.querySelector(".device-module__trim")).not.toBeInTheDocument();
    expect(container.querySelector(".device-module__rivet")).not.toBeInTheDocument();
    expect(container.querySelector(".device-shell__plate")).not.toBeInTheDocument();
    expect(container.querySelector(".device-module__eyebrow")).not.toBeInTheDocument();

    // Icon-only chrome keeps its accessible names. "皮肤"/"设置" appear both in
    // the title bar and as feature tabs, so scope the query to the title nav.
    expect(container.querySelector(".title-status-cluster")).toBeInTheDocument();
    expect(container.querySelectorAll(".title-action-button")).toHaveLength(4);
    const windowActions = screen.getByRole("navigation", { name: "窗口操作" });
    expect(within(windowActions).getByRole("button", { name: "皮肤" })).toBeInTheDocument();
    expect(within(windowActions).getByRole("button", { name: "桌面歌词" })).toBeInTheDocument();
    expect(container.querySelector(".feature-tab .lucide")).toBeInTheDocument();
    expect(container.querySelector(".feature-tab__slot")).not.toBeInTheDocument();

    const controls = screen.getByRole("region", { name: "播放控制" });
    expect(within(controls).getByRole("button", { name: "播放" })).toBeInTheDocument();
    expect(within(controls).getByRole("slider", { name: "播放进度" })).toBeInTheDocument();
    expect(within(controls).getByRole("spinbutton", { name: "音量" })).toBeInTheDocument();
  });

  it("renders the selected visualization mode in the feature panel", () => {
    const props = createProps();
    props.activePanel = "visualization";
    props.settings.visualizationMode = "radial";
    props.playback.isPlaying = true;
    const ClassicLayout = builtInLayoutSkins[0].Layout;
    const { container } = render(<ClassicLayout {...props} />);

    expect(container.querySelector(".feature-content .visualization-preview--radial")).toBeInTheDocument();
    expect(container.querySelector(".feature-content .visualization-radial-ring--outer")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "环形脉冲" })).toHaveAttribute("aria-pressed", "true");
  });
});
