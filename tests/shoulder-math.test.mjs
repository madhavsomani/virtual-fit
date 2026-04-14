import assert from "node:assert/strict";
import test from "node:test";

import { computeShoulderAngleMetric, computeShoulderWidthMetric } from "../app/mirror/body-metrics.js";

test("computeShoulderWidthMetric is invariant to shoulder ordering", () => {
  const normal = computeShoulderWidthMetric({
    leftShoulder: { x: 0.2, y: 0.4 },
    rightShoulder: { x: 0.62, y: 0.4 }
  });

  const reversed = computeShoulderWidthMetric({
    leftShoulder: { x: 0.62, y: 0.4 },
    rightShoulder: { x: 0.2, y: 0.4 }
  });

  assert.equal(normal, 0.42);
  assert.equal(reversed, 0.42);
});

test("computeShoulderWidthMetric returns zero for aligned x positions", () => {
  const width = computeShoulderWidthMetric({
    leftShoulder: { x: 0.45, y: 0.3 },
    rightShoulder: { x: 0.45, y: 0.52 }
  });

  assert.equal(width, 0);
});

test("computeShoulderAngleMetric returns zero for level shoulders", () => {
  const angle = computeShoulderAngleMetric({
    leftShoulder: { x: 0.25, y: 0.4 },
    rightShoulder: { x: 0.75, y: 0.4 }
  });

  assert.equal(angle, 0);
});

test("computeShoulderAngleMetric supports full vertical shoulder tilts", () => {
  const upTilt = computeShoulderAngleMetric({
    leftShoulder: { x: 0.5, y: 0.6 },
    rightShoulder: { x: 0.5, y: 0.2 }
  });

  const downTilt = computeShoulderAngleMetric({
    leftShoulder: { x: 0.5, y: 0.2 },
    rightShoulder: { x: 0.5, y: 0.6 }
  });

  assert.equal(upTilt, -90);
  assert.equal(downTilt, 90);
});
