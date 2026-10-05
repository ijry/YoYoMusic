import { useEffect, useRef } from "react";
import type { VisualizationMode } from "../../shared/types";
import { createRenderState, drawModeMap, type VizPalette } from "./drawModes";
import { BAND_COUNT, SignalEngine } from "./signal";

interface AudioVisualizerProps {
  mode: VisualizationMode;
  isPlaying?: boolean;
  hasTrack?: boolean;
  /** Track id — the signal is seeded from it so each song dances differently. */
  seed?: string;
  className?: string;
}

/*
 * Canvas visualiser host.
 *
 * Owns the animation loop, canvas sizing (device-pixel-ratio aware) and the
 * palette read from the active skin's CSS custom properties. The signal itself
 * comes from SignalEngine, which is seeded per track and advanced every frame
 * instead of being tied to the 500ms playback-state poll.
 */
export function AudioVisualizer({
  mode,
  isPlaying = false,
  hasTrack = false,
  seed = "",
  className,
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modeRef = useRef(mode);
  const playingRef = useRef(isPlaying && hasTrack);
  const seedRef = useRef(seed);
  const engineRef = useRef<SignalEngine | null>(null);

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    playingRef.current = isPlaying && hasTrack;
  }, [isPlaying, hasTrack]);

  useEffect(() => {
    seedRef.current = seed;
    engineRef.current?.reseed(seed);
  }, [seed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;

    return runVisualizer(canvas, context, modeRef, playingRef, seedRef, engineRef);
  }, []);

  return (
    <div className={["audio-visualizer", className].filter(Boolean).join(" ")} aria-hidden="true">
      <canvas ref={canvasRef} className="audio-visualizer__canvas" />
      <span className="audio-visualizer__vignette" />
    </div>
  );
}

type ModeRef = { current: VisualizationMode };
type PlayingRef = { current: boolean };
type SeedRef = { current: string };
type EngineRef = { current: SignalEngine | null };

function runVisualizer(
  canvas: HTMLCanvasElement,
  context: CanvasRenderingContext2D,
  modeRef: ModeRef,
  playingRef: PlayingRef,
  seedRef: SeedRef,
  engineRef: EngineRef,
) {
  const engine = new SignalEngine(seedRef.current);
  engineRef.current = engine;
  const state = createRenderState(BAND_COUNT);

  const reduceMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let width = 1;
  let height = 1;
  let ratio = 1;
  let palette = readPalette(canvas);
  let paletteAge = 0;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = Math.max(1, rect.width || canvas.clientWidth || 320);
    height = Math.max(1, rect.height || canvas.clientHeight || 160);
    ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    palette = readPalette(canvas);
    paletteAge = 0;
  }

  function paint(dt: number) {
    const frame = engine.update(dt, playingRef.current);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    const draw = drawModeMap[modeRef.current] ?? drawModeMap.spectrum;
    draw({ context, width, height, frame, palette, state, dt });
  }

  function teardown() {
    engineRef.current = null;
    window.removeEventListener("resize", resize);
  }

  resize();

  let observer: ResizeObserver | undefined;
  if (typeof ResizeObserver !== "undefined") {
    observer = new ResizeObserver(resize);
    observer.observe(canvas);
  } else {
    window.addEventListener("resize", resize);
  }

  if (reduceMotion) {
    // One static frame: honour the preference without leaving a blank box.
    engine.update(0.016, false);
    paint(0.016);
    return () => {
      observer?.disconnect();
      teardown();
    };
  }

  let handle = 0;
  let last = performance.now();

  function tick(now: number) {
    const dt = Math.min(Math.max((now - last) / 1000, 0), 0.05);
    last = now;

    paletteAge += dt;
    if (paletteAge > 0.5) {
      palette = readPalette(canvas);
      paletteAge = 0;
    }

    paint(dt);
    handle = window.requestAnimationFrame(tick);
  }

  handle = window.requestAnimationFrame(tick);

  return () => {
    window.cancelAnimationFrame(handle);
    observer?.disconnect();
    teardown();
  };
}

const FALLBACK_PALETTE: VizPalette = { a: "#8b5cf6", b: "#22d3ee", ink: "#ffffff" };

function readPalette(element: HTMLElement): VizPalette {
  if (typeof window.getComputedStyle !== "function") return FALLBACK_PALETTE;

  const style = window.getComputedStyle(element);
  const a = style.getPropertyValue("--viz-a").trim();
  const b = style.getPropertyValue("--viz-b").trim();
  const ink = style.getPropertyValue("--viz-ink").trim();

  return {
    a: a || style.getPropertyValue("--skin-primary").trim() || FALLBACK_PALETTE.a,
    b: b || style.getPropertyValue("--skin-accent").trim() || FALLBACK_PALETTE.b,
    ink: ink || FALLBACK_PALETTE.ink,
  };
}
