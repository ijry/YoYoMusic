import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePlaybackProjection } from "./usePlaybackProjection";
import type { PlaybackState, PlaylistSnapshot, Track } from "./types";

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
  };
});

vi.mock("./tauri", () => ({
  isTauriRuntime: () => true,
  invokeCommand: vi.fn(async (command: string) => {
    if (command === "get_playlist") return testState.playlistSnapshot;
    if (command === "get_playback_state") return testState.stoppedPlayback;
    return {};
  }),
  listenToAppEvent: vi.fn(async (event: string, handler: (payload: unknown) => void) => {
    testState.listeners.set(event, handler);
    return vi.fn();
  }),
}));

function Probe() {
  const { currentTrack, playback } = usePlaybackProjection();
  return (
    <div>
      <span>{currentTrack?.title ?? "none"}</span>
      <span>{playback.isPlaying ? "playing" : "stopped"}</span>
    </div>
  );
}

describe("usePlaybackProjection", () => {
  beforeEach(() => {
    testState.listeners.clear();
  });

  it("updates track and playback from app events", async () => {
    render(<Probe />);
    expect(await screen.findByText("Song A")).toBeInTheDocument();

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

    expect(screen.getByText("Song B")).toBeInTheDocument();
    expect(screen.getByText("playing")).toBeInTheDocument();
  });
});
