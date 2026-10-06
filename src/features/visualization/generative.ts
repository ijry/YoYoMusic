import type { DrawContext, VizPalette } from "./drawModes";
import type { SignalFrame } from "./signal";

/*
 * The generative visualiser.
 *
 * Unlike the other modes this one is not a single drawing routine: it is a
 * rotation of several procedurally-generated scenes that cross-fade into each
 * other, so the display keeps arriving somewhere new instead of looping. Every
 * scene is driven by the same analysed spectrum, and each is randomised on
 * entry — no two runs look alike.
 */

/** Seconds a scene stays before the next one starts fading in. */
const SCENE_MIN_SECONDS = 16;
const SCENE_MAX_SECONDS = 27;

/** How long the cross-fade takes. */
const TRANSITION_SECONDS = 1.4;

export const CONSTELLATION_NODES = 22;
/*
 * Flow fields are thin lines, so they need a lot of them: 340 particles on a
 * 1560x1046 backing store measured as an almost blank canvas next to the other
 * scenes. Count, segment length and line width all had to come up together.
 */
export const FLOW_PARTICLES = 1000;

export interface GenerativeNode {
  /** Orbit radii as a fraction of the shorter side. */
  orbitA: number;
  orbitB: number;
  /** Radians per second. */
  speed: number;
  phase: number;
  /** Which band drives this node, so the field answers across the spectrum. */
  band: number;
  size: number;
  /** 0..1, blended between the two palette accents. */
  tone: number;
}

export interface FlowParticle {
  x: number;
  y: number;
}

export interface GenerativeState {
  /** Id of the scene on screen. */
  scene: string;
  /** Scene fading in, while a transition is running. */
  incoming: string | null;
  /** 0..1 progress of the running transition. */
  transition: number;
  sceneAge: number;
  /** How long the current scene should last; drawn when it starts. */
  sceneDuration: number;
  nodes: GenerativeNode[];
  flow: FlowParticle[];
  clock: number;
  lastReseed: number;
  flash: number;
}

export const GENERATIVE_SCENE_IDS = [
  "constellation",
  "ribbons",
  "lattice",
  "orbits",
  "flowfield",
] as const;

export type GenerativeSceneId = (typeof GENERATIVE_SCENE_IDS)[number];

function randomDuration(): number {
  return SCENE_MIN_SECONDS + Math.random() * (SCENE_MAX_SECONDS - SCENE_MIN_SECONDS);
}

function randomSceneId(exclude?: string): GenerativeSceneId {
  const pool = GENERATIVE_SCENE_IDS.filter((id) => id !== exclude);
  return pool[Math.floor(Math.random() * pool.length)];
}

export function createGenerativeState(): GenerativeState {
  const scene = randomSceneId();
  return {
    scene,
    incoming: null,
    transition: 0,
    sceneAge: 0,
    sceneDuration: randomDuration(),
    nodes: [],
    flow: [],
    clock: 0,
    lastReseed: 0,
    flash: 0,
  };
}

export interface SceneContext {
  context: CanvasRenderingContext2D;
  width: number;
  height: number;
  frame: SignalFrame;
  palette: VizPalette;
  state: GenerativeState;
  /** Seconds since the mode started. */
  clock: number;
  /** 0..1 beat flash, already decayed. */
  flash: number;
  /** 0..1 — how visible this scene should be while cross-fading. */
  alpha: number;
  dt: number;
}

function bandAt(frame: SignalFrame, t: number): number {
  const index = Math.max(0, Math.min(frame.bands.length - 1, Math.floor(t * frame.bands.length)));
  return frame.bands[index] ?? 0;
}

function randomNode(bandCount: number): GenerativeNode {
  return {
    orbitA: 0.16 + Math.random() * 0.34,
    orbitB: 0.16 + Math.random() * 0.34,
    speed: (Math.random() < 0.5 ? -1 : 1) * (0.08 + Math.random() * 0.42),
    phase: Math.random() * Math.PI * 2,
    band: Math.floor(Math.random() * bandCount),
    size: 0.6 + Math.random() * 1.8,
    tone: Math.random(),
  };
}

