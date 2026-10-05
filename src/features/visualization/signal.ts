/*
 * Simulated audio signal engine.
 *
 * Playback happens in the Rust core (rodio), so the webview never sees the
 * decoded samples and there is no AnalyserNode to read from. Instead of a
 * static fake frame we synthesise a signal that behaves like music: a
 * pink-noise-ish spectral tilt, smooth per-band wander, a periodic kick
 * envelope and a matching oscilloscope trace.
 *
 * The engine is seeded from the track id, so every song gets its own
 * "signature" — the same track always dances the same way — while the
 * animation itself runs at display refresh rate rather than the 500ms
 * playback-state poll.
 */

export const BAND_COUNT = 56;
export const WAVE_SAMPLES = 256;

export interface SignalFrame {
  /** Frequency bands, low → high, each clamped to 0..1. */
  bands: Float32Array;
  /** Oscilloscope samples in -1..1. */
  wave: Float32Array;
  /** Smoothed overall loudness, 0..1. */
  level: number;
  /** Kick envelope, 0..1, spiking once per beat. */
  beat: number;
}

const IDLE_FLOOR = 0.045;

export class SignalEngine {
  readonly bands = new Float32Array(BAND_COUNT);
  readonly wave = new Float32Array(WAVE_SAMPLES);
  level = 0;
  beat = 0;

  private readonly shape: Float32Array;
  private readonly speed: Float32Array;
  private readonly phase: Float32Array;
  private readonly tilt: Float32Array;
  private readonly kickCurve: Float32Array;
  private bpm: number;
  private time = 0;
  private beatClock = 0;
  private beatPulse = 0;

  constructor(seed: string) {
    const random = mulberry32(hashString(seed || "yoyomusic"));

    this.shape = new Float32Array(BAND_COUNT);
    this.speed = new Float32Array(BAND_COUNT);
    this.phase = new Float32Array(BAND_COUNT);
    this.tilt = new Float32Array(BAND_COUNT);
    this.kickCurve = new Float32Array(BAND_COUNT);

    for (let index = 0; index < BAND_COUNT; index += 1) {
      const ratio = index / (BAND_COUNT - 1);

      this.shape[index] = 0.45 + random() * 0.55;
      this.speed[index] = 0.7 + random() * 3.4;
      this.phase[index] = random() * Math.PI * 2;
      // Pink-ish tilt: real music carries far more energy in the low end.
      this.tilt[index] = Math.pow(1 - ratio, 1.35) * 0.88 + 0.12;
      this.kickCurve[index] = Math.pow(1 - ratio, 2.2);
    }

    this.bpm = 92 + random() * 46;
    this.reset();
  }

  /** Re-seed in place so the engine instance can follow the current track. */
  reseed(seed: string) {
    const next = new SignalEngine(seed);
    this.shape.set(next.shape);
    this.speed.set(next.speed);
    this.phase.set(next.phase);
    this.tilt.set(next.tilt);
    this.kickCurve.set(next.kickCurve);
    this.bpm = next.bpm;
    this.time = 0;
    this.beatClock = 0;
    this.beatPulse = 0;
    this.level = 0;
    this.beat = 0;
    this.bands.fill(0);
    this.wave.fill(0);
  }

  /** Decay to the idle floor without wiping the seeded character. */
  reset() {
    this.bands.fill(0);
    this.wave.fill(0);
    this.level = 0;
    this.beat = 0;
  }

  /**
   * Advance the simulation. `dt` is in seconds; call once per animation frame.
   * When `isPlaying` is false the spectrum relaxes into a slow idle breath so
   * a paused player still looks alive rather than frozen.
   */
  update(dt: number, isPlaying: boolean): SignalFrame {
    const step = Math.min(Math.max(dt, 0), 0.05);
    this.time += step;

    const period = 60 / this.bpm;
    this.beatClock += step;
    if (this.beatClock >= period) {
      this.beatClock -= period;
      if (isPlaying) this.beatPulse = 1;
    }
    this.beatPulse *= Math.exp(-step * 6.5);
    this.beat = isPlaying ? this.beatPulse : 0;

    const attack = 1 - Math.exp(-step * 22);
    const release = 1 - Math.exp(-step * 6.5);
    const idleBreath = 1 + Math.sin(this.time * 0.9) * 0.35;
    let sum = 0;

    for (let index = 0; index < BAND_COUNT; index += 1) {
      const ratio = index / (BAND_COUNT - 1);

      const wanderA = 0.5 + 0.5 * Math.sin(this.time * this.speed[index] + this.phase[index]);
      const wanderB = 0.5 + 0.5 * Math.sin(this.time * this.speed[index] * 0.41 + this.phase[index] * 2.3);
      const wanderC = 0.5 + 0.5 * Math.sin(this.time * this.speed[index] * 0.13 + this.phase[index] * 0.7);

      let target =
        (wanderA * 0.5 + wanderB * 0.32 + wanderC * 0.18) *
        this.shape[index] *
        this.tilt[index];

      target += this.beat * this.kickCurve[index] * 0.55;
      // A little high-end sparkle keeps the top bars from sitting dead flat.
      target += ratio > 0.55 ? this.beat * (ratio - 0.55) * 0.6 : 0;

      if (!isPlaying) {
        // Idle still breathes per band, so an empty player shows a shaped
        // resting spectrum instead of a flat strip.
        target =
          IDLE_FLOOR *
          idleBreath *
          (0.5 + this.shape[index] * 0.9) *
          (0.7 + ratio * 0.6) *
          (0.55 + wanderA * 0.8);
      }

      const clamped = target < 0 ? 0 : target > 1 ? 1 : target;
      const coefficient = clamped > this.bands[index] ? attack : release;
      this.bands[index] += (clamped - this.bands[index]) * coefficient;
      sum += this.bands[index];
    }

    this.level += ((sum / BAND_COUNT) - this.level) * (1 - Math.exp(-step * 8));
    this.updateWave(isPlaying);
    return this;
  }

  private updateWave(isPlaying: boolean) {
    const drive = isPlaying ? 0.35 + this.level * 1.5 : 0.08;

    for (let index = 0; index < WAVE_SAMPLES; index += 1) {
      const position = index / (WAVE_SAMPLES - 1);
      // Mirror the left half onto the right so the trace stays symmetric.
      const mirrored = position <= 0.5 ? position : 1 - position;

      let value = 0;
      value += Math.sin(mirrored * Math.PI * 2 * 2 + this.time * 2.4) * 0.42;
      value += Math.sin(mirrored * Math.PI * 2 * 5 - this.time * 3.9) * 0.26;
      value += Math.sin(mirrored * Math.PI * 2 * 11 + this.time * 6.7) * 0.15;
      value += Math.sin(mirrored * Math.PI * 2 * 19 - this.time * 9.3) * 0.08;
      value *= drive;
      value += this.beat * Math.sin(mirrored * Math.PI * 2 * 3 + this.time * 4) * 0.12;

      const clamped = value < -1 ? -1 : value > 1 ? 1 : value;
      this.wave[index] = clamped;
    }
  }
}

export function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
