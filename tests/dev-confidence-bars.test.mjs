import assert from "node:assert/strict";
import test from "node:test";

import { buildDevConfidenceBars } from "../app/mirror/dev-confidence-bars.js";

test("buildDevConfidenceBars creates bars for finite confidence values", () => {
  const bars = buildDevConfidenceBars({
    tracking: 0.81,
    pose: 0.74,
    fallback: 0.52
  });

  assert.equal(bars.length, 3);
  assert.equal(bars[0].label, "Tracking");
  assert.equal(bars[0].percent, 81);
});

test("buildDevConfidenceBars filters null or undefined values", () => {
  const bars = buildDevConfidenceBars({
    tracking: 0.65,
    pose: null,
    fallback: undefined
  });

  assert.equal(bars.length, 1);
  assert.equal(bars[0].key, "tracking");
});

test("buildDevConfidenceBars applies threshold colors", () => {
  const bars = buildDevConfidenceBars({
    tracking: 0.8,
    pose: 0.62,
    fallback: 0.45
  });

  assert.equal(bars[0].color, "#2ecc71");
  assert.equal(bars[1].color, "#f1c40f");
  assert.equal(bars[2].color, "#e74c3c");
});
