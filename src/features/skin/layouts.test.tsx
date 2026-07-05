import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
  it.each(builtInLayoutSkins)("renders accessible shell controls for $name", (skin) => {
    const props = createProps();
    const { container } = render(<skin.Layout {...props} />);

    expect(container.firstElementChild).toHaveClass(`skin-layout--${skin.id}`);
    expect(screen.getByRole("heading", { name: "悠悠乐听" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "当前播放列表" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "当前播放" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "功能面板" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "播放动态可视化" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Song A" })).toBeInTheDocument();

    const controls = screen.getByRole("region", { name: "播放控制" });
    expect(within(controls).getByRole("button", { name: "播放" })).toBeInTheDocument();
    expect(within(controls).getByRole("slider", { name: "播放进度" })).toBeInTheDocument();
    expect(within(controls).getByRole("spinbutton", { name: "音量" })).toBeInTheDocument();
  });
});
