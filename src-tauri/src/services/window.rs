use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use crate::errors::AppError;

pub async fn open_mini_player_window(app: AppHandle) -> Result<String, AppError> {
    open_or_focus_window(app, "mini", "?window=mini", false).await
}

pub async fn toggle_desktop_lyrics_window(app: AppHandle) -> Result<String, AppError> {
    if let Some(window) = app.get_webview_window("desktop-lyrics") {
        window
            .close()
            .map_err(|err| AppError::StorageFailed(err.to_string()))?;
        return Ok("closed".into());
    }

    open_or_focus_window(app, "desktop-lyrics", "?window=desktop-lyrics", true).await
}

async fn open_or_focus_window(
    app: AppHandle,
    label: &str,
    route: &str,
    lyrics_window: bool,
) -> Result<String, AppError> {
    if let Some(window) = app.get_webview_window(label) {
        focus_window(&window)?;
        return Ok("focused".into());
    }

    let mut builder = WebviewWindowBuilder::new(&app, label, WebviewUrl::App(route.into()))
        .title(if lyrics_window { "桌面歌词" } else { "悠悠乐听迷你模式" })
        .always_on_top(true)
        .resizable(!lyrics_window);

    if lyrics_window {
        builder = builder
            .decorations(false)
            .transparent(true)
            .skip_taskbar(true)
            .inner_size(820.0, 130.0);
    } else {
        builder = builder.inner_size(520.0, 128.0);
    }

    let window = builder
        .build()
        .map_err(|err| AppError::StorageFailed(err.to_string()))?;
    focus_window(&window)?;
    Ok("opened".into())
}

fn focus_window(window: &WebviewWindow) -> Result<(), AppError> {
    window
        .show()
        .map_err(|err| AppError::StorageFailed(err.to_string()))?;
    window
        .set_focus()
        .map_err(|err| AppError::StorageFailed(err.to_string()))
}
