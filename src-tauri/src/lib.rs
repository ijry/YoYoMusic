pub mod errors;
pub mod models;
pub mod state;

pub mod services {
    pub mod playlist;
    pub mod settings;
}

use state::AppState;
use tauri::Manager;

pub mod commands {
    use std::path::PathBuf;

    use crate::{errors, models::{AppSettings, PlayMode, PlaylistSnapshot}, state::AppState};

    #[tauri::command]
    pub fn get_playlist(
        state: tauri::State<'_, AppState>,
    ) -> Result<PlaylistSnapshot, errors::AppError> {
        let playlist = state
            .playlist
            .lock()
            .map_err(|err| errors::AppError::StorageFailed(err.to_string()))?;
        Ok(playlist.snapshot())
    }

    #[tauri::command]
    pub fn add_tracks(
        paths: Vec<String>,
        state: tauri::State<'_, AppState>,
    ) -> Result<PlaylistSnapshot, errors::AppError> {
        let mut playlist = state
            .playlist
            .lock()
            .map_err(|err| errors::AppError::StorageFailed(err.to_string()))?;
        playlist.add_paths(paths.into_iter().map(PathBuf::from).collect())
    }

    #[tauri::command]
    pub fn remove_track(
        track_id: String,
        state: tauri::State<'_, AppState>,
    ) -> Result<PlaylistSnapshot, errors::AppError> {
        let mut playlist = state
            .playlist
            .lock()
            .map_err(|err| errors::AppError::StorageFailed(err.to_string()))?;
        playlist.remove_track(&track_id)
    }

    #[tauri::command]
    pub fn clear_playlist(
        state: tauri::State<'_, AppState>,
    ) -> Result<PlaylistSnapshot, errors::AppError> {
        let mut playlist = state
            .playlist
            .lock()
            .map_err(|err| errors::AppError::StorageFailed(err.to_string()))?;
        Ok(playlist.clear())
    }

    #[tauri::command]
    pub fn set_play_mode(
        play_mode: PlayMode,
        state: tauri::State<'_, AppState>,
    ) -> Result<PlaylistSnapshot, errors::AppError> {
        let mut playlist = state
            .playlist
            .lock()
            .map_err(|err| errors::AppError::StorageFailed(err.to_string()))?;
        Ok(playlist.set_play_mode(play_mode))
    }

    #[tauri::command]
    pub fn load_settings(
        state: tauri::State<'_, AppState>,
    ) -> Result<AppSettings, errors::AppError> {
        state.settings_service.load()
    }

    #[tauri::command]
    pub fn save_settings(
        settings: AppSettings,
        state: tauri::State<'_, AppState>,
    ) -> Result<AppSettings, errors::AppError> {
        state.settings_service.save(&settings)?;
        let mut current = state
            .settings
            .lock()
            .map_err(|err| errors::AppError::StorageFailed(err.to_string()))?;
        *current = settings.clone();
        Ok(settings)
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let app_data_dir = app
                .path()
                .app_data_dir()
                .map_err(|err| Box::<dyn std::error::Error>::from(err))?;
            let state = AppState::new(app_data_dir)?;
            app.manage(state);

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_playlist,
            commands::add_tracks,
            commands::remove_track,
            commands::clear_playlist,
            commands::set_play_mode,
            commands::load_settings,
            commands::save_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
