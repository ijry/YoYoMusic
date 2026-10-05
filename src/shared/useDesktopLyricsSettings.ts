import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_DESKTOP_LYRICS_THEME, clampLyricsFontScale } from "../features/lyrics/desktopLyricsTheme";
import { invokeCommand, isTauriRuntime } from "./tauri";
import type { AppSettings, DesktopLyricsSettings } from "./types";

export const defaultDesktopLyricsSettings: DesktopLyricsSettings = {
  theme: DEFAULT_DESKTOP_LYRICS_THEME,
  fontScale: 1,
  pinned: false,
  clickThrough: false,
};

/*
 * Desktop-lyrics preferences, owned by the floating lyrics window.
 *
 * Two rules this hook exists to enforce:
 *
 * 1. The toolbar must work *immediately*. The preferences are UI state seeded
 *    with usable defaults, not a nullable slice of the settings document — an
 *    earlier version read them out of a `settings` object that starts as `null`
 *    and silently dropped every click made before the load landed (and all of
 *    them in the browser preview, where there is no load at all).
 *
 * 2. Nothing may be written before the document is known. Saving defaults over
 *    a real settings file would clobber the user's other preferences, so writes
 *    are gated on the load having completed and merge into *that* document —
 *    which is also how the main window and this window stay in sync.
 */
export function useDesktopLyricsSettings() {
  const settingsRef = useRef<AppSettings | null>(null);
  const [prefs, setPrefs] = useState<DesktopLyricsSettings>(defaultDesktopLyricsSettings);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    let cancelled = false;

    void invokeCommand<AppSettings>("load_settings")
      .then((loaded) => {
        if (cancelled) return;
        settingsRef.current = loaded;
        // Merge per field: a file written before this section existed may only
        // carry part of it.
        setPrefs((current) => ({ ...current, ...loaded.desktopLyrics }));
      })
      .catch(() => {
        /* keep the defaults; the strip stays usable without persistence */
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const update = useCallback(
    (change: Partial<DesktopLyricsSettings>) => {
      setPrefs((current) => {
        const merged: DesktopLyricsSettings = { ...current, ...change };
        if (typeof merged.fontScale === "number") {
          merged.fontScale = clampLyricsFontScale(merged.fontScale);
        }

        const loaded = settingsRef.current;
        if (loaded) {
          void invokeCommand<AppSettings>("save_settings", {
            settings: { ...loaded, desktopLyrics: merged },
          }).catch(() => {});
        }
        return merged;
      });
    },
    [],
  );

  const setTheme = useCallback((theme: string) => update({ theme }), [update]);
  const setFontScale = useCallback((fontScale: number) => update({ fontScale }), [update]);
  const toggleLock = useCallback(() => update({ pinned: !prefs.pinned }), [prefs.pinned, update]);
  const toggleClickThrough = useCallback(
    () => update({ clickThrough: !prefs.clickThrough }),
    [prefs.clickThrough, update],
  );

  return { prefs, setTheme, setFontScale, toggleLock, toggleClickThrough };
}
