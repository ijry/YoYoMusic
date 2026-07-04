use sha2::{Digest, Sha256};

use crate::errors::AppError;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct CacheKey {
    pub value: String,
}

impl CacheKey {
    pub fn for_track(path: &str, title: &str, artist: &str) -> Self {
        let mut hasher = Sha256::new();
        hasher.update(path.trim().to_ascii_lowercase().as_bytes());
        hasher.update(b"\0");
        hasher.update(title.trim().to_ascii_lowercase().as_bytes());
        hasher.update(b"\0");
        hasher.update(artist.trim().to_ascii_lowercase().as_bytes());

        Self {
            value: format!("{:x}", hasher.finalize()),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct EnrichedMetadata {
    pub title: String,
    pub artist: String,
    pub album: String,
}

pub trait EnrichmentProvider: Send + Sync {
    fn search_lyrics(&self, title: &str, artist: &str) -> Result<Option<String>, AppError>;
    fn search_artwork(&self, title: &str, artist: &str) -> Result<Option<Vec<u8>>, AppError>;
    fn search_metadata(
        &self,
        title: &str,
        artist: &str,
    ) -> Result<Option<EnrichedMetadata>, AppError>;
}

#[derive(Debug, Default)]
pub struct NoopProvider;

impl EnrichmentProvider for NoopProvider {
    fn search_lyrics(&self, _title: &str, _artist: &str) -> Result<Option<String>, AppError> {
        Ok(None)
    }

    fn search_artwork(&self, _title: &str, _artist: &str) -> Result<Option<Vec<u8>>, AppError> {
        Ok(None)
    }

    fn search_metadata(
        &self,
        _title: &str,
        _artist: &str,
    ) -> Result<Option<EnrichedMetadata>, AppError> {
        Ok(None)
    }
}

#[cfg(test)]
mod tests {
    use super::CacheKey;

    #[test]
    fn cache_key_is_stable_for_same_track_identity() {
        let a = CacheKey::for_track("D:/Music/a.mp3", "Song", "Artist");
        let b = CacheKey::for_track("D:/Music/a.mp3", "Song", "Artist");

        assert_eq!(a.value, b.value);
    }

    #[test]
    fn cache_key_changes_when_path_changes() {
        let a = CacheKey::for_track("a.mp3", "Song", "Artist");
        let b = CacheKey::for_track("b.mp3", "Song", "Artist");

        assert_ne!(a.value, b.value);
    }
}
