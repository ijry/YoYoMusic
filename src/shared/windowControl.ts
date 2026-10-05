import { getCurrentWindow } from "@tauri-apps/api/window";

/*
 * Thin wrapper over the current webview's window.
 *
 * Every window in this app draws its own chrome (`decorations: false`), so the
 * minimise / maximise / close buttons and the drag regions are React components
 * that need these primitives. Keeping them here means the capability list is
 * declared once and the components stay free of Tauri imports — which also
 * keeps them renderable in jsdom, where `getCurrentWindow()` would throw.
 */

export type WindowAction = "minimize" | "toggleMaximize" | "close" | "startDragging";

function currentWindow() {
  // Lazy so importing this module never touches the Tauri runtime.
  return getCurrentWindow();
}

export function isTauriWindowRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function performWindowAction(action: WindowAction): Promise<void> {
  if (!isTauriWindowRuntime()) return;

  const handle = currentWindow();
  switch (action) {
    case "minimize":
      await handle.minimize();
      return;
    case "toggleMaximize":
      await handle.toggleMaximize();
      return;
    case "close":
      await handle.close();
      return;
    case "startDragging":
      await handle.startDragging();
      return;
  }
}

export async function isWindowMaximized(): Promise<boolean> {
  if (!isTauriWindowRuntime()) return false;
  return currentWindow().isMaximized();
}

/** Click-through for the desktop-lyrics window, so clicks reach the desktop. */
export async function setWindowClickThrough(ignore: boolean): Promise<void> {
  if (!isTauriWindowRuntime()) return;
  await currentWindow().setIgnoreCursorEvents(ignore);
}
