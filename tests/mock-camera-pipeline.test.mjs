/**
 * Test suite: Mock camera → pose → garment/armor overlay pipeline.
 *
 * Tests clothes and 3D objects on torso/chest using the mock camera system
 * instead of a real webcam. Covers:
 * - Armor transform computation from mock poses
 * - Garment loading + normalization with mock pose data
 * - Calibration gate with all mock scenarios
 * - Tracking gate (lock/unlock) with pose sequences
 * - Full pipeline: mock camera → pose → calibration → transform → overlay
 */
import assert from "node:assert/strict";
import test from "node:test";

import {
  MOCK_POSES,
  LANDMARK_INDICES as LM,
  createMockPoseTracker,
  createMockVideoElement,
  createWalkInOutSequence,
} from "../lib/mock-camera.mjs";
import { computeArmorTransform } from "../lib/armor.ts";
import { computeCalibration } from "../lib/calibration.ts";
import { computeHelmetTransform } from "../lib/helmet.ts";
import { computeBicepTransforms } from "../lib/bicep.ts";
import { computeShoulderPadTransforms } from "../lib/shoulder-pad.ts";
import { computeGauntletTransforms } from "../lib/gauntlet.ts";
import { createTrackingGate } from "../lib/tracking-gate.ts";
import { createTransformSmoother } from "../lib/smooth.ts";
import { normalizeGlb, computeNormalizeScale } from "../lib/glb-normalize.ts";

// ─── Mock Pose Provider Tests ───────────────────────────────────────────

test("MOCK_POSES.standing_front has 33 landmarks with high visibility", () => {
  const pose = MOCK_POSES.standing_front;
  assert.equal(pose.length, 33);
  // Key torso landmarks should have high visibility
  assert.ok(pose[LM.LEFT_SHOULDER].visibility > 0.9);
  assert.ok(pose[LM.RIGHT_SHOULDER].visibility > 0.9);
  assert.ok(pose[LM.LEFT_HIP].visibility > 0.9);
  assert.ok(pose[LM.RIGHT_HIP].visibility > 0.9);
});

test("MOCK_POSES.standing_front shoulders are centered and properly spaced", () => {
  const pose = MOCK_POSES.standing_front;
  const ls = pose[LM.LEFT_SHOULDER];
  const rs = pose[LM.RIGHT_SHOULDER];
  const midX = (ls.x + rs.x) / 2;
  const span = Math.abs(rs.x - ls.x);
  assert.ok(Math.abs(midX - 0.5) < 0.1, `shoulder midpoint should be ~0.5, got ${midX}`);
  assert.ok(span > 0.15 && span < 0.5, `shoulder span should be 0.15-0.5, got ${span}`);
});

test("MOCK_POSES.no_person returns null", () => {
  assert.equal(MOCK_POSES.no_person, null);
});

test("MOCK_POSES covers all 8 test scenarios", () => {
  const keys = Object.keys(MOCK_POSES);
  assert.ok(keys.length >= 8, `expected ≥8 poses, got ${keys.length}`);
  assert.ok(keys.includes("standing_front"));
  assert.ok(keys.includes("arms_up"));
  assert.ok(keys.includes("turned_left"));
  assert.ok(keys.includes("too_close"));
  assert.ok(keys.includes("too_far"));
  assert.ok(keys.includes("off_center_left"));
  assert.ok(keys.includes("chest_up_only"));
  assert.ok(keys.includes("no_person"));
});

// ─── Mock Pose Tracker Tests ────────────────────────────────────────────

test("createMockPoseTracker returns landmarks from a static pose", () => {
  const tracker = createMockPoseTracker(MOCK_POSES.standing_front);
  const video = createMockVideoElement();
  const result = tracker.detect(video, 1000);
  assert.ok(result.landmarks);
  assert.equal(result.landmarks.length, 33);
  assert.equal(tracker.frameCount, 1);
});

