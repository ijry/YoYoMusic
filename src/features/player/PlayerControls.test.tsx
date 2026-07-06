import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlayerControls } from "./PlayerControls";
import type { PlaybackState } from "../../shared/types";

const baseState: PlaybackState = {
  trackId: "1",
  positionMs: 1000,
  durationMs: 5000,
  volume: 0.5,
  isPlaying: false,
  isMuted: false,
  playMode: "sequence",
  eqEnabled: false,
};

describe("PlayerControls", () => {
  it("calls playback commands from enabled controls", async () => {
    const user = userEvent.setup();
    const onCommand = vi.fn();
    const { container } = render(
      <PlayerControls state={baseState} hasPlayableTrack={true} onCommand={onCommand} />,
    );

    const playButton = screen.getByRole("button", { name: "播放" });
    const progress = screen.getByLabelText("播放进度");
    const volume = screen.getByLabelText("音量");

    expect(playButton).toHaveClass("transport-button", "transport-button--play");
    expect(playButton).not.toBeDisabled();
    expect(progress).toHaveClass("progress-rail");
    expect(progress).not.toBeDisabled();
    expect(volume).toHaveClass("volume-input");
    expect(container.querySelector(".volume-well__tick")).toBeInTheDocument();
    expect(container.querySelector(".transport-status-strip")).toBeInTheDocument();
    expect(container.querySelectorAll(".transport-status-light")).toHaveLength(3);
    expect(container.querySelectorAll(".control-monitor")).toHaveLength(2);

    await user.click(playButton);
    await user.click(screen.getByRole("button", { name: "下一首" }));
    await user.clear(volume);
    await user.type(volume, "80");

    expect(onCommand).toHaveBeenCalledWith("toggle_playback", {});
    expect(onCommand).toHaveBeenCalledWith("next_track", {});
    expect(onCommand).toHaveBeenCalledWith("set_volume", { value: 0.8 });
  });

  it("disables inert transport controls when there is no playable track", async () => {
    const user = userEvent.setup();
    const onCommand = vi.fn();
    render(
      <PlayerControls
        state={{ ...baseState, trackId: null, positionMs: 0, durationMs: 0 }}
        hasPlayableTrack={false}
        onCommand={onCommand}
      />,
    );

    expect(screen.getByRole("button", { name: "上一首" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "播放" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "下一首" })).toBeDisabled();
    expect(screen.getByRole("slider", { name: "播放进度" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "静音" })).not.toBeDisabled();

    await user.click(screen.getByRole("button", { name: "播放" }));
    await user.click(screen.getByRole("button", { name: "下一首" }));

    expect(onCommand).not.toHaveBeenCalledWith("toggle_playback", {});
    expect(onCommand).not.toHaveBeenCalledWith("next_track", {});
  });
});
