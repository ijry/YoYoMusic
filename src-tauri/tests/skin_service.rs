use std::fs;

use tempfile::tempdir;
use yoyomusic_lib::services::skin::validate_skin_package;

#[test]
fn validates_skin_package_with_required_files() {
    let dir = tempdir().unwrap();
    fs::create_dir_all(dir.path().join("assets")).unwrap();
    fs::write(
        dir.path().join("manifest.json"),
        r#"{"name":"Classic Blue","version":"1.0.0","author":"YoYoMusic","supports":["main","mini","desktopLyrics"],"assets":[]}"#,
    )
    .unwrap();
    fs::write(
        dir.path().join("theme.json"),
        r##"{"colors":{"primary":"#102030","surface":"#ffffff","text":"#111111"}}"##,
    )
    .unwrap();

    let manifest = validate_skin_package(dir.path().to_path_buf()).unwrap();

    assert_eq!(manifest.name, "Classic Blue");
}

#[test]
fn rejects_skin_package_without_manifest() {
    let dir = tempdir().unwrap();
    fs::create_dir_all(dir.path().join("assets")).unwrap();
    fs::write(dir.path().join("theme.json"), "{}").unwrap();

    let err = validate_skin_package(dir.path().to_path_buf()).unwrap_err();

    assert!(err.to_string().contains("manifest"));
}
