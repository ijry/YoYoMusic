/*
 * Canvas renderers for the visualiser.
 *
 * Each mode is a pure `(context, size, frame, palette, state) => void` so the
 * component only has to own the animation loop and the canvas sizing. Stateful
 * effects (peak hold, waterfall history, particles, rotation) live in the
 * mutable RenderState that the component creates once per canvas.
 */

import { createGenerativeState, drawGenerative, type GenerativeState } from "./generative";
import type { SignalFrame } from "./signal";

export interface VizPalette {
  /** Primary accent (skin gradient start). */
  a: string;
  /** Secondary accent (skin gradient end). */
  b: string;
  /** Bright ink for caps, cores and highlights. */
  ink: string;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  tone: number;
}

export interface RenderState {
  peaks: Float32Array;
  waterfall: Float32Array;
  waterfallRows: number;
  waterfallHead: number;
  waterfallFilled: number;
  waterfallClock: number;
  rotation: number;
  kaleidoRotation: number;
  particles: Particle[];
  particleClock: number;
  generative: GenerativeState;
}

export const WATERFALL_ROWS = 72;

export function createRenderState(bandCount: number): RenderState {
  return {
    peaks: new Float32Array(bandCount),
    waterfall: new Float32Array(WATERFALL_ROWS * bandCount),
    waterfallRows: WATERFALL_ROWS,
    waterfallHead: 0,
    waterfallFilled: 0,
    waterfallClock: 0,
    rotation: 0,
    kaleidoRotation: 0,
    particles: [],
    particleClock: 0,
    generative: createGenerativeState(),
  };
}

export interface DrawContext {
  context: CanvasRenderingContext2D;
  width: number;
  height: number;
  frame: SignalFrame;
  palette: VizPalette;
  state: RenderState;
  /** Seconds since the previous frame, already clamped. */
  dt: number;
}

export function drawSpectrum({ context, width, height, frame, palette, state, dt }: DrawContext) {
  const count = frame.bands.length;
  const gap = Math.max(1, (width / count) * 0.24);
  const barWidth = Math.max(1, (width - gap * (count - 1)) / count);
  const floor = height * 0.82;
  const reach = floor - 6;

  const gradient = context.createLinearGradient(0, floor, 0, floor - reach);
  gradient.addColorStop(0, palette.b);
  gradient.addColorStop(0.55, palette.a);
  gradient.addColorStop(1, palette.ink);

  context.save();
  for (let index = 0; index < count; index += 1) {
    const value = frame.bands[index];
    const barHeight = Math.max(2, value * reach);
    const x = index * (barWidth + gap);
    const y = floor - barHeight;

    context.globalAlpha = 0.9;
    context.fillStyle = gradient;
    roundedRect(context, x, y, barWidth, barHeight, Math.min(barWidth / 2, 4));
    context.fill();

    // Reflection under the floor keeps the deck feeling like glass.
    context.globalAlpha = 0.16;
    roundedRect(context, x, floor + 2, barWidth, barHeight * 0.35, Math.min(barWidth / 2, 3));
    context.fill();

    const peak = Math.max(value, state.peaks[index] - dt * 0.55);
    state.peaks[index] = peak;
    const capY = floor - Math.max(peak * reach, barHeight) - 4;
    context.globalAlpha = 0.95;
    context.fillStyle = palette.ink;
    roundedRect(context, x, capY, barWidth, 3, 1.5);
    context.fill();
  }
  context.restore();
}

