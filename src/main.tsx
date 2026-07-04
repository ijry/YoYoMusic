import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { DesktopLyrics } from "./features/lyrics/DesktopLyrics";
import { MiniPlayer } from "./features/mini/MiniPlayer";
import { invokeCommand, isTauriRuntime, type CommandName, type CommandPayload } from "./shared/tauri";
import type { PlaybackState, PlaylistSnapshot, Track } from "./shared/types";

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

function RootWindow() {
  const windowName = new URLSearchParams(window.location.search).get("window");

  if (windowName === "mini") {
    return <MiniPlayerRoute />;
  }

  if (windowName === "desktop-lyrics") {
    return <DesktopLyricsRoute />;
  }

  return <App />;
}

function MiniPlayerRoute() {
  const { currentTrack, playback, runCommand } = usePlaybackProjection();

  return (
    <MiniPlayer
      title={currentTrack?.title ?? "悠悠乐听"}
      artist={currentTrack?.artist || currentTrack?.album || "迷你模式"}
      isPlaying={playback.isPlaying}
      onCommand={(command, payload) => void runCommand(command, payload)}
    />
  );
}

function DesktopLyricsRoute() {
  const { currentTrack } = usePlaybackProjection();
  const line = currentTrack ? `${currentTrack.title} · ${currentTrack.artist || "未知歌手"}` : "悠悠乐听桌面歌词";

  return (
    <DesktopLyrics
      currentLine={line}
      locked={false}
      onToggleClickThrough={() => console.debug("toggle click through")}
    />
  );
}

function usePlaybackProjection() {
  const [playlist, setPlaylist] = useState<PlaylistSnapshot>(emptyPlaylist);
  const [playback, setPlayback] = useState<PlaybackState>(initialPlayback);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    let cancelled = false;
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
    const intervalId = window.setInterval(() => {
      void loadState();
    }, 500);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
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
  ].includes(command);
}

function isPlaylistCommand(command: CommandName) {
  return command === "add_tracks" || command === "remove_track" || command === "clear_playlist";
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootWindow />
  </StrictMode>,
);
