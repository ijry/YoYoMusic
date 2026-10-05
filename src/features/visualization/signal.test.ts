import { describe, expect, it } from "vitest";
import { BAND_COUNT, SignalEngine, hashString } from "./signal";

function run(seed: string, seconds: number, isPlaying = true) {
  const engine = new SignalEngine(seed);
  const step = 1 / 60;
  for (let elapsed = 0; elapsed < seconds; elapsed += step) {
    engine.update(step, isPlaying);
  }
  return engine;
}

describe("SignalEngine", () => {
  it("produces in-range bands and a positive level while playing", () => {
    const engine = run("track-a", 2);

    expect(engine.bands).toHaveLength(BAND_COUNT);
    for (const value of engine.bands) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
    expect(engine.level).toBeGreaterThan(0.02);
    expect(engine.beat).toBeGreaterThanOrEqual(0);
    expect(engine.beat).toBeLessThanOrEqual(1);
  });

  it("keeps the wave trace inside -1..1", () => {
    const engine = run("track-a", 1);

    for (const sample of engine.wave) {
      expect(sample).toBeGreaterThanOrEqual(-1);
      expect(sample).toBeLessThanOrEqual(1);
    }
  });

  it("relaxes to a quiet idle floor when paused", () => {
    const playing = run("track-a", 2, true);
    const paused = run("track-a", 2, false);

    expect(paused.beat).toBe(0);
    expect(paused.level).toBeLessThan(playing.level);
    expect(paused.level).toBeLessThan(0.2);
  });

  it("is deterministic per seed and distinct across seeds", () => {
    const first = run("track-a", 1.5);
    const repeat = run("track-a", 1.5);
    const other = run("track-b", 1.5);

    expect(Array.from(first.bands)).toEqual(Array.from(repeat.bands));
    expect(Array.from(first.bands)).not.toEqual(Array.from(other.bands));
  });

  it("re-seeds in place so a new track gets its own signature", () => {
    const engine = run("track-a", 1);
    const before = Array.from(engine.bands);

    engine.reseed("track-b");
    const step = 1 / 60;
    for (let elapsed = 0; elapsed < 1; elapsed += step) {
      engine.update(step, true);
    }

    expect(Array.from(engine.bands)).not.toEqual(before);
    expect(Array.from(engine.bands)).toEqual(Array.from(run("track-b", 1).bands));
  });
});

describe("hashString", () => {
  it("is stable and seed-sensitive", () => {
    expect(hashString("yoyomusic")).toBe(hashString("yoyomusic"));
    expect(hashString("yoyomusic")).not.toBe(hashString("yoyomusix"));
    expect(hashString("")).toBe(hashString(""));
  });
});
