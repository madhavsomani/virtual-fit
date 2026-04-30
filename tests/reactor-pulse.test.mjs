import { test } from "node:test";
import assert from "node:assert/strict";

import { reactorPulse } from "../lib/reactor-pulse.ts";

test("at t=0 returns the floor (cos=1)", () => {
  assert.equal(reactorPulse(0), 0.6);
});

test("at half period returns the ceiling (cos=-1)", () => {
  assert.ok(Math.abs(reactorPulse(700) - 1.3) < 1e-9);
});

test("output stays inside [lo, hi] for many samples", () => {
  for (let t = 0; t < 5000; t += 11) {
    const v = reactorPulse(t);
    assert.ok(v >= 0.6 - 1e-9 && v <= 1.3 + 1e-9);
  }
});

test("custom min/max respected", () => {
  assert.ok(Math.abs(reactorPulse(500, { periodMs: 1000, minIntensity: 0, maxIntensity: 2 }) - 2) < 1e-9);
  assert.ok(Math.abs(reactorPulse(0, { periodMs: 1000, minIntensity: 0, maxIntensity: 2 }) - 0) < 1e-9);
});

test("non-finite t falls back to midpoint", () => {
  assert.ok(Math.abs(reactorPulse(NaN) - (0.6 + 1.3) / 2) < 1e-9);
});

test("zero period falls back to midpoint", () => {
  assert.ok(Math.abs(reactorPulse(100, { periodMs: 0 }) - (0.6 + 1.3) / 2) < 1e-9);
});