/*
 * Scene 1 — a drifting constellation.
 *
 * Each node rides its own ellipse at its own speed, so the field is a sum of
 * incommensurate motions and never returns to a previous arrangement. Links are
 * drawn between nodes that happen to be close, which makes the structure emerge
 * rather than be drawn: nothing decides where the mesh appears.
 */
function drawConstellation(ctx: SceneContext) {
  const { context, width, height, frame, palette, state, clock, flash, alpha } = ctx;
  const bandCount = frame.bands.length;

  if (state.nodes.length === 0) {
    for (let i = 0; i < CONSTELLATION_NODES; i += 1) state.nodes.push(randomNode(bandCount));
  }

  // Re-orbit one node per beat, rate-limited so a fast track does not scramble
  // the field faster than the eye can follow.
  if (frame.beat > 0.5 && clock - state.lastReseed > 0.22) {
    state.lastReseed = clock;
    state.nodes[Math.floor(Math.random() * state.nodes.length)] = randomNode(bandCount);
  }

  const cx = width / 2;
  const cy = height / 2;
  const scale = Math.min(width, height);

  const points = state.nodes.map((node) => {
    const angle = clock * node.speed + node.phase;
    const level = frame.bands[node.band] ?? 0;
    // The band value stretches the orbit, so the field breathes with the mix.
    const stretch = 0.55 + level * 0.9;
    return {
      x: cx + Math.cos(angle) * node.orbitA * scale * stretch,
      y: cy + Math.sin(angle * 1.13) * node.orbitB * scale * stretch,
      node,
      level,
    };
  });

  context.save();
  context.globalCompositeOperation = "lighter";

  const linkDistance = scale * (0.2 + frame.level * 0.12);
  context.lineWidth = 1;
  context.strokeStyle = palette.b;
  for (let i = 0; i < points.length; i += 1) {
    for (let j = i + 1; j < points.length; j += 1) {
      const distance = Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y);
      if (distance > linkDistance) continue;

      const nearness = 1 - distance / linkDistance;
      context.globalAlpha = nearness * nearness * (0.3 + flash * 0.5) * alpha;
      context.beginPath();
      context.moveTo(points[i].x, points[i].y);
      context.lineTo(points[j].x, points[j].y);
      context.stroke();
    }
  }

  for (const point of points) {
    const radius = (2 + point.level * 7) * point.node.size * (1 + flash * 0.5);
    const glow = context.createRadialGradient(point.x, point.y, 0, point.x, point.y, radius * 3.4);
    glow.addColorStop(0, palette.ink);
    glow.addColorStop(0.32, point.node.tone > 0.5 ? palette.a : palette.b);
    glow.addColorStop(1, "transparent");

    context.globalAlpha = (0.55 + point.level * 0.45) * alpha;
    context.fillStyle = glow;
    context.beginPath();
    context.arc(point.x, point.y, radius * 3.4, 0, Math.PI * 2);
    context.fill();

    context.globalAlpha = 0.9 * alpha;
    context.fillStyle = palette.ink;
    context.beginPath();
    context.arc(point.x, point.y, Math.max(0.8, radius * 0.4), 0, Math.PI * 2);
    context.fill();
  }

  const bloom = context.createRadialGradient(cx, cy, 0, cx, cy, scale * 0.42);
  bloom.addColorStop(0, palette.a);
  bloom.addColorStop(1, "transparent");
  context.globalAlpha = (0.06 + frame.level * 0.12 + flash * 0.08) * alpha;
  context.fillStyle = bloom;
  context.fillRect(0, 0, width, height);

  context.restore();
}

/*
 * Scene 2 — stacked ribbons.
 *
 * Each ribbon is a sum of three sines at unrelated frequencies, so the bands
 * drift in and out of phase and the whole stack keeps re-folding. Line width
 * carries the energy, which reads as loudness without moving anything.
 */
