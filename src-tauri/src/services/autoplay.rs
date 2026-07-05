use std::{thread, time::Duration};

use tauri::Manager;

use crate::{
    errors::AppError,
    models::PlaybackState,
    services::{playback::PlaybackTick, playlist::AutoAdvanceDecision},
    state::AppState,
};

pub fn spawn_playback_monitor(app: tauri::AppHandle) -> Result<(), AppError> {
    thread::Builder::new()
        .name("yoyomusic-autoplay".into())
        .spawn(move || loop {
            thread::sleep(Duration::from_millis(500));
            if let Err(err) = run_playback_maintenance(&app) {
                log::warn!("playback maintenance failed: {err}");
            }
        })
        .map(|_| ())
        .map_err(|err| AppError::StorageFailed(err.to_string()))
}

pub fn run_playback_maintenance(app: &tauri::AppHandle) -> Result<(), AppError> {
    let app_state = app.state::<AppState>();
    let tick = {
        let mut playback = app_state
            .playback
            .lock()
            .map_err(|err| AppError::StorageFailed(err.to_string()))?;
        playback.tick()
    };

    match tick {
        PlaybackTick::Finished(finished_state) => handle_finished_playback(app, finished_state),
        PlaybackTick::PositionChanged(state) => {
            AppState::emit_playback_state(app, &state);
            Ok(())
        }
        PlaybackTick::Idle(_) => Ok(()),
    }
}

fn handle_finished_playback(
    app: &tauri::AppHandle,
    finished_state: PlaybackState,
) -> Result<(), AppError> {
    let app_state = app.state::<AppState>();
    let (decision, playlist_snapshot) = {
        let mut playlist = app_state
            .playlist
            .lock()
            .map_err(|err| AppError::StorageFailed(err.to_string()))?;
        let decision = playlist.auto_advance_after_finished(finished_state.track_id.as_deref());
        let snapshot = playlist.snapshot();
        (decision, snapshot)
    };

    let playback_state = apply_auto_advance_decision(app, decision)?;
    AppState::emit_playlist(app, &playlist_snapshot);
    AppState::emit_playback_state(app, &playback_state);
    Ok(())
}

fn apply_auto_advance_decision(
    app: &tauri::AppHandle,
    decision: AutoAdvanceDecision,
) -> Result<PlaybackState, AppError> {
    let app_state = app.state::<AppState>();
    let mut playback = app_state
        .playback
        .lock()
        .map_err(|err| AppError::StorageFailed(err.to_string()))?;

    match decision {
        AutoAdvanceDecision::Play(track) => playback
            .play(track)
            .or_else(|_| Ok(playback.stop_after_finished())),
        AutoAdvanceDecision::Stop => Ok(playback.stop_after_finished()),
    }
}
