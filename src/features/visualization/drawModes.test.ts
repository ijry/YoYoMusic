import { describe, expect, it } from "vitest";
import { createRenderState, drawModeMap, type DrawContext, type VizPalette } from "./drawModes";
import { FLOW_PARTICLES, GENERATIVE_SCENE_IDS } from "./generative";
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
    ellipse: () => calls.push("ellipse"),
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
  return { calls, state, context, palette };
}

/** Steps a draw context forward, as the animation loop would. */
function step(ctx: DrawContext, times = 1) {
  for (let i = 0; i < times; i += 1) drawModeMap.generative(ctx);
}

function contextFor(state: ReturnType<typeof createRenderState>) {
  const { context, calls } = recordingContext();
  return {
    calls,
    ctx: {
      context,
      width: 640,
      height: 360,
      frame: frame(),
      palette,
      state,
      dt: 1 / 60,
    } satisfies DrawContext,
  };
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
    /*
     * The mode picks a scene at random, so the tests drive each one explicitly.
     * Leaving it random made these tests flaky: a different scene ran on each
     * run, and only some of them exercised `ellipse`.
     */
    it("renders every scene it can rotate through", () => {
      for (const scene of GENERATIVE_SCENE_IDS) {
        const state = createRenderState(BAND_COUNT);
        state.generative.scene = scene;
        const { ctx } = contextFor(state);

        expect(() => step(ctx), scene).not.toThrow();
      }
    });

    it("balances save and restore in every scene", () => {
      // An unbalanced save leaks the additive composite mode into the next
      // frame, which washes the canvas out.
      for (const scene of GENERATIVE_SCENE_IDS) {
        const state = createRenderState(BAND_COUNT);
        state.generative.scene = scene;
        const { ctx, calls } = contextFor(state);
        step(ctx);

        const saves = calls.filter((call) => call === "save").length;
        const restores = calls.filter((call) => call === "restore").length;
        expect(restores, `${scene} leaked a save`).toBe(saves);
      }
    });

    it("draws something in every scene, even at silence", () => {
      const silent = {
        bands: new Float32Array(BAND_COUNT),
        wave: new Float32Array(WAVE_SAMPLES),
        level: 0,
        beat: 0,
      };

      for (const scene of GENERATIVE_SCENE_IDS) {
        const state = createRenderState(BAND_COUNT);
        state.generative.scene = scene;
        const { context, calls } = recordingContext();
        drawModeMap.generative({
          context,
          width: 640,
          height: 360,
          frame: silent,
          palette,
          state,
          dt: 1 / 60,
        });

        expect(calls.length, `${scene} drew nothing at silence`).toBeGreaterThan(0);
      }
    });

    /*
     * The flow field shipped with 340 particles, which measured as an almost
     * blank canvas next to the other scenes: thin lines need far more of them
     * than filled shapes do.
     *
     * This is pinned by particle count rather than by counting draw calls,
     * because call counts do not describe how much is on screen — `ribbons`
     * issues twelve calls for six long thick strokes and is one of the
     * brightest scenes. Overall visual density is checked by measuring the
     * rendered canvas in the browser, not here.
     */
    it("keeps the flow field dense enough to read", () => {
      const state = createRenderState(BAND_COUNT);
      state.generative.scene = "flowfield";
      const { ctx, calls } = contextFor(state);
      step(ctx);

      expect(state.generative.flow).toHaveLength(FLOW_PARTICLES);
      // A few are skipped each frame where a particle wrapped around an edge.
      const strokes = calls.filter((call) => call === "stroke").length;
      expect(strokes).toBeGreaterThan(FLOW_PARTICLES * 0.9);
    });

    it("starts on a random scene", () => {
      // The whole point of the mode is that no two runs look alike.
      const seen = new Set<string>();
      for (let i = 0; i < 40; i += 1) seen.add(createRenderState(BAND_COUNT).generative.scene);
      expect(seen.size).toBeGreaterThan(1);
    });

    it("keeps moving rather than settling", () => {
      const state = createRenderState(BAND_COUNT);
      const { ctx } = contextFor(state);

      step(ctx);
      const firstClock = state.generative.clock;
      step(ctx, 30);
      expect(state.generative.clock).toBeGreaterThan(firstClock);
    });

    it("moves on to another scene once its time is up", () => {
      const state = createRenderState(BAND_COUNT);
      const { ctx } = contextFor(state);
      const started = state.generative.scene;

      // Run past the longest a scene can last, plus the cross-fade.
      const frames = Math.ceil((30 + 2) / (1 / 60));
      step(ctx, frames);

      expect(state.generative.scene).not.toBe(started);
      // And it must have kept cycling, not stopped after the first change.
      expect(state.generative.sceneAge).toBeLessThan(30);
    });

    it("cross-fades: both scenes are drawn while a transition runs", () => {
      const state = createRenderState(BAND_COUNT);
      state.generative.scene = "ribbons";
      state.generative.incoming = "lattice";
      state.generative.transition = 0.5;

      const { ctx, calls } = contextFor(state);
      step(ctx);

      // `lattice` strokes far more segments than `ribbons`, so a cross-fade
      // shows up as a link count well above either scene alone.
      expect(calls.filter((call) => call === "lineTo").length).toBeGreaterThan(100);
      expect(state.generative.transition).toBeGreaterThan(0.5);
    });

    it("finishes the transition by promoting the incoming scene", () => {
      const state = createRenderState(BAND_COUNT);
      state.generative.scene = "ribbons";
      state.generative.incoming = "orbits";
      state.generative.transition = 0.98;

      const { ctx } = contextFor(state);
      step(ctx, 3);

      expect(state.generative.scene).toBe("orbits");
      expect(state.generative.incoming).toBeNull();
      expect(state.generative.sceneAge).toBeLessThan(1);
    });

    it("never picks the scene that is already on screen", () => {
      // A transition into the same scene would fade out and back in for no
      // reason, which reads as a flicker.
      for (let attempt = 0; attempt < 60; attempt += 1) {
        const state = createRenderState(BAND_COUNT);
        const current = state.generative.scene;
        const { ctx } = contextFor(state);

        state.generative.sceneDuration = 0;
        step(ctx);
        expect(state.generative.incoming).not.toBe(current);
      }
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
