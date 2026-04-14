import assert from "node:assert/strict";
import test from "node:test";

import { detectLeftSwipeIntent, detectRightSwipeIntent } from "../app/mirror/gesture-intent.js";

test("detectLeftSwipeIntent rejects long-window movement when velocity falls below threshold", () => {
  const result = detectLeftSwipeIntent({
    previousX: 0.8,
    currentX: 0.65,
    deltaTimeMs: 300,
    handPresenceMetric: 1
  });

  assert.equal(result.detected, false);
  assert.equal(result.reason, "velocity-below-threshold");
});

test("detectLeftSwipeIntent detects short-window movement when velocity threshold is met", () => {
  const result = detectLeftSwipeIntent({
    previousX: 0.8,
    currentX: 0.62,
    deltaTimeMs: 100,
    handPresenceMetric: 1
  });

  assert.equal(result.detected, true);
  assert.equal(result.reason, "left-swipe-detected");
});

test("detectRightSwipeIntent rejects long-window movement when velocity falls below threshold", () => {
  const result = detectRightSwipeIntent({
    previousX: 0.25,
    currentX: 0.4,
    deltaTimeMs: 320,
    handPresenceMetric: 1
  });

  assert.equal(result.detected, false);
  assert.equal(result.reason, "velocity-below-threshold");
});

test("detectRightSwipeIntent allows long-window movement with custom velocity threshold", () => {
  const result = detectRightSwipeIntent({
    previousX: 0.25,
    currentX: 0.4,
    deltaTimeMs: 320,
    handPresenceMetric: 1,
    minVelocityX: 0.0004
  });

  assert.equal(result.detected, true);
  assert.equal(result.reason, "right-swipe-detected");
});

test("swipe detectors reject non-positive time windows", () => {
  const left = detectLeftSwipeIntent({
    previousX: 0.8,
    currentX: 0.6,
    deltaTimeMs: 0,
    handPresenceMetric: 1
  });

  const right = detectRightSwipeIntent({
    previousX: 0.2,
    currentX: 0.4,
    deltaTimeMs: -10,
    handPresenceMetric: 1
  });

  assert.equal(left.detected, false);
  assert.equal(left.reason, "invalid-sample");
  assert.equal(right.detected, false);
  assert.equal(right.reason, "invalid-sample");
});
