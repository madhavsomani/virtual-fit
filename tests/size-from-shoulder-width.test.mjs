// Phase 7.31 — boundary tests for the size estimator extracted from the
// /mirror render loop. The thresholds are taste-sensitive (taller users,
// different camera FOV, retail data drift) — pin every boundary so a
// future tweak shows up as an explicit test diff, not silent behavior
// change in the perf-critical pose loop.

import assert from "node:assert/strict";
import test from "node:test";
import {
  estimateSizeFromShoulderRatio,
  SHOULDER_RATIO_THRESHOLDS,
} from "../app/mirror/size-from-shoulder-width-pure.mjs";

test("thresholds are ordered ascending and end at +Infinity", () => {
  let prev = -Infinity;
  for (const [, upper] of SHOULDER_RATIO_THRESHOLDS) {
    assert.ok(upper > prev, `thresholds must be strictly ascending: saw ${upper} after ${prev}`);
    prev = upper;
  }
  const last = SHOULDER_RATIO_THRESHOLDS[SHOULDER_RATIO_THRESHOLDS.length - 1];
  assert.equal(last[1], Number.POSITIVE_INFINITY);
});

test("the six size labels are XS S M L XL XXL in order", () => {
  assert.deepEqual(
    SHOULDER_RATIO_THRESHOLDS.map((p) => p[0]),
    ["XS", "S", "M", "L", "XL", "XXL"],
  );
});

// Boundary-pair tests: the if-ladder uses strict `<`, so the threshold
// itself goes to the NEXT bucket (e.g. 0.22 → S, just-below → XS).
test("boundary 0.22: just below → XS, at boundary → S", () => {
  assert.equal(estimateSizeFromShoulderRatio(0.21999), "XS");
  assert.equal(estimateSizeFromShoulderRatio(0.22), "S");
});

test("boundary 0.27: just below → S, at boundary → M", () => {
  assert.equal(estimateSizeFromShoulderRatio(0.26999), "S");
  assert.equal(estimateSizeFromShoulderRatio(0.27), "M");
});

test("boundary 0.32: just below → M, at boundary → L", () => {
  assert.equal(estimateSizeFromShoulderRatio(0.31999), "M");
  assert.equal(estimateSizeFromShoulderRatio(0.32), "L");
});

test("boundary 0.38: just below → L, at boundary → XL", () => {
  assert.equal(estimateSizeFromShoulderRatio(0.37999), "L");
  assert.equal(estimateSizeFromShoulderRatio(0.38), "XL");
});

test("boundary 0.45: just below → XL, at boundary → XXL", () => {
  assert.equal(estimateSizeFromShoulderRatio(0.44999), "XL");
  assert.equal(estimateSizeFromShoulderRatio(0.45), "XXL");
});

test("typical webcam ratios map to expected sizes", () => {
  assert.equal(estimateSizeFromShoulderRatio(0.20), "XS");
  assert.equal(estimateSizeFromShoulderRatio(0.25), "S");
  assert.equal(estimateSizeFromShoulderRatio(0.30), "M");
  assert.equal(estimateSizeFromShoulderRatio(0.35), "L");
  assert.equal(estimateSizeFromShoulderRatio(0.42), "XL");
  assert.equal(estimateSizeFromShoulderRatio(0.50), "XXL");
});

test("huge ratio (very close to camera) → XXL", () => {
  assert.equal(estimateSizeFromShoulderRatio(0.99), "XXL");
  assert.equal(estimateSizeFromShoulderRatio(10), "XXL");
});

test("zero / negative / NaN ratio → XS (defensive clamp)", () => {
  assert.equal(estimateSizeFromShoulderRatio(0), "XS");
  assert.equal(estimateSizeFromShoulderRatio(-0.1), "XS");
  assert.equal(estimateSizeFromShoulderRatio(NaN), "XS");
  assert.equal(estimateSizeFromShoulderRatio(Infinity), "XXL");
});

test("output is always one of the six size literals", () => {
  const valid = new Set(["XS", "S", "M", "L", "XL", "XXL"]);
  for (let r = -0.1; r <= 1.0; r += 0.013) {
    assert.ok(
      valid.has(estimateSizeFromShoulderRatio(r)),
      `unexpected size for ratio=${r}: ${estimateSizeFromShoulderRatio(r)}`,
    );
  }
});
