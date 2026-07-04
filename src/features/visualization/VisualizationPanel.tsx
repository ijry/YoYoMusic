import type { VisualizationMode } from "../../shared/types";
import type { VisualizationFrame } from "./renderers";

interface VisualizationPanelProps {
  mode: VisualizationMode;
  frame: VisualizationFrame;
  onModeChange: (mode: VisualizationMode) => void;
}

export function VisualizationPanel({ mode, frame, onModeChange }: VisualizationPanelProps) {
  return (
    <section className="visualization-panel" aria-label="音乐可视化">
      <div className="feature-tabs">
        <button type="button" aria-pressed={mode === "spectrum"} onClick={() => onModeChange("spectrum")}>
          频谱柱
        </button>
        <button type="button" aria-pressed={mode === "waveform"} onClick={() => onModeChange("waveform")}>
          波形
        </button>
        <button type="button" aria-pressed={mode === "radial"} onClick={() => onModeChange("radial")}>
          环形脉冲
        </button>
      </div>
      <div className="visualization-preview">
        {frame.values.map((value, index) => (
          <span key={index} style={{ height: `${Math.max(8, value * 100)}%` }} />
        ))}
      </div>
    </section>
  );
}
