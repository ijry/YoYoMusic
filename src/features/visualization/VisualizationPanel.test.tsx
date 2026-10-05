import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VisualizationPanel } from "./VisualizationPanel";

describe("VisualizationPanel", () => {
  it("renders every mode control and the panel preview", async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();
    const { container } = render(
      <VisualizationPanel
        mode="waveform"
        isPlaying={true}
        hasTrack={true}
        seed="track-a"
        onModeChange={onModeChange}
      />,
    );

    expect(container.querySelectorAll(".visualization-mode-button")).toHaveLength(6);
    expect(container.querySelector(".visualization-panel__status")).toHaveTextContent("示波波形");
    expect(container.querySelector(".visualization-panel__live")).toBeInTheDocument();
    expect(container.querySelector(".audio-visualizer--panel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "示波波形" })).toHaveAttribute("aria-pressed", "true");

    await user.click(screen.getByRole("button", { name: "镜像瀑布" }));
    expect(onModeChange).toHaveBeenCalledWith("waterfall");
  });

  it("hides the live badge while no track is loaded", () => {
    const { container } = render(
      <VisualizationPanel mode="radial" isPlaying={true} hasTrack={false} onModeChange={() => undefined} />,
    );

    expect(container.querySelector(".visualization-panel__live")).not.toBeInTheDocument();
    expect(container.querySelector(".audio-visualizer--panel")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "环形律动" })).toHaveAttribute("aria-pressed", "true");
  });
});
