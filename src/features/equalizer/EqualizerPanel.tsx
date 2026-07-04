import type { EqualizerSettings } from "../../shared/types";

interface EqualizerPanelProps {
  settings: EqualizerSettings;
  onChange: (settings: EqualizerSettings) => void;
}

const presets: Record<string, { label: string; bands: number[] }> = {
  flat: { label: "平直", bands: Array(10).fill(0) },
  rock: { label: "摇滚", bands: [3, 2, 1, 0, -1, -1, 0, 1, 2, 3] },
  pop: { label: "流行", bands: [1, 2, 2, 1, 0, 0, 1, 2, 2, 1] },
  vocal: { label: "人声", bands: [-1, 0, 1, 2, 3, 3, 2, 1, 0, -1] },
};

export function EqualizerPanel({ settings, onChange }: EqualizerPanelProps) {
  return (
    <section className="equalizer-panel" aria-label="均衡器">
      <label className="toggle-row">
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(event) => onChange({ ...settings, enabled: event.currentTarget.checked })}
        />
        启用均衡器
      </label>

      <div className="feature-tabs">
        {Object.entries(presets).map(([preset, config]) => (
          <button
            key={preset}
            type="button"
            onClick={() => onChange({ enabled: true, preset, bands: config.bands })}
          >
            {config.label}
          </button>
        ))}
      </div>

      <div className="eq-bands">
        {settings.bands.map((band, index) => (
          <label key={index}>
            频段 {index + 1}
            <input
              aria-label={`频段 ${index + 1}`}
              type="range"
              min="-12"
              max="12"
              value={band}
              onChange={(event) => {
                const bands = [...settings.bands];
                bands[index] = Number(event.currentTarget.value);
                onChange({ ...settings, bands });
              }}
            />
          </label>
        ))}
      </div>
    </section>
  );
}
