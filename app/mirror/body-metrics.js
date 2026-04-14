function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * @typedef {{ x: number, y: number, z?: number, visibility?: number }} LandmarkPoint
 */

/**
 * Compute normalized shoulder width from left/right shoulder landmarks.
 * Returns null when required landmarks are missing.
 *
 * @param {{ leftShoulder?: LandmarkPoint | null, rightShoulder?: LandmarkPoint | null }} input
 * @returns {number | null}
 */
export function computeShoulderWidthMetric(input) {
  const leftShoulder = input?.leftShoulder;
  const rightShoulder = input?.rightShoulder;

  if (!leftShoulder || !rightShoulder) {
    return null;
  }

  if (!Number.isFinite(leftShoulder.x) || !Number.isFinite(rightShoulder.x)) {
    return null;
  }

  const width = Math.abs(leftShoulder.x - rightShoulder.x);
  return Number(clamp(width, 0, 1).toFixed(3));
}

/**
 * Convert normalized shoulder width metric to pixels for easier diagnostics.
 *
 * @param {{ shoulderWidthMetric?: number | null, frameWidthPx?: number | null }} input
 * @returns {number | null}
 */
export function computeShoulderWidthPixels(input) {
  const shoulderWidthMetric = input?.shoulderWidthMetric;
  const frameWidthPx = input?.frameWidthPx;

  if (!Number.isFinite(shoulderWidthMetric) || !Number.isFinite(frameWidthPx) || frameWidthPx <= 0) {
    return null;
  }

  return Math.round(Number(shoulderWidthMetric) * Number(frameWidthPx));
}

/**
 * Compute signed shoulder tilt angle (degrees) from shoulder landmarks.
 * Positive value means right shoulder is lower than left in screen coordinates.
 *
 * @param {{ leftShoulder?: LandmarkPoint | null, rightShoulder?: LandmarkPoint | null }} input
 * @returns {number | null}
 */
export function computeShoulderAngleMetric(input) {
  const leftShoulder = input?.leftShoulder;
  const rightShoulder = input?.rightShoulder;

  if (!leftShoulder || !rightShoulder) {
    return null;
  }

  if (
    !Number.isFinite(leftShoulder.x) ||
    !Number.isFinite(leftShoulder.y) ||
    !Number.isFinite(rightShoulder.x) ||
    !Number.isFinite(rightShoulder.y)
  ) {
    return null;
  }

  const dx = rightShoulder.x - leftShoulder.x;
  const dy = rightShoulder.y - leftShoulder.y;

  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
    return 0;
  }

  const rawDegrees = (Math.atan2(dy, dx) * 180) / Math.PI;
  const normalizedDegrees = rawDegrees > 90 ? rawDegrees - 180 : rawDegrees < -90 ? rawDegrees + 180 : rawDegrees;

  return Number(clamp(normalizedDegrees, -90, 90).toFixed(1));
}

/**
 * Compute torso rotation proxy angle (degrees) from left/right torso side asymmetry.
 * Positive value means right torso side appears longer than left side.
 *
 * @param {{ leftShoulder?: LandmarkPoint | null, rightShoulder?: LandmarkPoint | null, leftHip?: LandmarkPoint | null, rightHip?: LandmarkPoint | null }} input
 * @returns {number | null}
 */
export function computeTorsoRotationMetric(input) {
  const leftShoulder = input?.leftShoulder;
  const rightShoulder = input?.rightShoulder;
  const leftHip = input?.leftHip;
  const rightHip = input?.rightHip;

  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) {
    return null;
  }

  if (
    !Number.isFinite(leftShoulder.x) ||
    !Number.isFinite(leftShoulder.y) ||
    !Number.isFinite(rightShoulder.x) ||
    !Number.isFinite(rightShoulder.y) ||
    !Number.isFinite(leftHip.x) ||
    !Number.isFinite(leftHip.y) ||
    !Number.isFinite(rightHip.x) ||
    !Number.isFinite(rightHip.y)
  ) {
    return null;
  }

  const leftTorsoSide = Math.hypot(leftHip.x - leftShoulder.x, leftHip.y - leftShoulder.y);
  const rightTorsoSide = Math.hypot(rightHip.x - rightShoulder.x, rightHip.y - rightShoulder.y);
  const torsoPerimeter = leftTorsoSide + rightTorsoSide;

  if (!Number.isFinite(torsoPerimeter) || torsoPerimeter < 1e-6) {
    return 0;
  }

  const sideAsymmetry = (rightTorsoSide - leftTorsoSide) / torsoPerimeter;
  const proxyDegrees = sideAsymmetry * 90;

  return Number(clamp(proxyDegrees, -45, 45).toFixed(1));
}

function hasUsableHandLandmarks(landmarks) {
  if (!Array.isArray(landmarks) || landmarks.length === 0) {
    return false;
  }

  const finitePoints = landmarks.filter(
    (point) => point && Number.isFinite(point.x) && Number.isFinite(point.y)
  );

  return finitePoints.length >= 3;
}

/**
 * Compute normalized hand-presence metric (0, 0.5, 1).
 * Returns null when no hand input was provided.
 *
 * @param {{ leftHandLandmarks?: LandmarkPoint[] | null, rightHandLandmarks?: LandmarkPoint[] | null }} input
 * @returns {number | null}
 */
