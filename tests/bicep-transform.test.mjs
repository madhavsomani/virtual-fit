import { test } from "node:test";
import assert from "node:assert/strict";

import { computeBicepTransforms, BICEP_LANDMARKS } from "../lib/bicep.ts";

function landmarks(overrides) {
  const arr = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }));
  for (const [i, v] of Object.entries(overrides)) {
    arr[Number(i)] = { ...arr[Number(i)], ...v };
  }
  return arr;
}

test("upper arm pointing down → rotZ ≈ 0", () => {
  const out = computeBicepTransforms(
    landmarks({
      [BICEP_LANDMARKS.leftShoulder]: { x: 0.3, y: 0.3 },
      [BICEP_LANDMARKS.leftElbow]: { x: 0.3, y: 0.5 }
    })
  );
  assert.ok(out.left);
  assert.ok(Math.abs(out.left.rotation.z) < 0.05);
  assert.equal(out.right, null);
});

test("midpoint = (shoulder + elbow) / 2", () => {
  const out = computeBicepTransforms(
    landmarks({
      [BICEP_LANDMARKS.rightShoulder]: { x: 0.7, y: 0.3 },
      [BICEP_LANDMARKS.rightElbow]: { x: 0.8, y: 0.5 }
    })
  );
  assert.ok(out.right);
  assert.ok(Math.abs(out.right.position.x - 0.75) < 1e-9);
  assert.ok(Math.abs(out.right.position.y - 0.4) < 1e-9);
});

test("scale = shoulder-elbow length", () => {
  const out = computeBicepTransforms(
    landmarks({
      [BICEP_LANDMARKS.leftShoulder]: { x: 0.3, y: 0.3 },
      [BICEP_LANDMARKS.leftElbow]: { x: 0.3, y: 0.55 }
    })
  );
  assert.ok(out.left);
  assert.ok(Math.abs(out.left.scale - 0.25) < 1e-9);
});

test("missing shoulder → null", () => {
  const out = computeBicepTransforms(
    landmarks({
      [BICEP_LANDMARKS.leftShoulder]: { visibility: 0 },
      [BICEP_LANDMARKS.leftElbow]: { x: 0.3, y: 0.5 }
    })
  );
  assert.equal(out.left, null);
});

test("mirrorX flips x and rotZ sign", () => {
  const ls = landmarks({
    [BICEP_LANDMARKS.leftShoulder]: { x: 0.3, y: 0.3 },
    [BICEP_LANDMARKS.leftElbow]: { x: 0.5, y: 0.3 }
  });
  const a = computeBicepTransforms(ls);
  const b = computeBicepTransforms(ls, { mirrorX: true });
  assert.ok(a.left && b.left);
  assert.ok(Math.abs(a.left.position.x + b.left.position.x - 1) < 1e-9);
  assert.ok(Math.sign(a.left.rotation.z) !== Math.sign(b.left.rotation.z));
});
