import { test } from "node:test";
import assert from "node:assert/strict";

import { computeGauntletTransforms, ARM_LANDMARKS } from "../lib/gauntlet.ts";

function landmarks(overrides) {
  const arr = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }));
  for (const [i, v] of Object.entries(overrides)) {
    arr[Number(i)] = { ...arr[Number(i)], ...v };
  }
  return arr;
}

test("forearm pointing straight down → rotZ ≈ 0 (renderer's '0 = down' convention)", () => {
  const out = computeGauntletTransforms(
    landmarks({
      [ARM_LANDMARKS.leftShoulder]: { x: 0.35, y: 0.4 },
      [ARM_LANDMARKS.leftElbow]: { x: 0.35, y: 0.55 },
      [ARM_LANDMARKS.leftWrist]: { x: 0.35, y: 0.70 }
    })
  );
  assert.ok(out.left);
  assert.ok(Math.abs(out.left.rotation.z) < 0.05, `rotZ=${out.left.rotation.z}`);
  assert.equal(out.right, null);
});

test("forearm pointing right → rotZ ≈ +π/2", () => {
  const out = computeGauntletTransforms(
    landmarks({
      [ARM_LANDMARKS.leftElbow]: { x: 0.4, y: 0.5 },
      [ARM_LANDMARKS.leftWrist]: { x: 0.6, y: 0.5 }
    })
  );
  assert.ok(out.left);
  assert.ok(Math.abs(out.left.rotation.z - Math.PI / 2) < 0.05, `rotZ=${out.left.rotation.z}`);
});

test("midpoint position is elbow-wrist average", () => {
  const out = computeGauntletTransforms(
    landmarks({
      [ARM_LANDMARKS.rightElbow]: { x: 0.7, y: 0.4 },
      [ARM_LANDMARKS.rightWrist]: { x: 0.8, y: 0.6 }
    })
  );
  assert.ok(out.right);
  assert.ok(Math.abs(out.right.position.x - 0.75) < 1e-9);
  assert.ok(Math.abs(out.right.position.y - 0.5) < 1e-9);
});

test("scale = elbow-to-wrist distance", () => {
  const out = computeGauntletTransforms(
    landmarks({
      [ARM_LANDMARKS.leftElbow]: { x: 0.3, y: 0.5 },
      [ARM_LANDMARKS.leftWrist]: { x: 0.3, y: 0.8 }
    })
  );
  assert.ok(out.left);
  assert.ok(Math.abs(out.left.scale - 0.3) < 1e-9);
});

test("missing wrist → null for that arm only", () => {
  const out = computeGauntletTransforms(
    landmarks({
      [ARM_LANDMARKS.leftElbow]: { x: 0.3, y: 0.5 },
      [ARM_LANDMARKS.leftWrist]: { visibility: 0 },
      [ARM_LANDMARKS.rightElbow]: { x: 0.7, y: 0.5 },
      [ARM_LANDMARKS.rightWrist]: { x: 0.7, y: 0.7 }
    })
  );
  assert.equal(out.left, null);
  assert.ok(out.right);
});

test("mirrorX: x position mirrors and rotZ flips sign", () => {
  const ls = landmarks({
    [ARM_LANDMARKS.leftElbow]: { x: 0.4, y: 0.5 },
    [ARM_LANDMARKS.leftWrist]: { x: 0.6, y: 0.5 }
  });
  const a = computeGauntletTransforms(ls);
  const b = computeGauntletTransforms(ls, { mirrorX: true });
  assert.ok(a.left && b.left);
  assert.ok(Math.abs(a.left.position.x + b.left.position.x - 1) < 1e-9);
  assert.ok(Math.sign(a.left.rotation.z) !== Math.sign(b.left.rotation.z));
});

test("missing shoulder → arm still resolves with rotY=0", () => {
  const out = computeGauntletTransforms(
    landmarks({
      [ARM_LANDMARKS.leftShoulder]: { visibility: 0 },
      [ARM_LANDMARKS.leftElbow]: { x: 0.4, y: 0.5 },
      [ARM_LANDMARKS.leftWrist]: { x: 0.4, y: 0.7 }
    })
  );
  assert.ok(out.left);
  assert.equal(out.left.rotation.y, 0);
});
