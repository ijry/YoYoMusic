import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UPDATE_CHECK_INTERVAL_MS, type AvailableUpdate } from "./updater";
import { useUpdateChecker } from "./useUpdateChecker";

const double = vi.hoisted(() => ({
  tauri: true,
  check: vi.fn(),
  download: vi.fn(),
  relaunch: vi.fn(),
}));

vi.mock("../../shared/tauri", () => ({
  isTauriRuntime: () => double.tauri,
}));

vi.mock("./updater", async () => {
  const actual = await vi.importActual<typeof import("./updater")>("./updater");
  return {
    ...actual,
    checkForUpdate: (...args: unknown[]) => double.check(...args),
    downloadUpdate: (...args: unknown[]) => double.download(...args),
    relaunchApp: (...args: unknown[]) => double.relaunch(...args),
  };
});

const release: AvailableUpdate = {
  version: "0.0.2",
  currentVersion: "0.0.1",
  notes: "修好了播放列表",
  date: null,
};

describe("useUpdateChecker", () => {
  beforeEach(() => {
    double.tauri = true;
    double.check.mockReset().mockResolvedValue(null);
    double.download.mockReset().mockResolvedValue(undefined);
    double.relaunch.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("checks half-hourly", () => {
    // The interval is the whole point of the feature.
    expect(UPDATE_CHECK_INTERVAL_MS).toBe(30 * 60 * 1000);
    expect(UPDATE_CHECK_INTERVAL_MS).toBe(1_800_000);

    // And the hook must report the value it actually schedules on.
    const { result } = renderHook(() => useUpdateChecker());
    expect(result.current.intervalMs).toBe(1_800_000);
  });

  it("checks once on mount", async () => {
    renderHook(() => useUpdateChecker());

    await waitFor(() => expect(double.check).toHaveBeenCalledTimes(1));
  });

  it("checks again after half an hour", async () => {
    vi.useFakeTimers();
    double.check.mockResolvedValue(null);

    renderHook(() => useUpdateChecker());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(double.check).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(UPDATE_CHECK_INTERVAL_MS);
    });
    expect(double.check).toHaveBeenCalledTimes(2);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(UPDATE_CHECK_INTERVAL_MS * 2);
    });
    expect(double.check).toHaveBeenCalledTimes(4);
  });

  it("surfaces an available release", async () => {
    double.check.mockResolvedValue(release);
    const { result } = renderHook(() => useUpdateChecker());

    await waitFor(() => expect(result.current.status.kind).toBe("available"));
    expect(result.current.status).toMatchObject({ update: { version: "0.0.2" } });
  });

  it("says nothing when the automatic check fails", async () => {
    // The user did not ask for that check, so a network blip must not raise an
    // error banner.
    double.check.mockRejectedValue(new Error("network down"));
    const { result } = renderHook(() => useUpdateChecker());

    await waitFor(() => expect(double.check).toHaveBeenCalled());
    expect(result.current.status.kind).toBe("idle");
  });

  it("reports a manual check", async () => {
    const { result } = renderHook(() => useUpdateChecker());
    await waitFor(() => expect(double.check).toHaveBeenCalled());

    act(() => result.current.checkNow());
    await waitFor(() => expect(result.current.status.kind).toBe("up-to-date"));
  });

  it("reports a manual failure", async () => {
    double.check.mockRejectedValue(new Error("网络不可用"));
    const { result } = renderHook(() => useUpdateChecker());
    await waitFor(() => expect(double.check).toHaveBeenCalled());

    act(() => result.current.checkNow());
    await waitFor(() => expect(result.current.status.kind).toBe("error"));
    expect(result.current.status).toMatchObject({ message: "网络不可用" });
  });

  it("keeps a dismissed release dismissed across automatic checks", async () => {
    // Re-opening the dialog every half hour would nag; the dismissal holds
    // until the update is actually installed.
    vi.useFakeTimers();
    double.check.mockResolvedValue(release);

    const { result } = renderHook(() => useUpdateChecker());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.status.kind).toBe("available");

    act(() => result.current.dismiss());
    expect(result.current.status.kind).toBe("idle");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(UPDATE_CHECK_INTERVAL_MS);
    });
    expect(result.current.status.kind).toBe("idle");
  });

  it("lets a manual check override a dismissal", async () => {
    double.check.mockResolvedValue(release);
    const { result } = renderHook(() => useUpdateChecker());
    await waitFor(() => expect(result.current.status.kind).toBe("available"));

    act(() => result.current.dismiss());
    expect(result.current.status.kind).toBe("idle");

    act(() => result.current.checkNow());
    await waitFor(() => expect(result.current.status.kind).toBe("available"));
  });

  it("walks install through download to ready", async () => {
    double.check.mockResolvedValue(release);
    double.download.mockImplementation(async (onProgress: (p: unknown) => void) => {
      onProgress({ downloaded: 512, total: 2048 });
      onProgress({ downloaded: 2048, total: 2048 });
    });

    const { result } = renderHook(() => useUpdateChecker());
    await waitFor(() => expect(result.current.status.kind).toBe("available"));

    act(() => result.current.install());
    await waitFor(() => expect(result.current.status.kind).toBe("ready"));
  });

  it("reports a failed download", async () => {
    double.check.mockResolvedValue(release);
    double.download.mockRejectedValue(new Error("签名校验失败"));

    const { result } = renderHook(() => useUpdateChecker());
    await waitFor(() => expect(result.current.status.kind).toBe("available"));

    act(() => result.current.install());
    await waitFor(() => expect(result.current.status.kind).toBe("error"));
    expect(result.current.status).toMatchObject({ message: "签名校验失败" });
  });

  it("relaunches on request", async () => {
    const { result } = renderHook(() => useUpdateChecker());
    act(() => result.current.relaunch());
    await waitFor(() => expect(double.relaunch).toHaveBeenCalledTimes(1));
  });

  it("stays dormant outside the Tauri runtime", async () => {
    // The browser preview must not poll a plugin that is not there.
    double.tauri = false;
    renderHook(() => useUpdateChecker());

    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(double.check).not.toHaveBeenCalled();
  });
});
