import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DesktopLyrics } from "./DesktopLyrics";
import { desktopLyricsThemes } from "./desktopLyricsTheme";

function renderLyrics(overrides: Partial<React.ComponentProps<typeof DesktopLyrics>> = {}) {
  const props = {
    currentLine: "正在播放的歌词",
    contextLine: "正在播放",
    themeId: "aurora" as const,
    fontScale: 1,
    locked: false,
    clickThrough: false,
    onThemeChange: vi.fn(),
    onFontScaleChange: vi.fn(),
    onToggleLock: vi.fn(),
    onToggleClickThrough: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };

  return { props, ...render(<DesktopLyrics {...props} />) };
}

describe("DesktopLyrics", () => {
  it("renders the lyric line and the secondary context line", () => {
    renderLyrics();

    expect(screen.getByText("正在播放的歌词")).toHaveClass("desktop-lyrics__line");
    expect(screen.getByText("正在播放")).toHaveClass("desktop-lyrics__context");
  });

  it("falls back to a placeholder when there is no lyric", () => {
    renderLyrics({ currentLine: "" });
    expect(screen.getByText("暂无歌词")).toBeInTheDocument();
  });

  it("is draggable until it is locked", () => {
    const { container, rerender, props } = renderLyrics();
    expect(container.querySelector(".desktop-lyrics")).toHaveAttribute("data-drag-region", "enabled");

    rerender(<DesktopLyrics {...props} locked />);
    expect(container.querySelector(".desktop-lyrics")).toHaveAttribute("data-drag-region", "disabled");
    expect(screen.getByText("已锁定，拖动无效")).toBeInTheDocument();
  });

  it("offers every theme preset and reports the picked one", async () => {
    const user = userEvent.setup();
    const { props } = renderLyrics();

    for (const theme of desktopLyricsThemes) {
      expect(screen.getByRole("button", { name: `桌面歌词主题：${theme.name}` })).toBeInTheDocument();
    }

    const target = desktopLyricsThemes[3];
    await user.click(screen.getByRole("button", { name: `桌面歌词主题：${target.name}` }));
    expect(props.onThemeChange).toHaveBeenCalledWith(target.id);
  });

  it("marks the active theme as pressed", () => {
    renderLyrics({ themeId: "sunset" });
    expect(screen.getByRole("button", { name: "桌面歌词主题：熔金" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("drives font scale, lock, click-through and close from the toolbar", async () => {
    const user = userEvent.setup();
    const { props } = renderLyrics();

    await user.click(screen.getByRole("button", { name: "锁定位置" }));
    expect(props.onToggleLock).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "开启鼠标穿透" }));
    expect(props.onToggleClickThrough).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "关闭桌面歌词" }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it("relabels the toggles once they are on", () => {
    renderLyrics({ locked: true, clickThrough: true });

    expect(screen.getByRole("button", { name: "解除锁定" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "关闭鼠标穿透" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("hides the toolbar until the strip is hovered", async () => {
    const user = userEvent.setup();
    const { container } = renderLyrics();

    expect(container.querySelector(".desktop-lyrics")).toHaveAttribute("data-toolbar", "closed");
    await user.hover(container.querySelector(".desktop-lyrics")!);
    expect(container.querySelector(".desktop-lyrics")).toHaveAttribute("data-toolbar", "open");
  });
});
