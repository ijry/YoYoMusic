/*
 * Real spectral analysis.
 *
 * The Rust core taps the decoded stream and ships a window of mono samples
 * (`services/spectrum.rs`); everything numerical happens here, where the test
 * suite can reach it. A hand-written FFT on the Rust side would have been
 * unreachable from tests on a machine that cannot build the crate.
 */

/** In-place radix-2 Cooley–Tukey FFT. `re`/`im` must be a power-of-two length. */
export function fftInPlace(re: Float32Array, im: Float32Array): void {
  const n = re.length;

  if (n !== im.length) throw new Error("fft: real and imaginary parts must match");
  if (n === 0) return;
  if ((n & (n - 1)) !== 0) throw new Error(`fft: length ${n} is not a power of two`);

  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }

  for (let len = 2; len <= n; len <<= 1) {
    const angle = (-2 * Math.PI) / len;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);

    for (let i = 0; i < n; i += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < len / 2; k += 1) {
        const aRe = re[i + k];
        const aIm = im[i + k];
        const bRe = re[i + k + len / 2] * curRe - im[i + k + len / 2] * curIm;
        const bIm = re[i + k + len / 2] * curIm + im[i + k + len / 2] * curRe;

        re[i + k] = aRe + bRe;
        im[i + k] = aIm + bIm;
        re[i + k + len / 2] = aRe - bRe;
        im[i + k + len / 2] = aIm - bIm;

        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }
}

/**
 * Magnitude of the first `n / 2` bins — the half of the spectrum that carries
 * real signal for a real-valued input.
 */
export function magnitudes(samples: Float32Array, window: Float32Array): Float32Array {
  const n = samples.length;
  const re = new Float32Array(n);
  const im = new Float32Array(n);

  for (let i = 0; i < n; i += 1) {
    re[i] = samples[i] * (window[i] ?? 1);
  }

  fftInPlace(re, im);

  const bins = n >> 1;
  const out = new Float32Array(bins);
  for (let i = 0; i < bins; i += 1) {
    out[i] = Math.hypot(re[i], im[i]);
  }
  return out;
}

/** Periodic Hann window — the usual choice for spectrum displays. */
export function hannWindow(size: number): Float32Array {
  const window = new Float32Array(size);
  for (let i = 0; i < size; i += 1) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / size));
  }
  return window;
}

export interface BandRange {
  /** Hz per bin — `sampleRate / fftSize`. */
  binHz: number;
  /** Lowest frequency the display covers. */
  minHz?: number;
  /** Highest frequency the display covers; clamped to Nyquist. */
  maxHz?: number;
}

/**
 * Bands are laid out logarithmically, because music is: an even split of the
 * bins would spend most of the display on the near-silent top end and squash
 * every bass note into the first bar.
 *
 * Edges are derived from **frequency**, not from bin indices. Bins depend on the
 * window size, so a bin-based layout would move every band the moment the audio
 * device changed its buffer length — the same bass note would jump several bars
 * sideways. Converting from Hz keeps a pitch in the same band for any window.
 */
export function logBandEdges(binCount: number, bandCount: number, range: BandRange): Int32Array {
  const binHz = range.binHz > 0 ? range.binHz : 1;
  const nyquist = binCount * binHz;
  // Below the lowest bin there is nothing to read, so start at the first one.
  const minHz = Math.max(range.minHz ?? 40, binHz);
  const maxHz = Math.max(minHz * 2, Math.min(range.maxHz ?? 16_000, nyquist));
  const ratio = Math.log(maxHz / minHz);

  const edges = new Int32Array(bandCount + 1);
  for (let i = 0; i <= bandCount; i += 1) {
    const hz = minHz * Math.exp((ratio * i) / bandCount);
    edges[i] = Math.min(binCount, Math.round(hz / binHz));
  }

  /*
   * Edges are only non-decreasing, never forced apart.
   *
   * A short window cannot resolve the bottom of the range: at 44.1 kHz with
   * 1024 samples one bin spans 43 Hz, so the first twenty-odd bands all round
   * down to the same bin. Nudging each edge up by one to keep them distinct
   * looks tidy but steals bins from the top of the range — it put a 440 Hz tone
   * in band 9 of 56 instead of band 22, compressing the whole display into its
   * left third. Letting the low bands share a bin is the honest answer, and
   * `foldBands` reads one bin for each of them rather than a gap.
   */
  return edges;
}

/** Averages the bins inside each log band. */
export function foldBands(
  bins: Float32Array,
  edges: Int32Array,
  out: Float32Array,
): Float32Array {
  const bandCount = out.length;
  const lastBin = bins.length - 1;

  for (let band = 0; band < bandCount; band += 1) {
    const from = Math.min(edges[band], lastBin);
    /*
     * Several low bands routinely share a bin (see `logBandEdges`), so `to` can
     * equal `from`. Reading the single bin there is what makes those bands
     * follow the bass instead of collapsing to a gap.
     */
    const to = Math.min(Math.max(edges[band + 1], from + 1), bins.length);

    let sum = 0;
    for (let bin = from; bin < to; bin += 1) sum += bins[bin];
    out[band] = sum / (to - from);
  }
  return out;
}

/**
 * Maps raw magnitudes onto 0..1.
 *
 * Loudness is perceived logarithmically, and the absolute scale depends on the
 * FFT size, so a fixed divisor would leave the display either pinned to the
 * floor or pegged at the top. This normalises against a running peak instead,
 * with a floor so a quiet passage does not get amplified into noise.
 */
export function normalizeBands(
  bands: Float32Array,
  peak: { value: number },
  floor = 1e-4,
): Float32Array {
  let framePeak = 0;
  for (let i = 0; i < bands.length; i += 1) {
    if (bands[i] > framePeak) framePeak = bands[i];
  }

  // The peak decays slowly, so the display does not pump on every transient.
  peak.value = Math.max(framePeak, peak.value * 0.94, floor);

  const out = new Float32Array(bands.length);
  for (let i = 0; i < bands.length; i += 1) {
    // `log1p` compresses the loud end, which is what makes quiet detail
    // visible at the bottom of the range.
    const ratio = bands[i] / peak.value;
    out[i] = Math.min(1, Math.log1p(ratio * 9) / Math.log(10));
  }
  return out;
}
