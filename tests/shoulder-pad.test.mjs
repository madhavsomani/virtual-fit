import { test } from "node:test";
import assert from "node:assert/strict";

import {
  computeShoulderPadTransforms,
  SHOULDER_PAD_LANDMARKS
} from "../lib/shoulder-pad.ts";

function landmarks(overrides) {
  const arr = Array.from({ length: 33 }, () => ({ x: 0, y: 0, z: 0, visibility: 1 }));
  for (const [i, v] of Object.entries(overrides)) {
    arr[Number(i)] = { ...arr[Number(i)], ...v };
  }
  return arr;
}

test("missing shoulder/elbow → null on that side", () => {
  const out = computeShoulderPadTransforms(
    landmarks({
      [SHOULDER_PAD_LANDMARKS.leftShoulder]: { x: 0.4, y: 0.3, visibility: 0.05 },
      [SHOULDER_PAD_LANDMARKS.leftElbow]: { x: 0.35, y: 0.55 },
      [SHOULDER_PAD_LANDMARKS.rightShoulder]: { x: 0.6, y: 0.3 },
      [SHOULDER_PAD_LANDMARKS.rightElbow]: { x: 0.65, y: 0.55 }
    })
  );
  assert.equal(out.left, null);
  assert.ok(out.right);
});

test("anchors near shoulder, biased ~8% toward elbow", () => {
  const out = computeShoulderPadTransforms(
    landmarks({
      [SHOULDER_PAD_LANDMARKS.leftShoulder]: { x: 0.4, y: 0.3 },
      [SHOULDER_PAD_LANDMARKS.leftElbow]: { x: 0.4, y: 0.6 },
      [SHOULDER_PAD_LANDMARKS.rightShoulder]: { x: 0.6, y: 0.3 },
      [SHOULDER_PAD_LANDMARKS.rightElbow]: { x: 0.6, y: 0.6 }
    })
  );
  assert.ok(out.left);
  // y biased 8% from shoulder (0.3) toward elbow (0.6) = 0.324
  assert.ok(Math.abs(out.left.position.y - 0.324) < 1e-6);
});

test("pad scale ≈ 0.55 × shoulder-elbow length", () => {
  const out = computeShoulderPadTransforms(
    landmarks({
      [SHOULDER_PAD_LANDMARKS.rightShoulder]: { x: 0.6, y: 0.3 },
      [SHOULDER_PAD_LANDMARKS.rightElbow]: { x: 0.6, y: 0.5 }
    })
  );
  // length 0.2 → scale 0.11
  assert.ok(out.right);
  assert.ok(Math.abs(out.right.scale - 0.11) < 1e-6);
});

test("left and right have opposite outward tilt sign", () => {
  const out = computeShoulderPadTransforms(
    landmarks({
      [SHOULDER_PAD_LANDMARKS.leftShoulder]: { x: 0.4, y: 0.3 },
      [SHOULDER_PAD_LANDMARKS.leftElbow]: { x: 0.4, y: 0.6 },
      [SHOULDER_PAD_LANDMARKS.rightShoulder]: { x: 0.6, y: 0.3 },
      [SHOULDER_PAD_LANDMARKS.rightElbow]: { x: 0.6, y: 0.6 }
    })
  );
  assert.ok(out.left && out.right);
  // For straight-down arms armRoll = 0; rotZ = ±0.18
  assert.ok(Math.abs(out.left.rotation.z + 0.18) < 1e-6);
  assert.ok(Math.abs(out.right.rotation.z - 0.18) < 1e-6);
});

test("mirrorX flips x positions", () => {
  const m = computeShoulderPadTransforms(
    landmarks({
      [SHOULDER_PAD_LANDMARKS.rightShoulder]: { x: 0.6, y: 0.3 },
      [SHOULDER_PAD_LANDMARKS.rightElbow]: { x: 0.6, y: 0.6 }
    }),
    { mirrorX: true }
  );
  assert.ok(m.right);
  assert.ok(Math.abs(m.right.position.x - 0.4) < 1e-6);
});

test("forward-arm (negative dz) yields negative pitch", () => {
  const out = computeShoulderPadTransforms(
    landmarks({
      [SHOULDER_PAD_LANDMARKS.rightShoulder]: { x: 0.6, y: 0.3, z: 0 },
      [SHOULDER_PAD_LANDMARKS.rightElbow]: { x: 0.6, y: 0.55, z: -0.2 }
    })
  );
  assert.ok(out.right);
  assert.ok(out.right.rotation.x > 0);
});
