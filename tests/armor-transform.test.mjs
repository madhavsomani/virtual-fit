import test from 'node:test';
import assert from 'node:assert/strict';

import { computeArmorTransform, POSE_LANDMARKS } from '../lib/armor.ts';

function createLandmarks(overrides) {
  const landmarks = Array.from({ length: 33 }, () => ({
    x: 0.5,
    y: 0.5,
    z: 0,
    visibility: 1
  }));

  for (const [index, value] of Object.entries(overrides)) {
    landmarks[Number(index)] = { ...landmarks[Number(index)], ...value };
  }

  return landmarks;
}

test('front-facing torso yields centered armor with neutral rotation', () => {
  const landmarks = createLandmarks({
    [POSE_LANDMARKS.leftShoulder]: { x: 0.38, y: 0.28, z: -0.1 },
    [POSE_LANDMARKS.rightShoulder]: { x: 0.62, y: 0.28, z: -0.12 },
    [POSE_LANDMARKS.leftHip]: { x: 0.43, y: 0.58, z: -0.08 },
    [POSE_LANDMARKS.rightHip]: { x: 0.57, y: 0.58, z: -0.09 }
  });

  const transform = computeArmorTransform(landmarks);

  assert.ok(transform);
  assert.ok(transform.position.x > 0.49 && transform.position.x < 0.51);
  assert.ok(transform.position.y > 0.27 && transform.position.y < 0.29);
  assert.ok(transform.scale > 0.23 && transform.scale < 0.25);
  assert.ok(Math.abs(transform.rotation.x) < 0.1);
  assert.ok(Math.abs(transform.rotation.y) < 0.05);
  assert.ok(Math.abs(transform.rotation.z) < 0.05);
});

test('leaning left produces negative roll and mirrored coordinates stay consistent', () => {
  const landmarks = createLandmarks({
    [POSE_LANDMARKS.leftShoulder]: { x: 0.36, y: 0.33, z: -0.11 },
    [POSE_LANDMARKS.rightShoulder]: { x: 0.6, y: 0.27, z: -0.15 },
    [POSE_LANDMARKS.leftHip]: { x: 0.46, y: 0.62, z: -0.09 },
    [POSE_LANDMARKS.rightHip]: { x: 0.58, y: 0.58, z: -0.1 }
  });

  const transform = computeArmorTransform(landmarks);
  const mirrored = computeArmorTransform(landmarks, { mirrorX: true });

  assert.ok(transform);
  assert.ok(mirrored);
  assert.ok(transform.rotation.z < -0.18);
  assert.ok(mirrored.rotation.z > 0.18);
  assert.ok(Math.abs(transform.position.x + mirrored.position.x - 1) < 0.01);
});

test('scale expands for close subjects and shrinks for far subjects', () => {
  const farLandmarks = createLandmarks({
    [POSE_LANDMARKS.leftShoulder]: { x: 0.44, y: 0.31, z: -0.06 },
    [POSE_LANDMARKS.rightShoulder]: { x: 0.56, y: 0.31, z: -0.06 },
    [POSE_LANDMARKS.leftHip]: { x: 0.46, y: 0.52, z: -0.04 },
    [POSE_LANDMARKS.rightHip]: { x: 0.54, y: 0.52, z: -0.04 }
  });
  const closeLandmarks = createLandmarks({
    [POSE_LANDMARKS.leftShoulder]: { x: 0.25, y: 0.24, z: -0.18 },
    [POSE_LANDMARKS.rightShoulder]: { x: 0.75, y: 0.24, z: -0.2 },
    [POSE_LANDMARKS.leftHip]: { x: 0.35, y: 0.7, z: -0.1 },
    [POSE_LANDMARKS.rightHip]: { x: 0.65, y: 0.7, z: -0.11 }
  });

  const farTransform = computeArmorTransform(farLandmarks);
  const closeTransform = computeArmorTransform(closeLandmarks);

  assert.ok(farTransform);
  assert.ok(closeTransform);
  assert.ok(farTransform.scale > 0.11 && farTransform.scale < 0.13);
  assert.ok(closeTransform.scale > 0.49 && closeTransform.scale < 0.51);
  assert.ok(closeTransform.scale > farTransform.scale * 3.5);
});

test('coincident shoulders return null safely', () => {
  const landmarks = createLandmarks({
    [POSE_LANDMARKS.leftShoulder]: { x: 0.5, y: 0.3, z: -0.1 },
    [POSE_LANDMARKS.rightShoulder]: { x: 0.5, y: 0.3, z: -0.1 },
    [POSE_LANDMARKS.leftHip]: { x: 0.45, y: 0.58, z: -0.08 },
    [POSE_LANDMARKS.rightHip]: { x: 0.55, y: 0.58, z: -0.08 }
  });

  assert.equal(computeArmorTransform(landmarks), null);
});

