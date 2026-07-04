use std::path::{Path, PathBuf};

use sha2::{Digest, Sha256};

pub fn artwork_cache_key(path: &Path) -> String {
    let mut hasher = Sha256::new();
    hasher.update(path.to_string_lossy().as_bytes());
    format!("{:x}", hasher.finalize())
}

pub fn artwork_cache_path(cache_root: &Path, audio_path: &Path, extension: &str) -> PathBuf {
    cache_root.join(format!("{}.{}", artwork_cache_key(audio_path), extension))
}
