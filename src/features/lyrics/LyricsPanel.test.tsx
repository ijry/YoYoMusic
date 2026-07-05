import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LyricsPanel } from "./LyricsPanel";

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
});
