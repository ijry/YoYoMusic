use std::{
    fs,
    path::{Path, PathBuf},
};

use uuid::Uuid;

use crate::{
    errors::AppError,
    models::{PlayMode, Playlist, PlaylistSnapshot, TagStatus, Track, TrackStatus},
    services::metadata::read_track_metadata,
};

#[derive(Debug)]
pub struct PlaylistService {
    playlist: Playlist,
    tracks: Vec<Track>,
}

#[derive(Clone, Debug, PartialEq)]
pub enum AutoAdvanceDecision {
    Play(Track),
    Stop,
}

impl Default for PlaylistService {
    fn default() -> Self {
        Self {
            playlist: Playlist {
                id: "default".into(),
                name: "当前播放列表".into(),
                track_ids: vec![],
                current_index: 0,
                play_mode: PlayMode::Sequence,
            },
            tracks: vec![],
        }
    }
}

impl PlaylistService {
    pub fn snapshot(&self) -> PlaylistSnapshot {
        PlaylistSnapshot {
            playlist: self.playlist.clone(),
            tracks: self.tracks.clone(),
        }
    }

    pub fn add_paths(&mut self, paths: Vec<PathBuf>) -> Result<PlaylistSnapshot, AppError> {
        for path in collect_audio_paths(paths) {
            let id = Uuid::new_v4().to_string();
            let metadata = read_track_metadata(&path);

            self.playlist.track_ids.push(id.clone());
            self.tracks.push(Track {
                id,
                file_path: path.to_string_lossy().to_string(),
                title: metadata.title,
                artist: metadata.artist,
                album: metadata.album,
                duration_ms: metadata.duration_ms,
                cover_art_ref: metadata.cover_art_ref,
                lyrics_ref: None,
                tag_status: TagStatus::Clean,
                status: TrackStatus::Ready,
            });
        }

        Ok(self.snapshot())
    }

    pub fn remove_track(&mut self, track_id: &str) -> Result<PlaylistSnapshot, AppError> {
        self.tracks.retain(|track| track.id != track_id);
        self.playlist.track_ids.retain(|id| id != track_id);

        if self.playlist.track_ids.is_empty() {
            self.playlist.current_index = 0;
        } else if self.playlist.current_index >= self.playlist.track_ids.len() {
            self.playlist.current_index = self.playlist.track_ids.len() - 1;
        }

        Ok(self.snapshot())
    }

    pub fn clear(&mut self) -> PlaylistSnapshot {
        self.tracks.clear();
        self.playlist.track_ids.clear();
        self.playlist.current_index = 0;
        self.snapshot()
    }

    pub fn track_by_id(&self, track_id: &str) -> Option<Track> {
        self.tracks
            .iter()
            .find(|track| track.id == track_id)
            .cloned()
    }

    pub fn select_track(&mut self, track_id: &str) -> Option<Track> {
        let index = self
            .playlist
            .track_ids
            .iter()
            .position(|id| id == track_id)?;
        self.playlist.current_index = index;
        self.track_by_id(track_id)
    }

    pub fn replace_track(&mut self, updated: Track) -> Result<PlaylistSnapshot, AppError> {
        let track = self
            .tracks
            .iter_mut()
            .find(|track| track.id == updated.id)
            .ok_or_else(|| AppError::FileMissing(updated.id.clone()))?;
        *track = updated;
        Ok(self.snapshot())
    }

    pub fn mark_track_status(
        &mut self,
        track_id: &str,
        status: TrackStatus,
    ) -> Result<PlaylistSnapshot, AppError> {
        let track = self
            .tracks
            .iter_mut()
            .find(|track| track.id == track_id)
            .ok_or_else(|| AppError::FileMissing(track_id.to_string()))?;
        track.status = status;
        Ok(self.snapshot())
    }

    pub fn current_track(&self) -> Option<Track> {
        let track_id = self.playlist.track_ids.get(self.playlist.current_index)?;
        self.track_by_id(track_id)
    }

    pub fn next_track(&mut self) -> Option<Track> {
        self.select_next_track()
    }

    pub fn previous_track(&mut self) -> Option<Track> {
        self.select_previous_track()
    }

    pub fn select_next_track(&mut self) -> Option<Track> {
        if self.playlist.track_ids.is_empty() {
            return None;
        }

        self.playlist.current_index = match self.playlist.play_mode {
            PlayMode::RepeatOne => self.playlist.current_index,
            PlayMode::Shuffle => self
                .shuffle_candidate_index(self.current_track_id())
                .unwrap_or(self.playlist.current_index),
            _ => (self.playlist.current_index + 1) % self.playlist.track_ids.len(),
        };
        self.current_track()
    }

