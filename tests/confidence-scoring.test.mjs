import assert from "node:assert/strict";
import test from "node:test";

import {
  computeDetectorTrackingConfidence,
  computeFaceTrackingConfidence,
  computeFallbackTrackingConfidence,
  computePoseTrackingConfidence,
  resolveLowConfidenceFallbackMode
} from "../app/mirror/confidence-scoring.js";

test("computePoseTrackingConfidence rewards stable high-visibility frames", () => {
  const score = computePoseTrackingConfidence({
    averageVisibility: 0.88,
    shoulderVisibility: 0.86,
    hipVisibility: 0.8,
    ankleVisibility: 0.6,
    hasHandsDetected: true,
    isTooClose: false,
    isTooFar: false,
    isPoorLight: false,
    isRotatedTooFar: false
  });

  assert.ok(score >= 0.8);
});

test("computePoseTrackingConfidence drops with unstable conditions", () => {
  const score = computePoseTrackingConfidence({
    averageVisibility: 0.55,
    shoulderVisibility: 0.3,
    hipVisibility: 0.2,
    ankleVisibility: 0.1,
    hasHandsDetected: false,
    isTooClose: true,
    isTooFar: false,
    isPoorLight: true,
    isRotatedTooFar: true
  });

  assert.ok(score < 0.55);
});

test("computeFaceTrackingConfidence penalizes tilt and framing issues", () => {
  const strong = computeFaceTrackingConfidence({
    eyeTilt: 0.01,
    faceAreaRatio: 0.026,
    isTooClose: false,
    isTooFar: false,
    isPoorLight: false,
    isRotatedTooFar: false
  });

  const weak = computeFaceTrackingConfidence({
    eyeTilt: 0.12,
    faceAreaRatio: 0.07,
    isTooClose: true,
    isTooFar: false,
    isPoorLight: true,
    isRotatedTooFar: true
  });

  assert.ok(strong > weak);
});

test("computeDetectorTrackingConfidence handles detected vs undetected", () => {
  const detected = computeDetectorTrackingConfidence({
    detected: true,
    faceAreaRatio: 0.02,
    isTooClose: false,
    isTooFar: false,
    isPoorLight: false,
    isRotatedTooFar: false
  });

  const undetected = computeDetectorTrackingConfidence({
    detected: false,
    faceAreaRatio: 0,
    isTooClose: false,
    isTooFar: false,
    isPoorLight: true,
    isRotatedTooFar: false
  });

  assert.ok(detected > undetected);
});

test("computeFallbackTrackingConfidence applies low-light penalty", () => {
  const bright = computeFallbackTrackingConfidence({ nowSeconds: 10, isPoorLight: false });
  const dark = computeFallbackTrackingConfidence({ nowSeconds: 10, isPoorLight: true });

  assert.ok(bright > dark);
});

test("resolveLowConfidenceFallbackMode enters fallback when confidence is low", () => {
  const result = resolveLowConfidenceFallbackMode({
    trackingConfidence: 0.52,
    fallbackActive: false
  });

  assert.equal(result.fallbackActive, true);
  assert.equal(result.reason, "enter-low-confidence-fallback");
});

test("resolveLowConfidenceFallbackMode exits fallback when confidence recovers", () => {
  const result = resolveLowConfidenceFallbackMode({
    trackingConfidence: 0.74,
    fallbackActive: true
  });

  assert.equal(result.fallbackActive, false);
  assert.equal(result.reason, "exit-low-confidence-fallback");
});

test("resolveLowConfidenceFallbackMode holds mode in hysteresis band", () => {
  const heldFallback = resolveLowConfidenceFallbackMode({
    trackingConfidence: 0.62,
    fallbackActive: true
  });
  const heldNormal = resolveLowConfidenceFallbackMode({
    trackingConfidence: 0.62,
    fallbackActive: false
  });

  assert.equal(heldFallback.fallbackActive, true);
  assert.equal(heldFallback.reason, "fallback-held");
  assert.equal(heldNormal.fallbackActive, false);
  assert.equal(heldNormal.reason, "normal-held");
});
