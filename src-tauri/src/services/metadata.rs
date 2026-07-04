use std::path::Path;

use lofty::{
    config::WriteOptions,
    file::{AudioFile, TaggedFileExt},
    prelude::Accessor,
    read_from_path,
    tag::Tag,
};

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
    let fallback_title = path
        .file_stem()
        .and_then(|value| value.to_str())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or("未知歌曲")
        .to_string();

    let Ok(tagged_file) = read_from_path(path) else {
        return TrackMetadata {
            title: fallback_title,
            artist: String::new(),
            album: String::new(),
            duration_ms: 0,
            cover_art_ref: None,
        };
    };

    let tag = tagged_file
        .primary_tag()
        .or_else(|| tagged_file.first_tag());
    let title = tag
        .and_then(|tag| tag.title())
        .map(|value| value.to_string())
        .filter(|value| !value.trim().is_empty())
        .unwrap_or(fallback_title);
    let artist = tag
        .and_then(|tag| tag.artist())
        .map(|value| value.to_string())
        .unwrap_or_default();
    let album = tag
        .and_then(|tag| tag.album())
        .map(|value| value.to_string())
        .unwrap_or_default();
    let duration_ms = tagged_file
        .properties()
        .duration()
        .as_millis()
        .min(u128::from(u64::MAX)) as u64;

    TrackMetadata {
        title,
        artist,
        album,
        duration_ms,
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

    write_tags_to_file(&track.file_path, &title, &artist, &album)?;

    track.title = title;
    track.artist = artist;
    track.album = album;
    track.cover_art_ref = cover_path;
    track.tag_status = TagStatus::Clean;
    Ok(track)
}

fn write_tags_to_file(
    file_path: &str,
    title: &str,
    artist: &str,
    album: &str,
) -> Result<(), AppError> {
    let path = Path::new(file_path);
    let mut tagged_file =
        read_from_path(path).map_err(|err| AppError::MetadataReadFailed(err.to_string()))?;

    if tagged_file.primary_tag().is_none() {
        let tag_type = tagged_file.file_type().primary_tag_type();
        tagged_file.insert_tag(Tag::new(tag_type));
    }

    let tag = tagged_file
        .primary_tag_mut()
        .ok_or_else(|| AppError::MetadataWriteFailed("无法创建主标签".into()))?;
    tag.set_title(title.to_string());
    tag.set_artist(artist.to_string());
    tag.set_album(album.to_string());

    tagged_file
        .save_to_path(path, WriteOptions::default())
        .map_err(|err| AppError::MetadataWriteFailed(err.to_string()))
}

#[cfg(test)]
mod tests {
    use std::{fs, path::Path};

    use tempfile::tempdir;

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
        let dir = tempdir().unwrap();
        let path = dir.path().join("a.wav");
        fs::write(&path, silent_wav()).unwrap();

        let track = Track {
            id: "1".into(),
            file_path: path.to_string_lossy().to_string(),
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

        let metadata = read_track_metadata(&path);
        assert_eq!(metadata.title, "New");
        assert_eq!(metadata.artist, "Singer");
        assert_eq!(metadata.album, "Album");
    }

    fn silent_wav() -> Vec<u8> {
        let mut bytes = Vec::new();
        bytes.extend_from_slice(b"RIFF");
        bytes.extend_from_slice(&38u32.to_le_bytes());
        bytes.extend_from_slice(b"WAVE");
        bytes.extend_from_slice(b"fmt ");
        bytes.extend_from_slice(&16u32.to_le_bytes());
        bytes.extend_from_slice(&1u16.to_le_bytes());
        bytes.extend_from_slice(&1u16.to_le_bytes());
        bytes.extend_from_slice(&8_000u32.to_le_bytes());
        bytes.extend_from_slice(&16_000u32.to_le_bytes());
        bytes.extend_from_slice(&2u16.to_le_bytes());
        bytes.extend_from_slice(&16u16.to_le_bytes());
        bytes.extend_from_slice(b"data");
        bytes.extend_from_slice(&2u32.to_le_bytes());
        bytes.extend_from_slice(&0i16.to_le_bytes());
        bytes
    }
}
