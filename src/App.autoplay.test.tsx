import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { invokeCommand } from "./shared/tauri";
import type { AppSettings, PlaybackState, PlaylistSnapshot, Track } from "./shared/types";

const testState = vi.hoisted(() => {
  function track(id: string, title: string): Track {
    return {
      id,
      filePath: `${id}.mp3`,
      title,
      artist: "",
      album: "",
      durationMs: 1000,
      coverArtRef: null,
      lyricsRef: null,
      tagStatus: "clean",
      status: "ready",
    };
  }

  return {
    listeners: new Map<string, (payload: unknown) => void>(),
    playlistSnapshot: {
      playlist: {
        id: "default",
        name: "当前播放列表",
        trackIds: ["a", "b"],
        currentIndex: 0,
        playMode: "sequence",
      },
      tracks: [track("a", "Song A"), track("b", "Song B")],
    } satisfies PlaylistSnapshot,
    stoppedPlayback: {
      trackId: "a",
      positionMs: 0,
      durationMs: 1000,
      volume: 0.8,
      isPlaying: false,
      isMuted: false,
      playMode: "sequence",
      eqEnabled: false,
    } satisfies PlaybackState,
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
    } satisfies AppSettings,
  };
});

vi.mock("./shared/tauri", () => ({
  isTauriRuntime: () => true,
  invokeCommand: vi.fn(async (command: string, payload?: Record<string, unknown>) => {
    if (command === "get_playlist") return testState.playlistSnapshot;
    if (command === "get_playback_state") return testState.stoppedPlayback;
    if (command === "load_settings") return testState.settings;
    if (command === "apply_skin") return payload?.skinId;
    if (command === "save_settings") {
      testState.settings = payload?.settings as AppSettings;
      return testState.settings;
    }
    return {};
  }),
  listenToAppEvent: vi.fn(async (event: string, handler: (payload: unknown) => void) => {
    testState.listeners.set(event, handler);
    return vi.fn();
  }),
}));

vi.mock("./shared/fileDialog", () => ({
  openAudioFiles: vi.fn(async () => []),
  openAudioFolders: vi.fn(async () => []),
  openSkinPackageFolder: vi.fn(async () => null),
}));

describe("App autoplay events", () => {
  beforeEach(() => {
    testState.listeners.clear();
    vi.mocked(invokeCommand).mockClear();
  });

  it("updates the now playing card from playlist and playback events", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Song A" })).toBeInTheDocument();

    act(() => {
      testState.listeners.get("playlist_changed")?.({
        ...testState.playlistSnapshot,
        playlist: { ...testState.playlistSnapshot.playlist, currentIndex: 1 },
      });
      testState.listeners.get("playback_state_changed")?.({
        ...testState.stoppedPlayback,
        trackId: "b",
        isPlaying: true,
      });
    });

    expect(screen.getByRole("heading", { name: "Song B" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "暂停" })).toBeInTheDocument();
  });

  it("opens the skin panel and applies a built-in layout skin in Tauri mode", async () => {
    const user = userEvent.setup();
    const { container } = render(<App />);

    const windowActions = await screen.findByRole("navigation", { name: "窗口操作" });
    await user.click(within(windowActions).getByRole("button", { name: "皮肤" }));
    expect(screen.getByRole("heading", { name: "皮肤管理" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "应用 暗夜黑胶舱" }));

    expect(invokeCommand).toHaveBeenCalledWith("apply_skin", { skinId: "dark-vinyl" });
    expect(container.querySelector(".skin-layout--dark-vinyl")).toBeInTheDocument();
  });
});
