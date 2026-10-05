import { fireEvent, render, screen } from "@testing-library/react";
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

    expect(playButton).toHaveClass("transport-button", "transport-button--play");
    expect(playButton).not.toBeDisabled();
    expect(progress).toHaveClass("progress-rail");
    expect(progress).not.toBeDisabled();
    // Transport is icon-only now: the play/pause icon carries the state that the
    // three status pills used to restate, so they are gone.
    expect(container.querySelector(".transport-status-strip")).not.toBeInTheDocument();
    expect(container.querySelector(".lucide-play")).toBeInTheDocument();
    expect(container.querySelectorAll(".control-monitor")).toHaveLength(1);

    await user.click(playButton);
    await user.click(screen.getByRole("button", { name: "下一首" }));

    expect(onCommand).toHaveBeenCalledWith("toggle_playback", {});
    expect(onCommand).toHaveBeenCalledWith("next_track", {});
  });

  it("keeps the volume slider behind the speaker button", async () => {
    const user = userEvent.setup();
    const onCommand = vi.fn();
    const { container } = render(
      <PlayerControls state={baseState} hasPlayableTrack={true} onCommand={onCommand} />,
    );

    // Nothing pops out until the speaker is clicked.
    expect(screen.queryByRole("slider", { name: "音量大小" })).not.toBeInTheDocument();
    expect(container.querySelector(".volume-popover")).not.toBeInTheDocument();

    const trigger = screen.getByRole("button", { name: "音量" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await user.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    const slider = screen.getByRole("slider", { name: "音量大小" });
    expect(slider).toHaveClass("volume-slider");
    // 0.5 in state -> 50 on the rail.
    expect(slider).toHaveValue("50");

    // jsdom does not step range inputs on keyboard, so fire change directly.
    fireEvent.change(slider, { target: { value: "80" } });
    expect(onCommand).toHaveBeenCalledWith("set_volume", { value: 0.8 });
  });

  it("toggles mute from inside the popover", async () => {
    const user = userEvent.setup();
    const onCommand = vi.fn();
    render(
      <PlayerControls state={baseState} hasPlayableTrack={true} onCommand={onCommand} />,
    );

    await user.click(screen.getByRole("button", { name: "音量" }));
    await user.click(screen.getByRole("button", { name: "静音" }));
    expect(onCommand).toHaveBeenCalledWith("set_muted", { value: true });
  });

  it("closes the popover on Escape and on an outside click", async () => {
    const user = userEvent.setup();
    render(
      <PlayerControls state={baseState} hasPlayableTrack={true} onCommand={vi.fn()} />,
    );

    const trigger = screen.getByRole("button", { name: "音量" });

    await user.click(trigger);
    expect(screen.getByRole("slider", { name: "音量大小" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("slider", { name: "音量大小" })).not.toBeInTheDocument();

    await user.click(trigger);
    expect(screen.getByRole("slider", { name: "音量大小" })).toBeInTheDocument();
    // Clicking the deck (well outside the popover) dismisses it.
    await user.click(screen.getByRole("region", { name: "当前播放" }));
    expect(screen.queryByRole("slider", { name: "音量大小" })).not.toBeInTheDocument();
  });

  it("shows the muted state on the trigger and the readout", async () => {
    const user = userEvent.setup();
    render(
      <PlayerControls
        state={{ ...baseState, isMuted: true }}
        hasPlayableTrack={true}
        onCommand={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "音量" }));
    expect(screen.getByText("已静音")).toBeInTheDocument();
    // Muting does not move the slider — it is a separate toggle.
    expect(screen.getByRole("slider", { name: "音量大小" })).toHaveValue("50");
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
    // Volume stays usable with no track loaded — it is a device setting.
    expect(screen.getByRole("button", { name: "音量" })).not.toBeDisabled();

    await user.click(screen.getByRole("button", { name: "播放" }));
    await user.click(screen.getByRole("button", { name: "下一首" }));

    expect(onCommand).not.toHaveBeenCalledWith("toggle_playback", {});
    expect(onCommand).not.toHaveBeenCalledWith("next_track", {});
  });
});
