import assert from "node:assert/strict";
import test from "node:test";

import { buildPoseLandmarkOverlayPoints } from "../app/mirror/dev-landmark-overlay.js";

test("buildPoseLandmarkOverlayPoints mirrors x and scales to frame pixels", () => {
  const points = buildPoseLandmarkOverlayPoints({
    landmarks: [{ x: 0.25, y: 0.5, visibility: 0.9 }],
    frameWidthPx: 100,
    frameHeightPx: 200
  });

  assert.equal(points.length, 1);
  assert.deepEqual(points[0], {
    x: 75,
    y: 100,
    radius: 2,
    color: "rgba(78, 255, 174, 0.85)"
  });
});

test("buildPoseLandmarkOverlayPoints filters low-visibility landmarks", () => {
  const points = buildPoseLandmarkOverlayPoints({
    landmarks: [{ x: 0.2, y: 0.3, visibility: 0.1 }],
    frameWidthPx: 100,
    frameHeightPx: 100,
    minVisibility: 0.2
  });

  assert.equal(points.length, 0);
});

test("buildPoseLandmarkOverlayPoints marks key landmarks with larger radius", () => {
  const landmarks = Array.from({ length: 25 }, () => ({ x: 0.5, y: 0.5, visibility: 0.9 }));
  const points = buildPoseLandmarkOverlayPoints({
    landmarks,
    frameWidthPx: 100,
    frameHeightPx: 100
  });

  const shoulderPoint = points[11];
  const hipPoint = points[23];

  assert.equal(shoulderPoint.radius, 4);
  assert.equal(hipPoint.radius, 4);
});
