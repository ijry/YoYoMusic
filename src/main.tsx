import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { DesktopLyrics } from "./features/lyrics/DesktopLyrics";
import { MiniPlayer } from "./features/mini/MiniPlayer";
import { usePlaybackProjection } from "./shared/usePlaybackProjection";

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

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootWindow />
  </StrictMode>,
);
