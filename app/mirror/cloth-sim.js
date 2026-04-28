// Phase 8.2 — Verlet cloth sim core (pure math, no three.js dependency).
//
// Spike output: prove a minimal mass-spring/Verlet cloth runs at 60fps in the
// browser with ZERO new dependencies (re-uses the existing `three` install
// for rendering geometry). See app/PHASE-8-2-CLOTH-SIM-SPIKE.md for the
// decision matrix vs three-cloth / Babylon / cannon-es.
//
// Algorithm: classic Provot-style position-based Verlet cloth.
//   - Particles store {x,y,z, prevX,prevY,prevZ, pinned}.
//   - Each tick:
//       1. Verlet integrate: pos += (pos - prev) + accel*dt²
//       2. Iterate constraints (structural + shear + bend) N times,
//          projecting endpoints back to rest length (Jakobsen 2001).
//       3. Pinned particles snap back to anchor every frame.
//
// Why pure JS / no deps: Babylon (~60MB) and cannon-es (unmaintained since
// 2022, no built-in cloth) both fail HARD RULES bandwidth/maintenance bar.
// three-cloth as a published npm package doesn't exist — it's a code pattern
// you reimplement. We're reimplementing it. Once.

const DEFAULT_ITERATIONS = 4;
const DEFAULT_GRAVITY = -9.81;

/**
 * @param {{
 *   width: number,           // particles wide  (e.g. 12)
 *   height: number,          // particles tall  (e.g. 16)
 *   spacing?: number,        // rest distance between adjacent particles (m)
 *   pinTopRow?: boolean,     // pin row 0 (typical shoulder anchor)
 *   bend?: boolean           // include skip-1 bending springs
 * }} opts
 */
export function createClothMesh(opts) {
  const width = Math.max(2, Math.floor(opts.width));
  const height = Math.max(2, Math.floor(opts.height));
  const spacing = Number.isFinite(opts.spacing) && opts.spacing > 0 ? opts.spacing : 0.05;
  const pinTopRow = opts.pinTopRow !== false;
  const bend = opts.bend === true;

  const particles = new Array(width * height);
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const x = (i - (width - 1) / 2) * spacing;
      const y = -j * spacing;
      const idx = j * width + i;
      particles[idx] = {
        x, y, z: 0,
        prevX: x, prevY: y, prevZ: 0,
        pinned: pinTopRow && j === 0
      };
    }
  }

  /** @type {Array<[number, number, number]>} idx pairs + rest length */
  const constraints = [];
  function add(a, b) {
    const pa = particles[a], pb = particles[b];
    const dx = pa.x - pb.x, dy = pa.y - pb.y, dz = pa.z - pb.z;
    const rest = Math.sqrt(dx * dx + dy * dy + dz * dz);
    constraints.push([a, b, rest]);
  }

  // Structural (horizontal + vertical neighbours)
  for (let j = 0; j < height; j++) {
    for (let i = 0; i < width; i++) {
      const idx = j * width + i;
      if (i + 1 < width) add(idx, idx + 1);
      if (j + 1 < height) add(idx, idx + width);
    }
  }
  // Shear (diagonal)
  for (let j = 0; j + 1 < height; j++) {
    for (let i = 0; i + 1 < width; i++) {
      const idx = j * width + i;
      add(idx, idx + width + 1);
      add(idx + 1, idx + width);
    }
  }
  // Bend (skip-1 — keeps cloth from folding sharply on itself)
  if (bend) {
    for (let j = 0; j < height; j++) {
      for (let i = 0; i < width; i++) {
        const idx = j * width + i;
        if (i + 2 < width) add(idx, idx + 2);
        if (j + 2 < height) add(idx, idx + 2 * width);
      }
    }
  }

  return { width, height, spacing, particles, constraints };
}

/**
 * Run one simulation step.
 *
 * @param {ReturnType<typeof createClothMesh>} cloth
 * @param {{ dt?: number, gravity?: number, iterations?: number }} [opts]
 */
export function stepCloth(cloth, opts = {}) {
  const dt = Number.isFinite(opts.dt) && opts.dt > 0 ? opts.dt : 1 / 60;
  const g = Number.isFinite(opts.gravity) ? opts.gravity : DEFAULT_GRAVITY;
  const iterations = Number.isFinite(opts.iterations) && opts.iterations > 0
    ? Math.floor(opts.iterations)
    : DEFAULT_ITERATIONS;
  const dt2 = dt * dt;

  // 1. Verlet integration.
  const ps = cloth.particles;
  for (let k = 0; k < ps.length; k++) {
    const p = ps[k];
    if (p.pinned) continue;
    const vx = p.x - p.prevX;
    const vy = p.y - p.prevY;
    const vz = p.z - p.prevZ;
    p.prevX = p.x; p.prevY = p.y; p.prevZ = p.z;
    p.x += vx;
    p.y += vy + g * dt2;
    p.z += vz;
  }

  // 2. Constraint relaxation.
  const cs = cloth.constraints;
  for (let it = 0; it < iterations; it++) {
    for (let k = 0; k < cs.length; k++) {
      const [a, b, rest] = cs[k];
      const pa = ps[a], pb = ps[b];
      const dx = pb.x - pa.x;
      const dy = pb.y - pa.y;
      const dz = pb.z - pa.z;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (dist === 0) continue;
      const diff = (dist - rest) / dist;
      const half = diff * 0.5;
      if (!pa.pinned && !pb.pinned) {
        pa.x += dx * half; pa.y += dy * half; pa.z += dz * half;
        pb.x -= dx * half; pb.y -= dy * half; pb.z -= dz * half;
      } else if (!pa.pinned) {
        pa.x += dx * diff; pa.y += dy * diff; pa.z += dz * diff;
      } else if (!pb.pinned) {
        pb.x -= dx * diff; pb.y -= dy * diff; pb.z -= dz * diff;
      }
    }
  }
}

/**
 * Move a pinned particle (used to drive cloth from MediaPipe shoulder
 * landmarks). No-op if particle isn't pinned (caller bug, but defensive).
 */
export function setAnchor(cloth, idx, x, y, z) {
  const p = cloth.particles[idx];
  if (!p || !p.pinned) return false;
  p.x = x; p.y = y; p.z = z;
  p.prevX = x; p.prevY = y; p.prevZ = z;
  return true;
}
