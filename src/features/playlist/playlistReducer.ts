import type { Playlist, Track } from "../../shared/types";

export interface PlaylistState {
  playlist: Playlist;
  tracks: Record<string, Track>;
}

export type PlaylistAction = {
  type: "playlist/snapshot";
  playlist: Playlist;
  tracks: Track[];
};

const initialState: PlaylistState = {
  playlist: {
    id: "default",
    name: "当前播放列表",
    trackIds: [],
    currentIndex: 0,
    playMode: "sequence",
  },
  tracks: {},
};

export function playlistReducer(
  state: PlaylistState = initialState,
  action: PlaylistAction,
): PlaylistState {
  if (action.type !== "playlist/snapshot") {
    return state;
  }

  return {
    playlist: action.playlist,
    tracks: Object.fromEntries(action.tracks.map((track) => [track.id, track])),
  };
}
