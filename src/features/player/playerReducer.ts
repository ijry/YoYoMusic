import type { PlaybackState } from "../../shared/types";

export type PlayerAction = { type: "player/snapshot"; state: PlaybackState };

const initialState: PlaybackState = {
  trackId: null,
  positionMs: 0,
  durationMs: 0,
  volume: 0.8,
  isPlaying: false,
  isMuted: false,
  playMode: "sequence",
  eqEnabled: false,
};

function clampVolume(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function playerReducer(
  state: PlaybackState = initialState,
  action: PlayerAction,
): PlaybackState {
  if (action.type === "player/snapshot") {
    return { ...action.state, volume: clampVolume(action.state.volume) };
  }

  return state;
}
