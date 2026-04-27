// Phase 7.108 — pure aggregator contract.
import test from "node:test";
import assert from "node:assert/strict";
import { aggregateSummaries, AGGREGATE_AXES } from "../app/mirror/session-summary-aggregate.js";

const summary = (over) => ({
  schemaVersion: 1,
  sessionId: "x",
  totalFrames: 100,
  durationMs: 5000,
  worstAxis: "yaw",
  overallHeldRatio: 0.1,
  heldRatio: { yaw: 0.1, pitch: 0, roll: 0, depth: 0 },
  ...over,
});

test("axes order is locked", () => {
  assert.deepEqual([...AGGREGATE_AXES], ["yaw", "pitch", "roll", "depth"]);
});

test("empty input → zero counts and null medians (no NaN leaks)", () => {
  const out = aggregateSummaries([]);
  assert.equal(out.sessionCount, 0);
  assert.equal(out.totalFrames, 0);
  assert.equal(out.medianHeldRatio, null);
  assert.deepEqual(out.worstAxisDistribution, { yaw: 0, pitch: 0, roll: 0, depth: 0 });
  for (const ax of AGGREGATE_AXES) assert.equal(out.perAxisMedianHeldRatio[ax], null);
});

test("non-array input is safely treated as empty", () => {
  for (const bad of [null, undefined, "nope", 123, {}]) {
    const out = aggregateSummaries(bad);
    assert.equal(out.sessionCount, 0);
    assert.equal(out.medianHeldRatio, null);
  }
});

test("totalFrames sums across sessions; ignores non-finite/negative", () => {
  const out = aggregateSummaries([
    summary({ totalFrames: 100 }),
    summary({ totalFrames: 250 }),
    summary({ totalFrames: NaN }),
    summary({ totalFrames: -5 }),
    summary({ totalFrames: Infinity }),
    summary({ totalFrames: undefined }),
  ]);
  assert.equal(out.totalFrames, 350);
  assert.equal(out.sessionCount, 6);
});

test("medianHeldRatio: odd length → middle value", () => {
  const out = aggregateSummaries([
    summary({ overallHeldRatio: 0.1 }),
    summary({ overallHeldRatio: 0.5 }),
    summary({ overallHeldRatio: 0.9 }),
  ]);
  assert.equal(out.medianHeldRatio, 0.5);
});

test("medianHeldRatio: even length → average of two middle values", () => {
  const out = aggregateSummaries([
    summary({ overallHeldRatio: 0.0 }),
    summary({ overallHeldRatio: 0.4 }),
    summary({ overallHeldRatio: 0.6 }),
    summary({ overallHeldRatio: 1.0 }),
  ]);
  assert.equal(out.medianHeldRatio, 0.5);
});

test("medianHeldRatio: NaN/Infinity ratios are skipped before median (no NaN leak)", () => {
  // The 7.107 CSV cell rule: non-finite values must never contaminate aggregates.
  const out = aggregateSummaries([
    summary({ overallHeldRatio: 0.2 }),
    summary({ overallHeldRatio: NaN }),
    summary({ overallHeldRatio: Infinity }),
    summary({ overallHeldRatio: 0.4 }),
  ]);
  assert.ok(Math.abs(out.medianHeldRatio - 0.3) < 1e-9, `expected ~0.3, got ${out.medianHeldRatio}`);
});

test("worstAxisDistribution counts each axis only when valid", () => {
  const out = aggregateSummaries([
    summary({ worstAxis: "yaw" }),
    summary({ worstAxis: "yaw" }),
    summary({ worstAxis: "pitch" }),
    summary({ worstAxis: "depth" }),
    summary({ worstAxis: "garbage" }),    // ignored
    summary({ worstAxis: undefined }),    // ignored
    summary({ worstAxis: "__proto__" }),  // ignored (prototype-pollution guard)
  ]);
  assert.deepEqual(out.worstAxisDistribution, { yaw: 2, pitch: 1, roll: 0, depth: 1 });
});

test("perAxisMedianHeldRatio: per-axis median over finite values only", () => {
  const out = aggregateSummaries([
    summary({ heldRatio: { yaw: 0.1, pitch: 0.2, roll: 0.3, depth: 0.4 } }),
    summary({ heldRatio: { yaw: 0.5, pitch: 0.6, roll: 0.7, depth: 0.8 } }),
    summary({ heldRatio: { yaw: 0.9, pitch: NaN, roll: Infinity, depth: -Infinity } }),
  ]);
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `expected ~${b}, got ${a}`);
  near(out.perAxisMedianHeldRatio.yaw, 0.5);
  near(out.perAxisMedianHeldRatio.pitch, 0.4);
  near(out.perAxisMedianHeldRatio.roll, 0.5);
  near(out.perAxisMedianHeldRatio.depth, 0.6);
});

test("missing heldRatio object on a summary doesn't crash; per-axis still derived from rest", () => {
  const out = aggregateSummaries([
    summary({ heldRatio: undefined }),
    summary({ heldRatio: null }),
    summary({ heldRatio: "not-an-object" }),
    summary({ heldRatio: { yaw: 0.4, pitch: 0.5, roll: 0.6, depth: 0.7 } }),
  ]);
  assert.equal(out.perAxisMedianHeldRatio.yaw, 0.4);
  assert.equal(out.sessionCount, 4);
});

test("null/undefined/non-object items are silently skipped from sessionCount + reads", () => {
  const out = aggregateSummaries([
    null,
    undefined,
    "garbage",
    42,
    summary({ totalFrames: 100, overallHeldRatio: 0.5, worstAxis: "roll" }),
  ]);
  assert.equal(out.sessionCount, 1);
  assert.equal(out.totalFrames, 100);
  assert.equal(out.medianHeldRatio, 0.5);
  assert.deepEqual(out.worstAxisDistribution, { yaw: 0, pitch: 0, roll: 1, depth: 0 });
});

test("output is JSON-stringifiable (matches every other observability layer)", () => {
  const out = aggregateSummaries([summary(), summary()]);
  const round = JSON.parse(JSON.stringify(out));
  assert.deepEqual(round, out);
});
