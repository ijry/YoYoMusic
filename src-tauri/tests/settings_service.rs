use tempfile::tempdir;
use yoyomusic_lib::models::{AppSettings, DesktopLyricsSettings, EqualizerSettings};
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
        desktop_lyrics: DesktopLyricsSettings {
            theme: "mint".into(),
            font_scale: 1.4,
            pinned: true,
            click_through: false,
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
    assert_eq!(loaded.desktop_lyrics.theme, "mint");
    assert!(loaded.desktop_lyrics.pinned);
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

/*
 * `AppSettings` carries `#[serde(default)]` precisely so a file written by an
 * older build — one without `desktop_lyrics` — still deserializes. Without it
 * the whole load fails, and the user is left with no settings at all rather
 * than one missing section.
 */
#[test]
fn fills_desktop_lyrics_defaults_for_settings_written_before_the_field_existed() {
    let dir = tempdir().unwrap();
    std::fs::write(
        dir.path().join("settings.json"),
        r#"{
            "defaultSkin": "aurora-glass",
            "shortcuts": {},
            "enrichmentEnabled": false,
            "cacheRetentionDays": 30,
            "recentPlaylists": [],
            "restoreSession": true,
            "visualizationMode": "spectrum",
            "equalizer": {
                "enabled": false,
                "preset": "flat",
                "bands": [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
            }
        }"#,
    )
    .unwrap();

    let service = SettingsService::new(dir.path().to_path_buf());
    let loaded = service.load().unwrap();

    assert_eq!(loaded.default_skin, "aurora-glass");
    assert_eq!(loaded.desktop_lyrics.theme, "aurora");
    assert!((loaded.desktop_lyrics.font_scale - 1.0).abs() < f32::EPSILON);
    assert!(!loaded.desktop_lyrics.pinned);
    assert!(!loaded.desktop_lyrics.click_through);
}
