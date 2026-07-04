import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MiniPlayer } from "./MiniPlayer";

describe("MiniPlayer", () => {
  it("shows compact playback controls", () => {
    render(
      <MiniPlayer
        title="Song A"
        artist="Artist A"
        isPlaying={false}
        onCommand={vi.fn()}
      />,
    );

    expect(screen.getByText("Song A")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "播放" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "下一首" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "静音" })).toBeInTheDocument();
  });
});
