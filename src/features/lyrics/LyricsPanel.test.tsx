import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LyricsPanel } from "./LyricsPanel";

describe("LyricsPanel", () => {
  it("highlights the active lyric line", () => {
    render(
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

    expect(screen.getByText("第二句")).toHaveAttribute("aria-current", "true");
  });

  it("renders empty lyrics copy", () => {
    render(<LyricsPanel positionMs={0} document={null} />);
    expect(screen.getByText("暂无歌词")).toBeInTheDocument();
  });
});
