import { useEffect, useState } from "react";
import {
  invokeCommand,
  isTauriRuntime,
  listenToAppEvent,
  type CommandName,
  type CommandPayload,
} from "./tauri";
import type { PlaybackState, PlaylistSnapshot, Track } from "./types";

const emptyPlaylist: PlaylistSnapshot = {
  playlist: {
    id: "default",
    name: "当前播放列表",
    trackIds: [],
    currentIndex: 0,
    playMode: "sequence",
  },
  tracks: [],
};

const initialPlayback: PlaybackState = {
  trackId: null,
  positionMs: 0,
  durationMs: 0,
  volume: 0.8,
  isPlaying: false,
  isMuted: false,
  playMode: "sequence",
  eqEnabled: false,
};

export function usePlaybackProjection() {
  const [playlist, setPlaylist] = useState<PlaylistSnapshot>(emptyPlaylist);
  const [playback, setPlayback] = useState<PlaybackState>(initialPlayback);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    let cancelled = false;
    const unlisteners: Array<() => void> = [];

    async function loadState() {
      const [playlistSnapshot, playbackState] = await Promise.all([
        invokeCommand<PlaylistSnapshot>("get_playlist"),
        invokeCommand<PlaybackState>("get_playback_state"),
      ]);

      if (!cancelled) {
        setPlaylist(playlistSnapshot);
        setPlayback(playbackState);
      }
    }

    void loadState();
    void listenToAppEvent<PlaylistSnapshot>("playlist_changed", setPlaylist).then((unlisten) => {
      if (cancelled) {
        unlisten();
      } else {
        unlisteners.push(unlisten);
      }
    });
    void listenToAppEvent<PlaybackState>("playback_state_changed", setPlayback).then((unlisten) => {
      if (cancelled) {
        unlisten();
      } else {
        unlisteners.push(unlisten);
      }
    });

    const intervalId = window.setInterval(() => {
      void loadState();
    }, 500);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, []);

  async function runCommand(command: CommandName, payload: CommandPayload = {}) {
    if (!isTauriRuntime()) {
      console.debug(command, payload);
      return;
    }

    if (isPlaybackCommand(command)) {
      setPlayback(await invokeCommand<PlaybackState>(command, payload));
    } else if (isPlaylistCommand(command)) {
      setPlaylist(await invokeCommand<PlaylistSnapshot>(command, payload));
    } else {
      await invokeCommand<unknown>(command, payload);
    }
  }

  return {
    currentTrack: findCurrentTrack(playlist, playback.trackId),
    playback,
    runCommand,
  };
}

function findCurrentTrack(snapshot: PlaylistSnapshot, trackId: string | null): Track | null {
  if (trackId) {
    const track = snapshot.tracks.find((candidate) => candidate.id === trackId);
    if (track) return track;
  }

  const fallbackId = snapshot.playlist.trackIds[snapshot.playlist.currentIndex];
  return snapshot.tracks.find((candidate) => candidate.id === fallbackId) ?? null;
}

function isPlaybackCommand(command: CommandName) {
  return [
    "play_track",
    "toggle_playback",
    "pause_playback",
    "next_track",
    "previous_track",
    "seek",
    "set_volume",
    "set_muted",
    "set_play_mode",
    "get_playback_state",
    "run_playback_maintenance",
  ].includes(command);
}

function isPlaylistCommand(command: CommandName) {
  return command === "add_tracks" || command === "remove_track" || command === "clear_playlist";
}
