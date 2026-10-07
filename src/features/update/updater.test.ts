import { beforeEach, describe, expect, it, vi } from "vitest";

const double = vi.hoisted(() => ({
  tauri: true,
  check: vi.fn(),
  downloadAndInstall: vi.fn(),
  relaunch: vi.fn(),
}));

vi.mock("../../shared/tauri", () => ({
  isTauriRuntime: () => double.tauri,
}));

vi.mock("@tauri-apps/plugin-updater", () => ({
  check: (...args: unknown[]) => double.check(...args),
}));

vi.mock("@tauri-apps/plugin-process", () => ({
  relaunch: (...args: unknown[]) => double.relaunch(...args),
}));

const {
  checkForUpdate,
  clearPendingUpdate,
  hasPendingUpdate,
  downloadUpdate,
  relaunchApp,
  UPDATE_CHECK_INTERVAL_MS,
} = await import("./updater");

function availableUpdate(overrides: Record<string, unknown> = {}) {
  return {
    version: "0.0.2",
    currentVersion: "0.0.1",
    body: "修复了若干问题",
    date: "2026-10-06T00:00:00Z",
    downloadAndInstall: (...args: unknown[]) => double.downloadAndInstall(...args),
    ...overrides,
  };
}

describe("updater", () => {
  beforeEach(() => {
    double.tauri = true;
    double.check.mockReset();
    double.downloadAndInstall.mockReset().mockResolvedValue(undefined);
    double.relaunch.mockReset().mockResolvedValue(undefined);
    clearPendingUpdate();
  });

  it("polls every half hour, not more often", () => {
    expect(UPDATE_CHECK_INTERVAL_MS).toBe(30 * 60 * 1000);
  });

  it("does nothing outside the Tauri runtime", async () => {
    // The browser preview has no plugin to call.
    double.tauri = false;
    await expect(checkForUpdate()).resolves.toBeNull();
    expect(double.check).not.toHaveBeenCalled();
  });

  it("reports no update when the manifest is current", async () => {
    double.check.mockResolvedValue(null);
    await expect(checkForUpdate()).resolves.toBeNull();
    expect(hasPendingUpdate()).toBe(false);
  });

  it("maps the manifest onto the fields the UI needs", async () => {
    double.check.mockResolvedValue(availableUpdate());

    await expect(checkForUpdate()).resolves.toEqual({
      version: "0.0.2",
      currentVersion: "0.0.1",
      notes: "修复了若干问题",
      date: "2026-10-06T00:00:00Z",
    });
    expect(hasPendingUpdate()).toBe(true);
  });

  it("copes with a release that has no notes", async () => {
    double.check.mockResolvedValue(availableUpdate({ body: undefined, date: undefined }));

    const result = await checkForUpdate();
    expect(result).toMatchObject({ notes: null, date: null });
  });

  it("forgets the handle once the manifest goes back to current", async () => {
    double.check.mockResolvedValue(availableUpdate());
    await checkForUpdate();
    expect(hasPendingUpdate()).toBe(true);

    double.check.mockResolvedValue(null);
    await checkForUpdate();
    expect(hasPendingUpdate()).toBe(false);
  });

  it("translates download events into a running total", async () => {
    double.check.mockResolvedValue(availableUpdate());
    await checkForUpdate();

    double.downloadAndInstall.mockImplementation(async (onEvent: (event: unknown) => void) => {
      onEvent({ event: "Started", data: { contentLength: 1000 } });
      onEvent({ event: "Progress", data: { chunkLength: 400 } });
      onEvent({ event: "Progress", data: { chunkLength: 600 } });
      onEvent({ event: "Finished" });
    });

    const seen: Array<{ downloaded: number; total: number | null }> = [];
    await downloadUpdate((progress) => seen.push(progress));

    expect(seen[0]).toEqual({ downloaded: 0, total: 1000 });
    expect(seen[1]).toEqual({ downloaded: 400, total: 1000 });
    expect(seen[2]).toEqual({ downloaded: 1000, total: 1000 });
    // Finished reports the total, so the bar lands on 100%.
    expect(seen[3]).toEqual({ downloaded: 1000, total: 1000 });
  });

  it("reports an unknown size as null rather than guessing", async () => {
    // Without a content-length the UI shows motion instead of a percentage,
    // so a zero here would read as "no progress".
    double.check.mockResolvedValue(availableUpdate());
    await checkForUpdate();

    double.downloadAndInstall.mockImplementation(async (onEvent: (event: unknown) => void) => {
      onEvent({ event: "Started", data: {} });
      onEvent({ event: "Progress", data: { chunkLength: 250 } });
    });

    const seen: Array<{ downloaded: number; total: number | null }> = [];
    await downloadUpdate((progress) => seen.push(progress));

    expect(seen[0]).toEqual({ downloaded: 0, total: null });
    expect(seen[1]).toEqual({ downloaded: 250, total: null });
  });

  it("refuses to download when nothing was checked", async () => {
    await expect(downloadUpdate(() => undefined)).rejects.toThrow(/没有待安装/);
    expect(double.downloadAndInstall).not.toHaveBeenCalled();
  });

  it("relaunches only inside the Tauri runtime", async () => {
    await relaunchApp();
    expect(double.relaunch).toHaveBeenCalledTimes(1);

    double.relaunch.mockClear();
    double.tauri = false;
    await relaunchApp();
    expect(double.relaunch).not.toHaveBeenCalled();
  });
});
