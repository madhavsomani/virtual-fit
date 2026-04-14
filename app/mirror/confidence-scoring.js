function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round2(value) {
  return Number(value.toFixed(2));
}

function areaPenalty(faceAreaRatio) {
  const target = 0.026;
  const distance = Math.abs(faceAreaRatio - target);
  return clamp(distance * 1.9, 0, 0.12);
}

export function computePoseTrackingConfidence({
  averageVisibility,
  shoulderVisibility,
  hipVisibility,
  ankleVisibility,
  hasHandsDetected,
  isTooClose,
  isTooFar,
  isPoorLight,
  isRotatedTooFar
}) {
  let score = clamp(averageVisibility, 0.42, 0.98);

  if (shoulderVisibility < 0.4) score -= 0.06;
  if (hipVisibility < 0.35) score -= 0.05;
  if (ankleVisibility < 0.2) score -= 0.03;
  if (!hasHandsDetected) score -= 0.02;
  if (isTooClose || isTooFar) score -= 0.08;
  if (isPoorLight) score -= 0.06;
  if (isRotatedTooFar) score -= 0.05;

  return round2(clamp(score, 0.35, 0.98));
}

export function computeFaceTrackingConfidence({
  eyeTilt,
  faceAreaRatio,
  isTooClose,
  isTooFar,
  isPoorLight,
  isRotatedTooFar
}) {
  let score = clamp(1 - eyeTilt * 2.2, 0.5, 0.96);
  score -= areaPenalty(faceAreaRatio);

  if (isTooClose || isTooFar) score -= 0.07;
  if (isPoorLight) score -= 0.05;
  if (isRotatedTooFar) score -= 0.04;

  return round2(clamp(score, 0.45, 0.96));
}

export function computeDetectorTrackingConfidence({
  detected,
  faceAreaRatio,
  isTooClose,
  isTooFar,
  isPoorLight,
  isRotatedTooFar
}) {
  if (!detected) {
    return isPoorLight ? 0.54 : 0.62;
  }

  let score = 0.88 - areaPenalty(faceAreaRatio) * 0.8;

  if (isTooClose || isTooFar) score -= 0.08;
  if (isPoorLight) score -= 0.07;
  if (isRotatedTooFar) score -= 0.06;

  return round2(clamp(score, 0.5, 0.92));
}

export function computeFallbackTrackingConfidence({ nowSeconds, isPoorLight }) {
  const baseline = 0.62 + ((Math.sin(nowSeconds) + 1) / 2) * 0.18;
  const penalty = isPoorLight ? 0.08 : 0;
  return round2(clamp(baseline - penalty, 0.45, 0.8));
}

/**
 * Determine low-confidence fallback mode using hysteresis thresholds.
 *
 * @param {{
 *   trackingConfidence?: number | null,
 *   fallbackActive?: boolean,
 *   enterThreshold?: number,
 *   exitThreshold?: number
 * }} input
 * @returns {{ fallbackActive: boolean, reason: string }}
 */
export function resolveLowConfidenceFallbackMode(input) {
  const trackingConfidence = input?.trackingConfidence;
  const fallbackActive = Boolean(input?.fallbackActive);
  const enterThreshold = Number.isFinite(input?.enterThreshold) ? Number(input.enterThreshold) : 0.58;
  const exitThreshold = Number.isFinite(input?.exitThreshold) ? Number(input.exitThreshold) : 0.67;

  if (!Number.isFinite(trackingConfidence)) {
    return { fallbackActive: true, reason: "invalid-confidence" };
  }

  const confidence = Number(trackingConfidence);

  if (!fallbackActive && confidence <= enterThreshold) {
    return { fallbackActive: true, reason: "enter-low-confidence-fallback" };
  }

  if (fallbackActive && confidence >= exitThreshold) {
    return { fallbackActive: false, reason: "exit-low-confidence-fallback" };
  }

  return {
    fallbackActive,
    reason: fallbackActive ? "fallback-held" : "normal-held"
  };
}
