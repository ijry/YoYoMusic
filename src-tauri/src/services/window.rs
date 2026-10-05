use tauri::{
    AppHandle, LogicalPosition, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder,
};

use crate::errors::AppError;

/*
 * Mini mode is a *replacement* for the main window, not an extra window: the
 * main window is hidden on open and restored on close, so at no point are two
 * player surfaces on screen at once.
 */

pub async fn open_mini_player_window(app: AppHandle) -> Result<String, AppError> {
    let outcome = open_or_focus_window(app.clone(), "mini", "?window=mini", WindowKind::Mini).await?;

    if outcome == "opened" || outcome == "focused" {
        if let Some(main) = app.get_webview_window("main") {
            main.hide()
                .map_err(|err| AppError::StorageFailed(err.to_string()))?;
        }
    }

    Ok(outcome)
}

/// Called when the mini window closes so the main window comes back.
pub fn restore_main_window(app: &AppHandle) {
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.show();
        let _ = main.unminimize();
        let _ = main.set_focus();
    }
}

pub async fn toggle_desktop_lyrics_window(app: AppHandle) -> Result<String, AppError> {
    if let Some(window) = app.get_webview_window("desktop-lyrics") {
        window
            .close()
            .map_err(|err| AppError::StorageFailed(err.to_string()))?;
        return Ok("closed".into());
    }

    open_or_focus_window(
        app.clone(),
        "desktop-lyrics",
        "?window=desktop-lyrics",
        WindowKind::Lyrics,
    )
    .await
}

#[derive(Clone, Copy)]
enum WindowKind {
    Mini,
    Lyrics,
}

async fn open_or_focus_window(
    app: AppHandle,
    label: &str,
    route: &str,
    kind: WindowKind,
) -> Result<String, AppError> {
    if let Some(window) = app.get_webview_window(label) {
        focus_window(&window)?;
        return Ok("focused".into());
    }

    let mut builder = WebviewWindowBuilder::new(&app, label, WebviewUrl::App(route.into()))
        .always_on_top(true)
        // Every window draws its own chrome, so the OS title bar has to go —
        // otherwise the custom minimise / close buttons sit below a second,
        // native one. See `features/shell/WindowChrome.tsx`.
        .decorations(false)
        .resizable(false)
        .skip_taskbar(true);

    let window = match kind {
        // One compact strip; a fixed height keeps it from ever needing to scroll.
        WindowKind::Mini => builder.inner_size(460.0, 88.0).build(),
        WindowKind::Lyrics => builder
            // Transparent + undecorated so only the lyric text and its plate
            // show against the desktop wallpaper.
            .transparent(true)
            .inner_size(880.0, 140.0)
            .build(),
    }
    .map_err(|err| AppError::StorageFailed(err.to_string()))?;

    if matches!(kind, WindowKind::Lyrics) {
        place_bottom_center(&window)?;
    }

    focus_window(&window)?;
    Ok("opened".into())
}

/// Park the lyrics strip near the bottom centre of its monitor, which is where
/// desktop lyrics conventionally lives. Needs the live window because the
/// monitor and size are only known once it exists.
fn place_bottom_center(window: &WebviewWindow) -> Result<(), AppError> {
    let scale = window.scale_factor().unwrap_or(1.0);
    let Some(monitor) = window
        .current_monitor()
        .map_err(|err| AppError::StorageFailed(err.to_string()))?
    else {
        return Ok(());
    };

    let monitor_position = monitor.position().to_logical(scale);
    let monitor_size = monitor.size().to_logical(scale);
    let window_size = window
        .outer_size()
        .map_err(|err| AppError::StorageFailed(err.to_string()))?
        .to_logical(scale);

    let x = monitor_position.x + (monitor_size.width - window_size.width) / 2.0;
    let y = monitor_position.y + monitor_size.height - window_size.height - 120.0;

    window
        .set_position(LogicalPosition::new(x, y))
        .map_err(|err| AppError::StorageFailed(err.to_string()))
}

fn focus_window(window: &WebviewWindow) -> Result<(), AppError> {
    window
        .show()
        .map_err(|err| AppError::StorageFailed(err.to_string()))?;
    window
        .set_focus()
        .map_err(|err| AppError::StorageFailed(err.to_string()))?;
    Ok(())
}