test("createMockPoseTracker cycles through pose sequences", () => {
  const sequence = [MOCK_POSES.standing_front, MOCK_POSES.arms_up];
  const tracker = createMockPoseTracker(sequence);
  const video = createMockVideoElement();

  const r1 = tracker.detect(video, 1000);
  const r2 = tracker.detect(video, 2000);
  const r3 = tracker.detect(video, 3000);

  // Frame 0 = standing, Frame 1 = arms_up, Frame 2 = standing (cycles)
  assert.equal(r1.landmarks[LM.LEFT_ELBOW].y, MOCK_POSES.standing_front[LM.LEFT_ELBOW].y);
  assert.equal(r2.landmarks[LM.LEFT_ELBOW].y, MOCK_POSES.arms_up[LM.LEFT_ELBOW].y);
  assert.equal(r3.landmarks[LM.LEFT_ELBOW].y, MOCK_POSES.standing_front[LM.LEFT_ELBOW].y);
});

test("createMockPoseTracker returns null after close()", () => {
  const tracker = createMockPoseTracker(MOCK_POSES.standing_front);
  const video = createMockVideoElement();
  tracker.close();
  const result = tracker.detect(video, 1000);
  assert.equal(result.landmarks, null);
  assert.equal(tracker.isClosed, true);
});

test("createMockPoseTracker accepts a function for dynamic poses", () => {
  const tracker = createMockPoseTracker((_ts, frame) => {
    if (frame < 3) return MOCK_POSES.standing_front;
    return null;
  });
  const video = createMockVideoElement();

  assert.ok(tracker.detect(video, 100).landmarks);  // frame 0
  assert.ok(tracker.detect(video, 200).landmarks);  // frame 1
  assert.ok(tracker.detect(video, 300).landmarks);  // frame 2
  assert.equal(tracker.detect(video, 400).landmarks, null); // frame 3
});

// ─── Armor on Torso (with Mock Poses) ───────────────────────────────────

test("standing_front pose produces valid torso armor transform", () => {
  const result = computeArmorTransform(MOCK_POSES.standing_front);
  assert.ok(result, "should produce a transform for a good pose");
  assert.ok(result.confidence > 0.7, `confidence should be >0.7, got ${result.confidence}`);
  assert.ok(result.scale > 0, "scale must be positive");
  // Position should be roughly centered (normalized 0..1 space)
  assert.ok(result.position.x > 0.3 && result.position.x < 0.7,
    `x should be centered, got ${result.position.x}`);
});

test("arms_up pose still produces valid torso armor", () => {
  const result = computeArmorTransform(MOCK_POSES.arms_up);
  assert.ok(result, "arms_up should still anchor torso armor");
  assert.ok(result.confidence > 0.5);
});

test("turned_left pose produces nonzero yaw rotation", () => {
  const result = computeArmorTransform(MOCK_POSES.turned_left);
  assert.ok(result);
  // Turned left should show some yaw
  assert.ok(Math.abs(result.rotation.y) > 0.01,
    `yaw should be nonzero for turned pose, got ${result.rotation.y}`);
});

test("leaning_right pose produces nonzero roll rotation", () => {
  const result = computeArmorTransform(MOCK_POSES.leaning_right);
  assert.ok(result);
  assert.ok(Math.abs(result.rotation.z) > 0.001,
    `roll should be nonzero for leaning pose, got ${result.rotation.z}`);
});

test("chest_up_only pose uses hip-fallback path (lower confidence)", () => {
  const result = computeArmorTransform(MOCK_POSES.chest_up_only);
  assert.ok(result, "should still produce a transform via hip fallback");
  // Hip fallback lowers confidence
  assert.ok(result.confidence < 0.8,
    `confidence should be reduced with hip fallback, got ${result.confidence}`);
});

test("no_person (null landmarks) cannot compute armor transform", () => {
  // computeArmorTransform expects an array, so null input should be
  // caught by calibration gate before reaching the transform.
  // The mock camera system enables this: calibration filters first.
  const cal = computeCalibration(MOCK_POSES.no_person);
  assert.equal(cal.status, "no_pose");
  // In the real pipeline, we never call computeArmorTransform when cal.status !== "ok"
});

// ─── Helmet on Head (with Mock Poses) ───────────────────────────────────

test("standing_front produces valid helmet transform", () => {
  const result = computeHelmetTransform(MOCK_POSES.standing_front);
  assert.ok(result, "should produce helmet transform");
  assert.ok(result.position.y < MOCK_POSES.standing_front[LM.LEFT_SHOULDER].y,
    "helmet should be above shoulders");
});

