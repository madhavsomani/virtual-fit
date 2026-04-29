// Phase 8.19 — Concurrent-session stress test.
//
// Simulates N independent <virtualfit-mirror> sessions running side-by-side
// on a single Mac mini host (e.g. one storefront kiosk + 4 shopper-phone
// embeds hitting the same iframe). Each session runs the same hot loop
// the single-user bench measures, but interleaved on one event loop —
// the actual deployment shape since browsers single-thread the main
// pipeline per tab and the Mac mini back-office tooling fans out the
// same way.
//
// Pure module. No DOM. No real concurrency primitives — we use a
// deterministic round-robin scheduler so the harness is reproducible
// and the results compare apples-to-apples across hosts.

import { performance } from "node:perf_hooks";
import { trackingStep, renderStep, percentile } from "./bench.mjs";

export const STRESS_BUDGETS_MS = Object.freeze({
  // Real-world ZERO10-parity story: 5 concurrent sessions on a Mac
  // mini must each clear our single-user budgets within 4× headroom.
  // (Browsers can lean on per-tab process isolation, so true wall
  // clock is more forgiving than this serial harness — these
  // numbers are deliberately conservative.)
  per_session_tracking_p95: 200,  // 4× single-user 50ms
  per_session_render_p95: 400,    // 4× single-user 100ms
  aggregate_throughput_fps_min: 30,
});

export const STRESS_VERSION = "1.0.0";

function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

function makeFrame(rng) {
  const out = new Array(33);
  for (let i = 0; i < 33; i++) out[i] = [rng(), rng(), rng()];
  return out;
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

/**
 * Run the concurrent-session stress test. Round-robins one frame per
 * session per "tick"; samples per-session percentiles and an aggregate
 * frames-per-second throughput (the most operator-relevant number).
 *
 * @param {{
 *   sessions?: number,
 *   framesPerSession?: number,
 *   anchors?: number,
 *   seed?: number,
 *   now?: () => number,
 * }} [opts]
 */
export function stressTest(opts) {
  const o = opts || {};
  const sessions = Number.isInteger(o.sessions) && o.sessions > 0 ? o.sessions : 5;
  const framesPerSession = Number.isInteger(o.framesPerSession) && o.framesPerSession > 0 ? o.framesPerSession : 120;
  const anchorCount = Number.isInteger(o.anchors) && o.anchors > 0 ? o.anchors : 24;
  const baseSeed = o.seed ?? 42;
  const now = typeof o.now === "function" ? o.now : () => performance.now();

  // Per-session state.
  const sessionsState = new Array(sessions);
  for (let s = 0; s < sessions; s++) {
    const rng = lcg(baseSeed + s);
    sessionsState[s] = {
      rng,
      anchors: makeAnchors(anchorCount),
      prev: makeFrame(rng),
      tracking: new Array(framesPerSession),
      render: new Array(framesPerSession),
    };
  }

  const wallStart = now();
  for (let f = 0; f < framesPerSession; f++) {
    for (let s = 0; s < sessions; s++) {
      const st = sessionsState[s];
      const obs = makeFrame(st.rng);
      const t0 = now();
      st.prev = trackingStep(st.prev, obs, 0.4);
      const t1 = now();
      renderStep(st.prev, st.anchors);
      const t2 = now();
      st.tracking[f] = t1 - t0;
      st.render[f] = t2 - t1;
    }
  }
  const wallEnd = now();
  const wallMs = wallEnd - wallStart;

  const totalFrames = sessions * framesPerSession;
  // Guard against synthetic-clock benches where wallMs can be 0.
  const aggregateFps = wallMs > 0 ? (totalFrames / wallMs) * 1000 : Infinity;

  const perSession = sessionsState.map((st, idx) => ({
    id: `s${idx}`,
    tracking: {
      p50: percentile(st.tracking, 50),
      p95: percentile(st.tracking, 95),
      p99: percentile(st.tracking, 99),
      max: percentile(st.tracking, 100),
    },
    render: {
      p50: percentile(st.render, 50),
      p95: percentile(st.render, 95),
      p99: percentile(st.render, 99),
      max: percentile(st.render, 100),
    },
  }));

  // Identify the dominant bottleneck across sessions. p95 is the right
  // signal here because we care about smoothness, not single-frame jank.
  const trackingP95s = perSession.map((s) => s.tracking.p95);
  const renderP95s = perSession.map((s) => s.render.p95);
  const trackingMax = Math.max(...trackingP95s);
  const renderMax = Math.max(...renderP95s);
  const bottleneck = trackingMax >= renderMax ? "tracking" : "render";

  return {
    version: STRESS_VERSION,
    sessions,
    framesPerSession,
    anchors: anchorCount,
    wallMs,
    aggregateFps,
    perSession,
    bottleneck,
    bottleneckP95Ms: Math.max(trackingMax, renderMax),
  };
}

/** Returns array of human-readable violation strings. */
export function checkStressBudgets(result, budgets) {
  const b = budgets || STRESS_BUDGETS_MS;
  const violations = [];
  for (const s of result.perSession) {
    if (s.tracking.p95 > b.per_session_tracking_p95) {
      violations.push(`${s.id}.tracking.p95 ${s.tracking.p95.toFixed(2)}ms > ${b.per_session_tracking_p95}ms`);
    }
    if (s.render.p95 > b.per_session_render_p95) {
      violations.push(`${s.id}.render.p95 ${s.render.p95.toFixed(2)}ms > ${b.per_session_render_p95}ms`);
    }
  }
  if (result.aggregateFps < b.aggregate_throughput_fps_min) {
    violations.push(`aggregate throughput ${result.aggregateFps.toFixed(1)} fps < ${b.aggregate_throughput_fps_min} fps`);
  }
  return violations;
}
