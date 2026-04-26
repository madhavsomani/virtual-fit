// Phase 7.89 — guards for computeDepthScaleStrict (closer→bigger garment).
//
// Sibling bug to Phase 7.88's yaw rubber-banding. The pre-7.89 inline mirror
// code computed depth as:
//   const avgShoulderZ = ((ls.z ?? 0) + (rs.z ?? 0)) / 2;
//   const depthScale = 1.0 - (avgShoulderZ * 0.4);
//   const clampedDepth = Math.max(0.7, Math.min(1.3, depthScale));
//
// Same `?? 0` lie: when MediaPipe z confidence dips, avgZ collapses to 0 and
// depthScale collapses to 1.0 ("neutral distance"). Smoother integrates that
// into the rendered scale → garment "breathes" (shrinks toward neutral on
// each z-dip, rubber-bands back when z recovers).
//
// computeDepthScaleStrict returns null when inputs can't yield a real estimate;
// the mirror loop SKIPS the smoother update on null and holds the last good
// scale.

import test from "node:test";
import assert from "node:assert/strict";
import { computeDepthScaleStrict } from "../app/mirror/body-metrics.js";

const VIS_OK = 0.9;

function shoulder(x, y, z, visibility = VIS_OK) {
  return { x, y, z, visibility };
}

test("computeDepthScaleStrict: neutral distance (z=0 on one shoulder, real z on other) returns near 1.0", () => {
  // Single-zero z is still a valid signal (defensive sanity check parallel to
  // computeBodyYaw's behaviour). Average z = 0.05; scale = 1 - 0.05*0.4 = 0.98.
  const d = computeDepthScaleStrict({
    leftShoulder: shoulder(0.4, 0.4, 0.1),
    rightShoulder: shoulder(0.6, 0.4, 0),
  });
  assert.ok(d !== null);
  assert.ok(Math.abs(d - 0.98) < 1e-6, `expected ~0.98, got ${d}`);
});

test("computeDepthScaleStrict: closer to camera (negative z) returns scale > 1.0", () => {
  const d = computeDepthScaleStrict({
    leftShoulder: shoulder(0.4, 0.4, -0.5),
    rightShoulder: shoulder(0.6, 0.4, -0.5),
  });
  assert.ok(d !== null);
  assert.ok(d > 1.0, `expected >1.0 when shoulders are close to camera (z<0), got ${d}`);
});

test("computeDepthScaleStrict: further from camera (positive z) returns scale < 1.0", () => {
  const d = computeDepthScaleStrict({
    leftShoulder: shoulder(0.4, 0.4, 0.5),
    rightShoulder: shoulder(0.6, 0.4, 0.5),
  });
  assert.ok(d !== null);
  assert.ok(d < 1.0, `expected <1.0 when shoulders are far (z>0), got ${d}`);
});

test("computeDepthScaleStrict: returns NULL when shoulders missing (do not fabricate neutral)", () => {
  // The whole point of the function: previous inline code returned 1.0 on
  // missing data, which is a LIE the smoother integrated. Now null → caller
  // skips the update.
  assert.equal(computeDepthScaleStrict({}), null);
  assert.equal(computeDepthScaleStrict({ leftShoulder: shoulder(0.4, 0.4, -0.1) }), null);
  assert.equal(computeDepthScaleStrict({ rightShoulder: shoulder(0.6, 0.4, -0.1) }), null);
});

test("computeDepthScaleStrict: returns NULL when shoulder visibility below threshold", () => {
  const d = computeDepthScaleStrict({
    leftShoulder: shoulder(0.4, 0.4, -0.1, 0.3),
    rightShoulder: shoulder(0.6, 0.4, -0.1, 0.9),
  });
  assert.equal(d, null);
});

test("computeDepthScaleStrict: returns NULL when both z values are exactly 0 (MediaPipe sentinel)", () => {
  // The breathing failure mode lives here: MediaPipe sometimes emits z=0 on
  // both shoulders when its depth solver has no signal. Pre-7.89 this gave
  // scale=1.0 (neutral lie); now null so smoother holds the real value.
  const d = computeDepthScaleStrict({
    leftShoulder: shoulder(0.4, 0.4, 0),
    rightShoulder: shoulder(0.6, 0.4, 0),
  });
  assert.equal(d, null);
});

test("computeDepthScaleStrict: returns NULL when z is non-finite (NaN/Infinity)", () => {
  assert.equal(
    computeDepthScaleStrict({
      leftShoulder: shoulder(0.4, 0.4, NaN),
      rightShoulder: shoulder(0.6, 0.4, -0.1),
    }),
    null,
  );
  assert.equal(
    computeDepthScaleStrict({
      leftShoulder: shoulder(0.4, 0.4, -0.1),
      rightShoulder: shoulder(0.6, 0.4, Infinity),
    }),
    null,
  );
});

test("computeDepthScaleStrict: clamps to default [0.7, 1.3] range", () => {
  // Even with a wildly negative z (which MediaPipe shouldn't produce but can
  // briefly during occlusion recovery), we cap at 1.3 because beyond that
  // the garment scale becomes implausibly large vs. the body it overlays.
  const big = computeDepthScaleStrict({
    leftShoulder: shoulder(0.4, 0.4, -10),
    rightShoulder: shoulder(0.6, 0.4, -10),
  });
  assert.equal(big, 1.3);
  const tiny = computeDepthScaleStrict({
    leftShoulder: shoulder(0.4, 0.4, 10),
    rightShoulder: shoulder(0.6, 0.4, 10),
  });
  assert.equal(tiny, 0.7);
});

test("computeDepthScaleStrict: sensitivity, minScale, maxScale are configurable", () => {
  // Allow callers to tune without re-implementing the formula. Pre-7.89 the
  // 0.4 / 0.7 / 1.3 magic numbers were inline in mirror/page.tsx with no
  // way to tune for, say, a wider-FOV camera or a kids'-mode that wants
  // more pronounced depth effect.
  const d = computeDepthScaleStrict({
    leftShoulder: shoulder(0.4, 0.4, -0.5),
    rightShoulder: shoulder(0.6, 0.4, -0.5),
    sensitivity: 1.0,
    minScale: 0.5,
    maxScale: 2.0,
  });
  // raw = 1 - (-0.5)*1.0 = 1.5, within [0.5, 2.0]
  assert.equal(d, 1.5);
});

test("computeDepthScaleStrict: minVisibility threshold is configurable", () => {
  const lowVis = {
    leftShoulder: shoulder(0.4, 0.4, -0.1, 0.3),
    rightShoulder: shoulder(0.6, 0.4, -0.1, 0.3),
  };
  assert.equal(computeDepthScaleStrict(lowVis), null, "default minVisibility=0.5 rejects 0.3");
  assert.ok(computeDepthScaleStrict({ ...lowVis, minVisibility: 0.2 }) !== null);
});
