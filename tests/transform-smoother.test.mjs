import { test } from "node:test";
import assert from "node:assert/strict";

import { createTransformSmoother } from "../lib/smooth.ts";

const baseTransform = (overrides = {}) => ({
  position: { x: 0, y: 0, z: 0 },
  scale: 1,
  rotation: { x: 0, y: 0, z: 0 },
  ...overrides
});

test("first push is emitted unchanged (filter primes)", () => {
  const s = createTransformSmoother();
  const t = baseTransform({ position: { x: 1, y: 2, z: 3 }, scale: 1.5 });
  const out = s.push(t);
  assert.deepEqual(out, t);
  // Returned object is a clone, not the same reference.
  assert.notEqual(out, t);
});

test("second push blends toward target proportional to alpha", () => {
  const s = createTransformSmoother({ positionAlpha: 0.5, rotationAlpha: 0.5 });
  s.push(baseTransform({ position: { x: 0, y: 0, z: 0 }, scale: 1 }));
  const out = s.push(baseTransform({ position: { x: 10, y: 20, z: -4 }, scale: 3 }));
  assert.equal(out.position.x, 5);
  assert.equal(out.position.y, 10);
  assert.equal(out.position.z, -2);
  assert.equal(out.scale, 2);
});

test("null input resets filter so next sample primes again", () => {
  const s = createTransformSmoother({ positionAlpha: 0.5 });
  s.push(baseTransform({ position: { x: 0, y: 0, z: 0 } }));
  s.push(baseTransform({ position: { x: 10, y: 0, z: 0 } })); // mid value 5
  assert.equal(s.push(null), null);
  const reprimed = s.push(baseTransform({ position: { x: 100, y: 0, z: 0 } }));
  assert.equal(reprimed.position.x, 100);
});

test("rotation uses shortest arc across ±π wrap", () => {
  const s = createTransformSmoother({ rotationAlpha: 0.5 });
  s.push(baseTransform({ rotation: { x: 0, y: Math.PI - 0.1, z: 0 } }));
  const out = s.push(baseTransform({ rotation: { x: 0, y: -Math.PI + 0.1, z: 0 } }));
  // Shortest arc crosses through ±π, so smoothed value should be NEAR π (not near 0).
  assert.ok(Math.abs(out.rotation.y) > Math.PI - 0.2, `expected near ±π, got ${out.rotation.y}`);
});

test("invalid alpha falls back to defaults; clamp at 1", () => {
  const s = createTransformSmoother({ positionAlpha: -1, rotationAlpha: 999 });
  s.push(baseTransform({ position: { x: 0, y: 0, z: 0 }, rotation: { x: 0, y: 0, z: 0 } }));
  const out = s.push(baseTransform({ position: { x: 100, y: 0, z: 0 }, rotation: { x: 1, y: 0, z: 0 } }));
  // positionAlpha negative → default 0.35 → 100*0.35 = 35
  assert.equal(out.position.x, 35);
  // rotationAlpha 999 clamped to 1 → snaps to target
  assert.equal(out.rotation.x, 1);
});

test("reset() clears prior state same as null push", () => {
  const s = createTransformSmoother({ positionAlpha: 0.5 });
  s.push(baseTransform({ position: { x: 0, y: 0, z: 0 } }));
  s.reset();
  const out = s.push(baseTransform({ position: { x: 50, y: 0, z: 0 } }));
  assert.equal(out.position.x, 50);
});
