import { Icon } from "../../shared/icons";
import type { Track } from "../../shared/types";

interface PlaylistPanelProps {
  tracks: Track[];
  currentTrackId: string | null;
  onPlay: (trackId: string) => void;
  onRemove: (trackId: string) => void;
  onAddFiles?: () => void;
  onAddFolder?: () => void;
  onClear?: () => void;
}

function formatTrackNumber(index: number) {
  return String(index + 1).padStart(2, "0");
}

function formatDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function PlaylistPanel({
  tracks,
  currentTrackId,
  onPlay,
  onRemove,
  onAddFiles,
  onAddFolder,
  onClear,
}: PlaylistPanelProps) {
  return (
    <section className="playlist-panel" aria-labelledby="playlist-title">
      <div className="panel-heading">
        <h2 id="playlist-title">当前播放列表</h2>
        <span className="playlist-panel__counter">{tracks.length} 首</span>
      </div>

      <div className="playlist-actions playlist-actions--drawer" aria-label="播放列表操作">
        <button
          type="button"
          className="playlist-action-button"
          aria-label="添加文件"
          title="添加文件"
          onClick={onAddFiles}
        >
          <Icon.addFiles />
        </button>
        <button
          type="button"
          className="playlist-action-button"
          aria-label="添加文件夹"
          title="添加文件夹"
          onClick={onAddFolder}
        >
          <Icon.addFolder />
        </button>
        <button
          type="button"
          className="playlist-action-button"
          aria-label="清空"
          title="清空"
          onClick={onClear}
          disabled={tracks.length === 0}
        >
          <Icon.clear />
        </button>
      </div>

      {tracks.length === 0 ? (
        <p className="empty-state">添加本地音乐文件后开始播放。</p>
      ) : (
        <ol className="track-list">
          {tracks.map((track, index) => {
            const isCurrent = track.id === currentTrackId;
            return (
              <li key={track.id} className={isCurrent ? "track-item is-current" : "track-item"}>
                <span className="track-index" aria-hidden="true">
                  {formatTrackNumber(index)}
                </span>
                {/* Always rendered so every row keeps the same grid tracks. */}
                <span className={isCurrent ? "track-eq is-live" : "track-eq"} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </span>
                <button type="button" onClick={() => onPlay(track.id)} className="track-main">
                  <strong>{track.title}</strong>
                  {/* Status flags share the artist line so the title keeps the
                      full column width instead of being squeezed by badges. */}
                  <span className="track-main__meta">
                    <span className="track-main__artist">{track.artist || "未知歌手"}</span>
                    {isCurrent ? <span className="track-flag track-flag--current">正在播放</span> : null}
                    {track.status === "missing" ? <span className="track-flag track-flag--missing">文件丢失</span> : null}
                    {track.status === "unplayable" ? <span className="track-flag track-flag--error">不可播放</span> : null}
                  </span>
                </button>
                <span className="track-duration">{formatDuration(track.durationMs)}</span>
                <button
                  type="button"
                  onClick={() => onRemove(track.id)}
                  className="ghost-button"
                  aria-label={`移除 ${track.title}`}
                  title="移除"
                >
                  <Icon.remove />
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