export function drawWaveform({ context, width, height, frame, palette }: DrawContext) {
  const mid = height / 2;
  const samples = frame.wave;
  const count = samples.length;
  const amplitude = height * 0.36;

  context.save();

  // Faint grid so the trace reads as an instrument, not a stray line.
  context.globalAlpha = 0.12;
  context.strokeStyle = palette.b;
  context.lineWidth = 1;
  context.beginPath();
  for (let line = 1; line < 4; line += 1) {
    const y = (height / 4) * line;
    context.moveTo(0, y);
    context.lineTo(width, y);
  }
  context.stroke();

  context.globalAlpha = 0.28;
  context.beginPath();
  context.moveTo(0, mid);
  context.lineTo(width, mid);
  context.stroke();

  context.globalAlpha = 1;
  context.beginPath();
  for (let index = 0; index < count; index += 1) {
    const x = (index / (count - 1)) * width;
    const y = mid - samples[index] * amplitude;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  }

  const fill = context.createLinearGradient(0, 0, width, 0);
  fill.addColorStop(0, palette.b);
  fill.addColorStop(0.5, palette.a);
  fill.addColorStop(1, palette.ink);

  context.lineWidth = 2.4;
  context.lineJoin = "round";
  context.strokeStyle = fill;
  context.shadowColor = palette.a;
  context.shadowBlur = 18;
  context.stroke();

  // Second pass without the shadow keeps the core line crisp.
  context.shadowBlur = 0;
  context.lineWidth = 1.1;
  context.strokeStyle = palette.ink;
  context.globalAlpha = 0.75;
  context.stroke();

  context.restore();
}

export function drawRadial({ context, width, height, frame, palette, state, dt }: DrawContext) {
  const centerX = width / 2;
  const centerY = height / 2;
  const count = frame.bands.length;
  const maxRadius = Math.min(width, height) * 0.44;
  const innerRadius = Math.min(width, height) * 0.16;

  state.rotation += dt * (0.25 + frame.level * 1.4);

  context.save();
  context.translate(centerX, centerY);

  const core = context.createRadialGradient(0, 0, 0, 0, 0, innerRadius * 1.5);
  core.addColorStop(0, palette.ink);
  core.addColorStop(0.35, palette.a);
  core.addColorStop(1, "transparent");
  context.globalAlpha = 0.35 + frame.beat * 0.4;
  context.fillStyle = core;
  context.beginPath();
  context.arc(0, 0, innerRadius * (1.25 + frame.beat * 0.4), 0, Math.PI * 2);
  context.fill();

  context.globalAlpha = 0.7;
  context.strokeStyle = palette.b;
  context.lineWidth = 1;
  context.beginPath();
  context.arc(0, 0, innerRadius, 0, Math.PI * 2);
  context.stroke();

  const gradient = context.createLinearGradient(0, -maxRadius, 0, maxRadius);
  gradient.addColorStop(0, palette.ink);
  gradient.addColorStop(0.5, palette.a);
  gradient.addColorStop(1, palette.b);

  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2 + state.rotation;
    const value = frame.bands[index];
    const length = innerRadius * 0.25 + value * (maxRadius - innerRadius);
    const thickness = Math.max(1.5, (Math.PI * 2 * innerRadius) / count * 0.55);

    context.save();
    context.rotate(angle);
    context.globalAlpha = 0.55 + value * 0.45;
    context.fillStyle = gradient;
    context.shadowColor = palette.a;
    context.shadowBlur = value > 0.6 ? 12 : 0;
    roundedRect(context, innerRadius + 6, -thickness / 2, length, thickness, thickness / 2);
    context.fill();
    context.restore();
  }

  context.restore();
}

