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
    return <p className="empty-state">选择一首歌曲后编辑标签。</p>;
  }

  return (
    <form
      className="tag-editor"
      onSubmit={(event) => {
        event.preventDefault();
        onSave(draft);
      }}
    >
      <label>
        标题
        <input
          aria-label="标题"
          value={draft.title}
          onChange={(event) => setDraft({ ...draft, title: event.currentTarget.value })}
        />
      </label>
      <label>
        歌手
        <input
          aria-label="歌手"
          value={draft.artist}
          onChange={(event) => setDraft({ ...draft, artist: event.currentTarget.value })}
        />
      </label>
      <label>
        专辑
        <input
          aria-label="专辑"
          value={draft.album}
          onChange={(event) => setDraft({ ...draft, album: event.currentTarget.value })}
        />
      </label>
      <button type="submit">保存标签</button>
    </form>
  );
}
