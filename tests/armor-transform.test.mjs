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
