import type { Track } from "../../shared/types";

interface PlaylistPanelProps {
  tracks: Track[];
  currentTrackId: string | null;
  onPlay: (trackId: string) => void;
  onRemove: (trackId: string) => void;
}

export function PlaylistPanel({ tracks, currentTrackId, onPlay, onRemove }: PlaylistPanelProps) {
  return (
    <section className="playlist-panel" aria-labelledby="playlist-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Playlist</p>
          <h2 id="playlist-title">当前播放列表</h2>
        </div>
        <span>{tracks.length} 首</span>
      </div>

      {tracks.length === 0 ? (
        <p className="empty-state">添加本地音乐文件后开始播放。</p>
      ) : (
        <ol className="track-list">
          {tracks.map((track) => {
            const isCurrent = track.id === currentTrackId;
            return (
              <li key={track.id} className={isCurrent ? "track-item is-current" : "track-item"}>
                <button type="button" onClick={() => onPlay(track.id)} className="track-main">
                  <strong>{track.title}</strong>
                  <span>{track.artist || "未知歌手"}</span>
                </button>
                <div className="track-badges">
                  {isCurrent ? <span>正在播放</span> : null}
                  {track.status === "missing" ? <span>文件丢失</span> : null}
                  {track.status === "unplayable" ? <span>不可播放</span> : null}
                </div>
                <button type="button" onClick={() => onRemove(track.id)} className="ghost-button">
                  移除
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
