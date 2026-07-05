use std::{path::PathBuf, sync::Mutex};

use tauri::Emitter;

use crate::{
    errors::AppError,
    models::{AppSettings, PlaybackState, PlaylistSnapshot},
    services::{playback::PlaybackService, playlist::PlaylistService, settings::SettingsService},
};

pub const PLAYBACK_STATE_CHANGED: &str = "playback_state_changed";
pub const PLAYLIST_CHANGED: &str = "playlist_changed";

pub struct AppState {
    pub playback: Mutex<PlaybackService>,
    pub playlist: Mutex<PlaylistService>,
    pub settings_service: SettingsService,
    pub settings: Mutex<AppSettings>,
}

impl AppState {
    pub fn new(app_data_dir: PathBuf) -> Result<Self, AppError> {
        let settings_service = SettingsService::new(app_data_dir);
        let settings = settings_service.load()?;

        Ok(Self {
            playback: Mutex::new(PlaybackService::new_best_effort()),
            playlist: Mutex::new(PlaylistService::default()),
            settings_service,
            settings: Mutex::new(settings),
        })
    }

    pub fn emit_playback_state(app: &tauri::AppHandle, state: &PlaybackState) {
        let _ = app.emit(PLAYBACK_STATE_CHANGED, state.clone());
    }

    pub fn emit_playlist(app: &tauri::AppHandle, snapshot: &PlaylistSnapshot) {
        let _ = app.emit(PLAYLIST_CHANGED, snapshot.clone());
    }
}
