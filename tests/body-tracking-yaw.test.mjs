import assert from "node:assert/strict";
import test from "node:test";

import {
  computeShoulderYawRadians,
  computeDepthScale,
} from "../app/mirror/body-metrics.js";

// --- computeShoulderYawRadians ---

test("yaw: facing camera (equal Z) returns 0", () => {
  const yaw = computeShoulderYawRadians({
    leftShoulder: { x: 0.4, y: 0.4, z: 0 },
    rightShoulder: { x: 0.6, y: 0.4, z: 0 },
  });
  assert.equal(yaw, 0);
});

test("yaw: turning left (left shoulder back) gives positive yaw", () => {
  const yaw = computeShoulderYawRadians({
    leftShoulder: { x: 0.4, y: 0.4, z: 0.2 }, // back
    rightShoulder: { x: 0.6, y: 0.4, z: -0.2 }, // forward
  });
  assert.ok(yaw > 0, `expected yaw > 0, got ${yaw}`);
});

test("yaw: turning right (right shoulder back) gives negative yaw", () => {
  const yaw = computeShoulderYawRadians({
    leftShoulder: { x: 0.4, y: 0.4, z: -0.2 },
    rightShoulder: { x: 0.6, y: 0.4, z: 0.2 },
  });
  assert.ok(yaw < 0, `expected yaw < 0, got ${yaw}`);
});

test("yaw: returns 0 when a shoulder is missing", () => {
  assert.equal(
    computeShoulderYawRadians({ leftShoulder: null, rightShoulder: { x: 0.6, y: 0.4, z: 0 } }),
    0
  );
  assert.equal(computeShoulderYawRadians({}), 0);
});

test("yaw: returns 0 on NaN inputs", () => {
  const yaw = computeShoulderYawRadians({
    leftShoulder: { x: NaN, y: 0.4, z: 0.2 },
    rightShoulder: { x: 0.6, y: 0.4, z: 0 },
  });
  assert.equal(yaw, 0);
});

test("yaw: bounded to (-pi/2, pi/2)", () => {
  const yaw = computeShoulderYawRadians({
    leftShoulder: { x: 0.5, y: 0.4, z: 100 },
    rightShoulder: { x: 0.5, y: 0.4, z: -100 },
  });
  assert.ok(yaw > 0 && yaw < Math.PI / 2, `yaw out of bounds: ${yaw}`);
});

// --- computeDepthScale ---

test("depth: at Z=0 returns 1.0", () => {
  const d = computeDepthScale({
    leftShoulder: { x: 0.4, y: 0.4, z: 0 },
    rightShoulder: { x: 0.6, y: 0.4, z: 0 },
  });
  assert.equal(d, 1.0);
});

test("depth: closer (negative Z) > 1", () => {
  const d = computeDepthScale({
    leftShoulder: { x: 0.4, y: 0.4, z: -0.3 },
    rightShoulder: { x: 0.6, y: 0.4, z: -0.3 },
  });
  assert.ok(d > 1.0 && d <= 1.3, `expected (1, 1.3], got ${d}`);
});

test("depth: farther (positive Z) < 1", () => {
  const d = computeDepthScale({
    leftShoulder: { x: 0.4, y: 0.4, z: 0.3 },
    rightShoulder: { x: 0.6, y: 0.4, z: 0.3 },
  });
  assert.ok(d < 1.0 && d >= 0.7, `expected [0.7, 1), got ${d}`);
});

test("depth: clamped to [0.7, 1.3]", () => {
  const dHi = computeDepthScale({
    leftShoulder: { x: 0.4, y: 0.4, z: -10 },
    rightShoulder: { x: 0.6, y: 0.4, z: -10 },
  });
  const dLo = computeDepthScale({
    leftShoulder: { x: 0.4, y: 0.4, z: 10 },
    rightShoulder: { x: 0.6, y: 0.4, z: 10 },
  });
  assert.equal(dHi, 1.3);
  assert.equal(dLo, 0.7);
});

test("depth: missing shoulder → 1.0", () => {
  assert.equal(computeDepthScale({}), 1.0);
});

// --- Phase 3.1: synthetic mock-camera frame sequence ---
// Simulates a person turning their body left over 30 frames.
// Asserts: yaw monotonically increases, depth stays ~constant when only rotating.

test("mock-camera: 30-frame body-turn sequence drives monotonic yaw", () => {
  const frames = 30;
  const yaws = [];
  for (let i = 0; i < frames; i++) {
    const t = i / (frames - 1); // 0 → 1
    // Shoulders rotate around vertical axis; left moves back, right moves forward.
    const lz = t * 0.4;
    const rz = -t * 0.4;
    yaws.push(
      computeShoulderYawRadians({
        leftShoulder: { x: 0.4, y: 0.4, z: lz },
        rightShoulder: { x: 0.6, y: 0.4, z: rz },
      })
    );
  }
  // Frame 0 yaw should be 0; final yaw should be clearly positive.
  assert.equal(yaws[0], 0);
  assert.ok(yaws[frames - 1] > 0.5, `final yaw too small: ${yaws[frames - 1]}`);
  // Monotonic non-decreasing
  for (let i = 1; i < frames; i++) {
    assert.ok(yaws[i] >= yaws[i - 1], `yaw decreased at frame ${i}: ${yaws[i - 1]} → ${yaws[i]}`);
  }
});

test("mock-camera: 30-frame walk-toward sequence drives monotonic depth increase", () => {
  const frames = 30;
  const depths = [];
  for (let i = 0; i < frames; i++) {
    const t = i / (frames - 1);
    const z = 0.5 - t * 1.0; // start far (z=0.5), end close (z=-0.5)
    depths.push(
      computeDepthScale({
        leftShoulder: { x: 0.4, y: 0.4, z },
        rightShoulder: { x: 0.6, y: 0.4, z },
      })
    );
  }
  assert.ok(depths[0] < 1.0);
  assert.ok(depths[frames - 1] > 1.0);
  for (let i = 1; i < frames; i++) {
    assert.ok(depths[i] >= depths[i - 1], `depth decreased at frame ${i}`);
  }
});
