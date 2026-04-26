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

/**
 * Phase2.3 — Compute Y-axis (yaw) rotation in radians from shoulder Z-delta.
 * Mirrors the inline logic in mirror/page.tsx. Used for GLB body-rotation tracking.
 *
 * Returns 0 when shoulders are missing/invalid (caller treats it as "no rotation").
 *
 * @param {{ leftShoulder?: LandmarkPoint | null, rightShoulder?: LandmarkPoint | null }} input
 * @returns {number} yaw in radians, in (-pi/2, pi/2)
 */
export function computeShoulderYawRadians(input) {
  const ls = input?.leftShoulder;
  const rs = input?.rightShoulder;
  if (!ls || !rs) return 0;
  if (!Number.isFinite(ls.x) || !Number.isFinite(rs.x)) return 0;
  const lz = Number.isFinite(ls.z) ? ls.z : 0;
  const rz = Number.isFinite(rs.z) ? rs.z : 0;
  const zDelta = lz - rz;
  const xSpan = Math.max(0.05, Math.abs(rs.x - ls.x));
  return Math.atan2(zDelta, xSpan);
}

/**
 * Phase2.4 — Compute depth scale factor from average shoulder Z.
 * Negative Z (closer to camera) → larger; positive Z → smaller.
 * Clamped to [0.7, 1.3] to avoid runaway scaling.
 *
 * @param {{ leftShoulder?: LandmarkPoint | null, rightShoulder?: LandmarkPoint | null }} input
 * @returns {number} depth scale in [0.7, 1.3]; returns 1.0 when shoulders missing
 */
export function computeDepthScale(input) {
  const ls = input?.leftShoulder;
  const rs = input?.rightShoulder;
  if (!ls || !rs) return 1.0;
  const lz = Number.isFinite(ls.z) ? ls.z : 0;
  const rz = Number.isFinite(rs.z) ? rs.z : 0;
  const avgZ = (lz + rz) / 2;
  const raw = 1.0 - avgZ * 0.4;
  return clamp(raw, 0.7, 1.3);
}

/**
 * Phase 6.1 — Compute body pitch (X-axis lean forward/back) in radians.
 *
 * MediaPipe gives us per-landmark Z (depth, in image-width units, negative =
 * closer to camera). When the user leans forward, shoulders move closer to
 * the camera relative to hips → average shoulder.z < average hip.z. We map
 * that depth delta along the torso into a pitch angle: atan2(ΔZ, torsoLengthY).
 *
 * Sign convention: leaning FORWARD → positive pitch (head toward camera).
 * Returns 0 when hip data is missing/invisible (graceful) and `null` when
 * shoulders themselves fail visibility — matches `computeAnchor` semantics.
 *
 * @param {{
 *   leftShoulder?: LandmarkPoint|null,
 *   rightShoulder?: LandmarkPoint|null,
 *   leftHip?: LandmarkPoint|null,
 *   rightHip?: LandmarkPoint|null,
 *   minVisibility?: number,
 * }} input
 * @returns {number|null} radians; null when shoulders unreliable
 */
export function computeBodyPitch(input) {
  const ls = input?.leftShoulder;
  const rs = input?.rightShoulder;
  const minV = Number.isFinite(input?.minVisibility) ? input.minVisibility : 0.5;
  if (!ls || !rs) return null;
  const lsv = Number.isFinite(ls.visibility) ? ls.visibility : 1;
  const rsv = Number.isFinite(rs.visibility) ? rs.visibility : 1;
  if (lsv < minV || rsv < minV) return null;

  const shoulderZ = ((Number.isFinite(ls.z) ? ls.z : 0) + (Number.isFinite(rs.z) ? rs.z : 0)) / 2;
  const shoulderY = ((Number.isFinite(ls.y) ? ls.y : 0) + (Number.isFinite(rs.y) ? rs.y : 0)) / 2;

  const lh = input?.leftHip;
  const rh = input?.rightHip;
  // No hips = no torso vector = no pitch reference. Return 0 (upright) gracefully.
  if (!lh || !rh) return 0;
  const lhv = Number.isFinite(lh.visibility) ? lh.visibility : 1;
  const rhv = Number.isFinite(rh.visibility) ? rh.visibility : 1;
  if (lhv < minV || rhv < minV) return 0;

  const hipZ = ((Number.isFinite(lh.z) ? lh.z : 0) + (Number.isFinite(rh.z) ? rh.z : 0)) / 2;
  const hipY = ((Number.isFinite(lh.y) ? lh.y : 0) + (Number.isFinite(rh.y) ? rh.y : 0)) / 2;

  // Shoulder closer to camera (more negative Z) than hips → leaning forward → +pitch.
  const zDelta = hipZ - shoulderZ; // > 0 when leaning forward
  const torsoLengthY = Math.max(0.05, Math.abs(hipY - shoulderY));

  // Clamp to ±60° to avoid wild values when MediaPipe Z is noisy.
  const raw = Math.atan2(zDelta, torsoLengthY);
  return clamp(raw, -Math.PI / 3, Math.PI / 3);
}

