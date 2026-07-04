import type { LyricsDocument, LyricsLine } from "../../shared/types";

interface LyricsPanelProps {
  document: LyricsDocument | null;
  positionMs: number;
}

export function LyricsPanel({ document, positionMs }: LyricsPanelProps) {
  if (!document || document.lines.length === 0) {
    return <p className="empty-state">暂无歌词</p>;
  }

  const activeLine = findActiveLine(document.lines, positionMs + document.offsetMs);

  return (
    <section className="lyrics-panel" aria-label="歌词">
      {document.lines.map((line) => (
        <p
          key={`${line.timeMs}-${line.text}`}
          className={line === activeLine ? "lyric-line is-active" : "lyric-line"}
          aria-current={line === activeLine ? "true" : undefined}
        >
          {line.text}
        </p>
      ))}
    </section>
  );
}

function findActiveLine(lines: LyricsLine[], positionMs: number) {
  return lines.reduce<LyricsLine | null>((active, line) => {
    if (line.timeMs <= positionMs) {
      return line;
    }
    return active;
  }, null);
}
