import type { CommandName, CommandPayload } from "../../shared/tauri";
import { DragRegion, WindowButtons } from "../shell/WindowChrome";
import { Icon } from "../../shared/icons";

interface MiniPlayerProps {
  title: string;
  artist: string;
  isPlaying: boolean;
  onCommand: (command: CommandName, payload: CommandPayload) => void;
  onToggleDesktopLyrics?: () => void;
}

/*
 * Compact always-on-top strip.
 *
 * "Mini mode" means *only* this window: opening it hides the main window, and
 * closing it brings the main window back. The OS title bar is off, so the drag
 * region and the single close button here are the whole chrome.
 */
export function MiniPlayer({
  title,
  artist,
  isPlaying,
  onCommand,
  onToggleDesktopLyrics,
}: MiniPlayerProps) {
  return (
    <DragRegion className="mini-player" aria-label="迷你播放器">
      <div className="mini-player__bar">
        <div className="mini-cover" aria-hidden="true">
          <span className="mini-cover__glyph">
            <Icon.disc size={18} />
          </span>
        </div>

        <div className="mini-copy">
          <strong>{title}</strong>
          <span>{artist}</span>
        </div>

        <div className="mini-player__actions">
          <button
            type="button"
            className="mini-icon-button"
            aria-label="桌面歌词"
            title="桌面歌词"
            onClick={() => onToggleDesktopLyrics?.()}
          >
            <Icon.desktopLyrics size={16} />
          </button>
          <button
            type="button"
            className="mini-icon-button"
            aria-label="上一首"
            title="上一首"
            onClick={() => onCommand("previous_track", {})}
          >
            <Icon.prev size={18} />
          </button>
          <button
            type="button"
            className="mini-icon-button mini-icon-button--primary"
            aria-label={isPlaying ? "暂停" : "播放"}
            title={isPlaying ? "暂停" : "播放"}
            onClick={() => onCommand("toggle_playback", {})}
          >
            {isPlaying ? <Icon.pause size={18} /> : <Icon.play size={18} />}
          </button>
          <button
            type="button"
            className="mini-icon-button"
            aria-label="下一首"
            title="下一首"
            onClick={() => onCommand("next_track", {})}
          >
            <Icon.next size={18} />
          </button>
          <button
            type="button"
            className="mini-icon-button"
            aria-label="静音"
            title="静音"
            onClick={() => onCommand("set_muted", { value: true })}
          >
            <Icon.muted size={18} />
          </button>
          <WindowButtons showMaximize={false} showMinimize={false} closeLabel="关闭迷你播放器" />
        </div>
      </div>
    </DragRegion>
  );
}
