import { StrictMode, useEffect } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { DesktopLyrics } from "./features/lyrics/DesktopLyrics";
import type { DesktopLyricsThemeId } from "./features/lyrics/desktopLyricsTheme";
import { MiniPlayer } from "./features/mini/MiniPlayer";
import { useDesktopLyricsSettings } from "./shared/useDesktopLyricsSettings";
import { usePlaybackProjection } from "./shared/usePlaybackProjection";
import { performWindowAction } from "./shared/windowControl";

function RootWindow() {
  const windowName = new URLSearchParams(window.location.search).get("window");

  /*
   * Marks the surface for CSS. The desktop-lyrics window is transparent at the
   * OS level, so it has to also be transparent down to `body` — otherwise the
   * window's own background colour becomes an opaque rectangle on the desktop.
   */
  useEffect(() => {
    document.body.dataset.window = windowName ?? "main";
  }, [windowName]);

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
      onToggleDesktopLyrics={() => void runCommand("toggle_desktop_lyrics", {})}
    />
  );
}

function DesktopLyricsRoute() {
  const { currentTrack, playback } = usePlaybackProjection();
  const { prefs, setTheme, setFontScale, toggleLock, toggleClickThrough } = useDesktopLyricsSettings();

  const line = currentTrack
    ? `${currentTrack.title} · ${currentTrack.artist || "未知歌手"}`
    : playback.isPlaying
      ? "悠悠乐听"
      : "暂无歌词";

  return (
    <DesktopLyrics
      currentLine={line}
      contextLine={playback.isPlaying ? "正在播放" : "已暂停"}
      themeId={prefs.theme as DesktopLyricsThemeId}
      fontScale={prefs.fontScale}
      locked={prefs.pinned}
      clickThrough={prefs.clickThrough}
      onThemeChange={setTheme}
      onFontScaleChange={setFontScale}
      onToggleLock={toggleLock}
      onToggleClickThrough={toggleClickThrough}
      onClose={() => void performWindowAction("close")}
    />
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootWindow />
  </StrictMode>,
);
