import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { EqualizerPanel } from "./EqualizerPanel";

describe("EqualizerPanel", () => {
  it("renders ten bands and applies rock preset", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <EqualizerPanel
        settings={{ enabled: false, preset: "flat", bands: Array(10).fill(0) }}
        onChange={onChange}
      />,
    );

    expect(screen.getAllByLabelText(/频段/)).toHaveLength(10);
    await user.click(screen.getByRole("button", { name: "摇滚" }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ preset: "rock", enabled: true }));
  });
});
