import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LyricsPanel } from "./LyricsPanel";
import type { DesktopLyricsSettings } from "../../shared/types";

describe("LyricsPanel", () => {
  it("highlights the active lyric line", () => {
    const { container } = render(
      <LyricsPanel
        positionMs={3500}
        document={{
          id: "lyrics-1",
          sourceType: "local_file",
          language: "zh-CN",
          offsetMs: 0,
          lines: [
            { timeMs: 1000, text: "第一句" },
            { timeMs: 3000, text: "第二句" },
          ],
        }}
      />,
    );

    expect(container.querySelector(".lyrics-panel__status")).toHaveTextContent("已定位 2 行");
    expect(container.querySelectorAll(".lyric-line__stamp")).toHaveLength(2);
    expect(screen.getByText("第二句").closest(".lyric-line")).toHaveAttribute("aria-current", "true");
  });

  it("renders empty lyrics copy", () => {
    const { container } = render(<LyricsPanel positionMs={0} document={null} />);
    expect(container.querySelector(".lyrics-panel__status")).toHaveTextContent("未载入");
    expect(screen.getByText("暂无歌词")).toBeInTheDocument();
  });

  describe("desktop lyrics controls", () => {
    const base: DesktopLyricsSettings = {
      theme: "aurora",
      fontScale: 1,
      pinned: false,
      clickThrough: false,
    };

    function renderWithDesktop(onChange = vi.fn(), onOpen = vi.fn()) {
      const utils = render(
        <LyricsPanel
          positionMs={0}
          document={null}
          desktopLyrics={base}
          onDesktopLyricsChange={onChange}
          onToggleDesktopLyricsWindow={onOpen}
        />,
      );
      return { onChange, onOpen, ...utils };
    }

    it("hides the controls when no handler is wired up", () => {
      render(<LyricsPanel positionMs={0} document={null} />);
      expect(screen.queryByRole("button", { name: "打开桌面歌词" })).not.toBeInTheDocument();
    });

    it("toggles lock and click-through through the settings copy", async () => {
      const user = userEvent.setup();
      const { onChange } = renderWithDesktop();

      await user.click(screen.getByRole("button", { name: "锁定桌面歌词位置" }));
      expect(onChange).toHaveBeenCalledWith({ ...base, pinned: true });

      await user.click(screen.getByRole("button", { name: "开启桌面歌词鼠标穿透" }));
      expect(onChange).toHaveBeenCalledWith({ ...base, clickThrough: true });
    });

    it("picks a theme and a font scale", async () => {
      const user = userEvent.setup();
      const { onChange } = renderWithDesktop();

      await user.click(screen.getByRole("button", { name: "桌面歌词主题：水墨" }));
      expect(onChange).toHaveBeenCalledWith({ ...base, theme: "ink" });

      // jsdom does not step range inputs on arrow keys, so drive `change`
      // directly rather than through the keyboard.
      fireEvent.change(screen.getByRole("slider", { name: "桌面歌词字号" }), {
        target: { value: "1.8" },
      });
      expect(onChange).toHaveBeenCalledWith({ ...base, fontScale: 1.8 });
    });

    it("requests the desktop lyrics window", async () => {
      const user = userEvent.setup();
      const { onOpen } = renderWithDesktop();

      await user.click(screen.getByRole("button", { name: "打开桌面歌词" }));
      expect(onOpen).toHaveBeenCalledTimes(1);
    });
  });
});
