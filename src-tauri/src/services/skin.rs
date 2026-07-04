use std::{fs, path::PathBuf};

use serde::{Deserialize, Serialize};

use crate::errors::AppError;

#[derive(Clone, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SkinManifest {
    pub name: String,
    pub version: String,
    pub author: String,
    #[serde(default)]
    pub supports: Vec<String>,
    #[serde(default)]
    pub assets: Vec<String>,
}

pub fn validate_skin_package(path: PathBuf) -> Result<SkinManifest, AppError> {
    let manifest_path = path.join("manifest.json");
    let theme_path = path.join("theme.json");
    let assets_path = path.join("assets");

    if !manifest_path.exists() {
        return Err(AppError::InvalidSkinPackage("manifest.json 缺失".into()));
    }

    if !theme_path.exists() {
        return Err(AppError::InvalidSkinPackage("theme.json 缺失".into()));
    }

    if !assets_path.exists() || !assets_path.is_dir() {
        return Err(AppError::InvalidSkinPackage("assets 目录缺失".into()));
    }

    let contents = fs::read_to_string(&manifest_path)
        .map_err(|err| AppError::InvalidSkinPackage(err.to_string()))?;
    let manifest: SkinManifest = serde_json::from_str(&contents)
        .map_err(|err| AppError::InvalidSkinPackage(err.to_string()))?;

    if manifest.name.trim().is_empty() {
        return Err(AppError::InvalidSkinPackage("name 不能为空".into()));
    }
    if manifest.version.trim().is_empty() {
        return Err(AppError::InvalidSkinPackage("version 不能为空".into()));
    }
    if manifest.author.trim().is_empty() {
        return Err(AppError::InvalidSkinPackage("author 不能为空".into()));
    }

    for asset in &manifest.assets {
        if asset.contains("..") || asset.starts_with('/') || asset.starts_with('\\') {
            return Err(AppError::InvalidSkinPackage(format!(
                "asset 路径不安全: {asset}"
            )));
        }
    }

    Ok(manifest)
}