/**
 * Phase 7.88 — Compute Y-axis yaw (Iron Man rotation effect) from shoulder
 * Z-delta. The VISION goal is "garment tracks rotation like Iron Man suit".
 *
 * Pre-7.88 the inline mirror code was:
 *   const shoulderZDelta = (ls.z ?? 0) - (rs.z ?? 0);
 *   const yawAngle = Math.atan2(shoulderZDelta, ...);
 * That `?? 0` silently fabricates yaw=0 ("facing camera") whenever MediaPipe
 * reports a missing/zero z, then the smoother integrates the lie. Result: when
 * the user actually turns sideways but z confidence dips for a frame or two,
 * the garment snaps back to facing-camera and then rubber-bands when z
 * recovers. Breaks the suit illusion at exactly the moments rotation matters
 * most.
 *
 * Fix: this function returns null whenever the inputs can't yield a real yaw
 * estimate — caller is expected to skip the smoothing update on null and
 * keep the last good yaw, so the garment freezes briefly instead of lying.
 *
 * Returns null when:
 * - shoulders missing
 * - either shoulder visibility < minVisibility (default 0.5)
 * - either shoulder z is non-finite
 * - both shoulder z values are exactly 0 (MediaPipe's "no depth signal" sentinel)
 * - shoulder X-distance is degenerate (<0.02 normalized — user is profile-on
 *   to camera and shoulders are stacked, which makes the atan2 angle wildly
 *   noisy; skip the frame instead of producing a giant yaw spike)
 *
 * @param {{
 *   leftShoulder?: LandmarkPoint|null,
 *   rightShoulder?: LandmarkPoint|null,
 *   minVisibility?: number,
 * }} input
 * @returns {number|null} radians; null when yaw estimate is unreliable
 */
export function computeBodyYaw(input) {
  const ls = input?.leftShoulder;
  const rs = input?.rightShoulder;
  if (!ls || !rs) return null;

  const minV = Number.isFinite(input?.minVisibility) ? input.minVisibility : 0.5;
  const lsv = Number.isFinite(ls.visibility) ? ls.visibility : 1;
  const rsv = Number.isFinite(rs.visibility) ? rs.visibility : 1;
  if (lsv < minV || rsv < minV) return null;

  // Z must be present AND not both exactly zero (MediaPipe sentinel).
  if (!Number.isFinite(ls.z) || !Number.isFinite(rs.z)) return null;
  if (ls.z === 0 && rs.z === 0) return null;

  if (!Number.isFinite(ls.x) || !Number.isFinite(rs.x)) return null;
  const xDist = Math.abs(rs.x - ls.x);
  // Below 0.02 normalized (~2% of frame width) shoulders are essentially
  // stacked — user is in profile, atan2 denominator collapses, output spikes.
  // Skip the frame; smoother holds last value.
  if (xDist < 0.02) return null;

  const zDelta = ls.z - rs.z;
  const raw = Math.atan2(zDelta, xDist);

  // Clamp to ±90° (π/2). Beyond that MediaPipe z confidence is bad anyway
  // and a 3D garment rotated past 90° hits self-occlusion ugliness.
  return clamp(raw, -Math.PI / 2, Math.PI / 2);
}


/**
 * Phase 7.89 — STRICT depth scale (closer→bigger garment).
 *
 * Sibling fix to Phase 7.88's computeBodyYaw. The original `computeDepthScale`
 * (Phase 2.4, above) returns 1.0 on missing/zero z — convenient for unit
 * tests but a LIE in the real-time pipeline. Pre-7.89 the inline mirror code
 * was:
 *   const avgShoulderZ = ((ls.z ?? 0) + (rs.z ?? 0)) / 2;
 *   const depthScale = 1.0 - (avgShoulderZ * 0.4);
 *   smoothPos.current.depth = smoothScalar(prev, depthScale, ...);
 * Same `?? 0` lie pattern: when MediaPipe z confidence dips, avgZ collapses
 * to 0, depthScale collapses to 1.0 ("neutral distance"), and the smoother
 * integrates that. Visible failure: user steps closer, garment grows
 * correctly, then z dips once → garment SHRINKS toward neutral → rubber-bands
 * larger when z recovers. The garment "breathes."
 *
 * The strict variant returns null when the inputs can't yield a real
 * estimate — caller is expected to skip the smoothing update on null and
 * hold the last good depth, so the garment freezes briefly instead of lying.
 *
 * Returns null when:
 * - shoulders missing
 * - either shoulder visibility < minVisibility (default 0.5)
 * - either z is non-finite (NaN/Infinity)
 * - both z values are exactly 0 (MediaPipe sentinel)
 *
 * The 0.4 multiplier and ±0.3-around-1.0 clamp are kept as defaults but
 * configurable so callers can tune sensitivity without re-implementing.
 *
 * @param {{
 *   leftShoulder?: LandmarkPoint|null,
 *   rightShoulder?: LandmarkPoint|null,
 *   minVisibility?: number,
 *   sensitivity?: number,
 *   minScale?: number,
 *   maxScale?: number,
 * }} input
 * @returns {number|null} unitless scale factor (1.0 = neutral); null when unreliable
 */
export function computeDepthScaleStrict(input) {
  const ls = input?.leftShoulder;
  const rs = input?.rightShoulder;
  if (!ls || !rs) return null;

  const minV = Number.isFinite(input?.minVisibility) ? input.minVisibility : 0.5;
  const lsv = Number.isFinite(ls.visibility) ? ls.visibility : 1;
  const rsv = Number.isFinite(rs.visibility) ? rs.visibility : 1;
  if (lsv < minV || rsv < minV) return null;

  if (!Number.isFinite(ls.z) || !Number.isFinite(rs.z)) return null;
  if (ls.z === 0 && rs.z === 0) return null;

  const sensitivity = Number.isFinite(input?.sensitivity) ? input.sensitivity : 0.4;
  const minScale = Number.isFinite(input?.minScale) ? input.minScale : 0.7;
  const maxScale = Number.isFinite(input?.maxScale) ? input.maxScale : 1.3;

  const avgZ = (ls.z + rs.z) / 2;
  // MediaPipe Z: negative = closer to camera. closer → larger scale.
  const raw = 1.0 - avgZ * sensitivity;
  return clamp(raw, minScale, maxScale);
}
