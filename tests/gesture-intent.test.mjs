import assert from "node:assert/strict";
import test from "node:test";

import {
  detectAccidentalGestureSuppression,
  detectGestureCooldownWindow,
  detectLeftSwipeIntent,
  detectLostHandsRecovery,
  detectLostPoseRecovery,
  detectRightSwipeIntent
} from "../app/mirror/gesture-intent.js";

test("detectLeftSwipeIntent returns detected=true for fast left movement", () => {
  const result = detectLeftSwipeIntent({
    previousX: 0.72,
    currentX: 0.54,
    deltaTimeMs: 90,
    handPresenceMetric: 1
  });

  assert.equal(result.detected, true);
  assert.equal(result.reason, "left-swipe-detected");
});

test("detectLeftSwipeIntent rejects rightward movement", () => {
  const result = detectLeftSwipeIntent({
    previousX: 0.4,
    currentX: 0.55,
    deltaTimeMs: 80,
    handPresenceMetric: 1
  });

  assert.equal(result.detected, false);
  assert.equal(result.reason, "not-left-direction");
});

test("detectLeftSwipeIntent rejects small distance movement", () => {
  const result = detectLeftSwipeIntent({
    previousX: 0.62,
    currentX: 0.56,
    deltaTimeMs: 50,
    handPresenceMetric: 1
  });

  assert.equal(result.detected, false);
  assert.equal(result.reason, "distance-below-threshold");
});

test("detectLeftSwipeIntent rejects low hand presence", () => {
  const result = detectLeftSwipeIntent({
    previousX: 0.7,
    currentX: 0.5,
    deltaTimeMs: 80,
    handPresenceMetric: 0
  });

  assert.equal(result.detected, false);
  assert.equal(result.reason, "insufficient-hand-presence");
});

test("detectLeftSwipeIntent rejects invalid sample values", () => {
  const result = detectLeftSwipeIntent({
    previousX: null,
    currentX: 0.5,
    deltaTimeMs: 80,
    handPresenceMetric: 1
  });

  assert.equal(result.detected, false);
  assert.equal(result.reason, "invalid-sample");
});

test("detectRightSwipeIntent returns detected=true for fast right movement", () => {
  const result = detectRightSwipeIntent({
    previousX: 0.35,
    currentX: 0.58,
    deltaTimeMs: 90,
    handPresenceMetric: 1
  });

  assert.equal(result.detected, true);
  assert.equal(result.reason, "right-swipe-detected");
});

test("detectRightSwipeIntent rejects leftward movement", () => {
  const result = detectRightSwipeIntent({
    previousX: 0.7,
    currentX: 0.5,
    deltaTimeMs: 80,
    handPresenceMetric: 1
  });

  assert.equal(result.detected, false);
  assert.equal(result.reason, "not-right-direction");
});

test("detectRightSwipeIntent rejects low hand presence", () => {
  const result = detectRightSwipeIntent({
    previousX: 0.3,
    currentX: 0.6,
    deltaTimeMs: 80,
    handPresenceMetric: 0
  });

  assert.equal(result.detected, false);
  assert.equal(result.reason, "insufficient-hand-presence");
});

test("detectAccidentalGestureSuppression suppresses conflicting directions", () => {
  const result = detectAccidentalGestureSuppression({
    leftIntentDetected: true,
    rightIntentDetected: true,
    handPresenceMetric: 1,
    velocityX: 0.002,
    deltaTimeMs: 80
  });

  assert.equal(result.suppressed, true);
  assert.equal(result.reason, "conflicting-directions");
});

test("detectAccidentalGestureSuppression suppresses velocity spikes", () => {
  const result = detectAccidentalGestureSuppression({
    leftIntentDetected: true,
    rightIntentDetected: false,
    handPresenceMetric: 1,
    velocityX: -0.05,
    deltaTimeMs: 90
  });

  assert.equal(result.suppressed, true);
  assert.equal(result.reason, "velocity-spike");
});

test("detectAccidentalGestureSuppression accepts stable intent", () => {
  const result = detectAccidentalGestureSuppression({
    leftIntentDetected: false,
    rightIntentDetected: true,
    handPresenceMetric: 1,
    velocityX: 0.003,
    deltaTimeMs: 90
  });

  assert.equal(result.suppressed, false);
  assert.equal(result.reason, "intent-accepted");
});

test("detectGestureCooldownWindow returns active when cooldown has not elapsed", () => {
  const result = detectGestureCooldownWindow({
    lastGestureAtMs: 1200,
    nowMs: 1600,
    cooldownMs: 700
  });

  assert.equal(result.inCooldown, true);
  assert.equal(result.reason, "cooldown-active");
  assert.equal(result.remainingMs, 300);
});

