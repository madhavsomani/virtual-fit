import assert from "node:assert/strict";
import test from "node:test";

import { computeTorsoRotationMetric } from "../app/mirror/body-metrics.js";

test("computeTorsoRotationMetric is translation invariant", () => {
  const base = computeTorsoRotationMetric({
    leftShoulder: { x: 0.2, y: 0.2 },
    rightShoulder: { x: 0.6, y: 0.2 },
    leftHip: { x: 0.18, y: 0.72 },
    rightHip: { x: 0.46, y: 0.72 }
  });

  const shifted = computeTorsoRotationMetric({
    leftShoulder: { x: 0.35, y: 0.35 },
    rightShoulder: { x: 0.75, y: 0.35 },
    leftHip: { x: 0.33, y: 0.87 },
    rightHip: { x: 0.61, y: 0.87 }
  });

  assert.equal(base, shifted);
});

test("computeTorsoRotationMetric clamps extreme asymmetry to +45 degrees", () => {
  const angle = computeTorsoRotationMetric({
    leftShoulder: { x: 0, y: 0 },
    rightShoulder: { x: 0, y: 0 },
    leftHip: { x: 0, y: 0 },
    rightHip: { x: 100, y: 0 }
  });

  assert.equal(angle, 45);
});

test("computeTorsoRotationMetric clamps extreme asymmetry to -45 degrees", () => {
  const angle = computeTorsoRotationMetric({
    leftShoulder: { x: 0, y: 0 },
    rightShoulder: { x: 0, y: 0 },
    leftHip: { x: 100, y: 0 },
    rightHip: { x: 0, y: 0 }
  });

  assert.equal(angle, -45);
});

test("computeTorsoRotationMetric returns null for invalid coordinate input", () => {
  const angle = computeTorsoRotationMetric({
    leftShoulder: { x: Number.NaN, y: 0.2 },
    rightShoulder: { x: 0.6, y: 0.2 },
    leftHip: { x: 0.2, y: 0.7 },
    rightHip: { x: 0.6, y: 0.7 }
  });

  assert.equal(angle, null);
});
