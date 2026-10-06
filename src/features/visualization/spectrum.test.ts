import { describe, expect, it } from "vitest";
import { SpectrumAnalyser } from "./spectrum";
import { BAND_COUNT, WAVE_SAMPLES } from "./signal";

const SAMPLE_RATE = 44_100;
const FFT_SIZE = 1024;

/** A sine at `hz`, sampled at the given rate. */
function tone(hz: number, size = FFT_SIZE, amplitude = 0.8): Float32Array {
  const out = new Float32Array(size);
  for (let i = 0; i < size; i += 1) out[i] = amplitude * Math.sin((2 * Math.PI * hz * i) / SAMPLE_RATE);
  return out;
}

function analyser() {
  return new SpectrumAnalyser(SAMPLE_RATE, FFT_SIZE);
}

/** Index of the loudest band. */
function loudest(bands: Float32Array): number {
  let best = 0;
  for (let i = 1; i < bands.length; i += 1) if (bands[i] > bands[best]) best = i;
  return best;
}

describe("SpectrumAnalyser", () => {
  it("produces a frame shaped like the synthesised one", () => {
    const frame = analyser().analyse(tone(440));

    expect(frame.bands).toHaveLength(BAND_COUNT);
    expect(frame.wave).toHaveLength(WAVE_SAMPLES);
    expect(frame.level).toBeGreaterThanOrEqual(0);
    expect(frame.level).toBeLessThanOrEqual(1);
    expect(frame.beat).toBeGreaterThanOrEqual(0);
    expect(frame.beat).toBeLessThanOrEqual(1);
  });

  /*
   * The property that makes this "real": where the energy lands must follow the
   * pitch. A synthesiser cannot fake this — it has no idea what is playing.
   */
  it("puts a low tone in the low bands and a high tone in the high bands", () => {
    const bass = loudest(analyser().analyse(tone(80)).bands);
    const treble = loudest(analyser().analyse(tone(6000)).bands);

    expect(bass).toBeLessThan(treble);
    // Not just "lower" — clearly separated across the range.
    expect(treble - bass).toBeGreaterThan(BAND_COUNT / 4);
  });

  it("tracks the pitch monotonically across the range", () => {
    const at = (hz: number) => loudest(analyser().analyse(tone(hz)).bands);

    const rising = [60, 250, 1000, 4000, 12000].map(at);
    for (let i = 1; i < rising.length; i += 1) {
      expect(rising[i], `band order at index ${i}`).toBeGreaterThanOrEqual(rising[i - 1]);
    }
  });

  it("reports silence without producing NaN", () => {
    const frame = analyser().analyse(new Float32Array(FFT_SIZE));

    expect(frame.bands.every((value) => Number.isFinite(value))).toBe(true);
    expect(frame.level).toBe(0);
    expect(frame.beat).toBe(0);
  });

  it("lifts the level with amplitude", () => {
    const quiet = analyser().analyse(tone(440, FFT_SIZE, 0.05)).level;
    const loud = analyser().analyse(tone(440, FFT_SIZE, 0.9)).level;

    expect(loud).toBeGreaterThan(quiet);
  });

  it("clamps the oscilloscope trace into range", () => {
    // Deliberately over-driven, as a clipped master would be.
    const frame = analyser().analyse(tone(220, FFT_SIZE, 4));

    expect(frame.wave.every((value) => value >= -1 && value <= 1)).toBe(true);
    expect(Math.max(...frame.wave)).toBeGreaterThan(0.5);
  });

  it("fires the beat on a bass burst and decays afterwards", () => {
    const subject = analyser();

    // Settle on a quiet bed first, so the rolling average has a floor.
    for (let i = 0; i < 12; i += 1) subject.analyse(tone(60, FFT_SIZE, 0.02));
    expect(subject.analyse(tone(60, FFT_SIZE, 0.02)).beat).toBeLessThan(0.2);

    const onKick = subject.analyse(tone(60, FFT_SIZE, 0.95)).beat;
    expect(onKick).toBeGreaterThan(0.2);

    const after = subject.analyse(tone(60, FFT_SIZE, 0.02)).beat;
    expect(after).toBeLessThan(onKick);
  });

  it("does not fire on a treble-only signal", () => {
    const subject = analyser();

    for (let i = 0; i < 12; i += 1) subject.analyse(tone(8000, FFT_SIZE, 0.9));
    // The kick detector listens below 150 Hz, so a cymbal must not trigger it.
    expect(subject.analyse(tone(8000, FFT_SIZE, 0.9)).beat).toBeLessThan(0.2);
  });

  it("reuses its buffers rather than allocating per frame", () => {
    const subject = analyser();
    const first = subject.analyse(tone(440));

    // The draw modes hold onto `frame.bands` between frames; a fresh array each
    // time would silently break anything that caches it.
    expect(subject.analyse(tone(440)).bands).toBe(first.bands);
  });
});