function drawRibbons(ctx: SceneContext) {
  const { context, width, height, frame, palette, clock, flash, alpha } = ctx;
  const count = 6;

  context.save();
  context.globalCompositeOperation = "lighter";
  context.lineCap = "round";

  for (let ribbon = 0; ribbon < count; ribbon += 1) {
    const energy = bandAt(frame, ribbon / count);
    const baseY = height * (0.14 + (ribbon / (count - 1)) * 0.72);
    const swing = height * (0.045 + energy * 0.13);
    const speed = 0.5 + ribbon * 0.17;

    const gradient = context.createLinearGradient(0, 0, width, 0);
    gradient.addColorStop(0, "transparent");
    gradient.addColorStop(0.5, ribbon % 2 === 0 ? palette.a : palette.b);
    gradient.addColorStop(1, "transparent");

    context.strokeStyle = gradient;
    context.lineWidth = 1.2 + energy * 5 + flash * 1.5;
    context.globalAlpha = (0.22 + energy * 0.5) * alpha;

    const step = Math.max(6, width / 90);
    context.beginPath();
    for (let x = 0; x <= width + step; x += step) {
      const t = x / width;
      const y =
        baseY +
        Math.sin(t * Math.PI * 3.1 + clock * speed) * swing +
        Math.sin(t * Math.PI * 7.3 - clock * speed * 1.7) * swing * 0.34 +
        Math.sin(t * Math.PI * 13.1 + clock * speed * 0.6) * swing * 0.14;
      if (x === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    }
    context.stroke();

    // A brighter head that rides the ribbon, so it has a direction.
    const headT = (Math.sin(clock * speed * 0.31 + ribbon) + 1) / 2;
    const headX = headT * width;
    const headY =
      baseY +
      Math.sin(headT * Math.PI * 3.1 + clock * speed) * swing +
      Math.sin(headT * Math.PI * 7.3 - clock * speed * 1.7) * swing * 0.34;

    const head = context.createRadialGradient(headX, headY, 0, headX, headY, 26 + energy * 40);
    head.addColorStop(0, palette.ink);
    head.addColorStop(0.4, ribbon % 2 === 0 ? palette.a : palette.b);
    head.addColorStop(1, "transparent");
    context.globalAlpha = (0.4 + energy * 0.5) * alpha;
    context.fillStyle = head;
    context.beginPath();
    context.arc(headX, headY, 26 + energy * 40, 0, Math.PI * 2);
    context.fill();
  }

  context.restore();
}

/*
 * Scene 3 — a warped lattice.
 *
 * A regular grid pushed around by a travelling wave. The grid is what makes the
 * deformation legible: a scattered field would just look like noise, but a
 * distorted lattice reads as a surface being disturbed.
 */
function drawLattice(ctx: SceneContext) {
  const { context, width, height, frame, palette, clock, flash, alpha } = ctx;
  const cols = 21;
  const rows = 13;
  const stepX = width / (cols - 1);
  const stepY = height / (rows - 1);

  const points: Array<{ x: number; y: number; energy: number }> = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const energy = bandAt(frame, col / (cols - 1));
      const push = 4 + energy * 30;
      points.push({
        x: col * stepX + Math.sin(clock * 0.7 + row * 0.5) * push,
        y: row * stepY + Math.cos(clock * 0.6 + col * 0.42) * push,
        energy,
      });
    }
  }

  const at = (col: number, row: number) => points[row * cols + col];

  context.save();
  context.globalCompositeOperation = "lighter";
  context.lineWidth = 1;

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const point = at(col, row);
      const energy = point.energy;

      context.strokeStyle = palette.b;
      context.globalAlpha = (0.05 + energy * 0.24) * alpha;
      if (col + 1 < cols) {
        const next = at(col + 1, row);
        context.beginPath();
        context.moveTo(point.x, point.y);
        context.lineTo(next.x, next.y);
        context.stroke();
      }
      if (row + 1 < rows) {
        const below = at(col, row + 1);
        context.beginPath();
        context.moveTo(point.x, point.y);
        context.lineTo(below.x, below.y);
        context.stroke();
      }

      const size = 0.7 + energy * 4.2 + flash * 1.4;
      context.globalAlpha = (0.25 + energy * 0.7) * alpha;
      context.fillStyle = energy > 0.55 ? palette.ink : palette.a;
      context.beginPath();
      context.arc(point.x, point.y, size, 0, Math.PI * 2);
      context.fill();
    }
  }

  context.restore();
}

