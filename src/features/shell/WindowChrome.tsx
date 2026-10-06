import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "../../shared/icons";
import {
  isTauriWindowRuntime,
  isWindowMaximized,
  performWindowAction,
  type WindowAction,
} from "../../shared/windowControl";

/*
 * Window chrome shared by the main window, the mini player and the desktop
 * lyrics window. All three run with `decorations: false`, so the OS title bar
 * is gone and these components *are* the title bar.
 */

export function DragRegion({
  className = "",
  disabled = false,
  children,
  ...rest
}: {
  className?: string;
  /** When true the region does not start a window drag (used by the lock). */
  disabled?: boolean;
  children?: ReactNode;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "className" | "children" | "onPointerDown">) {
  /*
   * `startDragging` has to run on mousedown — Tauri starts a native drag
   * loop for that gesture. A plain `data-tauri-drag-region` attribute would be
   * simpler, but going through the API lets a region opt out (`disabled`),
   * which the lock on the desktop-lyrics strip relies on.
   */
  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (disabled) return;
    // Buttons inside the drag region must stay clickable.
    if ((event.target as HTMLElement).closest("button, input, select, a")) return;
    void performWindowAction("startDragging");
  }

  return (
    <div
      className={`window-drag-region ${className}`.trim()}
      data-drag-region={disabled ? "disabled" : "enabled"}
      onPointerDown={handlePointerDown}
      {...rest}
    >
      {children}
    </div>
  );
}

export function WindowButtons({
  className = "",
  showMaximize = true,
  showMinimize = true,
  closeLabel = "关闭窗口",
}: {
  className?: string;
  showMaximize?: boolean;
  showMinimize?: boolean;
  closeLabel?: string;
}) {
  const [maximized, setMaximized] = useState(false);

  useEffect(() => {
    if (!isTauriWindowRuntime()) return;
    let cancelled = false;
    void isWindowMaximized().then((value) => {
      if (!cancelled) setMaximized(value);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function run(action: WindowAction) {
    void performWindowAction(action).then(() => {
      if (action === "toggleMaximize") void isWindowMaximized().then(setMaximized);
    });
  }

  /*
   * One glyph size across the trio. They were 16 / 14 / 16 — the kind of
   * difference nobody names but everybody feels.
   */
  return (
    <div className={`window-buttons ${className}`.trim()} role="group" aria-label="窗口控制">
      {showMinimize ? (
        <button
          type="button"
          className="window-button window-button--minimize"
          aria-label="最小化"
          title="最小化"
          onClick={() => run("minimize")}
        >
          <Icon.minimize size={16} />
        </button>
      ) : null}
      {showMaximize ? (
        <button
          type="button"
          className="window-button window-button--maximize"
          aria-label={maximized ? "向下还原" : "最大化"}
          title={maximized ? "向下还原" : "最大化"}
          onClick={() => run("toggleMaximize")}
        >
          {maximized ? <Icon.restore size={16} /> : <Icon.maximize size={16} />}
        </button>
      ) : null}
      <button
        type="button"
        className="window-button window-button--close"
        aria-label={closeLabel}
        title={closeLabel}
        onClick={() => run("close")}
      >
        <Icon.remove size={16} />
      </button>
    </div>
  );
}