// ─── Bicep/Shoulder Pad/Gauntlet (with Mock Poses) ──────────────────────

test("standing_front produces valid bicep transforms for both arms", () => {
  const result = computeBicepTransforms(MOCK_POSES.standing_front);
  assert.ok(result.left, "should have left bicep");
  assert.ok(result.right, "should have right bicep");
});

test("standing_front produces valid shoulder pad transforms", () => {
  const result = computeShoulderPadTransforms(MOCK_POSES.standing_front);
  assert.ok(result.left, "should have left shoulder pad");
  assert.ok(result.right, "should have right shoulder pad");
});

test("standing_front produces valid gauntlet transforms", () => {
  const result = computeGauntletTransforms(MOCK_POSES.standing_front);
  assert.ok(result.left, "should have left gauntlet");
  assert.ok(result.right, "should have right gauntlet");
});

// ─── Calibration Gate (with Mock Poses) ─────────────────────────────────

test("standing_front passes calibration (status=ok)", () => {
  const cal = computeCalibration(MOCK_POSES.standing_front);
  assert.equal(cal.status, "ok");
});

test("too_close triggers 'too_close' calibration", () => {
  const cal = computeCalibration(MOCK_POSES.too_close);
  assert.equal(cal.status, "too_close");
});

test("too_far triggers 'too_far' calibration", () => {
  const cal = computeCalibration(MOCK_POSES.too_far);
  assert.equal(cal.status, "too_far");
});

test("off_center_left triggers 'off_center' or 'out_of_frame'", () => {
  const cal = computeCalibration(MOCK_POSES.off_center_left);
  assert.ok(
    cal.status === "off_center" || cal.status === "out_of_frame",
    `expected off_center or out_of_frame, got ${cal.status}`
  );
});

test("no_person triggers 'no_pose' calibration", () => {
  const cal = computeCalibration(MOCK_POSES.no_person);
  assert.equal(cal.status, "no_pose");
});

test("chest_up_only still passes calibration (shoulders visible)", () => {
  const cal = computeCalibration(MOCK_POSES.chest_up_only);
  assert.equal(cal.status, "ok", "chest-up with visible shoulders should calibrate ok");
});

// ─── Tracking Gate (with Mock Pose Sequence) ────────────────────────────

test("tracking gate locks after consistent valid frames", () => {
  const gate = createTrackingGate({ lockFrames: 3, unlockFrames: 3 });
  const tracker = createMockPoseTracker(MOCK_POSES.standing_front);
  const video = createMockVideoElement();

  let phase;
  // Feed 3 valid frames
  for (let i = 0; i < 3; i++) {
    const { landmarks } = tracker.detect(video, i * 33);
    const cal = computeCalibration(landmarks);
    phase = gate.push(cal.status === "ok");
  }

  assert.equal(phase, "locked", "should lock after 3 valid frames");
});

test("tracking gate unlocks after consistent invalid frames", () => {
  const gate = createTrackingGate({ lockFrames: 2, unlockFrames: 3 });

  // Lock first
  gate.push(true);
  gate.push(true);

  // 3 invalid frames to unlock
  gate.push(false);
  gate.push(false);
  const phase = gate.push(false);
  assert.equal(phase, "searching", "should unlock after 3 invalid frames");
});

// ─── Transform Smoother (with Mock Pose Sequence) ───────────────────────

test("smoother reduces jitter across consecutive mock frames", () => {
  const smoother = createTransformSmoother({ alpha: 0.3 });
  const tracker = createMockPoseTracker(MOCK_POSES.standing_front);
  const video = createMockVideoElement();

  const transforms = [];
  for (let i = 0; i < 5; i++) {
    const { landmarks } = tracker.detect(video, i * 33);
    const raw = computeArmorTransform(landmarks);
    if (raw) {
      const smoothed = smoother.push(raw);
      transforms.push(smoothed);
    }
  }

  assert.ok(transforms.length >= 4, "should produce smoothed transforms");
  // Static pose should produce near-identical smoothed outputs
  const first = transforms[0];
  const last = transforms[transforms.length - 1];
  assert.ok(
    Math.abs(first.position.x - last.position.x) < 0.1,
    "smoothed x should converge for static pose"
  );
});

