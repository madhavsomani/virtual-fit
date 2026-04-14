import assert from "node:assert/strict";
import test from "node:test";

import {
  computeBodyCenterMetric,
  computeBodyCenterPixels,
  computeHandPresenceMetric,
  computeShoulderAngleMetric,
  computeShoulderWidthMetric,
  computeShoulderWidthPixels,
  computeTorsoHeightMetric,
  computeTorsoHeightPixels,
  computeTorsoRotationMetric
} from "../app/mirror/body-metrics.js";

test("computeShoulderWidthMetric returns normalized distance", () => {
  const metric = computeShoulderWidthMetric({
    leftShoulder: { x: 0.32, y: 0.4 },
    rightShoulder: { x: 0.64, y: 0.42 }
  });

  assert.equal(metric, 0.32);
});

test("computeShoulderWidthMetric handles missing landmarks", () => {
  assert.equal(computeShoulderWidthMetric({ leftShoulder: { x: 0.4, y: 0.4 }, rightShoulder: null }), null);
  assert.equal(computeShoulderWidthMetric({ leftShoulder: null, rightShoulder: { x: 0.6, y: 0.4 } }), null);
});

test("computeShoulderWidthMetric clamps out-of-range values", () => {
  const metric = computeShoulderWidthMetric({
    leftShoulder: { x: -2, y: 0.4 },
    rightShoulder: { x: 3, y: 0.4 }
  });

  assert.equal(metric, 1);
});

test("computeShoulderWidthPixels converts normalized metric", () => {
  const pixels = computeShoulderWidthPixels({
    shoulderWidthMetric: 0.315,
    frameWidthPx: 1280
  });

  assert.equal(pixels, 403);
});

test("computeShoulderWidthPixels returns null for invalid input", () => {
  assert.equal(computeShoulderWidthPixels({ shoulderWidthMetric: null, frameWidthPx: 1280 }), null);
  assert.equal(computeShoulderWidthPixels({ shoulderWidthMetric: 0.3, frameWidthPx: null }), null);
});

test("computeShoulderAngleMetric returns signed shoulder tilt angle", () => {
  const angle = computeShoulderAngleMetric({
    leftShoulder: { x: 0.32, y: 0.4 },
    rightShoulder: { x: 0.68, y: 0.44 }
  });

  assert.equal(angle, 6.3);
});

test("computeShoulderAngleMetric handles missing landmarks", () => {
  assert.equal(computeShoulderAngleMetric({ leftShoulder: { x: 0.3, y: 0.4 }, rightShoulder: null }), null);
  assert.equal(computeShoulderAngleMetric({ leftShoulder: null, rightShoulder: { x: 0.6, y: 0.4 } }), null);
});

test("computeShoulderAngleMetric normalizes flipped shoulder order", () => {
  const angle = computeShoulderAngleMetric({
    leftShoulder: { x: 0.68, y: 0.44 },
    rightShoulder: { x: 0.32, y: 0.4 }
  });

  assert.equal(angle, 6.3);
});

test("computeTorsoRotationMetric returns zero for balanced torso sides", () => {
  const angle = computeTorsoRotationMetric({
    leftShoulder: { x: 0.3, y: 0.3 },
    rightShoulder: { x: 0.7, y: 0.3 },
    leftHip: { x: 0.3, y: 0.7 },
    rightHip: { x: 0.7, y: 0.7 }
  });

  assert.equal(angle, 0);
});

test("computeTorsoRotationMetric returns signed proxy angle", () => {
  const angle = computeTorsoRotationMetric({
    leftShoulder: { x: 0.3, y: 0.3 },
    rightShoulder: { x: 0.7, y: 0.3 },
    leftHip: { x: 0.28, y: 0.7 },
    rightHip: { x: 0.5, y: 0.7 }
  });

  assert.equal(angle, 5);
});

test("computeTorsoRotationMetric handles missing landmarks", () => {
  assert.equal(
    computeTorsoRotationMetric({
      leftShoulder: { x: 0.3, y: 0.3 },
      rightShoulder: { x: 0.7, y: 0.3 },
      leftHip: null,
      rightHip: { x: 0.6, y: 0.7 }
    }),
    null
  );
});

