import { foldBands, hannWindow, logBandEdges, magnitudes, normalizeBands } from "./fft";
import { BAND_COUNT, WAVE_SAMPLES, type SignalFrame } from "./signal";

/*
 * Turns a window of real samples into the same shape `SignalEngine` produces,
 * so every draw mode works with either source and none of them need to know
 * which one they are looking at.
 *
 * The smoothing (attack/release) stays in `SignalEngine`; this class only does
 * the per-frame transform.
 */

/** Below this, energy is treated as "the bass", which is what drives the beat. */
const BASS_HZ = 150;

/** How much the bass must exceed its own recent average to count as a beat. */
const BEAT_RATIO = 1.35;

export class SpectrumAnalyser {
  private readonly sampleRate: number;
  private readonly fftSize: number;
  private readonly window: Float32Array;
  private readonly edges: Int32Array;
  private readonly rawBands: Float32Array;
  private readonly bandPeak = { value: 0 };
  private readonly wave = new Float32Array(WAVE_SAMPLES);
  private readonly bands = new Float32Array(BAND_COUNT);

  /** Rolling average of bass energy, for onset detection. */
  private bassMean = 0;
  private beat = 0;
  private level = 0;

  constructor(sampleRate: number, fftSize: number) {
    this.sampleRate = sampleRate > 0 ? sampleRate : 44_100;
    this.fftSize = fftSize;
    this.window = hannWindow(fftSize);
    // Hz-based edges, so the layout does not shift if the device hands us a
    // different window length later.
    this.edges = logBandEdges(fftSize >> 1, BAND_COUNT, {
      binHz: this.sampleRate / fftSize,
      minHz: 40,
      maxHz: 16_000,
    });
    this.rawBands = new Float32Array(BAND_COUNT);
  }

  analyse(samples: Float32Array): SignalFrame {
    const bins = magnitudes(samples, this.window);
    foldBands(bins, this.edges, this.rawBands);

    const normalised = normalizeBands(this.rawBands, this.bandPeak);
    this.bands.set(normalised);

    this.updateLevel(samples);
    this.updateBeat(bins);

    return {
      bands: this.bands,
      wave: this.wave,
      level: this.level,
      beat: this.beat,
    };
  }

  /** Downsamples the time-domain window for the oscilloscope modes. */
  private updateLevel(samples: Float32Array): void {
    const stride = samples.length / WAVE_SAMPLES;
    let sumSquares = 0;

    for (let i = 0; i < WAVE_SAMPLES; i += 1) {
      const start = Math.floor(i * stride);
      const end = Math.max(start + 1, Math.floor((i + 1) * stride));

      let sum = 0;
      for (let s = start; s < end && s < samples.length; s += 1) sum += samples[s];
      const value = sum / (end - start);

      this.wave[i] = Math.max(-1, Math.min(1, value));
      sumSquares += value * value;
    }

    const rms = Math.sqrt(sumSquares / WAVE_SAMPLES);
    // Speech and music sit well below full scale, so lift the range before
    // clamping or the meter would barely move.
    this.level = Math.min(1, rms * 3.2);
  }

  private updateBeat(bins: Float32Array): void {
    const binHz = this.sampleRate / this.fftSize;
    const bassBins = Math.max(1, Math.min(bins.length - 1, Math.round(BASS_HZ / binHz)));

    let bass = 0;
    for (let i = 1; i <= bassBins; i += 1) bass += bins[i];
    bass /= bassBins;

    this.bassMean = this.bassMean === 0 ? bass : this.bassMean * 0.92 + bass * 0.08;

    const threshold = this.bassMean * BEAT_RATIO;
    const onset = bass > threshold && this.bassMean > 1e-5 ? (bass - threshold) / threshold : 0;

    // Snap up on an onset, decay smoothly afterwards — the shape a kick makes.
    this.beat = onset > 0 ? Math.min(1, onset) : this.beat * 0.82;
  }
}
