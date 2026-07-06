import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VisualizationPanel } from "./VisualizationPanel";

const frame = {
  values: Array.from({ length: 12 }, (_, index) => 0.2 + index * 0.05),
  peak: 0.92,
  positionMs: 12000,
};

describe("VisualizationPanel", () => {
  it("renders mode controls and a mode-specific waveform preview", async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();
    const { container } = render(
      <VisualizationPanel
        mode="waveform"
        frame={frame}
        isPlaying={true}
        hasTrack={true}
        onModeChange={onModeChange}
      />,
    );

    expect(container.querySelector(".visualization-panel__status")).toHaveTextContent("峰值 0.92");
    expect(container.querySelectorAll(".visualization-mode-button")).toHaveLength(3);
    expect(container.querySelector(".visualization-preview--panel")).toHaveClass("visualization-preview--waveform");
    expect(container.querySelector(".visualization-preview--panel")).toHaveClass("is-playing");
    expect(container.querySelector(".visualization-waveform-line")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "波形" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "环形脉冲" }));
    expect(onModeChange).toHaveBeenCalledWith("radial");
  });

  it("marks the preview as standby when no track is loaded", () => {
    const { container } = render(
      <VisualizationPanel mode="radial" frame={frame} hasTrack={false} onModeChange={() => undefined} />,
    );

    expect(container.querySelector(".visualization-preview--radial")).toHaveClass("is-standby");
    expect(container.querySelector(".visualization-radial-ring--outer")).toBeInTheDocument();
  });
});
