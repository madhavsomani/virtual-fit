import { test } from "node:test";
import assert from "node:assert/strict";

import { computeHelmetTransform, HEAD_LANDMARKS } from "../lib/helmet.ts";

function landmarks(overrides) {
  const arr = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }));
  for (const [i, v] of Object.entries(overrides)) {
    arr[Number(i)] = { ...arr[Number(i)], ...v };
  }
  return arr;
}

test("front-facing head: centered nose, level ears → ~zero yaw/roll", () => {
  const t = computeHelmetTransform(
    landmarks({
      [HEAD_LANDMARKS.nose]: { x: 0.5, y: 0.32, z: -0.15 },
      [HEAD_LANDMARKS.leftEar]: { x: 0.43, y: 0.32, z: -0.05 },
      [HEAD_LANDMARKS.rightEar]: { x: 0.57, y: 0.32, z: -0.05 }
    })
  );
  assert.ok(t);
  assert.ok(Math.abs(t.position.x - 0.5) < 1e-9);
  assert.ok(Math.abs(t.rotation.y) < 0.05);
  assert.ok(Math.abs(t.rotation.z) < 0.05);
  assert.ok(t.scale > 0.13 && t.scale < 0.15);
  assert.ok(t.confidence > 0.95);
});

test("head turned right: nose pulls toward right ear → positive yaw", () => {
  const t = computeHelmetTransform(
    landmarks({
      [HEAD_LANDMARKS.nose]: { x: 0.55, y: 0.32, z: -0.15 },
      [HEAD_LANDMARKS.leftEar]: { x: 0.43, y: 0.32 },
      [HEAD_LANDMARKS.rightEar]: { x: 0.57, y: 0.32 }
    })
  );
  assert.ok(t);
  assert.ok(t.rotation.y > 0.1, `expected yaw>0, got ${t.rotation.y}`);
});

test("head tilted: ear line not horizontal → nonzero roll", () => {
  const t = computeHelmetTransform(
    landmarks({
      [HEAD_LANDMARKS.nose]: { x: 0.5, y: 0.32 },
      [HEAD_LANDMARKS.leftEar]: { x: 0.43, y: 0.30 },
      [HEAD_LANDMARKS.rightEar]: { x: 0.57, y: 0.36 }
    })
  );
  assert.ok(t);
  assert.ok(t.rotation.z > 0.1, `expected positive roll, got ${t.rotation.z}`);
});

test("ear-fallback: ears occluded but shoulders visible → scaled-down confidence", () => {
  const t = computeHelmetTransform(
    landmarks({
      [HEAD_LANDMARKS.nose]: { x: 0.5, y: 0.32, visibility: 1 },
      [HEAD_LANDMARKS.leftEar]: { x: 0.43, y: 0.32, visibility: 0 },
      [HEAD_LANDMARKS.rightEar]: { x: 0.57, y: 0.32, visibility: 0 },
      [HEAD_LANDMARKS.leftShoulder]: { x: 0.38, y: 0.5, visibility: 1 },
      [HEAD_LANDMARKS.rightShoulder]: { x: 0.62, y: 0.5, visibility: 1 }
    })
  );
  assert.ok(t);
  assert.ok(t.confidence > 0.5 && t.confidence < 0.6, `expected ~0.55, got ${t.confidence}`);
  assert.ok(t.scale > 0.12 && t.scale < 0.14, `shoulder×0.55 fallback scale, got ${t.scale}`);
});

test("nose missing → null", () => {
  const t = computeHelmetTransform(
    landmarks({ [HEAD_LANDMARKS.nose]: { visibility: 0 } })
  );
  assert.equal(t, null);
});

test("mirrorX: yaw flips sign, position mirrors", () => {
  const base = landmarks({
    [HEAD_LANDMARKS.nose]: { x: 0.55, y: 0.32 },
    [HEAD_LANDMARKS.leftEar]: { x: 0.43, y: 0.32 },
    [HEAD_LANDMARKS.rightEar]: { x: 0.57, y: 0.32 }
  });
  const a = computeHelmetTransform(base);
  const b = computeHelmetTransform(base, { mirrorX: true });
  assert.ok(a && b);
  assert.ok(Math.sign(a.rotation.y) !== Math.sign(b.rotation.y));
  assert.ok(Math.abs(a.position.x + b.position.x - 1) < 1e-9);
});
