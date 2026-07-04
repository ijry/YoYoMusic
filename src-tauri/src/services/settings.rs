use std::{fs, path::PathBuf};

use crate::{errors::AppError, models::AppSettings};

#[derive(Clone, Debug)]
pub struct SettingsService {
    settings_path: PathBuf,
}

impl SettingsService {
    pub fn new(app_data_dir: PathBuf) -> Self {
        Self {
            settings_path: app_data_dir.join("settings.json"),
        }
    }

    pub fn load(&self) -> Result<AppSettings, AppError> {
        if !self.settings_path.exists() {
            return Ok(AppSettings::default());
        }

        let contents = fs::read_to_string(&self.settings_path)
            .map_err(|err| AppError::StorageFailed(err.to_string()))?;
        serde_json::from_str(&contents).map_err(|err| AppError::StorageFailed(err.to_string()))
    }

    pub fn save(&self, settings: &AppSettings) -> Result<(), AppError> {
        if let Some(parent) = self.settings_path.parent() {
            fs::create_dir_all(parent).map_err(|err| AppError::StorageFailed(err.to_string()))?;
        }

        let contents = serde_json::to_string_pretty(settings)
            .map_err(|err| AppError::StorageFailed(err.to_string()))?;
        fs::write(&self.settings_path, contents)
            .map_err(|err| AppError::StorageFailed(err.to_string()))
    }
}
