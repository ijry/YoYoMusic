import { beforeEach, describe, expect, it } from "vitest";
import {
  ingestSpectrumFrame,
  readLiveSpectrum,
  resetLiveSpectrum,
  SPECTRUM_FRAME_EVENT,
} from "./liveSpectrum";
import { BAND_COUNT } from "./signal";

const SAMPLE_RATE = 44_100;
const FFT_SIZE = 1024;

function tonePayload(hz: number, size = FFT_SIZE) {
  const samples: number[] = [];
  for (let i = 0; i < size; i += 1) {
    samples.push(0.8 * Math.sin((2 * Math.PI * hz * i) / SAMPLE_RATE));
  }
  return { samples, sample_rate: SAMPLE_RATE };
}

function loudest(bands: Float32Array): number {
  let best = 0;
  for (let i = 1; i < bands.length; i += 1) if (bands[i] > bands[best]) best = i;
  return best;
}

describe("liveSpectrum", () => {
  beforeEach(() => {
    resetLiveSpectrum();
  });

  it("names the event the core emits", () => {
    // The Rust side hardcodes this string; a rename on one side only would
    // silently stop all audio analysis.
    expect(SPECTRUM_FRAME_EVENT).toBe("spectrum_frame");
  });

  it("has nothing to report before any frame arrives", () => {
    expect(readLiveSpectrum()).toBeNull();
  });

  it("analyses an incoming frame", () => {
    ingestSpectrumFrame(tonePayload(440), 1000);

    const frame = readLiveSpectrum(1000);
    expect(frame).not.toBeNull();
    expect(frame!.bands).toHaveLength(BAND_COUNT);
  });

  it("keeps the pitch information from the samples", () => {
    ingestSpectrumFrame(tonePayload(100), 1000);
    const bass = loudest(readLiveSpectrum(1000)!.bands);

    resetLiveSpectrum();
    ingestSpectrumFrame(tonePayload(7000), 1000);
    const treble = loudest(readLiveSpectrum(1000)!.bands);

    expect(treble).toBeGreaterThan(bass);
  });

  /*
   * Without this the canvas would freeze on the last frame the moment playback
   * stopped, instead of relaxing into the idle breathing.
   */
  it("goes quiet once the frames stop arriving", () => {
    ingestSpectrumFrame(tonePayload(440), 1000);
    expect(readLiveSpectrum(1000)).not.toBeNull();

    expect(readLiveSpectrum(1200)).not.toBeNull();
    expect(readLiveSpectrum(1300)).toBeNull();
  });

  it("rebuilds its analyser when the stream format changes", () => {
    ingestSpectrumFrame(tonePayload(440, 1024), 1000);
    const first = loudest(readLiveSpectrum(1000)!.bands);

    // A different device can hand us a different window length and rate. Both
    // sizes here resolve 440 Hz, so the peak must stay in the same place —
    // bands are laid out in Hz precisely so a format change cannot shift them.
    ingestSpectrumFrame({ samples: tonePayload(440, 2048).samples, sample_rate: 48_000 }, 1100);
    const second = readLiveSpectrum(1100);

    expect(second).not.toBeNull();
    expect(second!.bands).toHaveLength(BAND_COUNT);
    expect(Number.isFinite(second!.bands[0])).toBe(true);
    expect(Math.abs(loudest(second!.bands) - first)).toBeLessThanOrEqual(1);
  });

  it("ignores malformed payloads instead of throwing", () => {
    expect(() => ingestSpectrumFrame({ samples: [], sample_rate: SAMPLE_RATE }, 1000)).not.toThrow();
    expect(() =>
      ingestSpectrumFrame({ samples: [1], sample_rate: SAMPLE_RATE }, 1000),
    ).not.toThrow();
    expect(() =>
      ingestSpectrumFrame({ samples: undefined as never, sample_rate: SAMPLE_RATE }, 1000),
    ).not.toThrow();

    expect(readLiveSpectrum(1000)).toBeNull();
  });

  it("drops everything on reset", () => {
    ingestSpectrumFrame(tonePayload(440), 1000);
    resetLiveSpectrum();
    expect(readLiveSpectrum(1000)).toBeNull();
  });
});
