import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

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
  | "run_playback_maintenance"
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

export function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export type AppEventName = "playback_state_changed" | "playlist_changed";

export async function listenToAppEvent<T>(
  event: AppEventName,
  handler: (payload: T) => void,
): Promise<() => void> {
  return listen<T>(event, (eventPayload) => handler(eventPayload.payload));
}