export function drawParticles({ context, width, height, frame, palette, state, dt }: DrawContext) {
  const centerX = width / 2;
  const centerY = height / 2;
  const span = Math.min(width, height);
  const emitRadius = span * 0.08;
  const maxParticles = 420;

  state.particleClock += dt;
  const emitInterval = 0.012;
  while (state.particleClock >= emitInterval) {
    state.particleClock -= emitInterval;
    const spawn = frame.beat > 0.4 ? 5 : frame.beat > 0.15 ? 2 : 1;
    for (let burst = 0; burst < spawn; burst += 1) {
      if (state.particles.length >= maxParticles) break;
      const angle = Math.random() * Math.PI * 2;
      const speed = 55 + Math.random() * 210 * (0.4 + frame.level);
      state.particles.push({
        x: centerX + Math.cos(angle) * emitRadius,
        y: centerY + Math.sin(angle) * emitRadius,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 1.1 + Math.random() * 1.4,
        size: 1.4 + Math.random() * 3.2,
        tone: Math.random(),
      });
    }
  }

  context.save();
  context.globalCompositeOperation = "lighter";

  const halo = context.createRadialGradient(centerX, centerY, 0, centerX, centerY, span * 0.34);
  halo.addColorStop(0, palette.a);
  halo.addColorStop(0.45, palette.b);
  halo.addColorStop(1, "transparent");
  context.globalAlpha = 0.3 + frame.beat * 0.4;
  context.fillStyle = halo;
  context.beginPath();
  context.arc(centerX, centerY, span * 0.34, 0, Math.PI * 2);
  context.fill();

  // Pulsing core ring so the burst has an origin to read against.
  context.globalAlpha = 0.75;
  context.strokeStyle = palette.ink;
  context.lineWidth = 1.6;
  context.beginPath();
  context.arc(centerX, centerY, emitRadius * (1.1 + frame.beat * 0.5), 0, Math.PI * 2);
  context.stroke();

  for (let index = state.particles.length - 1; index >= 0; index -= 1) {
    const particle = state.particles[index];
    particle.life += dt;
    if (particle.life >= particle.maxLife) {
      state.particles.splice(index, 1);
      continue;
    }

    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 1 - dt * 1.1;
    particle.vy *= 1 - dt * 1.1;

    const progress = particle.life / particle.maxLife;
    context.globalAlpha = (1 - progress) * 0.95;
    context.fillStyle = particle.tone > 0.55 ? palette.a : particle.tone > 0.2 ? palette.b : palette.ink;
    context.beginPath();
    context.arc(particle.x, particle.y, particle.size * (1 - progress * 0.35), 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}

export function drawAurora({ context, width, height, frame, palette }: DrawContext) {
  const layers = 4;
  const segments = 96;
  const colors = [palette.b, palette.a, palette.ink, palette.a];

  context.save();
  context.globalCompositeOperation = "lighter";

  for (let layer = 0; layer < layers; layer += 1) {
    const phase = layer * 1.7;
    const amplitude = height * (0.09 + layer * 0.045) * (0.55 + frame.level);
    const centerY = height * (0.32 + layer * 0.14);

    context.beginPath();
    for (let step = 0; step <= segments; step += 1) {
      const progress = step / segments;
      const x = progress * width;
      const bandIndex = Math.min(
        frame.bands.length - 1,
        Math.round(progress * (frame.bands.length - 1)),
      );
      const energy = frame.bands[bandIndex];
      const y =
        centerY +
        Math.sin(progress * Math.PI * 2 * 1.6 + phase + frame.beat * 2) * amplitude +
        Math.sin(progress * Math.PI * 2 * 3.1 - phase * 0.6) * amplitude * 0.45 +
        (energy - 0.35) * height * 0.22;
      if (step === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }

    const stroke = context.createLinearGradient(0, 0, width, 0);
    stroke.addColorStop(0, palette.b);
    stroke.addColorStop(0.35, colors[layer % colors.length]);
    stroke.addColorStop(1, palette.ink);

    context.globalAlpha = 0.16 + layer * 0.07;
    context.strokeStyle = stroke;
    context.lineWidth = 16 - layer * 2.5;
    context.shadowColor = colors[layer % colors.length];
    context.shadowBlur = 26;
    context.lineJoin = "round";
    context.stroke();

    context.globalAlpha = 0.5 - layer * 0.08;
    context.lineWidth = 2;
    context.shadowBlur = 0;
    context.strokeStyle = palette.ink;
    context.stroke();
  }

  context.restore();
}

export function drawWaterfall({ context, width, height, frame, palette, state, dt }: DrawContext) {
  const count = frame.bands.length;
  const half = Math.ceil(count / 2);
  state.waterfallClock += dt;

  // One new row roughly every other frame keeps the scroll readable.
  if (state.waterfallClock >= 1 / 45) {
    state.waterfallClock = 0;
    state.waterfallHead = (state.waterfallHead + 1) % state.waterfallRows;
    const offset = state.waterfallHead * count;
    state.waterfall.set(frame.bands, offset);
    state.waterfallFilled = Math.min(state.waterfallFilled + 1, state.waterfallRows);
  }

  const rowHeight = height / state.waterfallRows;
  const cellWidth = width / 2 / half;

  context.save();
  for (let row = 0; row < state.waterfallFilled; row += 1) {
    // Newest row at the bottom, oldest scrolls off the top.
    const dataRow = (state.waterfallHead - row + state.waterfallRows * 2) % state.waterfallRows;
    const offset = dataRow * count;
    const y = height - (row + 1) * rowHeight;

    // Only the left half is drawn; it is mirrored onto the right half so the
    // curtain reads as one symmetric shape instead of two overlapping copies.
    for (let column = 0; column < half; column += 1) {
      const value = state.waterfall[offset + column];
      if (value < 0.02) continue;

      context.globalAlpha = Math.min(0.95, value * 1.35);
      context.fillStyle = colormap(value, palette);
      const x = column * cellWidth;
      context.fillRect(x, y, cellWidth + 0.5, rowHeight + 0.5);
      context.fillRect(width - x - cellWidth, y, cellWidth + 0.5, rowHeight + 0.5);
    }
  }
  context.restore();
}

function colormap(value: number, palette: VizPalette) {
  // Three-stop ramp built from the skin accents; alpha carries intensity.
  if (value > 0.82) return palette.ink;
  if (value > 0.52) return palette.a;
  return palette.b;
}

export function roundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const safeRadius = Math.max(0, Math.min(radius, width / 2, height / 2));
  context.beginPath();
  context.moveTo(x + safeRadius, y);
  context.lineTo(x + width - safeRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius);
  context.lineTo(x + width, y + height - safeRadius);
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height);
  context.lineTo(x + safeRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius);
  context.lineTo(x, y + safeRadius);
  context.quadraticCurveTo(x, y, x + safeRadius, y);
  context.closePath();
}

/*
 * A kaleidoscope: one spectrum-driven arm, mirrored around the centre.
 *
 * Odd sectors draw the arm reflected, which is what turns a pinwheel into a
 * kaleidoscope — the reflections meet at the sector boundaries and the pattern
 * reads as symmetric rather than merely repeated.
 */
export function drawKaleidoscope({ context, width, height, frame, palette, state, dt }: DrawContext) {
  const cx = width / 2;
  const cy = height / 2;
  const scale = Math.min(width, height);
  const bands = frame.bands;
  const bandCount = bands.length;

  state.kaleidoRotation += dt * (0.16 + frame.level * 0.9);

  const sectorCount = 10;
  const sectorAngle = (Math.PI * 2) / sectorCount;
  const innerRadius = scale * 0.1;
  const span = scale * 0.34;

  context.save();
  context.translate(cx, cy);
  context.globalCompositeOperation = "lighter";

  const gradient = context.createLinearGradient(0, 0, 0, -span - innerRadius);
  gradient.addColorStop(0, palette.a);
  gradient.addColorStop(0.55, palette.b);
  gradient.addColorStop(1, palette.ink);

  for (let sector = 0; sector < sectorCount; sector += 1) {
    context.save();
    context.rotate(sector * sectorAngle + state.kaleidoRotation);
    // Every other sector mirrors the arm.
    if (sector % 2 === 1) context.scale(1, -1);

    for (let band = 0; band < bandCount; band += 1) {
      const value = bands[band] ?? 0;
      if (value <= 0.012) continue;

      const t = band / bandCount;
      const radius = innerRadius + t * span;
      // The arm fans out as it goes, which is what gives the petals their shape.
      const angle = t * sectorAngle * 0.85;
      const size = (1.2 + value * 13) * (0.5 + t * 0.9);

      const x = Math.sin(angle) * radius;
      const y = -Math.cos(angle) * radius;

      context.globalAlpha = 0.18 + value * 0.72;
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(x, y, size, 0, Math.PI * 2);
      context.fill();
    }

    context.restore();
  }

  // Core, brightened on the beat.
  const core = context.createRadialGradient(0, 0, 0, 0, 0, innerRadius * 1.7);
  core.addColorStop(0, palette.ink);
  core.addColorStop(0.4, palette.a);
  core.addColorStop(1, "transparent");
  context.globalAlpha = 0.3 + frame.beat * 0.5;
  context.fillStyle = core;
  context.beginPath();
  context.arc(0, 0, innerRadius * (1.15 + frame.beat * 0.5), 0, Math.PI * 2);
  context.fill();

  context.restore();
}

export const drawModeMap = {
  spectrum: drawSpectrum,
  waveform: drawWaveform,
  radial: drawRadial,
  particles: drawParticles,
  aurora: drawAurora,
  waterfall: drawWaterfall,
  generative: drawGenerative,
  kaleidoscope: drawKaleidoscope,
} as const;
