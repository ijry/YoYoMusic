use std::{path::PathBuf, sync::Mutex};

use crate::{errors::AppError, models::AppSettings, services::settings::SettingsService};

pub struct AppState {
    pub settings_service: SettingsService,
    pub settings: Mutex<AppSettings>,
}

impl AppState {
    pub fn new(app_data_dir: PathBuf) -> Result<Self, AppError> {
        let settings_service = SettingsService::new(app_data_dir);
        let settings = settings_service.load()?;

        Ok(Self {
            settings_service,
            settings: Mutex::new(settings),
        })
    }
}
