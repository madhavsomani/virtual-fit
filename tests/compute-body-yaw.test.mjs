// Phase 7.88 — guards for computeBodyYaw (Iron Man rotation signal).
//
// Pre-7.88 the inline mirror code computed yaw as:
//   const shoulderZDelta = (ls.z ?? 0) - (rs.z ?? 0);
//   const yawAngle = Math.atan2(shoulderZDelta, Math.max(0.05, Math.abs(rs.x - ls.x)));
//
// The `?? 0` was the bug: when MediaPipe reports missing or zero z (which it
// does on low-confidence frames OR when the user is very close to the camera),
// the expression silently produces yaw=0 ("facing camera"). The smoother then
// integrates that lie. Visible failure mode: user turns 45° to the side, z
// confidence dips for two frames, garment snaps back to facing-camera, then
// rubber-bands when z recovers. Breaks the suit illusion at exactly the
// moments rotation is most visible.
//
// computeBodyYaw returns null when the inputs can't yield a real yaw estimate;
// the mirror loop then SKIPS the smoothing update, holding the last good yaw.

import test from "node:test";
import assert from "node:assert/strict";
import { computeBodyYaw } from "../app/mirror/body-metrics.js";

const VIS_OK = 0.9;

function shoulder(x, y, z, visibility = VIS_OK) {
  return { x, y, z, visibility };
}

test("computeBodyYaw: facing camera (z-symmetric) returns ~0 radians", () => {
  const yaw = computeBodyYaw({
    leftShoulder: shoulder(0.4, 0.4, -0.1),
    rightShoulder: shoulder(0.6, 0.4, -0.1),
  });
  assert.ok(yaw !== null);
  assert.ok(Math.abs(yaw) < 0.05, `expected near-zero yaw when shoulders symmetric in z, got ${yaw}`);
});

test("computeBodyYaw: turning right (left shoulder back, right forward) returns positive yaw", () => {
  // Left shoulder z = +0.15 (further from camera), right z = -0.15 (closer).
  // ls.z - rs.z = +0.30 → atan2(+0.30, 0.20) > 0.
  const yaw = computeBodyYaw({
    leftShoulder: shoulder(0.4, 0.4, 0.15),
    rightShoulder: shoulder(0.6, 0.4, -0.15),
  });
  assert.ok(yaw !== null);
  assert.ok(yaw > 0, `expected positive yaw when left shoulder is further (z+), got ${yaw}`);
});

test("computeBodyYaw: turning left (right shoulder back, left forward) returns negative yaw", () => {
  const yaw = computeBodyYaw({
    leftShoulder: shoulder(0.4, 0.4, -0.15),
    rightShoulder: shoulder(0.6, 0.4, 0.15),
  });
  assert.ok(yaw !== null);
  assert.ok(yaw < 0, `expected negative yaw when right shoulder is further (z+), got ${yaw}`);
});

test("computeBodyYaw: returns NULL when shoulders missing (do not fabricate facing-camera)", () => {
  // The whole point of the function: the previous inline code returned 0
  // (facing camera) on missing data, which is a LIE that gets smoothed in.
  // Now we return null so the caller can skip the smoothing update.
  assert.equal(computeBodyYaw({}), null);
  assert.equal(computeBodyYaw({ leftShoulder: shoulder(0.4, 0.4, 0) }), null);
  assert.equal(computeBodyYaw({ rightShoulder: shoulder(0.6, 0.4, 0) }), null);
});

test("computeBodyYaw: returns NULL when shoulder visibility below threshold", () => {
  const yaw = computeBodyYaw({
    leftShoulder: shoulder(0.4, 0.4, 0.1, 0.3),
    rightShoulder: shoulder(0.6, 0.4, -0.1, 0.9),
  });
  assert.equal(yaw, null, "low-vis shoulder must invalidate yaw, not silently lie");
});

test("computeBodyYaw: returns NULL when both z values are exactly 0 (MediaPipe sentinel)", () => {
  // MediaPipe sometimes emits z=0 for both shoulders when its depth solver
  // has no signal (e.g. user just walked into frame). Pre-7.88 this produced
  // yaw=0 ("facing camera"); now it produces null so the smoother holds the
  // last real value.
  const yaw = computeBodyYaw({
    leftShoulder: shoulder(0.4, 0.4, 0),
    rightShoulder: shoulder(0.6, 0.4, 0),
  });
  assert.equal(yaw, null);
});

test("computeBodyYaw: one z=0 and other z≠0 IS a valid signal (do not over-reject)", () => {
  // Defensive sanity: only the BOTH-zero case is the sentinel. If one
  // shoulder reports a real z and the other reports 0, that's still a
  // computable yaw (albeit weaker confidence).
  const yaw = computeBodyYaw({
    leftShoulder: shoulder(0.4, 0.4, 0.2),
    rightShoulder: shoulder(0.6, 0.4, 0),
  });
  assert.ok(yaw !== null, "single-zero z should still produce a real yaw");
  assert.ok(yaw > 0, "ls.z=+0.2, rs.z=0 → ls is further → positive yaw");
});

test("computeBodyYaw: returns NULL when shoulders are stacked in X (profile-on, atan2 noise)", () => {
  // When user turns nearly fully sideways, shoulders project to almost the
  // same x. The atan2(zDelta, near-zero-x) becomes hyper-sensitive — a
  // tiny z noise produces a huge yaw spike. Skip the frame.
  const yaw = computeBodyYaw({
    leftShoulder: shoulder(0.499, 0.4, 0.2),
    rightShoulder: shoulder(0.501, 0.4, -0.2),
  });
  assert.equal(yaw, null, "shoulders stacked in x (profile-on) must skip, not spike");
});

test("computeBodyYaw: returns NULL when z is non-finite (NaN/Infinity)", () => {
  assert.equal(
    computeBodyYaw({
      leftShoulder: shoulder(0.4, 0.4, NaN),
      rightShoulder: shoulder(0.6, 0.4, -0.1),
    }),
    null,
  );
  assert.equal(
    computeBodyYaw({
      leftShoulder: shoulder(0.4, 0.4, 0.1),
      rightShoulder: shoulder(0.6, 0.4, Infinity),
    }),
    null,
  );
});

test("computeBodyYaw: clamps to ±π/2 to avoid wild values from noisy z", () => {
  // Even with absurdly large z-delta (which MediaPipe shouldn't produce but
  // can briefly during occlusion recovery), we cap at ±90° because beyond
  // that a 3D garment hits self-occlusion ugliness.
  const yaw = computeBodyYaw({
    leftShoulder: shoulder(0.4, 0.4, 5.0),
    rightShoulder: shoulder(0.6, 0.4, -5.0),
  });
  assert.ok(yaw !== null);
  assert.ok(yaw <= Math.PI / 2 + 1e-9, `must clamp to +π/2, got ${yaw}`);
});

test("computeBodyYaw: minVisibility threshold is configurable", () => {
  // Default is 0.5; allow caller to lower it for noisier sources.
  const lowVis = {
    leftShoulder: shoulder(0.4, 0.4, 0.1, 0.3),
    rightShoulder: shoulder(0.6, 0.4, -0.1, 0.3),
  };
  assert.equal(computeBodyYaw(lowVis), null, "default minVisibility=0.5 rejects 0.3");
  assert.ok(computeBodyYaw({ ...lowVis, minVisibility: 0.2 }) !== null, "lowered threshold accepts 0.3");
});
