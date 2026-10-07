import { isTauriRuntime } from "../../shared/tauri";

/*
 * Self-update, the thin layer over the Tauri plugins.
 *
 * Everything that touches the plugins lives here so the hook above can be
 * tested without a Tauri runtime — the plugin calls go through `invoke`, which
 * throws under jsdom.
 *
 * Signing is not optional: the bundle is verified against the public key in
 * `tauri.conf.json`, so a tampered or unsigned download is rejected before it
 * is installed. `release.yml` does the signing half.
 */

export const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;

export interface AvailableUpdate {
  version: string;
  currentVersion: string;
  /** Release notes from the manifest, when the release carried any. */
  notes: string | null;
  date: string | null;
}

export interface DownloadProgress {
  downloaded: number;
  total: number | null;
}

type UpdateHandle = Awaited<ReturnType<typeof import("@tauri-apps/plugin-updater")["check"]>>;

/*
 * The live plugin handle, deliberately outside React state: it owns the
 * downloaded bytes, and re-creating it would throw the download away.
 */
let pending: UpdateHandle = null;

export function hasPendingUpdate(): boolean {
  return pending !== null;
}

/** Drops the pending handle, e.g. after the user says "later". */
export function clearPendingUpdate(): void {
  pending = null;
}

export async function checkForUpdate(): Promise<AvailableUpdate | null> {
  if (!isTauriRuntime()) return null;

  const { check } = await import("@tauri-apps/plugin-updater");
  const update = await check();

  if (!update) {
    pending = null;
    return null;
  }

  pending = update;
  return {
    version: update.version,
    // The manifest states what it is replacing, which is what makes a downgrade
    // attempt visible in the UI rather than silently ignored.
    currentVersion: update.currentVersion,
    notes: update.body ?? null,
    date: update.date ?? null,
  };
}

export async function downloadUpdate(
  onProgress: (progress: DownloadProgress) => void,
): Promise<void> {
  if (!pending) throw new Error("没有待安装的更新");

  let downloaded = 0;
  let total: number | null = null;

  await pending.downloadAndInstall((event) => {
    if (event.event === "Started") {
      total = event.data.contentLength ?? null;
      downloaded = 0;
      onProgress({ downloaded, total });
      return;
    }
    if (event.event === "Progress") {
      downloaded += event.data.chunkLength;
      onProgress({ downloaded, total });
      return;
    }
    onProgress({ downloaded: total ?? downloaded, total });
  });
}

export async function relaunchApp(): Promise<void> {
  if (!isTauriRuntime()) return;
  const { relaunch } = await import("@tauri-apps/plugin-process");
  await relaunch();
}
