use tempfile::tempdir;
use yoyomusic_lib::models::{AppSettings, EqualizerSettings};
use yoyomusic_lib::services::settings::SettingsService;

fn sample_settings() -> AppSettings {
    AppSettings {
        default_skin: "classic".into(),
        shortcuts: [("toggle_playback".into(), "Ctrl+Alt+P".into())].into(),
        enrichment_enabled: true,
        cache_retention_days: 30,
        recent_playlists: vec!["default".into()],
        restore_session: true,
        visualization_mode: "spectrum".into(),
        equalizer: EqualizerSettings {
            enabled: true,
            preset: "rock".into(),
            bands: vec![0.0, 1.5, 2.0, 1.0, 0.0, -1.0, -1.5, 0.5, 1.0, 0.0],
        },
    }
}

#[test]
fn saves_and_loads_settings_json() {
    let dir = tempdir().unwrap();
    let service = SettingsService::new(dir.path().to_path_buf());
    let settings = sample_settings();

    service.save(&settings).unwrap();
    let loaded = service.load().unwrap();

    assert_eq!(loaded.default_skin, "classic");
    assert!(loaded.equalizer.enabled);
    assert_eq!(loaded.equalizer.bands.len(), 10);
}

#[test]
fn creates_default_settings_when_file_is_missing() {
    let dir = tempdir().unwrap();
    let service = SettingsService::new(dir.path().to_path_buf());

    let loaded = service.load().unwrap();

    assert_eq!(loaded.default_skin, "default");
    assert_eq!(loaded.visualization_mode, "spectrum");
    assert!(loaded.restore_session);
}