test("detectGestureCooldownWindow returns complete when cooldown elapsed", () => {
  const result = detectGestureCooldownWindow({
    lastGestureAtMs: 1200,
    nowMs: 1901,
    cooldownMs: 700
  });

  assert.equal(result.inCooldown, false);
  assert.equal(result.reason, "cooldown-complete");
  assert.equal(result.remainingMs, 0);
});

test("detectGestureCooldownWindow handles missing prior gesture", () => {
  const result = detectGestureCooldownWindow({
    lastGestureAtMs: null,
    nowMs: 1901,
    cooldownMs: 700
  });

  assert.equal(result.inCooldown, false);
  assert.equal(result.reason, "no-prior-gesture");
});

test("detectLostHandsRecovery refreshes timestamp when hands are visible", () => {
  const result = detectLostHandsRecovery({
    handsDetected: true,
    lastHandsSeenAtMs: 1200,
    nowMs: 1800,
    recoveryTimeoutMs: 900
  });

  assert.equal(result.shouldRecover, false);
  assert.equal(result.graceActive, false);
  assert.equal(result.nextLastHandsSeenAtMs, 1800);
  assert.equal(result.reason, "hands-visible");
});

test("detectLostHandsRecovery stays in grace window when timeout not reached", () => {
  const result = detectLostHandsRecovery({
    handsDetected: false,
    lastHandsSeenAtMs: 1200,
    nowMs: 1700,
    recoveryTimeoutMs: 900
  });

  assert.equal(result.shouldRecover, false);
  assert.equal(result.graceActive, true);
  assert.equal(result.reason, "within-recovery-grace-window");
});

test("detectLostHandsRecovery triggers recovery when timeout exceeded", () => {
  const result = detectLostHandsRecovery({
    handsDetected: false,
    lastHandsSeenAtMs: 1200,
    nowMs: 2305,
    recoveryTimeoutMs: 900
  });

  assert.equal(result.shouldRecover, true);
  assert.equal(result.graceActive, false);
  assert.equal(result.reason, "recovery-timeout-exceeded");
  assert.equal(result.missingForMs, 1105);
});

test("detectLostHandsRecovery handles missing prior timestamp", () => {
  const result = detectLostHandsRecovery({
    handsDetected: false,
    lastHandsSeenAtMs: null,
    nowMs: 2000,
    recoveryTimeoutMs: 900
  });

  assert.equal(result.shouldRecover, false);
  assert.equal(result.graceActive, true);
  assert.equal(result.reason, "no-prior-hands-timestamp");
});

test("detectLostPoseRecovery refreshes timestamp when pose is visible", () => {
  const result = detectLostPoseRecovery({
    poseDetected: true,
    lastPoseSeenAtMs: 1400,
    nowMs: 2100,
    recoveryTimeoutMs: 1200
  });

  assert.equal(result.shouldRecover, false);
  assert.equal(result.graceActive, false);
  assert.equal(result.nextLastPoseSeenAtMs, 2100);
  assert.equal(result.reason, "pose-visible");
});

test("detectLostPoseRecovery stays in grace window when timeout not reached", () => {
  const result = detectLostPoseRecovery({
    poseDetected: false,
    lastPoseSeenAtMs: 1400,
    nowMs: 2300,
    recoveryTimeoutMs: 1200
  });

  assert.equal(result.shouldRecover, false);
  assert.equal(result.graceActive, true);
  assert.equal(result.reason, "within-recovery-grace-window");
});

test("detectLostPoseRecovery triggers recovery when timeout exceeded", () => {
  const result = detectLostPoseRecovery({
    poseDetected: false,
    lastPoseSeenAtMs: 1400,
    nowMs: 2805,
    recoveryTimeoutMs: 1200
  });

  assert.equal(result.shouldRecover, true);
  assert.equal(result.graceActive, false);
  assert.equal(result.reason, "recovery-timeout-exceeded");
  assert.equal(result.missingForMs, 1405);
});

test("detectLostPoseRecovery handles missing prior timestamp", () => {
  const result = detectLostPoseRecovery({
    poseDetected: false,
    lastPoseSeenAtMs: null,
    nowMs: 2300,
    recoveryTimeoutMs: 1200
  });

  assert.equal(result.shouldRecover, false);
  assert.equal(result.graceActive, true);
  assert.equal(result.reason, "no-prior-pose-timestamp");
});
