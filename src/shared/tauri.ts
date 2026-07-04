import { invoke } from "@tauri-apps/api/core";

export type CommandName =
  | "get_playlist"
  | "add_tracks"
  | "remove_track"
  | "clear_playlist"
  | "play_track"
  | "toggle_playback"
  | "pause_playback"
  | "next_track"
  | "previous_track"
  | "seek"
  | "set_volume"
  | "set_muted"
  | "set_play_mode"
  | "get_playback_state"
  | "load_lyrics"
  | "save_tags"
  | "validate_skin_package"
  | "apply_skin"
  | "open_mini_player"
  | "toggle_desktop_lyrics"
  | "save_settings"
  | "load_settings";

export type CommandPayload = Record<string, unknown>;

export function invokeCommand<T>(
  command: CommandName,
  payload: CommandPayload = {},
): Promise<T> {
  return invoke<T>(command, payload);
}