// ─── Walk In/Out Sequence (End-to-End Pipeline) ─────────────────────────

test("walk-in-out sequence: no_pose → ok → no_pose calibration transitions", () => {
  const walkFn = createWalkInOutSequence(3, 5, 3);
  const tracker = createMockPoseTracker(walkFn);
  const video = createMockVideoElement();

  const statuses = [];
  for (let i = 0; i < 15; i++) {
    const { landmarks } = tracker.detect(video, i * 33);
    const cal = computeCalibration(landmarks);
    statuses.push(cal.status);
  }

  // Should start with non-ok (entering), hit ok (standing), end non-ok (exiting/gone)
  assert.ok(
    statuses.some(s => s !== "ok"),
    "should have non-ok frames during enter/exit"
  );
  assert.ok(
    statuses.some(s => s === "ok"),
    "should have ok frames during standing"
  );
  // Last frames should be no_pose (person left)
  assert.equal(statuses[statuses.length - 1], "no_pose", "final frame should be no_pose");
});

// ─── Full Pipeline: Mock Camera → Pose → Transform → Garment-Ready ─────

test("full pipeline: mock camera produces garment-ready armor transforms", () => {
  const tracker = createMockPoseTracker(MOCK_POSES.standing_front);
  const gate = createTrackingGate({ lockFrames: 2 });
  const smoother = createTransformSmoother();
  const video = createMockVideoElement();

  let lastTransform = null;
  let locked = false;

  // Simulate 10 frames
  for (let frame = 0; frame < 10; frame++) {
    const { landmarks } = tracker.detect(video, frame * 33);
    const cal = computeCalibration(landmarks);
    const phase = gate.push(cal.status === "ok");

    if (phase === "locked" && landmarks) {
      const raw = computeArmorTransform(landmarks);
      if (raw) {
        lastTransform = smoother.push(raw);
        locked = true;
      }
    }
  }

  assert.ok(locked, "pipeline should achieve tracking lock");
  assert.ok(lastTransform, "should produce a final transform");
  assert.ok(lastTransform.confidence > 0.5, "transform should have good confidence");
  assert.ok(lastTransform.scale > 0, "transform should have positive scale");

  // This transform is what would drive garment mesh positioning:
  // position → Three.js group.position
  // scale → Three.js group.scale
  // rotation → Three.js group.rotation (Euler)
  assert.ok(Number.isFinite(lastTransform.position.x));
  assert.ok(Number.isFinite(lastTransform.position.y));
  assert.ok(Number.isFinite(lastTransform.rotation.x));
  assert.ok(Number.isFinite(lastTransform.rotation.y));
  assert.ok(Number.isFinite(lastTransform.rotation.z));
});

test("full pipeline: mock garment mesh can be normalized for overlay", async () => {
  // Simulate: load a garment GLB → normalize → position using mock pose transform
  const THREE = await import("three");

  // Create a simple mesh representing a garment
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([
    -0.3, 0.5, 0.05,  0.3, 0.5, 0.05,  0.3, -0.2, 0.05,  // front tri 1
    -0.3, 0.5, 0.05,  0.3, -0.2, 0.05,  -0.3, -0.2, 0.05, // front tri 2
  ], 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(new Float32Array(18), 3));

  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial()));

  // Normalize the garment mesh
  const normalized = normalizeGlb(scene, { targetSize: 1.0 });

  // Get pose transform from mock camera
  const tracker = createMockPoseTracker(MOCK_POSES.standing_front);
  const video = createMockVideoElement();
  const { landmarks } = tracker.detect(video, 0);
  const armorXform = computeArmorTransform(landmarks);

  // Apply pose transform to garment (simulating what the renderer does)
  assert.ok(armorXform);
  normalized.position.set(armorXform.position.x, armorXform.position.y, armorXform.position.z);
  normalized.scale.setScalar(armorXform.scale);

  assert.ok(normalized.position.x > 0, "garment should be positioned in view");
  assert.ok(normalized.scale.x > 0, "garment should have positive scale");
  assert.equal(normalized.frustumCulled, false, "garment should not be frustum culled");
});
