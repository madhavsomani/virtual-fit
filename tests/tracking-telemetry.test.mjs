// Phase 7.101 — tracking-telemetry contract tests.
import test from "node:test";
import assert from "node:assert/strict";
import { createTrackingTelemetry } from "../app/mirror/tracking-telemetry.js";

test("fresh instance has zeroed counters and held=false everywhere", () => {
  const t = createTrackingTelemetry();
  const s = t.snapshot();
  assert.equal(s.totalFrames, 0);
  for (const a of ["yaw", "pitch", "roll", "depth"]) {
    assert.equal(s.holds[a], 0);
    assert.equal(s.maxHold[a], 0);
    assert.equal(s.totals[a], 0);
    assert.equal(s.held[a], false);
  }
});

test("totalFrames increments by 1 per recordFrame regardless of contents", () => {
  const t = createTrackingTelemetry();
  t.recordFrame({ yaw: 0.1, pitch: 0.2, roll: 0, depth: 1.0 });
  t.recordFrame({ yaw: null, pitch: null, roll: null, depth: null });
  t.recordFrame({});
  assert.equal(t.snapshot().totalFrames, 3);
});

test("null input increments holds + totals; max tracks longest streak", () => {
  const t = createTrackingTelemetry();
  // 3-frame yaw hold, 1-frame pitch hold mid-streak, no roll holds.
  t.recordFrame({ yaw: null, pitch: 0.5, roll: 0, depth: 1.0 });
  t.recordFrame({ yaw: null, pitch: null, roll: 0, depth: 1.0 });
  t.recordFrame({ yaw: null, pitch: 0.5, roll: 0, depth: 1.0 });
  const s = t.snapshot();
  assert.equal(s.holds.yaw, 3);
  assert.equal(s.maxHold.yaw, 3);
  assert.equal(s.totals.yaw, 3);
  assert.equal(s.holds.pitch, 0);
  assert.equal(s.maxHold.pitch, 1);
  assert.equal(s.totals.pitch, 1);
  assert.equal(s.totals.roll, 0);
});

test("a fresh measurement resets the CURRENT streak but not max/total", () => {
  const t = createTrackingTelemetry();
  t.recordFrame({ yaw: null });
  t.recordFrame({ yaw: null });
  t.recordFrame({ yaw: 0.1 }); // fresh!
  t.recordFrame({ yaw: null });
  const s = t.snapshot();
  assert.equal(s.holds.yaw, 1, "current streak restarted at 1");
  assert.equal(s.maxHold.yaw, 2, "max retains earlier 2-streak");
  assert.equal(s.totals.yaw, 3, "totals = 2 + 1");
});

test("held flag mirrors holds[axis] > 0", () => {
  const t = createTrackingTelemetry();
  t.recordFrame({ yaw: null, pitch: 0.5, roll: 0, depth: 1.0 });
  let s = t.snapshot();
  assert.equal(s.held.yaw, true);
  assert.equal(s.held.pitch, false);
  t.recordFrame({ yaw: 0.1, pitch: 0.5, roll: 0, depth: 1.0 });
  s = t.snapshot();
  assert.equal(s.held.yaw, false);
});

test("missing axis keys default to 'fresh' (back-compat for partial callers)", () => {
  const t = createTrackingTelemetry();
  t.recordFrame({ yaw: null }); // pitch/roll/depth omitted
  const s = t.snapshot();
  assert.equal(s.holds.yaw, 1);
  assert.equal(s.holds.pitch, 0);
  assert.equal(s.holds.roll, 0);
  assert.equal(s.holds.depth, 0);
});

test("non-null finite values count as fresh (the wiring contract)", () => {
  const t = createTrackingTelemetry();
  // Production: smoother gates fire on `axis !== null`. Telemetry must agree.
  t.recordFrame({ yaw: 0, pitch: 0, roll: 0, depth: 1 }); // all zeros = valid fresh
  const s = t.snapshot();
  for (const a of ["yaw", "pitch", "roll", "depth"]) {
    assert.equal(s.totals[a], 0, `${a} should not count zero as held`);
  }
});

test("snapshot is independent of internal state (no mutation leak)", () => {
  const t = createTrackingTelemetry();
  t.recordFrame({ yaw: null });
  const s1 = t.snapshot();
  s1.holds.yaw = 999;     // caller mutates snapshot
  s1.totalFrames = -1;
  const s2 = t.snapshot(); // re-snapshot
  assert.equal(s2.holds.yaw, 1);
  assert.equal(s2.totalFrames, 1);
});

test("reset() zeros everything", () => {
  const t = createTrackingTelemetry();
  t.recordFrame({ yaw: null, pitch: null, roll: null, depth: null });
  t.recordFrame({ yaw: null, pitch: null, roll: null, depth: null });
  t.reset();
  const s = t.snapshot();
  assert.equal(s.totalFrames, 0);
  for (const a of ["yaw", "pitch", "roll", "depth"]) {
    assert.equal(s.holds[a], 0);
    assert.equal(s.maxHold[a], 0);
    assert.equal(s.totals[a], 0);
  }
});

test("recordFrame(undefined) is a no-op-ish (treats all axes as fresh, increments totalFrames)", () => {
  const t = createTrackingTelemetry();
  t.recordFrame(undefined);
  t.recordFrame(null);
  const s = t.snapshot();
  assert.equal(s.totalFrames, 2);
  for (const a of ["yaw", "pitch", "roll", "depth"]) {
    assert.equal(s.totals[a], 0);
  }
});
