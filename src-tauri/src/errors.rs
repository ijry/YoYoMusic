use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("file is missing: {0}")]
    FileMissing(String),
    #[error("file is unplayable: {0}")]
    Unplayable(String),
    #[error("metadata read failed: {0}")]
    MetadataReadFailed(String),
    #[error("metadata write failed: {0}")]
    MetadataWriteFailed(String),
    #[error("skin package invalid: {0}")]
    InvalidSkinPackage(String),
    #[error("shortcut conflict: {0}")]
    ShortcutConflict(String),
    #[error("storage failed: {0}")]
    StorageFailed(String),
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppErrorPayload {
    pub code: String,
    pub message: String,
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        let code = match self {
            AppError::FileMissing(_) => "file_missing",
            AppError::Unplayable(_) => "unplayable",
            AppError::MetadataReadFailed(_) => "metadata_read_failed",
            AppError::MetadataWriteFailed(_) => "metadata_write_failed",
            AppError::InvalidSkinPackage(_) => "invalid_skin_package",
            AppError::ShortcutConflict(_) => "shortcut_conflict",
            AppError::StorageFailed(_) => "storage_failed",
        };

        AppErrorPayload {
            code: code.to_string(),
            message: self.to_string(),
        }
        .serialize(serializer)
    }
}
