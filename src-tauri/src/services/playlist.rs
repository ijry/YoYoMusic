use std::path::{Path, PathBuf};

use uuid::Uuid;

use crate::{
    errors::AppError,
    models::{PlayMode, Playlist, PlaylistSnapshot, TagStatus, Track, TrackStatus},
};

#[derive(Debug)]
pub struct PlaylistService {
    playlist: Playlist,
    tracks: Vec<Track>,
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
        for path in paths {
            if !is_supported_audio_path(&path) {
                continue;
            }

            let id = Uuid::new_v4().to_string();
            let title = path
                .file_stem()
                .and_then(|value| value.to_str())
                .filter(|value| !value.trim().is_empty())
                .unwrap_or("未知歌曲")
                .to_string();

            self.playlist.track_ids.push(id.clone());
            self.tracks.push(Track {
                id,
                file_path: path.to_string_lossy().to_string(),
                title,
                artist: String::new(),
                album: String::new(),
                duration_ms: 0,
                cover_art_ref: None,
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

    pub fn current_track(&self) -> Option<Track> {
        let track_id = self.playlist.track_ids.get(self.playlist.current_index)?;
        self.track_by_id(track_id)
    }

    pub fn next_track(&mut self) -> Option<Track> {
        if self.playlist.track_ids.is_empty() {
            return None;
        }

        self.playlist.current_index = match self.playlist.play_mode {
            PlayMode::RepeatOne => self.playlist.current_index,
            _ => (self.playlist.current_index + 1) % self.playlist.track_ids.len(),
        };
        self.current_track()
    }

    pub fn previous_track(&mut self) -> Option<Track> {
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

    pub fn set_play_mode(&mut self, play_mode: PlayMode) -> PlaylistSnapshot {
        self.playlist.play_mode = play_mode;
        self.snapshot()
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
