import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VolumeControl } from "./VolumeControl";

function renderVolume(overrides: Partial<React.ComponentProps<typeof VolumeControl>> = {}) {
  const props = {
    volume: 0.8,
    isMuted: false,
    onVolumeChange: vi.fn(),
    onToggleMuted: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<VolumeControl {...props} />) };
}

describe("VolumeControl", () => {
  it("starts closed with no popover in the DOM", () => {
    renderVolume();

    const trigger = screen.getByRole("button", { name: "音量" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("slider", { name: "音量大小" })).not.toBeInTheDocument();
  });

  it("opens the popover from the speaker button", async () => {
    const user = userEvent.setup();
    renderVolume();

    const trigger = screen.getByRole("button", { name: "音量" });
    await user.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("group", { name: "音量调节" })).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: "音量大小" })).toHaveValue("80");
  });

  /*
   * The regression this guards: every `.modern-panel` sets `overflow: hidden`,
   * and the deck is one of those panels, so a popover rendered in place gets
   * clipped and its controls become unclickable. Portalling to <body> is what
   * keeps the mute button reachable.
   */
  it("portals the popover out of the clipped panel", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <div style={{ overflow: "hidden" }}>
        <VolumeControl
          volume={0.5}
          isMuted={false}
          onVolumeChange={vi.fn()}
          onToggleMuted={vi.fn()}
        />
      </div>,
    );

    await user.click(screen.getByRole("button", { name: "音量" }));

    const popover = screen.getByRole("group", { name: "音量调节" });
    expect(popover.parentElement).toBe(document.body);
    // Not nested anywhere inside the clipping ancestor.
    expect(container.contains(popover)).toBe(false);
  });

  it("reports volume changes as a 0–1 fraction", async () => {
    const { props } = renderVolume();

    fireEvent.change(screen.getByRole("button", { name: "音量" }), { target: { value: "1" } });
    expect(props.onVolumeChange).not.toHaveBeenCalled();

    await userEvent.setup().click(screen.getByRole("button", { name: "音量" }));
    fireEvent.change(screen.getByRole("slider", { name: "音量大小" }), { target: { value: "35" } });
    expect(props.onVolumeChange).toHaveBeenCalledWith(0.35);
  });

  it("toggles mute from inside the popover", async () => {
    const user = userEvent.setup();
    const { props } = renderVolume();

    await user.click(screen.getByRole("button", { name: "音量" }));
    await user.click(screen.getByRole("button", { name: "静音" }));
    expect(props.onToggleMuted).toHaveBeenCalledTimes(1);
  });

  it("relabels the mute button and readout while muted", async () => {
    const user = userEvent.setup();
    renderVolume({ isMuted: true });

    await user.click(screen.getByRole("button", { name: "音量" }));

    expect(screen.getByRole("button", { name: "取消静音" })).toBeInTheDocument();
    expect(screen.getByText("已静音")).toBeInTheDocument();
    // Muting is a separate toggle, so the level stays visible on the rail.
    expect(screen.getByRole("slider", { name: "音量大小" })).toHaveValue("80");
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const user = userEvent.setup();
    renderVolume();

    const trigger = screen.getByRole("button", { name: "音量" });
    await user.click(trigger);
    expect(screen.getByRole("slider", { name: "音量大小" })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("slider", { name: "音量大小" })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes on an outside click but not on an inside one", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button type="button">别处</button>
        <VolumeControl
          volume={0.5}
          isMuted={false}
          onVolumeChange={vi.fn()}
          onToggleMuted={vi.fn()}
        />
      </div>,
    );

    const trigger = screen.getByRole("button", { name: "音量" });

    await user.click(trigger);
    // Clicking the slider must not dismiss the popover mid-drag.
    fireEvent.pointerDown(screen.getByRole("slider", { name: "音量大小" }));
    expect(screen.getByRole("slider", { name: "音量大小" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "别处" }));
    expect(screen.queryByRole("slider", { name: "音量大小" })).not.toBeInTheDocument();
  });

  it("toggles closed when the speaker is clicked again", async () => {
    const user = userEvent.setup();
    renderVolume();

    const trigger = screen.getByRole("button", { name: "音量" });
    await user.click(trigger);
    await user.click(trigger);
    expect(screen.queryByRole("slider", { name: "音量大小" })).not.toBeInTheDocument();
  });

  it("shows the level in the trigger tooltip", () => {
    renderVolume({ volume: 0.42 });
    expect(screen.getByRole("button", { name: "音量" })).toHaveAttribute("title", "音量 42%");
  });
});
