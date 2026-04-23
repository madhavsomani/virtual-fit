// Phase 6.1 — computeBodyPitch unit tests.
import assert from "node:assert/strict";
import test from "node:test";
import { computeBodyPitch } from "../app/mirror/body-metrics.js";

const SHOULDER_L = { x: 0.4, y: 0.30, z: 0,    visibility: 0.9 };
const SHOULDER_R = { x: 0.6, y: 0.30, z: 0,    visibility: 0.9 };
const HIP_L      = { x: 0.42, y: 0.60, z: 0,   visibility: 0.9 };
const HIP_R      = { x: 0.58, y: 0.60, z: 0,   visibility: 0.9 };

test("upright: pitch ≈ 0", () => {
  const p = computeBodyPitch({
    leftShoulder: SHOULDER_L, rightShoulder: SHOULDER_R,
    leftHip: HIP_L, rightHip: HIP_R,
  });
  assert.ok(p !== null);
  assert.ok(Math.abs(p) < 0.01, `expected near 0, got ${p}`);
});

test("leaning forward: shoulders closer to camera → positive pitch", () => {
  const p = computeBodyPitch({
    leftShoulder:  { ...SHOULDER_L, z: -0.20 },
    rightShoulder: { ...SHOULDER_R, z: -0.20 },
    leftHip: HIP_L, rightHip: HIP_R,
  });
  assert.ok(p > 0.3, `expected forward lean > 0.3 rad, got ${p}`);
});

test("leaning back: shoulders farther from camera → negative pitch", () => {
  const p = computeBodyPitch({
    leftShoulder:  { ...SHOULDER_L, z: 0.20 },
    rightShoulder: { ...SHOULDER_R, z: 0.20 },
    leftHip: HIP_L, rightHip: HIP_R,
  });
  assert.ok(p < -0.3, `expected back lean < -0.3 rad, got ${p}`);
});

test("missing hips: graceful 0 fallback (no crash)", () => {
  const p = computeBodyPitch({
    leftShoulder: { ...SHOULDER_L, z: -0.2 },
    rightShoulder: { ...SHOULDER_R, z: -0.2 },
  });
  assert.equal(p, 0);
});

test("low-visibility shoulders → null", () => {
  const p = computeBodyPitch({
    leftShoulder:  { ...SHOULDER_L, visibility: 0.2 },
    rightShoulder: SHOULDER_R,
    leftHip: HIP_L, rightHip: HIP_R,
  });
  assert.equal(p, null);
});

test("low-visibility hips → 0 (treat as no torso reference)", () => {
  const p = computeBodyPitch({
    leftShoulder: { ...SHOULDER_L, z: -0.3 },
    rightShoulder: { ...SHOULDER_R, z: -0.3 },
    leftHip: { ...HIP_L, visibility: 0.1 },
    rightHip: HIP_R,
  });
  assert.equal(p, 0);
});

test("clamped at ±60° for extreme noise", () => {
  const p = computeBodyPitch({
    leftShoulder:  { ...SHOULDER_L, z: -10, y: 0.30 },
    rightShoulder: { ...SHOULDER_R, z: -10, y: 0.30 },
    leftHip:  { ...HIP_L, y: 0.31 },
    rightHip: { ...HIP_R, y: 0.31 },
  });
  assert.ok(Math.abs(p) <= Math.PI / 3 + 1e-6);
});

test("custom minVisibility threshold honored", () => {
  const p = computeBodyPitch({
    leftShoulder:  { ...SHOULDER_L, visibility: 0.6 },
    rightShoulder: { ...SHOULDER_R, visibility: 0.6 },
    leftHip: HIP_L, rightHip: HIP_R,
    minVisibility: 0.7,
  });
  assert.equal(p, null);
});
