import { describe, expect, it } from "vitest";
import {
  fftInPlace,
  foldBands,
  hannWindow,
  logBandEdges,
  magnitudes,
  normalizeBands,
} from "./fft";

/** A sine that completes exactly `cycles` periods across the window. */
function sine(size: number, cycles: number, amplitude = 1): Float32Array {
  const out = new Float32Array(size);
  for (let i = 0; i < size; i += 1) {
    out[i] = amplitude * Math.sin((2 * Math.PI * cycles * i) / size);
  }
  return out;
}

function peakBin(values: Float32Array): number {
  let best = 0;
  for (let i = 1; i < values.length; i += 1) {
    if (values[i] > values[best]) best = i;
  }
  return best;
}

function magnitudeAtBin(bins: Float32Array, bin: number): number {
  return bins[bin] ?? 0;
}

describe("fftInPlace", () => {
  it("puts a whole number of cycles in exactly one bin", () => {
    const size = 1024;
    // This is the property the whole visualiser rests on: a tone must land in
    // the bin that corresponds to its frequency, not somewhere nearby.
    for (const cycles of [1, 4, 32, 64, 200]) {
      const re = sine(size, cycles);
      const im = new Float32Array(size);
      fftInPlace(re, im);

      const bins = new Float32Array(size >> 1);
      for (let i = 0; i < bins.length; i += 1) bins[i] = Math.hypot(re[i], im[i]);

      expect(peakBin(bins), `sine of ${cycles} cycles`).toBe(cycles);
    }
  });

  it("keeps DC in bin zero", () => {
    const size = 256;
    const re = new Float32Array(size).fill(1);
    fftInPlace(re, new Float32Array(size));

    // Every bin but the first should cancel out.
    for (let i = 1; i < size; i += 1) expect(Math.abs(re[i])).toBeLessThan(1e-4);
    expect(re[0]).toBeCloseTo(size, 3);
  });

  it("mirrors the spectrum of a real signal", () => {
    const size = 256;
    const re = sine(size, 10);
    const im = new Float32Array(size);
    fftInPlace(re, im);

    // For real input, bin k and bin n-k carry the same magnitude.
    for (let k = 1; k < size / 2; k += 1) {
      const low = Math.hypot(re[k], im[k]);
      const high = Math.hypot(re[size - k], im[size - k]);
      expect(low).toBeCloseTo(high, 3);
    }
  });

  it("scales linearly with amplitude", () => {
    const size = 256;
    const one = sine(size, 8, 1);
    const half = sine(size, 8, 0.5);
    const binsOf = (signal: Float32Array) => {
      const re = signal.slice();
      const im = new Float32Array(size);
      fftInPlace(re, im);
      return Math.hypot(re[8], im[8]);
    };

    expect(binsOf(half)).toBeCloseTo(binsOf(one) / 2, 4);
  });

  it("rejects lengths that are not a power of two", () => {
    expect(() => fftInPlace(new Float32Array(100), new Float32Array(100))).toThrow(/power of two/);
  });

  it("rejects mismatched halves", () => {
    expect(() => fftInPlace(new Float32Array(8), new Float32Array(4))).toThrow(/match/);
  });
});

