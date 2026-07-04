import { describe, expect, it } from "vitest";
import type { Playlist, Track } from "../../shared/types";
import { playlistReducer } from "./playlistReducer";

const playlist: Playlist = {
  id: "default",
  name: "当前播放列表",
  trackIds: ["1"],
  currentIndex: 0,
  playMode: "sequence",
};

const tracks: Track[] = [
  {
    id: "1",
    filePath: "a.mp3",
    title: "a",
    artist: "",
    album: "",
    durationMs: 0,
    coverArtRef: null,
    lyricsRef: null,
    tagStatus: "clean",
    status: "ready",
  },
];

describe("playlistReducer", () => {
  it("replaces playlist snapshot", () => {
    const state = playlistReducer(undefined, {
      type: "playlist/snapshot",
      playlist,
      tracks,
    });

    expect(state.playlist.trackIds).toEqual(["1"]);
    expect(state.tracks["1"].title).toBe("a");
  });
});
