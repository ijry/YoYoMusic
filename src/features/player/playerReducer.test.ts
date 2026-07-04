import { describe, expect, it } from "vitest";
import { playerReducer } from "./playerReducer";

describe("playerReducer", () => {
  it("stores playback snapshot and clamps volume", () => {
    const state = playerReducer(undefined, {
      type: "player/snapshot",
      state: {
        trackId: "1",
        positionMs: 1200,
        durationMs: 3000,
        volume: 1.4,
        isPlaying: true,
        isMuted: false,
        playMode: "sequence",
        eqEnabled: false,
      },
    });

    expect(state.trackId).toBe("1");
    expect(state.volume).toBe(1);
  });
});
