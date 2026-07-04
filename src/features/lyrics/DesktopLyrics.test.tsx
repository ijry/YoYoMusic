import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DesktopLyrics } from "./DesktopLyrics";

describe("DesktopLyrics", () => {
  it("renders current lyric with click-through control", () => {
    render(
      <DesktopLyrics
        currentLine="正在播放的歌词"
        locked={false}
        onToggleClickThrough={vi.fn()}
      />,
    );

    expect(screen.getByText("正在播放的歌词")).toHaveClass("desktop-lyrics__line");
    expect(screen.getByRole("button", { name: "开启穿透" })).toBeInTheDocument();
  });
});
