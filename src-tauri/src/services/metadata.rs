use std::path::Path;

use crate::{
    errors::AppError,
    models::{TagStatus, Track},
};

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TrackMetadata {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_ms: u64,
    pub cover_art_ref: Option<String>,
}

pub fn read_track_metadata(path: &Path) -> TrackMetadata {
    let title = path
        .file_stem()
        .and_then(|value| value.to_str())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("未知歌曲")
        .to_string();

    TrackMetadata {
        title,
        artist: String::new(),
        album: String::new(),
        duration_ms: 0,
        cover_art_ref: None,
    }
}

pub fn apply_tag_edit(
    mut track: Track,
    title: String,
    artist: String,
    album: String,
    cover_path: Option<String>,
) -> Result<Track, AppError> {
    if title.trim().is_empty() {
        return Err(AppError::MetadataWriteFailed("标题不能为空".into()));
    }

    track.title = title;
    track.artist = artist;
    track.album = album;
    track.cover_art_ref = cover_path;
    track.tag_status = TagStatus::Clean;
    Ok(track)
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use crate::{
        models::{TagStatus, Track, TrackStatus},
        services::metadata::{apply_tag_edit, read_track_metadata},
    };

    #[test]
    fn falls_back_to_file_stem_title() {
        let metadata = read_track_metadata(Path::new("D:/Music/Song Name.mp3"));
        assert_eq!(metadata.title, "Song Name");
        assert_eq!(metadata.duration_ms, 0);
    }

    #[test]
    fn applies_tag_edit_to_track_snapshot() {
        let track = Track {
            id: "1".into(),
            file_path: "a.mp3".into(),
            title: "Old".into(),
            artist: String::new(),
            album: String::new(),
            duration_ms: 0,
            cover_art_ref: None,
            lyrics_ref: None,
            tag_status: TagStatus::Dirty,
            status: TrackStatus::Ready,
        };

        let updated = apply_tag_edit(
            track,
            "New".into(),
            "Singer".into(),
            "Album".into(),
            Some("cover.png".into()),
        )
        .unwrap();

        assert_eq!(updated.title, "New");
        assert_eq!(updated.artist, "Singer");
        assert_eq!(updated.cover_art_ref.as_deref(), Some("cover.png"));
        assert_eq!(updated.tag_status, TagStatus::Clean);
    }
}
