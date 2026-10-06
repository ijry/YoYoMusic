import { useEffect } from "react";
import { isTauriRuntime, listenToAppEvent } from "../../shared/tauri";
import type { SignalFrame } from "./signal";
import { SpectrumAnalyser } from "./spectrum";

/*
 * Live audio, fed from the Rust core.
 *
 * `services/spectrum.rs` ships a window of mono samples ~30 times a second; this
 * module analyses them and parks the result where the render loop can pick it
 * up. Deliberately *not* React state: a 30 Hz `setState` would re-render the
 * whole shell to move a canvas that already redraws itself every frame.
 */

export const SPECTRUM_FRAME_EVENT = "spectrum_frame";

/** Past this, the audio counts as stopped and the synthesis takes over. */
const STALE_AFTER_MS = 250;

export interface SpectrumFramePayload {
  samples: number[];
  sample_rate: number;
}

let current: { frame: SignalFrame; receivedAt: number } | null = null;
let analyser: SpectrumAnalyser | null = null;
let analyserKey = "";
let attached = false;

/** Analyses one frame from the core and stores it. */
export function ingestSpectrumFrame(payload: SpectrumFramePayload, now = performance.now()): void {
  const samples = payload.samples;
  if (!Array.isArray(samples) || samples.length < 2) return;

  // The analyser caches a Hann window and the band edges for its size, so it is
  // rebuilt only when the stream format actually changes.
  const key = `${samples.length}:${payload.sample_rate}`;
  if (key !== analyserKey) {
    analyser = new SpectrumAnalyser(payload.sample_rate, samples.length);
    analyserKey = key;
  }

  current = { frame: analyser!.analyse(Float32Array.from(samples)), receivedAt: now };
}

/**
 * The latest analysed frame, or `null` once the audio has gone quiet — which is
 * what lets a paused player fall back to the idle breathing instead of freezing
 * on its last frame.
 */
export function readLiveSpectrum(now = performance.now()): SignalFrame | null {
  if (!current) return null;
  if (now - current.receivedAt > STALE_AFTER_MS) return null;
  return current.frame;
}

/** Drops the analyser, the last frame and the listener flag. For tests. */
export function resetLiveSpectrum(): void {
  current = null;
  analyser = null;
  analyserKey = "";
  attached = false;
}

/**
 * Subscribes to the core's sample stream. Idempotent, so every visualiser
 * instance can call it without stacking listeners — there is one audio stream,
 * and analysing it three times would be waste.
 */
export function useLiveSpectrum(): void {
  useEffect(() => {
    if (!isTauriRuntime() || attached) return;
    attached = true;

    let disposed = false;
    let unlisten: (() => void) | undefined;

    void listenToAppEvent<SpectrumFramePayload>(SPECTRUM_FRAME_EVENT, (payload) => {
      if (!disposed) ingestSpectrumFrame(payload);
    }).then((off) => {
      // The listener can resolve after unmount, in which case drop it at once.
      if (disposed) off();
      else unlisten = off;
    });

    return () => {
      disposed = true;
      unlisten?.();
      attached = false;
    };
  }, []);
}