test("computeHandPresenceMetric returns null when no hand fields are provided", () => {
  assert.equal(computeHandPresenceMetric({}), null);
});

test("computeHandPresenceMetric returns half score for single present hand", () => {
  const metric = computeHandPresenceMetric({
    leftHandLandmarks: [
      { x: 0.2, y: 0.2 },
      { x: 0.25, y: 0.3 },
      { x: 0.3, y: 0.35 }
    ],
    rightHandLandmarks: null
  });

  assert.equal(metric, 0.5);
});

test("computeHandPresenceMetric returns full score for both hands", () => {
  const metric = computeHandPresenceMetric({
    leftHandLandmarks: [
      { x: 0.2, y: 0.2 },
      { x: 0.25, y: 0.3 },
      { x: 0.3, y: 0.35 }
    ],
    rightHandLandmarks: [
      { x: 0.6, y: 0.2 },
      { x: 0.65, y: 0.3 },
      { x: 0.7, y: 0.35 }
    ]
  });

  assert.equal(metric, 1);
});

test("computeHandPresenceMetric ignores malformed landmark sets", () => {
  const metric = computeHandPresenceMetric({
    leftHandLandmarks: [{ x: Number.NaN, y: 0.2 }],
    rightHandLandmarks: []
  });

  assert.equal(metric, 0);
});

test("computeTorsoHeightMetric returns normalized torso distance", () => {
  const metric = computeTorsoHeightMetric({
    leftShoulder: { x: 0.3, y: 0.32 },
    rightShoulder: { x: 0.62, y: 0.34 },
    leftHip: { x: 0.36, y: 0.67 },
    rightHip: { x: 0.58, y: 0.69 }
  });

  assert.equal(metric, 0.35);
});

test("computeTorsoHeightMetric handles missing landmarks", () => {
  assert.equal(
    computeTorsoHeightMetric({
      leftShoulder: { x: 0.3, y: 0.3 },
      rightShoulder: { x: 0.6, y: 0.3 },
      leftHip: null,
      rightHip: { x: 0.58, y: 0.68 }
    }),
    null
  );
});

test("computeTorsoHeightPixels converts normalized metric", () => {
  const pixels = computeTorsoHeightPixels({
    torsoHeightMetric: 0.352,
    frameHeightPx: 720
  });

  assert.equal(pixels, 253);
});

test("computeTorsoHeightPixels returns null for invalid input", () => {
  assert.equal(computeTorsoHeightPixels({ torsoHeightMetric: null, frameHeightPx: 720 }), null);
  assert.equal(computeTorsoHeightPixels({ torsoHeightMetric: 0.3, frameHeightPx: null }), null);
});

test("computeBodyCenterMetric returns normalized center point", () => {
  const center = computeBodyCenterMetric({
    leftShoulder: { x: 0.3, y: 0.3 },
    rightShoulder: { x: 0.7, y: 0.31 },
    leftHip: { x: 0.34, y: 0.68 },
    rightHip: { x: 0.66, y: 0.69 }
  });

  assert.deepEqual(center, { x: 0.5, y: 0.495 });
});

test("computeBodyCenterMetric handles missing landmarks", () => {
  assert.equal(
    computeBodyCenterMetric({
      leftShoulder: { x: 0.3, y: 0.3 },
      rightShoulder: { x: 0.7, y: 0.31 },
      leftHip: null,
      rightHip: { x: 0.66, y: 0.69 }
    }),
    null
  );
});

test("computeBodyCenterPixels converts normalized center to pixels", () => {
  const centerPx = computeBodyCenterPixels({
    bodyCenterMetric: { x: 0.5, y: 0.495 },
    frameWidthPx: 1280,
    frameHeightPx: 720
  });

  assert.deepEqual(centerPx, { x: 640, y: 356 });
});

test("computeBodyCenterPixels returns null for invalid input", () => {
  assert.equal(computeBodyCenterPixels({ bodyCenterMetric: null, frameWidthPx: 1280, frameHeightPx: 720 }), null);
  assert.equal(
    computeBodyCenterPixels({ bodyCenterMetric: { x: 0.5, y: 0.5 }, frameWidthPx: null, frameHeightPx: 720 }),
    null
  );
});
