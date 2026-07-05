import type { LyricsDocument, LyricsLine } from "../../shared/types";

interface LyricsPanelProps {
  document: LyricsDocument | null;
  positionMs: number;
}

export function LyricsPanel({ document, positionMs }: LyricsPanelProps) {
  const lineCount = document?.lines.length ?? 0;

  if (!document || lineCount === 0) {
    return (
      <section className="lyrics-panel" aria-label="歌词">
        <div className="lyrics-panel__header">
          <div>
            <p className="eyebrow">Lyrics Readout</p>
            <h2>歌词</h2>
          </div>
          <span className="lyrics-panel__status">未载入</span>
        </div>
        <p className="empty-state">暂无歌词</p>
      </section>
    );
  }

  const activeLine = findActiveLine(document.lines, positionMs + document.offsetMs);

  return (
    <section className="lyrics-panel" aria-label="歌词">
      <div className="lyrics-panel__header">
        <div>
          <p className="eyebrow">Lyrics Readout</p>
          <h2>歌词</h2>
        </div>
        <span className="lyrics-panel__status">已定位 {lineCount} 行</span>
      </div>
      <div className="lyrics-panel__viewport">
        {document.lines.map((line, index) => (
          <p
            key={`${line.timeMs}-${line.text}`}
            className={line === activeLine ? "lyric-line is-active" : "lyric-line"}
            aria-current={line === activeLine ? "true" : undefined}
          >
            <span className="lyric-line__stamp" aria-hidden="true">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="lyric-line__text">{line.text}</span>
          </p>
        ))}
      </div>
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
