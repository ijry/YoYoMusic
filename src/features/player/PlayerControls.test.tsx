import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PlayerControls } from "./PlayerControls";

describe("PlayerControls", () => {
  it("calls playback commands from buttons and volume slider", async () => {
    const user = userEvent.setup();
    const onCommand = vi.fn();
    render(
      <PlayerControls
        state={{
          trackId: "1",
          positionMs: 1000,
          durationMs: 5000,
          volume: 0.5,
          isPlaying: false,
          isMuted: false,
          playMode: "sequence",
          eqEnabled: false,
        }}
        onCommand={onCommand}
      />,
    );

    await user.click(screen.getByRole("button", { name: "播放" }));
    await user.click(screen.getByRole("button", { name: "下一首" }));
    await user.clear(screen.getByLabelText("音量"));
    await user.type(screen.getByLabelText("音量"), "80");

    expect(onCommand).toHaveBeenCalledWith("toggle_playback", {});
    expect(onCommand).toHaveBeenCalledWith("next_track", {});
    expect(onCommand).toHaveBeenCalledWith("set_volume", { value: 0.8 });
  });
});
