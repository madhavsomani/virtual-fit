// Phase 8.1 — per-landmark EMA smoother for the raw MediaPipe pose stream.
//
// Design notes:
// - Applied to landmarks BEFORE they reach updateGarmentFromLandmarks(), so
//   every downstream metric (yaw / pitch / roll / depth / overlay rect /
//   gestures / dev overlays) inherits a less-jittery signal.
// - Per-axis EMA on { x, y, z, visibility }. Visibility uses a stiffer alpha
//   so a single low-vis frame doesn't drag the smoothed visibility under the
//   downstream gates (computeBodyYaw etc gate on vis < 0.4).
// - Stateless on first frame: initial values pass through verbatim so we don't
//   bias toward the origin (same lesson as Phase 7.90's seed-frame loophole).
// - Defensive: non-array / empty / non-finite inputs pass through unchanged so
//   the inner detect-loop never throws because of a bad MediaPipe frame.
// - Pure module: no DOM, no clock, no React; trivially testable in Node.

const DEFAULT_ALPHA = 0.5;
const DEFAULT_VIS_ALPHA = 0.7;

function clamp01(v) {
  if (!Number.isFinite(v)) return v;
  if (v < 0) return 0;
  if (v > 1) return 1;
  return v;
}

function emaScalar(prev, next, alpha) {
  if (!Number.isFinite(next)) return next;
  if (!Number.isFinite(prev)) return next;
  return prev + (next - prev) * alpha;
}

function emaLandmark(prev, next, alpha, visAlpha) {
  if (!next || typeof next !== "object") return next;
  const out = { ...next };
  if (Number.isFinite(next.x)) out.x = emaScalar(prev?.x, next.x, alpha);
  if (Number.isFinite(next.y)) out.y = emaScalar(prev?.y, next.y, alpha);
  if (Number.isFinite(next.z)) out.z = emaScalar(prev?.z, next.z, alpha);
  if (Number.isFinite(next.visibility)) {
    out.visibility = clamp01(emaScalar(prev?.visibility, next.visibility, visAlpha));
  }
  return out;
}

/**
 * Create a stateful per-landmark EMA smoother.
 *
 * @param {{ alpha?: number, visAlpha?: number }} [options]
 *   alpha    — position smoothing factor in (0,1]. 1 = no smoothing,
 *              lower = more lag but smoother. Default 0.5.
 *   visAlpha — visibility smoothing factor. Higher than alpha by default so
 *              the downstream low-vis gate reacts quickly to real drops.
 */
export function createLandmarkSmoother(options = {}) {
  const alpha = sanitizeAlpha(options.alpha, DEFAULT_ALPHA);
  const visAlpha = sanitizeAlpha(options.visAlpha, DEFAULT_VIS_ALPHA);
  /** @type {Array<any> | null} */
  let prev = null;

  function smooth(landmarks) {
    if (!Array.isArray(landmarks) || landmarks.length === 0) return landmarks;
    const out = new Array(landmarks.length);
    for (let i = 0; i < landmarks.length; i++) {
      out[i] = emaLandmark(prev?.[i], landmarks[i], alpha, visAlpha);
    }
    prev = out;
    return out;
  }

  function reset() {
    prev = null;
  }

  return { smooth, reset };
}

function sanitizeAlpha(value, fallback) {
  if (!Number.isFinite(value)) return fallback;
  if (value <= 0) return fallback;
  if (value > 1) return 1;
  return value;
}
