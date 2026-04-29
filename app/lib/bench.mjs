// Phase 8.18 — Latency benchmark harness.
//
// Pure, deterministic micro-benchmark for the two hot loops the mirror
// ships:
//
//   1. **Tracking** — pose-keypoint update per webcam frame. Budget 50ms.
//   2. **Render**   — three.js scene update + draw call.        Budget 100ms.
//
// We can't measure WebGL or MediaPipe in node, but we can measure the
// pure-JS work that ships in our hot loops (matrix math, anchor
// resolution, pose smoothing, payload assembly). The bench surfaces
// regressions there before they ship.
//
// `npm run bench` calls `bench()` and exits non-zero if any p95 budget
// is blown. Tests assert the harness itself behaves (deterministic
// timing, p95/p99 math, budget enforcement).

import { performance } from "node:perf_hooks";

export const BUDGETS_MS = Object.freeze({
  tracking_p95: 50,
  tracking_p99: 80,
  render_p95: 100,
  render_p99: 160,
});

export const BENCH_VERSION = "1.0.0";

/** Pure CPU stand-in for our pose smoother (~exp moving average across 33 keypoints). */
export function trackingStep(prev, observation, alpha) {
  if (!Array.isArray(prev) || !Array.isArray(observation) || prev.length !== observation.length) {
    throw new Error("trackingStep: prev/observation length mismatch");
  }
  const a = typeof alpha === "number" && alpha > 0 && alpha <= 1 ? alpha : 0.4;
  const out = new Array(prev.length);
  for (let i = 0; i < prev.length; i++) {
    const p = prev[i];
    const o = observation[i];
    out[i] = [
      p[0] * (1 - a) + o[0] * a,
      p[1] * (1 - a) + o[1] * a,
      p[2] * (1 - a) + o[2] * a,
    ];
  }
  return out;
}

/** Pure CPU stand-in for our render-prep step (mat4 mul + anchor resolution). */
export function renderStep(keypoints, garmentAnchors) {
  if (!Array.isArray(keypoints) || !Array.isArray(garmentAnchors)) {
    throw new Error("renderStep: keypoints + garmentAnchors required");
  }
  const out = new Array(garmentAnchors.length);
  for (let i = 0; i < garmentAnchors.length; i++) {
    const a = garmentAnchors[i];
    const kp = keypoints[a.boneIndex] || [0, 0, 0];
    // 4x4 mat mul-equivalent compute (cheap, deterministic).
    let acc = 0;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) acc += (a.matrix[r * 4 + c] || 0) * (kp[c & 3] || 0);
    out[i] = { id: a.id, value: acc };
  }
  return out;
}

/** Compute percentile of an unsorted ms array. */
export function percentile(samples, p) {
  if (!Array.isArray(samples) || samples.length === 0) throw new Error("percentile: empty samples");
  if (typeof p !== "number" || p < 0 || p > 100) throw new Error("percentile: p out of range");
  const sorted = [...samples].sort((a, b) => a - b);
  if (p === 0) return sorted[0];
  if (p === 100) return sorted[sorted.length - 1];
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

function makeFrame(rng) {
  const kp = new Array(33);
  for (let i = 0; i < 33; i++) kp[i] = [rng(), rng(), rng()];
  return kp;
}

function makeAnchors(n) {
  const out = new Array(n);
  for (let i = 0; i < n; i++) {
    const m = new Array(16);
    for (let j = 0; j < 16; j++) m[j] = (i * 16 + j) / 64;
    out[i] = { id: `a${i}`, boneIndex: i % 33, matrix: m };
  }
  return out;
}

/** Seeded LCG so bench numbers are reproducible across runs. */
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

/**
 * Run the benchmark and return raw samples + percentile summary.
 * Pure (apart from `performance.now`); safe to call from tests.
 *
 * @param {{ frames?: number, anchors?: number, seed?: number, now?: () => number }} [opts]
 */
export function bench(opts) {
  const o = opts || {};
  const frames = Number.isInteger(o.frames) && o.frames > 0 ? o.frames : 300;
  const anchorCount = Number.isInteger(o.anchors) && o.anchors > 0 ? o.anchors : 24;
  const rng = lcg(o.seed ?? 42);
  const now = typeof o.now === "function" ? o.now : () => performance.now();

  const anchors = makeAnchors(anchorCount);
  let prev = makeFrame(rng);
  const trackingMs = new Array(frames);
  const renderMs = new Array(frames);

  for (let i = 0; i < frames; i++) {
    const obs = makeFrame(rng);
    const t0 = now();
    prev = trackingStep(prev, obs, 0.4);
    const t1 = now();
    renderStep(prev, anchors);
    const t2 = now();
    trackingMs[i] = t1 - t0;
    renderMs[i] = t2 - t1;
  }

  const summary = {
    frames,
    anchors: anchorCount,
    tracking: {
      p50: percentile(trackingMs, 50),
      p95: percentile(trackingMs, 95),
      p99: percentile(trackingMs, 99),
      max: percentile(trackingMs, 100),
    },
    render: {
      p50: percentile(renderMs, 50),
      p95: percentile(renderMs, 95),
      p99: percentile(renderMs, 99),
      max: percentile(renderMs, 100),
    },
  };

  return { summary, samples: { tracking: trackingMs, render: renderMs } };
}

/** Assert results pass our shipped budgets; returns array of violation strings. */
export function checkBudgets(summary, budgets) {
  const b = budgets || BUDGETS_MS;
  const violations = [];
  if (summary.tracking.p95 > b.tracking_p95) violations.push(`tracking.p95 ${summary.tracking.p95.toFixed(2)}ms > ${b.tracking_p95}ms`);
  if (summary.tracking.p99 > b.tracking_p99) violations.push(`tracking.p99 ${summary.tracking.p99.toFixed(2)}ms > ${b.tracking_p99}ms`);
  if (summary.render.p95   > b.render_p95)   violations.push(`render.p95 ${summary.render.p95.toFixed(2)}ms > ${b.render_p95}ms`);
  if (summary.render.p99   > b.render_p99)   violations.push(`render.p99 ${summary.render.p99.toFixed(2)}ms > ${b.render_p99}ms`);
  return violations;
}