export function computeHandPresenceMetric(input) {
  const leftProvided = input && Object.prototype.hasOwnProperty.call(input, "leftHandLandmarks");
  const rightProvided = input && Object.prototype.hasOwnProperty.call(input, "rightHandLandmarks");

  if (!leftProvided && !rightProvided) {
    return null;
  }

  const leftPresent = hasUsableHandLandmarks(input?.leftHandLandmarks);
  const rightPresent = hasUsableHandLandmarks(input?.rightHandLandmarks);
  const presentHands = Number(leftPresent) + Number(rightPresent);

  return Number((presentHands / 2).toFixed(2));
}

/**
 * Compute normalized torso height from shoulder center to hip center.
 * Returns null when required landmarks are missing.
 *
 * @param {{ leftShoulder?: LandmarkPoint | null, rightShoulder?: LandmarkPoint | null, leftHip?: LandmarkPoint | null, rightHip?: LandmarkPoint | null }} input
 * @returns {number | null}
 */
export function computeTorsoHeightMetric(input) {
  const leftShoulder = input?.leftShoulder;
  const rightShoulder = input?.rightShoulder;
  const leftHip = input?.leftHip;
  const rightHip = input?.rightHip;

  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) {
    return null;
  }

  if (
    !Number.isFinite(leftShoulder.y) ||
    !Number.isFinite(rightShoulder.y) ||
    !Number.isFinite(leftHip.y) ||
    !Number.isFinite(rightHip.y)
  ) {
    return null;
  }

  const shoulderCenterY = (leftShoulder.y + rightShoulder.y) / 2;
  const hipCenterY = (leftHip.y + rightHip.y) / 2;
  const height = Math.abs(hipCenterY - shoulderCenterY);

  return Number(clamp(height, 0, 1).toFixed(3));
}

/**
 * Convert normalized torso-height metric to pixels for easier diagnostics.
 *
 * @param {{ torsoHeightMetric?: number | null, frameHeightPx?: number | null }} input
 * @returns {number | null}
 */
export function computeTorsoHeightPixels(input) {
  const torsoHeightMetric = input?.torsoHeightMetric;
  const frameHeightPx = input?.frameHeightPx;

  if (!Number.isFinite(torsoHeightMetric) || !Number.isFinite(frameHeightPx) || frameHeightPx <= 0) {
    return null;
  }

  return Math.round(Number(torsoHeightMetric) * Number(frameHeightPx));
}

/**
 * Compute normalized body center using shoulder and hip centers.
 * Returns null when required landmarks are missing.
 *
 * @param {{ leftShoulder?: LandmarkPoint | null, rightShoulder?: LandmarkPoint | null, leftHip?: LandmarkPoint | null, rightHip?: LandmarkPoint | null }} input
 * @returns {{ x: number, y: number } | null}
 */
export function computeBodyCenterMetric(input) {
  const leftShoulder = input?.leftShoulder;
  const rightShoulder = input?.rightShoulder;
  const leftHip = input?.leftHip;
  const rightHip = input?.rightHip;

  if (!leftShoulder || !rightShoulder || !leftHip || !rightHip) {
    return null;
  }

  if (
    !Number.isFinite(leftShoulder.x) ||
    !Number.isFinite(rightShoulder.x) ||
    !Number.isFinite(leftHip.x) ||
    !Number.isFinite(rightHip.x) ||
    !Number.isFinite(leftShoulder.y) ||
    !Number.isFinite(rightShoulder.y) ||
    !Number.isFinite(leftHip.y) ||
    !Number.isFinite(rightHip.y)
  ) {
    return null;
  }

  const shoulderCenterX = (leftShoulder.x + rightShoulder.x) / 2;
  const shoulderCenterY = (leftShoulder.y + rightShoulder.y) / 2;
  const hipCenterX = (leftHip.x + rightHip.x) / 2;
  const hipCenterY = (leftHip.y + rightHip.y) / 2;

  return {
    x: Number(clamp((shoulderCenterX + hipCenterX) / 2, 0, 1).toFixed(3)),
    y: Number(clamp((shoulderCenterY + hipCenterY) / 2, 0, 1).toFixed(3))
  };
}

/**
 * Convert normalized body center metric to pixel coordinates for diagnostics.
 *
 * @param {{ bodyCenterMetric?: { x: number, y: number } | null, frameWidthPx?: number | null, frameHeightPx?: number | null }} input
 * @returns {{ x: number, y: number } | null}
 */
export function computeBodyCenterPixels(input) {
  const bodyCenterMetric = input?.bodyCenterMetric;
  const frameWidthPx = input?.frameWidthPx;
  const frameHeightPx = input?.frameHeightPx;

  if (
    !bodyCenterMetric ||
    !Number.isFinite(bodyCenterMetric.x) ||
    !Number.isFinite(bodyCenterMetric.y) ||
    !Number.isFinite(frameWidthPx) ||
    !Number.isFinite(frameHeightPx) ||
    frameWidthPx <= 0 ||
    frameHeightPx <= 0
  ) {
    return null;
  }

  return {
    x: Math.round(clamp(bodyCenterMetric.x, 0, 1) * Number(frameWidthPx)),
    y: Math.round(clamp(bodyCenterMetric.y, 0, 1) * Number(frameHeightPx))
  };
}
