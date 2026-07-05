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
  const presetLabel = presets[settings.preset]?.label ?? settings.preset;

  return (
    <section className="equalizer-panel" aria-label="均衡器">
      <div className="equalizer-panel__header">
        <div>
          <p className="eyebrow">Equalizer Rack</p>
          <h2>均衡器</h2>
        </div>
        <span className="equalizer-panel__status">{settings.enabled ? `已启用 · ${presetLabel}` : "均衡器待机"}</span>
      </div>

      <label className="toggle-row equalizer-panel__toggle">
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={(event) => onChange({ ...settings, enabled: event.currentTarget.checked })}
        />
        启用均衡器
      </label>

      <div className="equalizer-presets">
        {Object.entries(presets).map(([preset, config], index) => (
          <button
            key={preset}
            className="equalizer-preset"
            type="button"
            aria-pressed={settings.preset === preset}
            onClick={() => onChange({ enabled: true, preset, bands: config.bands })}
          >
            <span className="equalizer-preset__slot" aria-hidden="true">
              P{index + 1}
            </span>
            <span className="equalizer-preset__label">{config.label}</span>
          </button>
        ))}
      </div>

      <div className="eq-bands">
        {settings.bands.map((band, index) => (
          <label key={index} className="eq-band-card">
            <span className="eq-band__meta">
              <span>频段 {index + 1}</span>
              <span className="eq-band__readout">{band > 0 ? `+${band}` : band}</span>
            </span>
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
