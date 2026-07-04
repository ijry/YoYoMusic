import "./styles/theme.css";
import "./styles/app.css";
import { PlayerControls } from "./features/player/PlayerControls";
import { PlaylistPanel } from "./features/playlist/PlaylistPanel";
import type { CommandName, CommandPayload } from "./shared/tauri";
import type { PlaybackState, Track } from "./shared/types";

const demoTracks: Track[] = [
  {
    id: "demo-1",
    filePath: "",
    title: "把本地音乐拖进来",
    artist: "悠悠乐听",
    album: "默认播放列表",
    durationMs: 245000,
    coverArtRef: null,
    lyricsRef: null,
    tagStatus: "clean",
    status: "ready",
  },
];

const demoPlayback: PlaybackState = {
  trackId: "demo-1",
  positionMs: 72000,
  durationMs: 245000,
  volume: 0.72,
  isPlaying: false,
  isMuted: false,
  playMode: "sequence",
  eqEnabled: false,
};

export default function App() {
  const handleCommand = (command: CommandName, payload: CommandPayload) => {
    console.debug("player command", command, payload);
  };

  return (
    <main className="app-shell">
      <section className="chrome" aria-labelledby="app-title">
        <header className="title-bar">
          <div>
            <p className="eyebrow">YoYoMusic Desktop Player</p>
            <h1 id="app-title">悠悠乐听</h1>
          </div>
          <nav className="title-actions" aria-label="窗口操作">
            <button type="button">皮肤</button>
            <button type="button">设置</button>
            <button type="button">迷你模式</button>
          </nav>
        </header>

        <div className="workspace">
          <PlaylistPanel
            currentTrackId={demoPlayback.trackId}
            tracks={demoTracks}
            onPlay={(trackId) => handleCommand("play_track", { trackId })}
            onRemove={(trackId) => handleCommand("remove_track", { trackId })}
          />

          <section className="now-playing" aria-label="当前播放">
            <div className="cover-card" aria-hidden="true">
              <div className="disc-ring" />
            </div>
            <div>
              <p className="eyebrow">Now Playing</p>
              <h2>{demoTracks[0].title}</h2>
              <p className="subtitle">{demoTracks[0].artist}</p>
            </div>

            <div className="feature-tabs" aria-label="功能面板">
              <button type="button" aria-pressed="true">
                歌词
              </button>
              <button type="button">可视化</button>
              <button type="button">标签</button>
              <button type="button">均衡器</button>
            </div>
          </section>
        </div>

        <PlayerControls state={demoPlayback} onCommand={handleCommand} />
      </section>
    </main>
  );
}
