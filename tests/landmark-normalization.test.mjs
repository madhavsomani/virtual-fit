import assert from "node:assert/strict";
import test from "node:test";

import {
  computeNormalizedBounds,
  normalizeFaceLandmarks,
  normalizeHandLandmarkSets,
  normalizePoseLandmarks
} from "../app/mirror/landmark-normalization.js";

function createLandmarks(length, mapper) {
  return Array.from({ length }, (_, index) => mapper(index));
}

test("normalizePoseLandmarks clamps coordinates and visibility", () => {
  const raw = createLandmarks(33, (index) => ({
    x: index === 0 ? -0.25 : 1.2,
    y: index === 1 ? 2 : 0.45,
    z: index,
    visibility: index === 2 ? -0.1 : 1.4
  }));

  const normalized = normalizePoseLandmarks(raw);
  assert.ok(normalized);
  assert.equal(normalized.length, 33);
  assert.equal(normalized[0].x, 0);
  assert.equal(normalized[1].y, 1);
  assert.equal(normalized[2].visibility, 0);
  assert.equal(normalized[3].visibility, 1);
});

test("normalizePoseLandmarks returns null for incomplete pose arrays", () => {
  const normalized = normalizePoseLandmarks(createLandmarks(10, () => ({ x: 0.5, y: 0.5 })));
  assert.equal(normalized, null);
});

test("normalizeHandLandmarkSets keeps only complete hands", () => {
  const completeHand = createLandmarks(21, (index) => ({
    x: index / 20,
    y: 1.3,
    visibility: -0.2
  }));

  const partialHand = createLandmarks(9, () => ({ x: 0.4, y: 0.4 }));
  const normalized = normalizeHandLandmarkSets([completeHand, partialHand]);

  assert.equal(normalized.length, 1);
  assert.equal(normalized[0].length, 21);
  assert.equal(normalized[0][0].y, 1);
  assert.equal(normalized[0][0].visibility, 0);
});

test("normalizeFaceLandmarks and bounds provide usable geometry", () => {
  const rawFace = createLandmarks(120, (index) => ({
    x: 0.2 + index * 0.002,
    y: 0.3 + index * 0.0015,
    visibility: 0.9
  }));

  const normalizedFace = normalizeFaceLandmarks(rawFace);
  assert.ok(normalizedFace);

  const bounds = computeNormalizedBounds(normalizedFace);
  assert.ok(bounds);
  assert.ok(bounds.width > 0);
  assert.ok(bounds.height > 0);
  assert.ok(bounds.centerX > 0.2);
  assert.ok(bounds.centerY > 0.3);
});

test("computeNormalizedBounds returns null for invalid input", () => {
  assert.equal(computeNormalizedBounds(null), null);
  assert.equal(computeNormalizedBounds([]), null);
});
