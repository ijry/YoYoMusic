import type { CommandName, CommandPayload } from "../../shared/tauri";

interface MiniPlayerProps {
  title: string;
  artist: string;
  isPlaying: boolean;
  onCommand: (command: CommandName, payload: CommandPayload) => void;
}

export function MiniPlayer({ title, artist, isPlaying, onCommand }: MiniPlayerProps) {
  return (
    <main className="mini-player" aria-label="迷你播放器">
      <div className="mini-cover" aria-hidden="true" />
      <div className="mini-copy">
        <strong>{title}</strong>
        <span>{artist}</span>
      </div>
      <div className="transport-row">
        <button type="button" onClick={() => onCommand("previous_track", {})}>
          上一首
        </button>
        <button type="button" onClick={() => onCommand("toggle_playback", {})}>
          {isPlaying ? "暂停" : "播放"}
        </button>
        <button type="button" onClick={() => onCommand("next_track", {})}>
          下一首
        </button>
        <button type="button" onClick={() => onCommand("set_muted", { value: true })}>
          静音
        </button>
      </div>
    </main>
  );
}
