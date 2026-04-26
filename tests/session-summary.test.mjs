// Phase 7.104 — session-summary contract.
import test from "node:test";
import assert from "node:assert/strict";
import {
  buildSessionSummary,
  SESSION_SUMMARY_SCHEMA_VERSION,
} from "../app/mirror/session-summary.js";
import { createTrackingTelemetry } from "../app/mirror/tracking-telemetry.js";

const ZERO = { yaw: 0, pitch: 0, roll: 0, depth: 0 };

test("schema version is 1 (bump deliberately if you change shape)", () => {
  assert.equal(SESSION_SUMMARY_SCHEMA_VERSION, 1);
});

test("zero-frame snapshot returns ratios=0 (no NaN)", () => {
  const s = buildSessionSummary({ snapshot: null });
  assert.equal(s.totalFrames, 0);
  for (const a of ["yaw", "pitch", "roll", "depth"]) {
    assert.equal(s.heldRatio[a], 0);
    assert.equal(s.totals[a], 0);
  }
  assert.equal(s.worstAxis, null);
  assert.equal(s.overallHeldRatio, 0);
});

test("missing snapshot is safe; sessionId defaults to 'unknown'", () => {
  const s = buildSessionSummary({});
  assert.equal(s.sessionId, "unknown");
  assert.equal(s.totalFrames, 0);
  assert.equal(s.startedAtMs, null);
  assert.equal(s.durationMs, null);
});

test("computes heldRatio = totals[axis] / totalFrames in [0,1]", () => {
  const snapshot = {
    totalFrames: 100,
    holds: { ...ZERO },
    maxHold: { yaw: 10, pitch: 5, roll: 0, depth: 25 },
    totals:  { yaw: 30, pitch: 5, roll: 0, depth: 50 },
    held:    { yaw: false, pitch: false, roll: false, depth: false },
  };
  const s = buildSessionSummary({ snapshot });
  assert.equal(s.heldRatio.yaw, 0.30);
  assert.equal(s.heldRatio.pitch, 0.05);
  assert.equal(s.heldRatio.roll, 0);
  assert.equal(s.heldRatio.depth, 0.50);
});

test("worstAxis = highest heldRatio; deterministic AXES-order tie-break", () => {
  const snapshot = {
    totalFrames: 100,
    holds: { ...ZERO },
    maxHold: { ...ZERO },
    totals:  { yaw: 20, pitch: 20, roll: 20, depth: 20 }, // four-way tie
    held:    { yaw: false, pitch: false, roll: false, depth: false },
  };
  const s = buildSessionSummary({ snapshot });
  assert.equal(s.worstAxis, "yaw", "ties resolve to first axis in AXES order");
  assert.equal(s.overallHeldRatio, 0.20);
});

test("worstAxis picks the actual highest when not tied", () => {
  const snapshot = {
    totalFrames: 200,
    holds: { ...ZERO },
    maxHold: { ...ZERO },
    totals:  { yaw: 10, pitch: 80, roll: 5, depth: 40 },
    held:    { yaw: false, pitch: false, roll: false, depth: false },
  };
  const s = buildSessionSummary({ snapshot });
  assert.equal(s.worstAxis, "pitch");
  assert.equal(s.overallHeldRatio, 0.40);
});

test("durationMs derived from startedAtMs/endedAtMs; clamps to >=0", () => {
  const s = buildSessionSummary({
    snapshot: null,
    startedAtMs: 1_000_000,
    endedAtMs:   1_005_500,
  });
  assert.equal(s.durationMs, 5_500);

  // Clock skew (ended < started) clamps to 0 instead of going negative.
  const s2 = buildSessionSummary({
    snapshot: null,
    startedAtMs: 2_000_000,
    endedAtMs:   1_999_000,
  });
  assert.equal(s2.durationMs, 0);
});

test("missing endedAtMs defaults to startedAtMs (durationMs=0, not null)", () => {
  const s = buildSessionSummary({ snapshot: null, startedAtMs: 1_000_000 });
  assert.equal(s.durationMs, 0);
});

test("missing startedAtMs leaves durationMs null (we don't guess)", () => {
  const s = buildSessionSummary({ snapshot: null });
  assert.equal(s.startedAtMs, null);
  assert.equal(s.durationMs, null);
});

test("non-finite or missing axis fields safely default to 0 (defensive)", () => {
  const snapshot = {
    totalFrames: 50,
    holds: {},
    maxHold: { yaw: NaN, pitch: undefined, roll: -3, depth: Infinity },
    totals:  { yaw: "10", pitch: null, depth: 25 }, // bogus types from a corrupted ref
    held:    {},
  };
  const s = buildSessionSummary({ snapshot });
  // bogus → 0, valid → preserved (note: -3 clamps to 0 because we use Math.max(0,…))
  assert.equal(s.maxHold.yaw, 0);
  assert.equal(s.maxHold.pitch, 0);
  assert.equal(s.maxHold.roll, 0, "negative streaks aren't real; clamp to 0");
  assert.equal(s.maxHold.depth, 0, "Infinity isn't a real frame count");
  assert.equal(s.totals.yaw, 0, "string totals → 0");
  assert.equal(s.totals.depth, 25);
  assert.equal(s.heldRatio.depth, 0.5);
});

test("output is JSON-stringifiable (no functions, no circular refs)", () => {
  const snapshot = {
    totalFrames: 42,
    holds: { ...ZERO },
    maxHold: { yaw: 3, pitch: 0, roll: 0, depth: 1 },
    totals:  { yaw: 7, pitch: 0, roll: 0, depth: 2 },
    held:    { yaw: false, pitch: false, roll: false, depth: false },
  };
  const s = buildSessionSummary({
    snapshot,
    sessionId: "sess_abc",
    startedAtMs: 1700000000000,
    endedAtMs:   1700000010000,
  });
  const json = JSON.stringify(s);
  assert.ok(json.includes('"schemaVersion":1'));
  assert.ok(json.includes('"sessionId":"sess_abc"'));
  const round = JSON.parse(json);
  assert.equal(round.totalFrames, 42);
  assert.equal(round.durationMs, 10_000);
  assert.equal(round.worstAxis, "yaw");
});

test("integrates with createTrackingTelemetry — real snapshot end-to-end", () => {
  const t = createTrackingTelemetry();
  // 10 frames: pitch null on 3, depth null on 7, no overlap.
  for (let i = 0; i < 3; i += 1) {
    t.recordFrame({ yaw: 0, pitch: null, roll: 0, depth: 1 });
  }
  for (let i = 0; i < 7; i += 1) {
    t.recordFrame({ yaw: 0, pitch: 0, roll: 0, depth: null });
  }
  const s = buildSessionSummary({ snapshot: t.snapshot(), sessionId: "real" });
  assert.equal(s.totalFrames, 10);
  assert.equal(s.totals.pitch, 3);
  assert.equal(s.totals.depth, 7);
  assert.equal(s.heldRatio.pitch, 0.3);
  assert.equal(s.heldRatio.depth, 0.7);
  assert.equal(s.worstAxis, "depth");
  assert.equal(s.overallHeldRatio, 0.7);
  assert.equal(s.maxHold.pitch, 3);
  assert.equal(s.maxHold.depth, 7);
});
