use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    AppHandle, Manager,
};

use crate::errors::AppError;

pub fn setup_tray(app: &AppHandle) -> Result<(), AppError> {
    let toggle_playback = MenuItem::with_id(app, "toggle_playback", "播放/暂停", true, None::<&str>)
        .map_err(|err| AppError::StorageFailed(err.to_string()))?;
    let previous_track = MenuItem::with_id(app, "previous_track", "上一首", true, None::<&str>)
        .map_err(|err| AppError::StorageFailed(err.to_string()))?;
    let next_track = MenuItem::with_id(app, "next_track", "下一首", true, None::<&str>)
        .map_err(|err| AppError::StorageFailed(err.to_string()))?;
    let show_main_window =
        MenuItem::with_id(app, "show_main_window", "显示主窗口", true, None::<&str>)
            .map_err(|err| AppError::StorageFailed(err.to_string()))?;
    let open_mini_player =
        MenuItem::with_id(app, "open_mini_player", "迷你模式", true, None::<&str>)
            .map_err(|err| AppError::StorageFailed(err.to_string()))?;
    let toggle_desktop_lyrics =
        MenuItem::with_id(app, "toggle_desktop_lyrics", "桌面歌词", true, None::<&str>)
            .map_err(|err| AppError::StorageFailed(err.to_string()))?;
    let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)
        .map_err(|err| AppError::StorageFailed(err.to_string()))?;

    let menu = Menu::with_items(
        app,
        &[
            &toggle_playback,
            &previous_track,
            &next_track,
            &show_main_window,
            &open_mini_player,
            &toggle_desktop_lyrics,
            &quit,
        ],
    )
    .map_err(|err| AppError::StorageFailed(err.to_string()))?;

    let icon = app
        .default_window_icon()
        .cloned()
        .ok_or_else(|| AppError::StorageFailed("默认图标缺失".into()))?;

    TrayIconBuilder::with_id("main")
        .tooltip("悠悠乐听")
        .menu(&menu)
        .icon(icon)
        .on_menu_event(|app, event| match event.id().as_ref() {
            "show_main_window" => {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)
        .map_err(|err| AppError::StorageFailed(err.to_string()))?;

    Ok(())
}
