interface DesktopLyricsProps {
  currentLine: string;
  locked: boolean;
  onToggleClickThrough: () => void;
}

export function DesktopLyrics({ currentLine, locked, onToggleClickThrough }: DesktopLyricsProps) {
  return (
    <main className="desktop-lyrics" aria-label="桌面歌词">
      <p className="desktop-lyrics__line">{currentLine || "暂无歌词"}</p>
      <button type="button" onClick={onToggleClickThrough}>
        {locked ? "关闭穿透" : "开启穿透"}
      </button>
    </main>
  );
}
