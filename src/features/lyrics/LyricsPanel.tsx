import { desktopLyricsThemes, type DesktopLyricsThemeId } from "./desktopLyricsTheme";
import { Icon } from "../../shared/icons";
import type { DesktopLyricsSettings, LyricsDocument, LyricsLine } from "../../shared/types";

interface LyricsPanelProps {
  document: LyricsDocument | null;
  positionMs: number;
  desktopLyrics?: DesktopLyricsSettings;
  onDesktopLyricsChange?: (next: DesktopLyricsSettings) => void;
}

export function LyricsPanel({
  document,
  positionMs,
  desktopLyrics,
  onDesktopLyricsChange,
}: LyricsPanelProps) {
  const lineCount = document?.lines.length ?? 0;

  return (
    <section className="lyrics-panel" aria-label="歌词">
      <div className="lyrics-panel__header">
        <span className="lyrics-panel__status">
          {lineCount > 0 ? `已定位 ${lineCount} 行` : "未载入"}
        </span>
      </div>

      {/*
       * Desktop-lyrics *settings* sit next to the lyric list, because this is
       * the panel a user opens when they care about lyrics. The control that
       * opens the floating window itself does not: it lives in the top bar
       * with the other window-level actions, and having it here too was the
       * same duplication the skin/settings buttons had.
       */}
      {desktopLyrics && onDesktopLyricsChange ? (
        <div className="lyrics-desktop-settings">
          <div className="lyrics-desktop-settings__row">
            <span className="lyrics-desktop-settings__title">桌面歌词</span>
            <button
              type="button"
              className="lyrics-desktop-toggle"
              aria-pressed={desktopLyrics.pinned}
              aria-label={desktopLyrics.pinned ? "解除桌面歌词锁定" : "锁定桌面歌词位置"}
              title={desktopLyrics.pinned ? "解除锁定" : "锁定位置"}
              onClick={() => onDesktopLyricsChange({ ...desktopLyrics, pinned: !desktopLyrics.pinned })}
            >
              {desktopLyrics.pinned ? <Icon.lock size={16} /> : <Icon.unlock size={16} />}
            </button>
            <button
              type="button"
              className="lyrics-desktop-toggle"
              aria-pressed={desktopLyrics.clickThrough}
              aria-label={
                desktopLyrics.clickThrough ? "关闭桌面歌词鼠标穿透" : "开启桌面歌词鼠标穿透"
              }
              title={desktopLyrics.clickThrough ? "关闭鼠标穿透" : "开启鼠标穿透"}
              onClick={() =>
                onDesktopLyricsChange({ ...desktopLyrics, clickThrough: !desktopLyrics.clickThrough })
              }
            >
              <Icon.clickThrough size={16} />
            </button>
          </div>

          <div className="lyrics-desktop-settings__row lyrics-desktop-settings__themes">
            {desktopLyricsThemes.map((theme) => (
              <button
                key={theme.id}
                type="button"
                className="lyrics-theme-swatch"
                data-active={theme.id === desktopLyrics.theme}
                aria-pressed={theme.id === desktopLyrics.theme}
                aria-label={`桌面歌词主题：${theme.name}`}
                title={theme.name}
                style={{ background: theme.swatch }}
                onClick={() =>
                  onDesktopLyricsChange({ ...desktopLyrics, theme: theme.id as DesktopLyricsThemeId })
                }
              />
            ))}
          </div>

          <label className="lyrics-desktop-settings__scale">
            <span className="control-label">字号</span>
            <input
              aria-label="桌面歌词字号"
              type="range"
              min={0.6}
              max={2.4}
              step={0.1}
              value={desktopLyrics.fontScale}
              onChange={(event) =>
                onDesktopLyricsChange({ ...desktopLyrics, fontScale: Number(event.currentTarget.value) })
              }
            />
          </label>
        </div>
      ) : null}

      {lineCount === 0 ? (
        <p className="empty-state">暂无歌词</p>
      ) : (
        <LyricList document={document!} positionMs={positionMs} />
      )}
    </section>
  );
}

function LyricList({ document, positionMs }: { document: LyricsDocument; positionMs: number }) {
  // Resolved once per render rather than per row — the original inline version
  // ran a reduce for every line.
  const activeLine = findActiveLine(document.lines, positionMs + document.offsetMs);

  return (
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
