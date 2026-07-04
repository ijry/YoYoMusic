import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { DesktopLyrics } from "./features/lyrics/DesktopLyrics";
import { MiniPlayer } from "./features/mini/MiniPlayer";

function RootWindow() {
  const windowName = new URLSearchParams(window.location.search).get("window");

  if (windowName === "mini") {
    return (
      <MiniPlayer
        title="悠悠乐听"
        artist="迷你模式"
        isPlaying={false}
        onCommand={(command, payload) => console.debug(command, payload)}
      />
    );
  }

  if (windowName === "desktop-lyrics") {
    return (
      <DesktopLyrics
        currentLine="悠悠乐听桌面歌词"
        locked={false}
        onToggleClickThrough={() => console.debug("toggle click through")}
      />
    );
  }

  return <App />;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RootWindow />
  </StrictMode>,
);
