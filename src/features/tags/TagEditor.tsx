import { useEffect, useState } from "react";
import type { Track } from "../../shared/types";

export interface TagDraft {
  title: string;
  artist: string;
  album: string;
  coverPath: string | null;
}

interface TagEditorProps {
  track: Track | null;
  onSave: (draft: TagDraft) => void;
}

export function TagEditor({ track, onSave }: TagEditorProps) {
  const [draft, setDraft] = useState<TagDraft>({
    title: "",
    artist: "",
    album: "",
    coverPath: null,
  });

  useEffect(() => {
    setDraft({
      title: track?.title ?? "",
      artist: track?.artist ?? "",
      album: track?.album ?? "",
      coverPath: track?.coverArtRef ?? null,
    });
  }, [track]);

  if (!track) {
    return (
      <section className="tag-editor" aria-label="标签编辑">
        <div className="tag-editor__header">
          <div>
            <p className="eyebrow">Tag Service Deck</p>
            <h2>标签编辑</h2>
          </div>
          <span className="tag-editor__status">未选择曲目</span>
        </div>
        <p className="empty-state">选择一首歌曲后编辑标签。</p>
      </section>
    );
  }

  return (
    <form
      className="tag-editor"
      aria-label="标签编辑"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(draft);
      }}
    >
      <div className="tag-editor__header">
        <div>
          <p className="eyebrow">Tag Service Deck</p>
          <h2>标签编辑</h2>
        </div>
        <span className="tag-editor__status">当前曲目 {track.title}</span>
      </div>
      <label className="tag-editor__field">
        标题
        <input
          aria-label="标题"
          value={draft.title}
          onChange={(event) => setDraft({ ...draft, title: event.currentTarget.value })}
        />
      </label>
      <label className="tag-editor__field">
        歌手
        <input
          aria-label="歌手"
          value={draft.artist}
          onChange={(event) => setDraft({ ...draft, artist: event.currentTarget.value })}
        />
      </label>
      <label className="tag-editor__field">
        专辑
        <input
          aria-label="专辑"
          value={draft.album}
          onChange={(event) => setDraft({ ...draft, album: event.currentTarget.value })}
        />
      </label>
      <div className="tag-editor__actions">
        <button type="submit">保存标签</button>
      </div>
    </form>
  );
}
