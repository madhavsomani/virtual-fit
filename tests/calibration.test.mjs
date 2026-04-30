import { test } from "node:test";
import assert from "node:assert/strict";

import { computeCalibration } from "../lib/calibration.ts";

function landmarks(overrides) {
  const arr = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }));
  for (const [i, v] of Object.entries(overrides)) {
    arr[Number(i)] = { ...arr[Number(i)], ...v };
  }
  return arr;
}

test("null landmarks → no_pose", () => {
  assert.equal(computeCalibration(null).status, "no_pose");
  assert.equal(computeCalibration([]).status, "no_pose");
});

test("low-visibility shoulders → no_pose", () => {
  const out = computeCalibration(
    landmarks({ 11: { visibility: 0.05 }, 12: { x: 0.7 } })
  );
  assert.equal(out.status, "no_pose");
});

test("shoulders too close together → too_far", () => {
  const out = computeCalibration(
    landmarks({ 11: { x: 0.48, y: 0.5 }, 12: { x: 0.52, y: 0.5 } })
  );
  assert.equal(out.status, "too_far");
});

test("shoulders very wide → too_close", () => {
  const out = computeCalibration(
    landmarks({ 11: { x: 0.1, y: 0.5 }, 12: { x: 0.85, y: 0.5 } })
  );
  assert.equal(out.status, "too_close");
});

test("shoulder offscreen → out_of_frame", () => {
  const out = computeCalibration(
    landmarks({ 11: { x: -0.2, y: 0.5 }, 12: { x: 0.7, y: 0.5 } })
  );
  assert.equal(out.status, "out_of_frame");
});

test("user pushed left → off_center", () => {
  const out = computeCalibration(
    landmarks({ 11: { x: 0.05, y: 0.5 }, 12: { x: 0.25, y: 0.5 } })
  );
  assert.equal(out.status, "off_center");
});

test("centered, normal span → ok", () => {
  const out = computeCalibration(
    landmarks({ 11: { x: 0.35, y: 0.45 }, 12: { x: 0.65, y: 0.45 } })
  );
  assert.equal(out.status, "ok");
  assert.ok(out.shoulderSpan > 0.25);
});