    pub fn select_previous_track(&mut self) -> Option<Track> {
        if self.playlist.track_ids.is_empty() {
            return None;
        }

        self.playlist.current_index = if self.playlist.current_index == 0 {
            self.playlist.track_ids.len() - 1
        } else {
            self.playlist.current_index - 1
        };
        self.current_track()
    }

    pub fn auto_advance_after_finished(
        &mut self,
        current_track_id: Option<&str>,
    ) -> AutoAdvanceDecision {
        if self.playlist.track_ids.is_empty() {
            return AutoAdvanceDecision::Stop;
        }

        if let Some(track_id) = current_track_id {
            if let Some(index) = self.playlist.track_ids.iter().position(|id| id == track_id) {
                self.playlist.current_index = index;
            }
        }

        let next_index = match self.playlist.play_mode {
            PlayMode::RepeatOne => self.playable_current_index(),
            PlayMode::RepeatAll => self.next_playable_index_wrapping(self.playlist.current_index),
            PlayMode::Shuffle => self.shuffle_candidate_index(current_track_id),
            PlayMode::Sequence => {
                self.next_playable_index_without_wrapping(self.playlist.current_index)
            }
        };

        let Some(index) = next_index else {
            return AutoAdvanceDecision::Stop;
        };

        self.playlist.current_index = index;
        self.current_track()
            .map(AutoAdvanceDecision::Play)
            .unwrap_or(AutoAdvanceDecision::Stop)
    }

    pub fn set_play_mode(&mut self, play_mode: PlayMode) -> PlaylistSnapshot {
        self.playlist.play_mode = play_mode;
        self.snapshot()
    }

    fn current_track_id(&self) -> Option<&str> {
        self.playlist
            .track_ids
            .get(self.playlist.current_index)
            .map(String::as_str)
    }

    fn playable_current_index(&self) -> Option<usize> {
        let track_id = self.current_track_id()?;
        self.playable_index_for_track_id(track_id)
    }

    fn next_playable_index_without_wrapping(&self, current_index: usize) -> Option<usize> {
        ((current_index + 1)..self.playlist.track_ids.len())
            .find(|index| self.is_playable_index(*index))
    }

    fn next_playable_index_wrapping(&self, current_index: usize) -> Option<usize> {
        let len = self.playlist.track_ids.len();
        if len == 0 {
            return None;
        }

        (1..=len)
            .map(|offset| (current_index + offset) % len)
            .find(|index| self.is_playable_index(*index))
    }

    fn shuffle_candidate_index(&self, current_track_id: Option<&str>) -> Option<usize> {
        let playable: Vec<usize> = self
            .playlist
            .track_ids
            .iter()
            .enumerate()
            .filter_map(|(index, id)| {
                if self.is_playable_index(index) {
                    Some((index, id.as_str()))
                } else {
                    None
                }
            })
            .filter(|(_, id)| {
                playable_exclusion_allows(*id, current_track_id, self.playable_count())
            })
            .map(|(index, _)| index)
            .collect();

        if playable.is_empty() {
            return None;
        }

        let seed = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|duration| duration.subsec_nanos() as usize)
            .unwrap_or(0);
        Some(playable[seed % playable.len()])
    }

    fn playable_count(&self) -> usize {
        self.playlist
            .track_ids
            .iter()
            .enumerate()
            .filter(|(index, _)| self.is_playable_index(*index))
            .count()
    }

    fn playable_index_for_track_id(&self, track_id: &str) -> Option<usize> {
        self.playlist
            .track_ids
            .iter()
            .position(|id| id == track_id)
            .filter(|index| self.is_playable_index(*index))
    }

    fn is_playable_index(&self, index: usize) -> bool {
        let Some(track_id) = self.playlist.track_ids.get(index) else {
            return false;
        };
        self.tracks
            .iter()
            .any(|track| track.id == *track_id && track.status == TrackStatus::Ready)
    }
}

pub fn is_supported_audio_path(path: &Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| {
            matches!(
                ext.to_ascii_lowercase().as_str(),
                "mp3" | "flac" | "wav" | "ogg" | "m4a" | "aac"
            )
        })
        .unwrap_or(false)
}

fn collect_audio_paths(paths: Vec<PathBuf>) -> Vec<PathBuf> {
    let mut collected = Vec::new();
    for path in paths {
        collect_audio_path(path, &mut collected);
    }
    collected.sort();
    collected.dedup();
    collected
}

fn playable_exclusion_allows(
    id: &str,
    current_track_id: Option<&str>,
    playable_count: usize,
) -> bool {
    if playable_count <= 1 {
        return true;
    }
    Some(id) != current_track_id
}

