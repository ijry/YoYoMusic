interface SettingsPanelProps {
  shortcuts: Record<string, string>;
  enrichmentEnabled: boolean;
  errorCode: string | null;
  onShortcutChange: (action: string, shortcut: string) => void;
}

export function SettingsPanel({
  shortcuts,
  enrichmentEnabled,
  errorCode,
  onShortcutChange,
}: SettingsPanelProps) {
  return (
    <section className="settings-panel" aria-labelledby="settings-title">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Settings</p>
          <h2 id="settings-title">设置</h2>
        </div>
        <span className="settings-panel__status">{enrichmentEnabled ? "联网补全已开启" : "联网补全已关闭"}</span>
      </div>

      {errorCode === "shortcut_conflict" ? (
        <p role="alert" className="error-text">
          快捷键冲突，请重新设置。
        </p>
      ) : null}

      <label className="settings-panel__field">
        播放/暂停快捷键
        <input
          aria-label="播放/暂停快捷键"
          value={shortcuts.toggle_playback ?? ""}
          onChange={(event) => onShortcutChange("toggle_playback", event.currentTarget.value)}
        />
      </label>
      <label className="settings-panel__field">
        下一首快捷键
        <input
          aria-label="下一首快捷键"
          value={shortcuts.next_track ?? ""}
          onChange={(event) => onShortcutChange("next_track", event.currentTarget.value)}
        />
      </label>
    </section>
  );
}
