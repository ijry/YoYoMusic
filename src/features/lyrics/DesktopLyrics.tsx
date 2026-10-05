import { useEffect, useState } from "react";
import { Icon } from "../../shared/icons";
import { setWindowClickThrough } from "../../shared/windowControl";
import { DragRegion } from "../shell/WindowChrome";
import {
  clampLyricsFontScale,
  desktopLyricsThemes,
  resolveDesktopLyricsTheme,
  type DesktopLyricsThemeId,
} from "./desktopLyricsTheme";

interface DesktopLyricsProps {
  currentLine: string;
  /** Secondary line: track title · artist. */
  contextLine?: string;
  themeId: DesktopLyricsThemeId;
  fontScale: number;
  locked: boolean;
  clickThrough: boolean;
  onThemeChange: (themeId: DesktopLyricsThemeId) => void;
  onFontScaleChange: (fontScale: number) => void;
  onToggleLock: () => void;
  onToggleClickThrough: () => void;
  onClose: () => void;
}

/*
 * Floating lyric strip.
 *
 * The window itself is transparent and undecorated, so everything the user can
 * interact with has to be drawn here. Two constraints shape the layout:
 *
 * - While click-through is on the window ignores the pointer entirely, so the
 *   toolbar must be unreachable *and* the lock has to be visible — otherwise
 *   the strip can become impossible to get back.
 * - While unlocked the whole strip is a drag handle, which conflicts with the
 *   toolbar buttons. Buttons opt out via `closest("button")` in `DragRegion`.
 *
 * The toolbar sits above the text and only reveals on hover, so the default
 * view is just the lyric.
 */
export function DesktopLyrics({
  currentLine,
  contextLine,
  themeId,
  fontScale,
  locked,
  clickThrough,
  onThemeChange,
  onFontScaleChange,
  onToggleLock,
  onToggleClickThrough,
  onClose,
}: DesktopLyricsProps) {
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const theme = resolveDesktopLyricsTheme(themeId);
  const scale = clampLyricsFontScale(fontScale);

  useEffect(() => {
    void setWindowClickThrough(clickThrough);
    // Turning click-through on also has to dismiss the toolbar, otherwise it
    // stays on screen while the window no longer reacts to the pointer.
    if (clickThrough) setToolbarOpen(false);
  }, [clickThrough]);

  /*
   * Inline custom properties rather than a stylesheet class: the theme is
   * user-selectable at runtime, so it cannot be known at build time.
   */
  const style = {
    "--lyric-ink": theme.ink,
    "--lyric-glow": theme.glow,
    "--lyric-plate": theme.plate,
    "--lyric-muted": theme.muted,
    "--lyric-scale": scale,
  } as React.CSSProperties;

  return (
    <DragRegion
      className="desktop-lyrics"
      disabled={locked}
      data-locked={locked ? "true" : "false"}
      data-toolbar={toolbarOpen ? "open" : "closed"}
      data-click-through={clickThrough ? "true" : "false"}
      data-dragging={locked ? "disabled" : "enabled"}
      style={style}
      aria-label="桌面歌词"
      onPointerEnter={() => setToolbarOpen(true)}
      onPointerLeave={() => setToolbarOpen(false)}
    >
      <div className="desktop-lyrics__toolbar" role="group" aria-label="桌面歌词设置">
        <div className="desktop-lyrics__themes" role="group" aria-label="桌面歌词主题">
          {desktopLyricsThemes.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className="lyrics-theme-swatch"
              data-active={entry.id === themeId}
              aria-pressed={entry.id === themeId}
              aria-label={`桌面歌词主题：${entry.name}`}
              title={entry.name}
              style={{ background: entry.swatch }}
              onClick={() => onThemeChange(entry.id)}
            />
          ))}
        </div>

        <label className="desktop-lyrics__scale">
          <span className="control-label">字号</span>
          <input
            aria-label="桌面歌词字号"
            type="range"
            min={0.6}
            max={2.4}
            step={0.1}
            value={scale}
            onChange={(event) => onFontScaleChange(Number(event.currentTarget.value))}
          />
        </label>

        <button
          type="button"
          className="lyrics-tool-button"
          aria-pressed={locked}
          aria-label={locked ? "解除锁定" : "锁定位置"}
          title={locked ? "解除锁定" : "锁定位置"}
          onClick={onToggleLock}
        >
          {locked ? <Icon.lock size={15} /> : <Icon.unlock size={15} />}
        </button>

        <button
          type="button"
          className="lyrics-tool-button"
          aria-pressed={clickThrough}
          aria-label={clickThrough ? "关闭鼠标穿透" : "开启鼠标穿透"}
          title={clickThrough ? "关闭鼠标穿透" : "开启鼠标穿透"}
          onClick={onToggleClickThrough}
        >
          <Icon.clickThrough size={15} />
        </button>

        <button
          type="button"
          className="lyrics-tool-button lyrics-tool-button--close"
          aria-label="关闭桌面歌词"
          title="关闭"
          onClick={onClose}
        >
          <Icon.remove size={15} />
        </button>
      </div>

      <p className="desktop-lyrics__line">{currentLine || "暂无歌词"}</p>
      {contextLine ? <p className="desktop-lyrics__context">{contextLine}</p> : null}

      {locked ? (
        <p className="desktop-lyrics__hint">
          <Icon.lock size={12} />
          已锁定，拖动无效
        </p>
      ) : null}
    </DragRegion>
  );
}