test('hip-fallback: chest-up framing (low hip visibility) still anchors armor', () => {
  const landmarks = createLandmarks({
    [POSE_LANDMARKS.leftShoulder]: { x: 0.38, y: 0.28, z: -0.1 },
    [POSE_LANDMARKS.rightShoulder]: { x: 0.62, y: 0.28, z: -0.12 },
    [POSE_LANDMARKS.leftHip]: { x: 0.5, y: 0.95, z: 0, visibility: 0.0 },
    [POSE_LANDMARKS.rightHip]: { x: 0.5, y: 0.95, z: 0, visibility: 0.0 }
  });

  const transform = computeArmorTransform(landmarks);

  assert.ok(transform, 'armor should still anchor with hips occluded');
  assert.ok(transform.position.x > 0.49 && transform.position.x < 0.51);
  // pitch should default to ~0 since synthesized hip has same z as shoulder
  assert.ok(Math.abs(transform.rotation.x) < 0.05);
});

test('shoulders missing → null (cannot anchor)', () => {
  const landmarks = createLandmarks({
    [POSE_LANDMARKS.leftShoulder]: { x: 0.38, y: 0.28, z: -0.1, visibility: 0 },
    [POSE_LANDMARKS.rightShoulder]: { x: 0.62, y: 0.28, z: -0.12, visibility: 0 }
  });

  assert.equal(computeArmorTransform(landmarks), null);
});

test('confidence: full visibility + hips visible → ~1.0', () => {
  const landmarks = createLandmarks({
    [POSE_LANDMARKS.leftShoulder]: { x: 0.38, y: 0.28, z: -0.1, visibility: 1 },
    [POSE_LANDMARKS.rightShoulder]: { x: 0.62, y: 0.28, z: -0.12, visibility: 1 },
    [POSE_LANDMARKS.leftHip]: { x: 0.43, y: 0.58, z: -0.08 },
    [POSE_LANDMARKS.rightHip]: { x: 0.57, y: 0.58, z: -0.09 }
  });
  const t = computeArmorTransform(landmarks);
  assert.ok(t.confidence > 0.99 && t.confidence <= 1.0);
});

test('confidence: hip-fallback path lowers confidence (~0.55x)', () => {
  const landmarks = createLandmarks({
    [POSE_LANDMARKS.leftShoulder]: { x: 0.38, y: 0.28, z: -0.1, visibility: 1 },
    [POSE_LANDMARKS.rightShoulder]: { x: 0.62, y: 0.28, z: -0.12, visibility: 1 },
    [POSE_LANDMARKS.leftHip]: { x: 0.5, y: 0.95, z: 0, visibility: 0.0 },
    [POSE_LANDMARKS.rightHip]: { x: 0.5, y: 0.95, z: 0, visibility: 0.0 }
  });
  const t = computeArmorTransform(landmarks);
  assert.ok(t, 'still anchors');
  assert.ok(t.confidence > 0.5 && t.confidence < 0.6, `expected ~0.55, got ${t.confidence}`);
});

test('shoulder z-skew (twist) increases yaw beyond pure x-displacement yaw', () => {
  // Identical x-positions for shoulders and hips (no torso x-offset),
  // but right shoulder is closer to camera (more negative z) → user twisted.
  const flat = createLandmarks({
    [POSE_LANDMARKS.leftShoulder]:  { x: 0.4, y: 0.3, z: 0,    visibility: 1 },
    [POSE_LANDMARKS.rightShoulder]: { x: 0.6, y: 0.3, z: 0,    visibility: 1 },
    [POSE_LANDMARKS.leftHip]:       { x: 0.45, y: 0.6, z: 0 },
    [POSE_LANDMARKS.rightHip]:      { x: 0.55, y: 0.6, z: 0 }
  });
  const twisted = createLandmarks({
    [POSE_LANDMARKS.leftShoulder]:  { x: 0.4, y: 0.3, z: 0,    visibility: 1 },
    [POSE_LANDMARKS.rightShoulder]: { x: 0.6, y: 0.3, z: -0.2, visibility: 1 },
    [POSE_LANDMARKS.leftHip]:       { x: 0.45, y: 0.6, z: 0 },
    [POSE_LANDMARKS.rightHip]:      { x: 0.55, y: 0.6, z: 0 }
  });
  const f = computeArmorTransform(flat);
  const t = computeArmorTransform(twisted);
  assert.ok(f && t);
  assert.ok(Math.abs(t.rotation.y) > Math.abs(f.rotation.y) + 0.1,
    `twisted yaw ${t.rotation.y} should exceed flat yaw ${f.rotation.y} by >0.1`);
});

test('yaw stays within widened clamp ±0.6 even at extreme twist', () => {
  const extreme = createLandmarks({
    [POSE_LANDMARKS.leftShoulder]:  { x: 0.45, y: 0.3, z: 0.5,  visibility: 1 },
    [POSE_LANDMARKS.rightShoulder]: { x: 0.55, y: 0.3, z: -0.5, visibility: 1 },
    [POSE_LANDMARKS.leftHip]:       { x: 0.7, y: 0.6, z: 0 },
    [POSE_LANDMARKS.rightHip]:      { x: 0.55, y: 0.6, z: 0 }
  });
  const t = computeArmorTransform(extreme);
  assert.ok(t);
  assert.ok(Math.abs(t.rotation.y) <= 0.6 + 1e-9, `yaw ${t.rotation.y} clamp violated`);
});
