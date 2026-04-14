import assert from "node:assert/strict";
import test from "node:test";

import { smoothOverlayRect, smoothScalar } from "../app/mirror/smoothing-utils.js";

test("smoothScalar returns next value when previous is missing", () => {
  const value = smoothScalar(null, 0.8, { alpha: 0.2, min: 0, max: 1 });
  assert.equal(value, 0.8);
});

test("smoothScalar applies exponential smoothing and clamps", () => {
  const value = smoothScalar(0.2, 1.4, { alpha: 0.5, min: 0, max: 1 });
  assert.equal(value, 0.8);
});

test("smoothOverlayRect smooths each dimension", () => {
  const previous = { left: 0.2, top: 0.3, width: 0.4, height: 0.5 };
  const next = { left: 0.6, top: 0.7, width: 0.8, height: 0.9 };

  const smoothed = smoothOverlayRect(previous, next, { alpha: 0.5 });

  assert.ok(Math.abs(smoothed.left - 0.4) < 1e-9);
  assert.ok(Math.abs(smoothed.top - 0.5) < 1e-9);
  assert.ok(Math.abs(smoothed.width - 0.6) < 1e-9);
  assert.ok(Math.abs(smoothed.height - 0.7) < 1e-9);
});

test("smoothOverlayRect clamps invalid ranges", () => {
  const smoothed = smoothOverlayRect(
    { left: 0.95, top: 0.95, width: 0.95, height: 0.95 },
    { left: 1.3, top: -0.4, width: 2.2, height: -1 },
    { alpha: 0.9 }
  );

  assert.ok(smoothed.left <= 1 && smoothed.left >= 0);
  assert.ok(smoothed.top <= 1 && smoothed.top >= 0);
  assert.ok(smoothed.width <= 1 && smoothed.width >= 0.08);
  assert.ok(smoothed.height <= 1 && smoothed.height >= 0.08);
});