describe("magnitudes", () => {
  it("returns half the spectrum for real input", () => {
    const size = 512;
    expect(magnitudes(sine(size, 12), hannWindow(size))).toHaveLength(size >> 1);
  });

  it("resolves a tone after windowing", () => {
    const size = 1024;
    const bins = magnitudes(sine(size, 64), hannWindow(size));
    expect(peakBin(bins)).toBe(64);
  });

  it("finds a tone whose frequency is not a whole number of cycles", () => {
    const size = 1024;
    // 100.5 cycles: no longer exactly one bin, but the energy must still sit
    // around bin 100 rather than smearing across the spectrum.
    const signal = new Float32Array(size);
    for (let i = 0; i < size; i += 1) {
      signal[i] = Math.sin((2 * Math.PI * 100.5 * i) / size);
    }
    const bins = magnitudes(signal, hannWindow(size));

    expect(Math.abs(peakBin(bins) - 100)).toBeLessThanOrEqual(1);
  });

  it("separates two tones", () => {
    const size = 1024;
    const a = sine(size, 40);
    const b = sine(size, 300);
    const mixed = new Float32Array(size);
    for (let i = 0; i < size; i += 1) mixed[i] = a[i] + b[i];

    const bins = magnitudes(mixed, hannWindow(size));
    // Both should stand well above the median.
    const sorted = [...bins].sort((x, y) => x - y);
    const median = sorted[sorted.length >> 1];
    expect(magnitudeAtBin(bins, 40)).toBeGreaterThan(median * 20);
    expect(magnitudeAtBin(bins, 300)).toBeGreaterThan(median * 20);
  });

  it("reports silence as silence", () => {
    const bins = magnitudes(new Float32Array(512), hannWindow(512));
    expect(Math.max(...bins)).toBeLessThan(1e-6);
  });
});

describe("hannWindow", () => {
  it("starts and ends at zero and peaks in the middle", () => {
    const window = hannWindow(64);
    expect(window[0]).toBeCloseTo(0, 6);
    expect(window[32]).toBeCloseTo(1, 6);
    expect(window.length).toBe(64);
  });
});

describe("logBandEdges", () => {
  /** `binHz: 1` makes one "Hz" equal one bin, which keeps these tests about layout. */
  const asBins = (binCount: number, bandCount: number) =>
    logBandEdges(binCount, bandCount, { binHz: 1, minHz: 1, maxHz: binCount });

  it("produces non-decreasing edges", () => {
    for (const binCount of [128, 256, 512]) {
      for (const bandCount of [16, 56]) {
        const edges = asBins(binCount, bandCount);
        expect(edges).toHaveLength(bandCount + 1);
        for (let i = 1; i < edges.length; i += 1) {
          // Not *strictly* increasing on purpose: a window that cannot resolve
          // the low end legitimately gives several bands the same bin.
          expect(edges[i], `binCount=${binCount} band=${i}`).toBeGreaterThanOrEqual(edges[i - 1]);
        }
      }
    }
  });

  it("stays inside the available bins", () => {
    const binCount = 512;
    const edges = asBins(binCount, 56);
    expect(edges[0]).toBeGreaterThanOrEqual(1);
    expect(edges[edges.length - 1]).toBeLessThanOrEqual(binCount);
  });

  it("gives the low end more bands than the top end", () => {
    // Log layout is the point: the bass gets resolution, the treble does not
    // need it.
    const edges = asBins(512, 56);
    const lowWidth = edges[1] - edges[0];
    const highWidth = edges[56] - edges[55];
    expect(highWidth).toBeGreaterThan(lowWidth);
  });

  /*
   * The reason the edges are computed in Hz rather than in bins: a device can
   * hand us a different window length, and a bin-based layout would then move
   * every band sideways — the same note would jump several bars.
   *
   * Only window sizes that can actually resolve the test tones are used. At
   * 44.1 kHz a 512-sample window has 86 Hz bins, which cannot place a 440 Hz
   * tone anywhere meaningful; that is physics, not layout.
   */
  it("keeps a pitch in the same band across different window sizes", () => {
    const sampleRate = 44_100;
    const bandOf = (hz: number, fftSize: number) => {
      const edges = logBandEdges(fftSize >> 1, 56, { binHz: sampleRate / fftSize });
      const bin = Math.round(hz / (sampleRate / fftSize));
      for (let band = 0; band < 56; band += 1) {
        if (bin >= edges[band] && bin < edges[band + 1]) return band;
      }
      return -1;
    };

    for (const hz of [440, 2000, 8000]) {
      const bands = [1024, 2048, 4096, 8192].map((size) => bandOf(hz, size));
      for (const band of bands) expect(band, `${hz} Hz`).toBeGreaterThanOrEqual(0);
      expect(Math.max(...bands) - Math.min(...bands), `${hz} Hz across windows`).toBeLessThanOrEqual(1);
    }
  });

  it("places a mid tone in the middle of the range, not at the left edge", () => {
    // The bug this guards: padding the low edges apart to keep them distinct
    // stole bins from the top and squashed everything into the first third.
    const sampleRate = 44_100;
    const fftSize = 1024;
    const edges = logBandEdges(fftSize >> 1, 56, { binHz: sampleRate / fftSize });
    const bin = Math.round(440 / (sampleRate / fftSize));

    let band = -1;
    for (let i = 0; i < 56; i += 1) {
      if (bin >= edges[i] && bin < edges[i + 1]) band = i;
    }
    // 440 Hz sits at ln(440/40) / ln(16000/40) = 40% of a log scale.
    expect(band).toBeGreaterThan(18);
    expect(band).toBeLessThan(28);
  });

  it("clamps the top of the range to Nyquist", () => {
    // Asking for 16 kHz on a stream that only reaches 8 kHz must not produce
    // edges past the end of the spectrum.
    const edges = logBandEdges(256, 32, { binHz: 31.25, maxHz: 16_000 });
    expect(edges[edges.length - 1]).toBeLessThanOrEqual(256);
  });
});

