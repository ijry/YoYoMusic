import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MiniPlayer } from "./MiniPlayer";

function renderMini(overrides: Partial<React.ComponentProps<typeof MiniPlayer>> = {}) {
  const props = {
    title: "Song A",
    artist: "Artist A",
    isPlaying: false,
    onCommand: vi.fn(),
    onToggleDesktopLyrics: vi.fn(),
    ...overrides,
  };

  return { props, ...render(<MiniPlayer {...props} />) };
}

describe("MiniPlayer", () => {
  it("shows compact playback controls", () => {
    renderMini();

    expect(screen.getByText("Song A")).toBeInTheDocument();
    expect(screen.getByText("Artist A")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "播放" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "上一首" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "下一首" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "静音" })).toBeInTheDocument();
  });

  it("swaps the transport button with the pause glyph while playing", () => {
    renderMini({ isPlaying: true });
    expect(screen.getByRole("button", { name: "暂停" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "播放" })).not.toBeInTheDocument();
  });

  it("sends transport commands through onCommand", async () => {
    const user = userEvent.setup();
    const { props } = renderMini();

    await user.click(screen.getByRole("button", { name: "播放" }));
    expect(props.onCommand).toHaveBeenCalledWith("toggle_playback", {});

    await user.click(screen.getByRole("button", { name: "下一首" }));
    expect(props.onCommand).toHaveBeenCalledWith("next_track", {});

    await user.click(screen.getByRole("button", { name: "上一首" }));
    expect(props.onCommand).toHaveBeenCalledWith("previous_track", {});

    await user.click(screen.getByRole("button", { name: "静音" }));
    expect(props.onCommand).toHaveBeenCalledWith("set_muted", { value: true });
  });

  it("replaces the native title bar with a drag region and a single close button", () => {
    const { container } = renderMini();

    expect(container.querySelector(".mini-player")).toHaveAttribute("data-drag-region", "enabled");

    const chrome = screen.getByRole("group", { name: "窗口控制" });
    expect(within(chrome).getByRole("button", { name: "关闭迷你播放器" })).toBeInTheDocument();
    // A 460×88 strip has no room for minimise / maximise.
    expect(within(chrome).queryByRole("button", { name: "最小化" })).not.toBeInTheDocument();
    expect(within(chrome).queryByRole("button", { name: "最大化" })).not.toBeInTheDocument();
  });

  it("can open the desktop lyrics window from the strip", async () => {
    const user = userEvent.setup();
    const { props } = renderMini();

    await user.click(screen.getByRole("button", { name: "桌面歌词" }));
    expect(props.onToggleDesktopLyrics).toHaveBeenCalledTimes(1);
  });
});
