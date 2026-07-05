import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { VisualizationPanel } from "./VisualizationPanel";

describe("VisualizationPanel", () => {
  it("renders machine-style mode controls and reports peak status", async () => {
    const user = userEvent.setup();
    const onModeChange = vi.fn();
    const { container } = render(
      <VisualizationPanel
        mode="spectrum"
        frame={{
          values: Array.from({ length: 12 }, (_, index) => 0.2 + index * 0.05),
          peak: 0.92,
          positionMs: 12000,
        }}
        onModeChange={onModeChange}
      />,
    );

    expect(container.querySelector(".visualization-panel__status")).toHaveTextContent("峰值 0.92");
    expect(container.querySelectorAll(".visualization-mode-button")).toHaveLength(3);
    expect(container.querySelector(".visualization-panel__meter")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "波形" }));
    expect(onModeChange).toHaveBeenCalledWith("waveform");
  });
});
