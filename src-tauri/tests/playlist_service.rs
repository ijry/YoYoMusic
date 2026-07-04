use std::path::PathBuf;

use yoyomusic_lib::models::PlayMode;
use yoyomusic_lib::services::playlist::PlaylistService;

#[test]
fn adds_audio_paths_as_tracks() {
    let mut service = PlaylistService::default();
    let snapshot = service
        .add_paths(vec![
            PathBuf::from("D:/Music/a.mp3"),
            PathBuf::from("D:/Music/b.flac"),
        ])
        .unwrap();

    assert_eq!(snapshot.playlist.track_ids.len(), 2);
    assert_eq!(snapshot.tracks[0].title, "a");
    assert_eq!(snapshot.tracks[1].title, "b");
    assert_eq!(snapshot.playlist.play_mode, PlayMode::Sequence);
}

#[test]
fn skips_unsupported_paths() {
    let mut service = PlaylistService::default();
    let snapshot = service
        .add_paths(vec![
            PathBuf::from("D:/Music/a.mp3"),
            PathBuf::from("D:/Music/cover.jpg"),
        ])
        .unwrap();

    assert_eq!(snapshot.tracks.len(), 1);
    assert_eq!(snapshot.tracks[0].title, "a");
}

#[test]
fn remove_track_keeps_current_index_in_range() {
    let mut service = PlaylistService::default();
    let snapshot = service
        .add_paths(vec![PathBuf::from("a.mp3"), PathBuf::from("b.mp3")])
        .unwrap();
    let first_id = snapshot.tracks[0].id.clone();

    let updated = service.remove_track(&first_id).unwrap();

    assert_eq!(updated.playlist.track_ids.len(), 1);
    assert_eq!(updated.playlist.current_index, 0);
}
