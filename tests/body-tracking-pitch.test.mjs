// Phase 6.2 — mock-camera pitch sweep.
// Drives `computeBodyPitch` with a synthesized 30-frame "lean forward" sequence
// and asserts the same monotonic-rotation contract that the yaw test enforces.
// This is the regression guard for the GLB's X-axis lean (Iron Man suit).

import assert from "node:assert/strict";
import test from "node:test";

import { computeBodyPitch } from "../app/mirror/body-metrics.js";

const FRAMES = 30;

function frame(t, leanAmount) {
  // Shoulders translate from upright (z≈ 0) → leaned forward (z=-leanAmount).
  // Hips stay put. Y values constant so torso length is stable.
  // Phase 7.91: shoulders & hips share the same baseline z (-0.05) so frame-0
  // reads as upright (zDelta=0 → pitch=0). Lean adds to shoulder z— negative
  // for forward, positive for back.
  const sz = -0.05 - t * leanAmount;
  return {
    leftShoulder:  { x: 0.4, y: 0.30, z: sz, visibility: 0.9 },
    rightShoulder: { x: 0.6, y: 0.30, z: sz, visibility: 0.9 },
    leftHip:  { x: 0.42, y: 0.60, z: -0.05, visibility: 0.9 },
    rightHip: { x: 0.58, y: 0.60, z: -0.05, visibility: 0.9 },
  };
}

test("mock-camera: 30-frame forward-lean sequence drives monotonic pitch", () => {
  const pitches = [];
  for (let i = 0; i < FRAMES; i++) {
    const t = i / (FRAMES - 1);
    pitches.push(computeBodyPitch(frame(t, 0.4)));
  }
  assert.ok(Math.abs(pitches[0]) < 1e-6, `frame 0 should be ~0, got ${pitches[0]}`);
  assert.ok(pitches[FRAMES - 1] > 0.5, `final pitch too small: ${pitches[FRAMES - 1]}`);
  for (let i = 1; i < FRAMES; i++) {
    assert.ok(
      pitches[i] >= pitches[i - 1] - 1e-9,
      `pitch decreased at frame ${i}: ${pitches[i - 1]} → ${pitches[i]}`,
    );
  }
});

test("mock-camera: 30-frame back-lean sequence drives monotonic negative pitch", () => {
  const pitches = [];
  for (let i = 0; i < FRAMES; i++) {
    const t = i / (FRAMES - 1);
    // Negative leanAmount → shoulders move away → pitch goes negative.
    pitches.push(computeBodyPitch(frame(t, -0.4)));
  }
  assert.ok(Math.abs(pitches[0]) < 1e-6);
  assert.ok(pitches[FRAMES - 1] < -0.5, `final pitch should be < -0.5, got ${pitches[FRAMES - 1]}`);
  for (let i = 1; i < FRAMES; i++) {
    assert.ok(pitches[i] <= pitches[i - 1] + 1e-9, `pitch increased at frame ${i}`);
  }
});

test("mock-camera: pitch never exceeds ±π/3 clamp across full sweep", () => {
  for (let i = 0; i < FRAMES; i++) {
    const t = i / (FRAMES - 1);
    // Wildly noisy z to try to break the clamp.
    const f = {
      leftShoulder:  { x: 0.4, y: 0.30, z: -t * 5,  visibility: 0.9 },
      rightShoulder: { x: 0.6, y: 0.30, z: -t * 5,  visibility: 0.9 },
      leftHip:  { x: 0.42, y: 0.305, z: -0.05, visibility: 0.9 },
      rightHip: { x: 0.58, y: 0.305, z: -0.05, visibility: 0.9 },
    };
    const p = computeBodyPitch(f);
    assert.ok(Math.abs(p) <= Math.PI / 3 + 1e-6, `frame ${i} exceeded clamp: ${p}`);
  }
});

test("mirror page wires sp.pitch into model3D.rotation.x (static guard)", async () => {
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const { dirname, resolve } = await import("node:path");
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(
    resolve(__dirname, "../app/mirror/page.tsx"),
    "utf8",
  );
  // Import + smoothing + apply.
  assert.match(src, /from\s+["']\.\/body-metrics(?:\.js)?["']/);
  assert.match(src, /computeBodyPitch\(/);
  assert.match(src, /smoothPos\.current\.pitch\s*=/);
  assert.match(src, /model3D\.rotation\.x\s*=\s*sp\.pitch/);
});