/*
 * Scene 4 — nested orbits.
 *
 * Concentric rings, each turning at its own rate and in its own direction, with
 * a rider on each. The bands set the ring radii, so the whole system breathes.
 */
function drawOrbits(ctx: SceneContext) {
  const { context, width, height, frame, palette, clock, flash, alpha } = ctx;
  const rings = 8;
  const scale = Math.min(width, height);

  context.save();
  context.translate(width / 2, height / 2);
  context.globalCompositeOperation = "lighter";

  for (let ring = 0; ring < rings; ring += 1) {
    const t = ring / (rings - 1);
    const energy = bandAt(frame, t);
    const radius = scale * (0.07 + t * 0.4) * (1 + energy * 0.12 + flash * 0.04);
    const spin = clock * (0.22 + ring * 0.055) * (ring % 2 === 0 ? 1 : -1);
    // Squash alternates, which keeps the rings from reading as flat circles.
    const squash = ring % 3 === 0 ? 0.82 : 1;

    context.save();
    context.rotate(spin);
    context.globalAlpha = (0.14 + energy * 0.5) * alpha;
    context.strokeStyle = ring % 2 === 0 ? palette.a : palette.b;
    context.lineWidth = 1 + energy * 2.6;
    context.beginPath();
    context.ellipse(0, 0, radius, radius * squash, 0, 0, Math.PI * 2);
    context.stroke();

    const riderSize = 2.2 + energy * 9 + flash * 2;
    const rider = context.createRadialGradient(radius, 0, 0, radius, 0, riderSize * 3);
    rider.addColorStop(0, palette.ink);
    rider.addColorStop(0.35, palette.b);
    rider.addColorStop(1, "transparent");
    context.globalAlpha = (0.45 + energy * 0.5) * alpha;
    context.fillStyle = rider;
    context.beginPath();
    context.arc(radius, 0, riderSize * 3, 0, Math.PI * 2);
    context.fill();

    context.restore();
  }

  const core = context.createRadialGradient(0, 0, 0, 0, 0, scale * 0.1);
  core.addColorStop(0, palette.ink);
  core.addColorStop(0.4, palette.a);
  core.addColorStop(1, "transparent");
  context.globalAlpha = (0.3 + frame.level * 0.3 + flash * 0.2) * alpha;
  context.fillStyle = core;
  context.beginPath();
  context.arc(0, 0, scale * 0.1, 0, Math.PI * 2);
  context.fill();

  context.restore();
}

/*
 * Scene 5 — a flow field.
 *
 * Particles advected through a slowly rotating angle field, each drawing the
 * segment it just travelled. Nothing is drawn as a shape; the image is entirely
 * the residue of motion, so it looks different every time it is entered.
 */
