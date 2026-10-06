import { describe, expect, it } from "vitest";
import { createRenderState, drawModeMap, type DrawContext, type VizPalette } from "./drawModes";
import { visualizationModes } from "./modes";
import { BAND_COUNT, WAVE_SAMPLES, type SignalFrame } from "./signal";

const palette: VizPalette = { a: "#8b5cf6", b: "#22d3ee", ink: "#ffffff" };

function frame(overrides: Partial<SignalFrame> = {}): SignalFrame {
  const bands = new Float32Array(BAND_COUNT);
  const wave = new Float32Array(WAVE_SAMPLES);
  for (let i = 0; i < BAND_COUNT; i += 1) bands[i] = 0.2 + 0.6 * ((i * 7) % 11) / 11;
  for (let i = 0; i < WAVE_SAMPLES; i += 1) wave[i] = Math.sin(i / 9) * 0.6;

  return { bands, wave, level: 0.55, beat: 0.7, ...overrides };
}

/** Records what a draw mode asked the context to do. */
function recordingContext() {
  const calls: string[] = [];
  const gradient = { addColorStop: () => calls.push("addColorStop") };

  const context = {
    save: () => calls.push("save"),
    restore: () => calls.push("restore"),
    translate: () => calls.push("translate"),
    rotate: () => calls.push("rotate"),
    scale: () => calls.push("scale"),
    beginPath: () => calls.push("beginPath"),
    closePath: () => calls.push("closePath"),
    moveTo: () => calls.push("moveTo"),
    lineTo: () => calls.push("lineTo"),
    quadraticCurveTo: () => calls.push("quadraticCurveTo"),
    arc: () => calls.push("arc"),
    fill: () => calls.push("fill"),
    stroke: () => calls.push("stroke"),
    fillRect: () => calls.push("fillRect"),
    clearRect: () => calls.push("clearRect"),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
  } as unknown as CanvasRenderingContext2D;

  return { context, calls };
}

function draw(mode: keyof typeof drawModeMap, overrides: Partial<SignalFrame> = {}) {
  const { context, calls } = recordingContext();
  const state = createRenderState(BAND_COUNT);
  const ctx: DrawContext = {
    context,
    width: 640,
    height: 360,
    frame: frame(overrides),
    palette,
    state,
    dt: 1 / 60,
  };

  drawModeMap[mode](ctx);
  return { calls, state };
}

describe("draw modes", () => {
  it("has a renderer for every mode in the catalogue", () => {
    // Adding a mode to the catalogue without a renderer would fall back to the
    // spectrum at runtime, silently ignoring the user's choice.
    for (const mode of visualizationModes) {
      expect(drawModeMap[mode.id], `${mode.id} has no renderer`).toBeTypeOf("function");
    }
  });

  it("gives every mode a unique id and a non-empty hint", () => {
    const ids = visualizationModes.map((mode) => mode.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const mode of visualizationModes) {
      expect(mode.label.length, mode.id).toBeGreaterThan(0);
      expect(mode.hint.length, mode.id).toBeGreaterThan(0);
    }
  });

  it("renders every mode without touching an unset canvas property", () => {
    for (const mode of visualizationModes) {
      expect(() => draw(mode.id), mode.id).not.toThrow();
    }
  });

  it("balances every save with a restore", () => {
    // An unbalanced `save` leaks the composite mode into the next frame, which
    // shows up as the whole canvas slowly washing out.
    for (const mode of visualizationModes) {
      const { calls } = draw(mode.id);
      const saves = calls.filter((call) => call === "save").length;
      const restores = calls.filter((call) => call === "restore").length;
      expect(restores, `${mode.id} leaked a save`).toBe(saves);
    }
  });

  it("draws something in every mode, even at silence", () => {
    const silent = {
      bands: new Float32Array(BAND_COUNT),
      wave: new Float32Array(WAVE_SAMPLES),
      level: 0,
      beat: 0,
    };

    for (const mode of visualizationModes) {
      const { calls } = draw(mode.id, silent);
      expect(calls.length, `${mode.id} drew nothing at silence`).toBeGreaterThan(0);
    }
  });

  describe("generative", () => {
    it("builds its field on first draw and keeps it", () => {
      const { state } = draw("generative");
      expect(state.generative.nodes.length).toBeGreaterThan(0);

      const count = state.generative.nodes.length;
      draw("generative");
      expect(state.generative.nodes.length).toBe(count);
    });

    it("evolves over time rather than settling", () => {
      const { context } = recordingContext();
      const state = createRenderState(BAND_COUNT);
      const ctx: DrawContext = {
        context,
        width: 640,
        height: 360,
        frame: frame(),
        palette,
        state,
        dt: 1 / 60,
      };

      drawModeMap.generative(ctx);
      const before = state.generative.nodes.map((node) => node.phase);
      for (let i = 0; i < 30; i += 1) drawModeMap.generative(ctx);
      const after = state.generative.nodes.map((node) => node.phase);

      // The clock advances every frame; a field that stopped moving would mean
      // the mode had frozen.
      expect(state.generative.clock).toBeGreaterThan(0.4);
      expect(before).not.toEqual(after);
    });
  });

  describe("kaleidoscope", () => {
    it("rotates, and rotates faster with the music", () => {
      const quiet = draw("kaleidoscope", { level: 0 });
      const loud = draw("kaleidoscope", { level: 1 });

      expect(quiet.state.kaleidoRotation).toBeGreaterThan(0);
      expect(loud.state.kaleidoRotation).toBeGreaterThan(quiet.state.kaleidoRotation);
    });

    it("mirrors alternate sectors", () => {
      // The reflection is what makes it a kaleidoscope rather than a pinwheel;
      // it shows up as a negative y scale on every other sector.
      const { calls } = draw("kaleidoscope");
      expect(calls.filter((call) => call === "scale").length).toBeGreaterThan(0);
    });
  });
});
