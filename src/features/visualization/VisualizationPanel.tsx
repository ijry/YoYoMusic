import type { VisualizationMode } from "../../shared/types";
import { VisualizationPreview } from "./VisualizationPreview";
import type { VisualizationFrame } from "./renderers";

interface VisualizationPanelProps {
  mode: VisualizationMode;
  frame: VisualizationFrame;
  isPlaying?: boolean;
  hasTrack?: boolean;
  onModeChange: (mode: VisualizationMode) => void;
}

const visualizationModes: Array<{ id: VisualizationMode; label: string }> = [
  { id: "spectrum", label: "频谱柱" },
  { id: "waveform", label: "波形" },
  { id: "radial", label: "环形脉冲" },
];

export function VisualizationPanel({
  mode,
  frame,
  isPlaying = false,
  hasTrack = true,
  onModeChange,
}: VisualizationPanelProps) {
  return (
    <section className="visualization-panel" aria-label="音乐可视化">
      <div className="visualization-panel__header">
        <div>
          <p className="eyebrow">Visualization Bay</p>
          <h2>音乐可视化</h2>
        </div>
        <span className="visualization-panel__status">峰值 {frame.peak.toFixed(2)}</span>
      </div>
      <div className="visualization-panel__modes">
        {visualizationModes.map((visualMode, index) => (
          <button
            key={visualMode.id}
            className="visualization-mode-button"
            type="button"
            aria-pressed={mode === visualMode.id}
            onClick={() => onModeChange(visualMode.id)}
          >
            <span className="visualization-mode-button__slot" aria-hidden="true">
              V{index + 1}
            </span>
            <span className="visualization-mode-button__label">{visualMode.label}</span>
          </button>
        ))}
      </div>
      <div className="visualization-panel__meter">
        <VisualizationPreview mode={mode} frame={frame} variant="panel" isPlaying={isPlaying} hasTrack={hasTrack} />
      </div>
    </section>
  );
}
