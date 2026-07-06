import type { CSSProperties } from "react";
import type { VisualizationMode } from "../../shared/types";
import { normalizeFrameValues, type VisualizationFrame } from "./renderers";

type VisualizationVariant = "hero" | "panel";

type VisualizationStyle = CSSProperties & Record<`--${string}`, string | number>;

interface VisualizationPreviewProps {
  mode: VisualizationMode;
  frame: VisualizationFrame;
  variant: VisualizationVariant;
  isPlaying?: boolean;
  hasTrack?: boolean;
}

const standbyValues = [0.12, 0.18, 0.14, 0.22, 0.16, 0.2, 0.15, 0.19, 0.13, 0.17, 0.14, 0.18];

export function VisualizationPreview({
  mode,
  frame,
  variant,
  isPlaying = false,
  hasTrack = true,
}: VisualizationPreviewProps) {
  const values = normalizeFrameValues(frame.values.length > 0 ? frame.values : standbyValues);
  const visualValues = hasTrack ? values : standbyValues;
  const className = [
    "visualization-preview",
    `visualization-preview--${variant}`,
    `visualization-preview--${mode}`,
    isPlaying ? "is-playing" : "is-paused",
    hasTrack ? "has-track" : "is-standby",
  ].join(" ");

  return (
    <div
      className={className}
      aria-hidden="true"
      style={visualizationStyle({
        "--viz-count": visualValues.length,
        "--viz-peak": frame.peak.toFixed(3),
      })}
    >
      {mode === "waveform" ? renderWaveform(visualValues) : null}
      {mode === "radial" ? renderRadial(visualValues, frame.peak, frame.positionMs) : null}
      {mode === "spectrum" ? renderSpectrum(visualValues) : null}
    </div>
  );
}

function renderSpectrum(values: number[]) {
  return values.map((value, index) => (
    <span
      key={`spectrum-${index}`}
      className="visualization-spectrum-bar"
      style={visualizationStyle({
        "--viz-index": index,
        "--viz-count": values.length,
        "--viz-value": roundValue(value),
      })}
    >
      <span className="visualization-spectrum-fill" />
      <span className="visualization-spectrum-cap" />
    </span>
  ));
}

function renderWaveform(values: number[]) {
  return (
    <>
      <span className="visualization-waveform-line" />
      {values.map((value, index) => (
        <span
          key={`waveform-${index}`}
          className="visualization-waveform-point"
          style={visualizationStyle({
            "--viz-index": index,
            "--viz-count": values.length,
            "--viz-x": `${roundValue((index / Math.max(values.length - 1, 1)) * 100)}%`,
            "--viz-value": roundValue(value),
          })}
        />
      ))}
    </>
  );
}

function renderRadial(values: number[], peak: number, positionMs: number) {
  const phase = Math.round(positionMs % 3600);

  return (
    <>
      <span
        className="visualization-radial-ring visualization-radial-ring--outer"
        style={visualizationStyle({ "--viz-peak": roundValue(peak), "--viz-phase": phase })}
      />
      <span
        className="visualization-radial-ring visualization-radial-ring--inner"
        style={visualizationStyle({ "--viz-peak": roundValue(peak), "--viz-phase": phase })}
      />
      {values.map((value, index) => (
        <span
          key={`radial-${index}`}
          className="visualization-radial-tick"
          style={visualizationStyle({
            "--viz-index": index,
            "--viz-count": values.length,
            "--viz-value": roundValue(value),
            "--viz-angle": `${Math.round((index / Math.max(values.length, 1)) * 360)}deg`,
          })}
        />
      ))}
    </>
  );
}

function visualizationStyle(vars: Record<`--${string}`, string | number>): VisualizationStyle {
  return vars as VisualizationStyle;
}

function roundValue(value: number) {
  return Number(value.toFixed(3));
}
