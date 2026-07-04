import type { VisualizationMode } from "../../shared/types";

export interface VisualizationFrame {
  values: number[];
  peak: number;
  positionMs: number;
}

export function normalizeFrameValues(values: number[]) {
  return values.map((value) => Math.max(0, Math.min(1, value)));
}

export function drawVisualization(
  canvas: HTMLCanvasElement,
  mode: VisualizationMode,
  frame: VisualizationFrame,
) {
  const context = canvas.getContext("2d");
  if (!context) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const values = normalizeFrameValues(reducedMotion ? frame.values.slice(0, 8) : frame.values);

  context.clearRect(0, 0, canvas.width, canvas.height);
  if (mode === "waveform") drawWaveform(context, canvas, values);
  else if (mode === "radial") drawRadialPulse(context, canvas, values, frame.peak);
  else drawSpectrum(context, canvas, values);
}

function drawSpectrum(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, values: number[]) {
  const barWidth = canvas.width / Math.max(values.length, 1);
  context.fillStyle = "#31d6a3";
  values.forEach((value, index) => {
    const height = value * canvas.height;
    context.fillRect(index * barWidth, canvas.height - height, Math.max(barWidth - 2, 1), height);
  });
}

function drawWaveform(context: CanvasRenderingContext2D, canvas: HTMLCanvasElement, values: number[]) {
  context.strokeStyle = "#8fd3ff";
  context.lineWidth = 2;
  context.beginPath();
  values.forEach((value, index) => {
    const x = (index / Math.max(values.length - 1, 1)) * canvas.width;
    const y = canvas.height / 2 + (value - 0.5) * canvas.height * 0.8;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.stroke();
}

function drawRadialPulse(
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  values: number[],
  peak: number,
) {
  const radius = Math.min(canvas.width, canvas.height) * (0.18 + Math.max(0, Math.min(1, peak)) * 0.24);
  context.strokeStyle = "#31d6a3";
  context.lineWidth = 5;
  context.beginPath();
  context.arc(canvas.width / 2, canvas.height / 2, radius, 0, Math.PI * 2);
  context.stroke();

  if (values.length > 0) {
    context.fillStyle = "rgba(143, 211, 255, 0.35)";
    context.beginPath();
    context.arc(canvas.width / 2, canvas.height / 2, radius * (0.45 + values[0] * 0.3), 0, Math.PI * 2);
    context.fill();
  }
}