function drawFlowfield(ctx: SceneContext) {
  const { context, width, height, frame, palette, state, clock, alpha, dt } = ctx;
  const count = FLOW_PARTICLES;

  if (state.flow.length !== count) {
    state.flow = [];
    for (let i = 0; i < count; i += 1) {
      state.flow.push({ x: Math.random() * width, y: Math.random() * height });
    }
  }

  const energy = 0.35 + frame.level * 1.5;

  context.save();
  context.globalCompositeOperation = "lighter";

  /*
   * A soft bed under the streaks. Without it the scene reads as empty during
   * quiet passages, because there is nothing but hairlines to look at.
   */
  const bed = context.createRadialGradient(
    width / 2,
    height / 2,
    0,
    width / 2,
    height / 2,
    Math.max(width, height) * 0.62,
  );
  bed.addColorStop(0, palette.a);
  bed.addColorStop(0.55, palette.b);
  bed.addColorStop(1, "transparent");
  context.globalAlpha = (0.025 + frame.level * 0.04 + ctx.flash * 0.03) * alpha;
  context.fillStyle = bed;
  context.fillRect(0, 0, width, height);

  context.lineCap = "round";

  for (let i = 0; i < state.flow.length; i += 1) {
    const particle = state.flow[i];

    // A cheap pseudo-noise field: three offset sines are enough to make the
    // streamlines curve without the cost of a real noise function.
    const nx = particle.x / width;
    const ny = particle.y / height;
    const angle =
      Math.sin(nx * 6.2 + clock * 0.35) * 1.7 +
      Math.cos(ny * 5.4 - clock * 0.27) * 1.7 +
      Math.sin((nx + ny) * 3.1 + clock * 0.19) * 1.2;

    const speed = (26 + energy * 90) * (0.5 + ((i % 7) / 7) * 0.9);
    const prevX = particle.x;
    const prevY = particle.y;

    particle.x += Math.cos(angle) * speed * dt;
    particle.y += Math.sin(angle) * speed * dt;

    // Wrap, so the field never empties out at the edges.
    if (particle.x < -4) particle.x = width + 4;
    if (particle.x > width + 4) particle.x = -4;
    if (particle.y < -4) particle.y = height + 4;
    if (particle.y > height + 4) particle.y = -4;

    // A teleport would draw a line across the whole canvas.
    if (Math.abs(particle.x - prevX) > width / 2 || Math.abs(particle.y - prevY) > height / 2) {
      continue;
    }

    context.globalAlpha = (0.16 + (i % 5) * 0.05) * alpha;
    context.strokeStyle = i % 3 === 0 ? palette.ink : i % 3 === 1 ? palette.a : palette.b;
    context.lineWidth = 1.1 + ((i % 4) / 4) * 1.6;
    context.beginPath();
    context.moveTo(prevX, prevY);
    context.lineTo(particle.x, particle.y);
    context.stroke();
  }

  context.restore();
}

const scenes: Record<GenerativeSceneId, (ctx: SceneContext) => void> = {
  constellation: drawConstellation,
  ribbons: drawRibbons,
  lattice: drawLattice,
  orbits: drawOrbits,
  flowfield: drawFlowfield,
};

/** Smoothstep, so the cross-fade eases in and out rather than stepping. */
function ease(t: number): number {
  const clamped = Math.max(0, Math.min(1, t));
  return clamped * clamped * (3 - 2 * clamped);
}

export function drawGenerative(draw: DrawContext) {
  const { context, frame, state, dt } = draw;
  const generative = state.generative;

  generative.clock += dt;
  generative.flash = Math.max(frame.beat, generative.flash - dt * 1.6);

  /*
   * Mirror the running scene onto the canvas. The mode changes what it draws
   * every twenty-odd seconds, which is impossible to reason about from the
   * outside without knowing which scene is up.
   */
  if (context.canvas) context.canvas.dataset.vizScene = generative.scene;

  if (generative.incoming === null) {
    generative.sceneAge += dt;
    if (generative.sceneAge >= generative.sceneDuration) {
      generative.incoming = randomSceneId(generative.scene);
      generative.transition = 0;
    }
  } else {
    generative.transition += dt / TRANSITION_SECONDS;
    if (generative.transition >= 1) {
      generative.scene = generative.incoming;
      generative.incoming = null;
      generative.transition = 0;
      generative.sceneAge = 0;
      generative.sceneDuration = randomDuration();
    }
  }

  const base: Omit<SceneContext, "alpha"> = {
    context,
    width: draw.width,
    height: draw.height,
    frame,
    palette: draw.palette,
    state: generative,
    clock: generative.clock,
    flash: generative.flash,
    dt,
  };

  /*
   * Both scenes are drawn additively on a transparent canvas, so fading one out
   * while fading the other in is a genuine cross-fade — no offscreen buffer
   * needed, which would cost a full-size canvas per frame.
   */
  const incoming = generative.incoming;
  if (incoming === null) {
    scenes[generative.scene as GenerativeSceneId]({ ...base, alpha: 1 });
    return;
  }

  const progress = ease(generative.transition);
  scenes[generative.scene as GenerativeSceneId]({ ...base, alpha: 1 - progress });
  scenes[incoming as GenerativeSceneId]({ ...base, alpha: progress });
}
