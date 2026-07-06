import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { VisualizationPreview } from "./VisualizationPreview";
import type { VisualizationFrame } from "./renderers";

const frame: VisualizationFrame = {
  values: [-1, 0.25, 0.5, 0.75, 2],
  peak: 0.84,
  positionMs: 12345,
};

describe("VisualizationPreview", () => {
  it("renders clamped spectrum bars with playing and track state", () => {
    const { container } = render(
      <VisualizationPreview mode="spectrum" frame={frame} variant="panel" isPlaying={true} hasTrack={true} />,
    );

    const preview = container.querySelector(".visualization-preview");
    expect(preview).toHaveClass("visualization-preview--panel");
    expect(preview).toHaveClass("visualization-preview--spectrum");
    expect(preview).toHaveClass("is-playing");
    expect(preview).toHaveClass("has-track");

    const bars = container.querySelectorAll(".visualization-spectrum-bar");
    expect(bars).toHaveLength(5);
    expect(bars[0].getAttribute("style")).toContain("--viz-value: 0");
    expect(bars[4].getAttribute("style")).toContain("--viz-value: 1");
    expect(container.querySelectorAll(".visualization-spectrum-cap")).toHaveLength(5);
  });

  it("renders waveform points with paused state", () => {
    const { container } = render(
      <VisualizationPreview mode="waveform" frame={frame} variant="hero" isPlaying={false} hasTrack={true} />,
    );

    const preview = container.querySelector(".visualization-preview");
    expect(preview).toHaveClass("visualization-preview--hero");
    expect(preview).toHaveClass("visualization-preview--waveform");
    expect(preview).toHaveClass("is-paused");
    expect(preview).toHaveClass("has-track");
    expect(container.querySelector(".visualization-waveform-line")).toBeInTheDocument();
    expect(container.querySelectorAll(".visualization-waveform-point")).toHaveLength(5);
  });

  it("renders radial rings and standby ticks", () => {
    const { container } = render(
      <VisualizationPreview mode="radial" frame={frame} variant="panel" isPlaying={false} hasTrack={false} />,
    );

    const preview = container.querySelector(".visualization-preview");
    expect(preview).toHaveClass("visualization-preview--radial");
    expect(preview).toHaveClass("is-standby");
    expect(container.querySelector(".visualization-radial-ring--outer")).toBeInTheDocument();
    expect(container.querySelector(".visualization-radial-ring--inner")).toBeInTheDocument();
    expect(container.querySelectorAll(".visualization-radial-tick")).toHaveLength(12);
  });
});
