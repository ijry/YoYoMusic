import type { VisualizationMode } from "../../shared/types";
import { AudioVisualizer } from "./AudioVisualizer";
import { findVisualizationMode, visualizationModes } from "./modes";

interface VisualizationPanelProps {
  mode: VisualizationMode;
  isPlaying?: boolean;
  hasTrack?: boolean;
  seed?: string;
  onModeChange: (mode: VisualizationMode) => void;
}

export function VisualizationPanel({
  mode,
  isPlaying = false,
  hasTrack = true,
  seed = "",
  onModeChange,
}: VisualizationPanelProps) {
  const active = findVisualizationMode(mode);

  return (
    <section className="visualization-panel" aria-label="音乐可视化">
      <div className="visualization-panel__header">
        <h2>音乐可视化</h2>
        <span className="visualization-panel__status">
          {isPlaying && hasTrack ? (
            <span className="visualization-panel__live">
              <span className="visualization-panel__pulse" aria-hidden="true" />
              实时
            </span>
          ) : null}
          {active.label}
        </span>
      </div>

      <div className="visualization-panel__modes" role="group" aria-label="可视化模式">
        {visualizationModes.map((entry) => {
          const ModeIcon = entry.icon;
          const isActive = entry.id === mode;
          return (
            <button
              key={entry.id}
              className="visualization-mode-button"
              type="button"
              aria-pressed={isActive}
              aria-label={entry.label}
              title={entry.hint}
              onClick={() => onModeChange(entry.id)}
            >
              <span className="visualization-mode-button__icon" aria-hidden="true">
                <ModeIcon />
              </span>
              <span className="visualization-mode-button__label">{entry.label}</span>
            </button>
          );
        })}
      </div>

      <div className="visualization-panel__stage">
        <AudioVisualizer
          mode={mode}
          isPlaying={isPlaying}
          hasTrack={hasTrack}
          seed={seed}
          className="audio-visualizer--panel"
        />
      </div>
    </section>
  );
}
