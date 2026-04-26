// Phase 7.104 — session-summary export for tracking telemetry.
//
// 7.101 added per-axis null-hold counters; 7.102/7.103 surfaced them to the
// user. But for product-side analytics ("how often does the 6-DOF pipeline
// freeze in real sessions? on which axis? for how long?") we need a SHAREABLE
// report, not just a live snapshot.
//
// Design:
//   - Pure: input is the telemetry snapshot + session context (start time,
//     id). No I/O, no random, no clocks except what the caller passes in.
//   - Stable shape across versions — bump `schemaVersion` if fields change.
//   - Computes derived ratios (heldRatio per axis, worstAxis) so consumers
//     don't reimplement the math.
//   - Safe on zero-frame snapshots (returns ratios=0 instead of NaN).

const SCHEMA_VERSION = 1;
const AXES = /** @type {const} */ (["yaw", "pitch", "roll", "depth"]);

/**
 * @typedef {import("./tracking-telemetry.js").TrackingTelemetryState} TrackingTelemetryState
 */

/**
 * @typedef {Object} SessionSummaryInput
 * @property {TrackingTelemetryState | null | undefined} snapshot
 * @property {string} [sessionId]   - opaque session identifier (caller-supplied)
 * @property {number} [startedAtMs] - epoch ms; if omitted, durationMs is null
 * @property {number} [endedAtMs]   - epoch ms; if omitted, defaults to startedAtMs (durationMs=0)
 */

/**
 * @typedef {Object} SessionSummary
 * @property {1}      schemaVersion
 * @property {string} sessionId
 * @property {number|null} startedAtMs
 * @property {number|null} durationMs
 * @property {number} totalFrames
 * @property {{ yaw: number, pitch: number, roll: number, depth: number }} totals    - cumulative null-frame count per axis
 * @property {{ yaw: number, pitch: number, roll: number, depth: number }} maxHold   - longest streak per axis
 * @property {{ yaw: number, pitch: number, roll: number, depth: number }} heldRatio - totals[axis] / totalFrames, in [0,1]
 * @property {"yaw"|"pitch"|"roll"|"depth"|null} worstAxis - axis with highest heldRatio (null when all zero)
 * @property {number} overallHeldRatio - max(heldRatio[*])
 */

function makeAxisRecord(value) {
  return { yaw: value, pitch: value, roll: value, depth: value };
}

function isFiniteNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}

/**
 * @param {SessionSummaryInput} input
 * @returns {SessionSummary}
 */
export function buildSessionSummary(input) {
  const snapshot = input?.snapshot ?? null;
  const totalFrames = isFiniteNumber(snapshot?.totalFrames) ? snapshot.totalFrames : 0;

  const totalsIn = snapshot?.totals ?? {};
  const maxHoldIn = snapshot?.maxHold ?? {};
  const totals = makeAxisRecord(0);
  const maxHold = makeAxisRecord(0);
  const heldRatio = makeAxisRecord(0);

  for (const axis of AXES) {
    const t = isFiniteNumber(totalsIn[axis]) ? Math.max(0, totalsIn[axis]) : 0;
    const m = isFiniteNumber(maxHoldIn[axis]) ? Math.max(0, maxHoldIn[axis]) : 0;
    totals[axis] = t;
    maxHold[axis] = m;
    heldRatio[axis] = totalFrames > 0 ? t / totalFrames : 0;
  }

  // worstAxis = axis with highest heldRatio. Tie-break by AXES order so the
  // result is deterministic across runs and JSON serializations.
  let worstAxis = /** @type {SessionSummary["worstAxis"]} */ (null);
  let worstRatio = 0;
  for (const axis of AXES) {
    if (heldRatio[axis] > worstRatio) {
      worstAxis = axis;
      worstRatio = heldRatio[axis];
    }
  }

  const startedAtMs = isFiniteNumber(input?.startedAtMs) ? input.startedAtMs : null;
  const endedAtMs = isFiniteNumber(input?.endedAtMs)
    ? input.endedAtMs
    : (startedAtMs ?? null);
  const durationMs =
    startedAtMs !== null && endedAtMs !== null
      ? Math.max(0, endedAtMs - startedAtMs)
      : null;

  return {
    schemaVersion: SCHEMA_VERSION,
    sessionId: typeof input?.sessionId === "string" && input.sessionId.length > 0
      ? input.sessionId
      : "unknown",
    startedAtMs,
    durationMs,
    totalFrames,
    totals,
    maxHold,
    heldRatio,
    worstAxis,
    overallHeldRatio: worstRatio,
  };
}

export const SESSION_SUMMARY_SCHEMA_VERSION = SCHEMA_VERSION;