fn collect_audio_path(path: PathBuf, collected: &mut Vec<PathBuf>) {
    if path.is_dir() {
        let Ok(entries) = fs::read_dir(path) else {
            return;
        };

        for entry in entries.flatten() {
            collect_audio_path(entry.path(), collected);
        }
    } else if is_supported_audio_path(&path) {
        collected.push(path);
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        models::{PlayMode, Playlist, TagStatus, Track, TrackStatus},
        services::playlist::{AutoAdvanceDecision, PlaylistService},
    };

    #[test]
    fn sequence_advances_to_next_ready_track() {
        let mut service = playlist_with_tracks(vec![
            track("a", TrackStatus::Ready),
            track("b", TrackStatus::Ready),
        ]);
        service.select_track("a");

        let decision = service.auto_advance_after_finished(Some("a"));

        assert!(matches!(decision, AutoAdvanceDecision::Play(track) if track.id == "b"));
        assert_eq!(service.snapshot().playlist.current_index, 1);
    }

    #[test]
    fn sequence_stops_at_last_track() {
        let mut service = playlist_with_tracks(vec![
            track("a", TrackStatus::Ready),
            track("b", TrackStatus::Ready),
        ]);
        service.select_track("b");

        let decision = service.auto_advance_after_finished(Some("b"));

        assert_eq!(decision, AutoAdvanceDecision::Stop);
        assert_eq!(service.snapshot().playlist.current_index, 1);
    }

    #[test]
    fn repeat_all_wraps_to_first_track() {
        let mut service = playlist_with_tracks(vec![
            track("a", TrackStatus::Ready),
            track("b", TrackStatus::Ready),
        ]);
        service.set_play_mode(PlayMode::RepeatAll);
        service.select_track("b");

        let decision = service.auto_advance_after_finished(Some("b"));

        assert!(matches!(decision, AutoAdvanceDecision::Play(track) if track.id == "a"));
        assert_eq!(service.snapshot().playlist.current_index, 0);
    }

    #[test]
    fn repeat_one_replays_current_track() {
        let mut service = playlist_with_tracks(vec![
            track("a", TrackStatus::Ready),
            track("b", TrackStatus::Ready),
        ]);
        service.set_play_mode(PlayMode::RepeatOne);
        service.select_track("b");

        let decision = service.auto_advance_after_finished(Some("b"));

        assert!(matches!(decision, AutoAdvanceDecision::Play(track) if track.id == "b"));
        assert_eq!(service.snapshot().playlist.current_index, 1);
    }

    #[test]
    fn shuffle_does_not_repeat_current_track_when_alternatives_exist() {
        let mut service = playlist_with_tracks(vec![
            track("a", TrackStatus::Ready),
            track("b", TrackStatus::Ready),
            track("c", TrackStatus::Ready),
        ]);
        service.set_play_mode(PlayMode::Shuffle);
        service.select_track("a");

        let decision = service.auto_advance_after_finished(Some("a"));

        assert!(matches!(decision, AutoAdvanceDecision::Play(track) if track.id != "a"));
    }

    #[test]
    fn auto_advance_skips_missing_and_unplayable_tracks() {
        let mut service = playlist_with_tracks(vec![
            track("a", TrackStatus::Ready),
            track("missing", TrackStatus::Missing),
            track("bad", TrackStatus::Unplayable),
            track("b", TrackStatus::Ready),
        ]);
        service.select_track("a");

        let decision = service.auto_advance_after_finished(Some("a"));

        assert!(matches!(decision, AutoAdvanceDecision::Play(track) if track.id == "b"));
        assert_eq!(service.snapshot().playlist.current_index, 3);
    }

    #[test]
    fn marks_track_status_by_id() {
        let mut service = playlist_with_tracks(vec![
            track("a", TrackStatus::Ready),
            track("b", TrackStatus::Ready),
        ]);

        let snapshot = service
            .mark_track_status("b", TrackStatus::Unplayable)
            .expect("track should be marked");

        let marked = snapshot
            .tracks
            .iter()
            .find(|track| track.id == "b")
            .expect("track b should exist");
        assert_eq!(marked.status, TrackStatus::Unplayable);
    }

    fn playlist_with_tracks(tracks: Vec<Track>) -> PlaylistService {
        let track_ids = tracks.iter().map(|track| track.id.clone()).collect();
        PlaylistService {
            playlist: Playlist {
                id: "default".into(),
                name: "当前播放列表".into(),
                track_ids,
                current_index: 0,
                play_mode: PlayMode::Sequence,
            },
            tracks,
        }
    }

    fn track(id: &str, status: TrackStatus) -> Track {
        Track {
            id: id.into(),
            file_path: format!("{id}.mp3"),
            title: id.into(),
            artist: String::new(),
            album: String::new(),
            duration_ms: 1000,
            cover_art_ref: None,
            lyrics_ref: None,
            tag_status: TagStatus::Clean,
            status,
        }
    }
}
