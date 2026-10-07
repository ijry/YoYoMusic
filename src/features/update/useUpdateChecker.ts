import { useCallback, useEffect, useRef, useState } from "react";
import { isTauriRuntime } from "../../shared/tauri";
import {
  checkForUpdate,
  clearPendingUpdate,
  downloadUpdate,
  relaunchApp,
  UPDATE_CHECK_INTERVAL_MS,
  type AvailableUpdate,
  type DownloadProgress,
} from "./updater";

export type UpdateStatus =
  | { kind: "idle" }
  | { kind: "checking" }
  | { kind: "up-to-date" }
  | { kind: "available"; update: AvailableUpdate }
  | { kind: "downloading"; update: AvailableUpdate; progress: DownloadProgress }
  | { kind: "ready"; update: AvailableUpdate }
  | { kind: "error"; message: string };

export interface UpdateChecker {
  status: UpdateStatus;
  /** Runs a check now, for the manual button. */
  checkNow: () => void;
  install: () => void;
  relaunch: () => void;
  /** Closes the prompt without installing. */
  dismiss: () => void;
  /** How long the last check waited between runs; 30 minutes. */
  intervalMs: number;
}

/*
 * Watches for a new release.
 *
 * Polls on mount and then every half hour. A failure is deliberately quiet on
 * the automatic runs — the user did not ask for the check, so a network blip
 * should not raise an error banner — but a manual check reports what happened.
 */
export function useUpdateChecker(): UpdateChecker {
  const [status, setStatus] = useState<UpdateStatus>({ kind: "idle" });
  const running = useRef(false);
  const dismissed = useRef(false);

  const runCheck = useCallback(async (announce: boolean) => {
    // A slow check must not stack up behind the interval.
    if (running.current) return;
    running.current = true;

    if (announce) setStatus({ kind: "checking" });

    try {
      const update = await checkForUpdate();
      if (update) {
        // A version the user already waved away stays away until it is
        // installed — re-opening the dialog every half hour would nag.
        setStatus(dismissed.current ? { kind: "idle" } : { kind: "available", update });
      } else if (announce) {
        setStatus({ kind: "up-to-date" });
      }
    } catch (cause) {
      if (announce) {
        setStatus({ kind: "error", message: cause instanceof Error ? cause.message : String(cause) });
      }
    } finally {
      running.current = false;
    }
  }, []);

  useEffect(() => {
    if (!isTauriRuntime()) return;

    void runCheck(false);
    const timer = window.setInterval(() => void runCheck(false), UPDATE_CHECK_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [runCheck]);

  const checkNow = useCallback(() => {
    // An explicit check overrides a previous "later".
    dismissed.current = false;
    void runCheck(true);
  }, [runCheck]);

  const install = useCallback(() => {
    setStatus((current) => {
      if (current.kind !== "available") return current;
      const { update } = current;
      void downloadUpdate((progress) =>
        setStatus((inner) =>
          inner.kind === "downloading" || inner.kind === "available"
            ? { kind: "downloading", update, progress }
            : inner,
        ),
      )
        .then(() => setStatus({ kind: "ready", update }))
        .catch((cause: unknown) =>
          setStatus({
            kind: "error",
            message: cause instanceof Error ? cause.message : String(cause),
          }),
        );
      return { kind: "downloading", update, progress: { downloaded: 0, total: null } };
    });
  }, []);

  const relaunch = useCallback(() => {
    void relaunchApp();
  }, []);

  const dismiss = useCallback(() => {
    dismissed.current = true;
    clearPendingUpdate();
    setStatus({ kind: "idle" });
  }, []);

  return { status, checkNow, install, relaunch, dismiss, intervalMs: UPDATE_CHECK_INTERVAL_MS };
}
