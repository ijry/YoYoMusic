pub mod errors;
pub mod models;
pub mod state;

pub mod services {
    pub mod artwork;
    pub mod enrichment;
    pub mod lyrics;
    pub mod metadata;
    pub mod playback;
    pub mod playlist;
    pub mod settings;
}

use state::AppState;
use tauri::Manager;

pub mod commands {
    use std::path::PathBuf;

    use crate::{
        errors,
        models::{AppSettings, PlayMode, PlaybackState, PlaylistSnapshot},
        services::lyrics::parse_lrc,
        services::metadata::apply_tag_edit,
        state::AppState,
    };

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
    ) -> Result<PlaybackState, errors::AppError> {
        let mut playlist = state
            .playlist
            .lock()
            .map_err(|err| errors::AppError::StorageFailed(err.to_string()))?;
        playlist.set_play_mode(play_mode.clone());
        drop(playlist);

        let mut playback = state
            .playback
            .lock()
            .map_err(|err| errors::AppError::StorageFailed(err.to_string()))?;
        Ok(playback.set_play_mode(play_mode))
    }

    #[tauri::command]
    pub fn get_playback_state(
        state: tauri::State<'_, AppState>,
    ) -> Result<PlaybackState, errors::AppError> {
        let playback = state
            .playback
            .lock()
            .map_err(|err| errors::AppError::StorageFailed(err.to_string()))?;
        Ok(playback.current_state())
    }

    #[tauri::command]
    pub fn play_track(
        track_id: String,
        state: tauri::State<'_, AppState>,
    ) -> Result<PlaybackState, errors::AppError> {
        let track = {
            let playlist = state
                .playlist
                .lock()
                .map_err(|err| errors::AppError::StorageFailed(err.to_string()))?;
            playlist
                .track_by_id(&track_id)
                .ok_or_else(|| errors::AppError::FileMissing(track_id.clone()))?
        };

        let mut playback = state
            .playback
            .lock()
            .map_err(|err| errors::AppError::StorageFailed(err.to_string()))?;
        Ok(playback.play(track))
    }

    #[tauri::command]
    pub fn toggle_playback(
        state: tauri::State<'_, AppState>,
    ) -> Result<PlaybackState, errors::AppError> {
        let mut playback = state
            .playback
            .lock()
            .map_err(|err| errors::AppError::StorageFailed(err.to_string()))?;
        Ok(playback.toggle())
    }

    #[tauri::command]
    pub fn pause_playback(
        state: tauri::State<'_, AppState>,
    ) -> Result<PlaybackState, errors::AppError> {
        let mut playback = state
            .playback
            .lock()
            .map_err(|err| errors::AppError::StorageFailed(err.to_string()))?;
        Ok(playback.pause())
    }

    #[tauri::command]
    pub fn next_track(state: tauri::State<'_, AppState>) -> Result<PlaybackState, errors::AppError> {
        let track = {
            let mut playlist = state
                .playlist
                .lock()
                .map_err(|err| errors::AppError::StorageFailed(err.to_string()))?;
            playlist.next_track()
        };

        let mut playback = state
            .playback
            .lock()
            .map_err(|err| errors::AppError::StorageFailed(err.to_string()))?;

        Ok(match track {
            Some(track) => playback.play(track),
            None => playback.current_state(),
        })
    }

    #[tauri::command]
    pub fn previous_track(
        state: tauri::State<'_, AppState>,
    ) -> Result<PlaybackState, errors::AppError> {
        let track = {
            let mut playlist = state
                .playlist
                .lock()
                .map_err(|err| errors::AppError::StorageFailed(err.to_string()))?;
            playlist.previous_track()
        };

        let mut playback = state
            .playback
            .lock()
            .map_err(|err| errors::AppError::StorageFailed(err.to_string()))?;

        Ok(match track {
            Some(track) => playback.play(track),
            None => playback.current_state(),
        })
    }

    #[tauri::command]
    pub fn seek(
        position_ms: u64,
        state: tauri::State<'_, AppState>,
    ) -> Result<PlaybackState, errors::AppError> {
        let mut playback = state
            .playback
            .lock()
            .map_err(|err| errors::AppError::StorageFailed(err.to_string()))?;
        Ok(playback.seek(position_ms))
    }

    #[tauri::command]
    pub fn set_volume(
        value: f32,
        state: tauri::State<'_, AppState>,
    ) -> Result<PlaybackState, errors::AppError> {
        let mut playback = state
            .playback
            .lock()
            .map_err(|err| errors::AppError::StorageFailed(err.to_string()))?;
        Ok(playback.set_volume(value))
    }

    #[tauri::command]
    pub fn set_muted(
        value: bool,
        state: tauri::State<'_, AppState>,
    ) -> Result<PlaybackState, errors::AppError> {
        let mut playback = state
            .playback
            .lock()
            .map_err(|err| errors::AppError::StorageFailed(err.to_string()))?;
        Ok(playback.set_muted(value))
    }

    #[tauri::command]
    pub fn save_tags(
        track_id: String,
        title: String,
        artist: String,
        album: String,
        cover_path: Option<String>,
        state: tauri::State<'_, AppState>,
    ) -> Result<crate::models::Track, errors::AppError> {
        let mut playlist = state
            .playlist
            .lock()
            .map_err(|err| errors::AppError::StorageFailed(err.to_string()))?;
        let track = playlist
            .track_by_id(&track_id)
            .ok_or_else(|| errors::AppError::FileMissing(track_id.clone()))?;
        let updated = apply_tag_edit(track, title, artist, album, cover_path)?;
        playlist.replace_track(updated.clone())?;
        Ok(updated)
    }

    #[tauri::command]
    pub fn load_lyrics(contents: String) -> Result<crate::models::LyricsDocument, errors::AppError> {
        parse_lrc(&contents)
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
        .plugin(tauri_plugin_http::init())
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
            commands::get_playback_state,
            commands::play_track,
            commands::toggle_playback,
            commands::pause_playback,
            commands::next_track,
            commands::previous_track,
            commands::seek,
            commands::set_volume,
            commands::set_muted,
            commands::save_tags,
            commands::load_lyrics,
            commands::load_settings,
            commands::save_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