describe("foldBands", () => {
  it("averages the bins inside each band", () => {
    const bins = new Float32Array([0, 2, 4, 6, 8, 10]);
    const edges = Int32Array.from([0, 2, 4, 6]);
    const out = new Float32Array(3);

    foldBands(bins, edges, out);
    expect([...out]).toEqual([1, 5, 9]);
  });

  it("never reads past the end of the spectrum", () => {
    const bins = new Float32Array([1, 2, 3, 4]);
    // Deliberately over-long edges, as a mismatched window size would produce.
    const edges = Int32Array.from([0, 2, 4, 6, 8]);
    const out = new Float32Array(4);

    foldBands(bins, edges, out);
    expect([...out].every((value) => Number.isFinite(value))).toBe(true);
  });
});

describe("normalizeBands", () => {
  it("maps the loudest band to the top of the range", () => {
    const bands = new Float32Array([1, 4, 16, 8]);
    const peak = { value: 0 };

    const out = normalizeBands(bands, peak);
    expect(Math.max(...out)).toBeCloseTo(1, 5);
    expect(Math.min(...out)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...out)).toBeLessThanOrEqual(1);
  });

  it("keeps a quiet passage visible instead of pinning it to zero", () => {
    const loud = new Float32Array([100, 200, 400]);
    const peak = { value: 0 };
    normalizeBands(loud, peak);

    // A tenth of the previous level.
    const quiet = new Float32Array([10, 20, 40]);
    const out = normalizeBands(quiet, peak);

    // The point of the log compression: a plain ratio would put this at 40/376,
    // barely off the floor. Asserting only "greater than zero" would pass even
    // if the mapping were linear, so compare against that directly.
    const linear = 40 / peak.value;
    expect(Math.max(...out)).toBeGreaterThan(linear * 2);
    expect(Math.max(...out)).toBeGreaterThan(0.2);
  });

  it("decays the tracked peak so the display does not pump", () => {
    const peak = { value: 0 };
    normalizeBands(new Float32Array([0, 0, 100]), peak);
    const afterLoud = peak.value;

    normalizeBands(new Float32Array([0, 0, 0]), peak);
    expect(peak.value).toBeLessThan(afterLoud);
    expect(peak.value).toBeGreaterThan(0);
  });

  it("survives an all-silent frame without dividing by zero", () => {
    const out = normalizeBands(new Float32Array([0, 0, 0]), { value: 0 });
    expect([...out].every((value) => value === 0)).toBe(true);
  });
});
