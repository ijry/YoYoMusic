import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { builtInLayoutSkins } from "./layoutRegistry";
import type { PlayerLayoutProps } from "./layoutTypes";

const machineLabels: Record<
  string,
  { shellClass: string; labels: string[]; hardware: Array<{ selector: string; count: number }> }
> = {
  "classic-blue-silver": {
    shellClass: "device-shell--classic",
    labels: ["频谱可视化", "播放列表", "正在播放", "功能面板", "播放控制"],
    hardware: [
      { selector: ".device-shell__split-rail", count: 2 },
      { selector: ".device-shell__center-seam", count: 1 },
    ],
  },
  "dark-vinyl": {
    shellClass: "device-shell--vinyl",
    labels: ["唱盘舱", "舞台频谱", "曲目塔", "控制塔", "控制台"],
    hardware: [
      { selector: ".device-shell__arc-platter", count: 1 },
      { selector: ".device-shell__arc-rail", count: 1 },
    ],
  },
  "transparent-crystal": {
    shellClass: "device-shell--crystal",
    labels: ["透明舱", "资料匣", "悬浮仓", "底座控制台"],
    hardware: [
      { selector: ".device-shell__standoff", count: 4 },
      { selector: ".device-shell__glass-bracket", count: 1 },
    ],
  },
  "metal-rack": {
    shellClass: "device-shell--rack",
    labels: ["频谱桥", "机柜面板", "状态机柜", "机架控制台"],
    hardware: [
      { selector: ".device-shell__rack-ear", count: 2 },
      { selector: ".device-shell__rack-rail", count: 2 },
    ],
  },
  "warm-wood": {
    shellClass: "device-shell--wood",
    labels: ["陈列窗", "节目单仓", "暖光铭牌窗", "黄铜控制台"],
    hardware: [
      { selector: ".device-shell__molding", count: 2 },
      { selector: ".device-shell__brass-plaque", count: 1 },
    ],
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
    expect(container.querySelector(".device-shell__plate")).toBeInTheDocument();
    expect(container.querySelectorAll(".device-shell__handle")).toHaveLength(2);
    expect(container.querySelectorAll(".device-shell__vent")).toHaveLength(4);
    expect(container.querySelectorAll(".device-shell__foot")).toHaveLength(2);
    expected.hardware.forEach(({ selector, count }) => {
      expect(container.querySelectorAll(selector)).toHaveLength(count);
    });
    expect(container.querySelector(".now-playing-display")).toBeInTheDocument();
    expect(container.querySelector(".cover-card__hub")).toBeInTheDocument();
    expect(container.querySelector(".device-module__trim")).toBeInTheDocument();
    expect(container.querySelectorAll(".device-module__rivet")).toHaveLength(10);
    expect(container.querySelector(".title-status-cluster")).toBeInTheDocument();
    expect(container.querySelectorAll(".title-action-button")).toHaveLength(4);
    expect(container.querySelector(".title-action-button__code")).not.toBeInTheDocument();
    expect(screen.queryByText("SKN")).not.toBeInTheDocument();
    expect(screen.queryByText("CFG")).not.toBeInTheDocument();
    expect(screen.queryByText("MINI")).not.toBeInTheDocument();
    expect(screen.queryByText("LRC")).not.toBeInTheDocument();
    expect(container.querySelector(".feature-tab__slot")).toBeInTheDocument();

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
