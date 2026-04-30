export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
  presence?: number;
}

export interface ArmorTransform {
  position: {
    x: number;
    y: number;
    z: number;
  };
  scale: number;
  rotation: {
    x: number;
    y: number;
    z: number;
  };
  /**
   * 0..1 — anchor confidence. 1.0 = all four landmarks visible at full
   * visibility. Drops when hips are synthesized via the chest-up fallback,
   * or when shoulder visibility is borderline. Renderer can use this to
   * dim the armor so the user sees that tracking quality has degraded.
   */
  confidence: number;
}

export const POSE_LANDMARKS = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftHip: 23,
  rightHip: 24
} as const;

const MIN_SEGMENT = 1e-5;
const MIN_VISIBILITY = 0.1;

function isFiniteLandmark(landmark: PoseLandmark | undefined): landmark is PoseLandmark {
  return Boolean(
    landmark &&
      Number.isFinite(landmark.x) &&
      Number.isFinite(landmark.y) &&
      Number.isFinite(landmark.z)
  );
}

function isUsableLandmark(landmark: PoseLandmark | undefined): landmark is PoseLandmark {
  return isFiniteLandmark(landmark) && (landmark.visibility ?? 1) >= MIN_VISIBILITY;
}

function average(a: PoseLandmark, b: PoseLandmark): PoseLandmark {
  return {
    x: (a.x + b.x) / 2,
    y: (a.y + b.y) / 2,
    z: (a.z + b.z) / 2,
    visibility: Math.min(a.visibility ?? 1, b.visibility ?? 1)
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function computeArmorTransform(
  landmarks: readonly PoseLandmark[],
  options: { mirrorX?: boolean } = {}
): ArmorTransform | null {
  const leftShoulder = landmarks[POSE_LANDMARKS.leftShoulder];
  const rightShoulder = landmarks[POSE_LANDMARKS.rightShoulder];
  const leftHipRaw = landmarks[POSE_LANDMARKS.leftHip];
  const rightHipRaw = landmarks[POSE_LANDMARKS.rightHip];

  if (!isUsableLandmark(leftShoulder) || !isUsableLandmark(rightShoulder)) {
    return null;
  }

  const shoulderMid = average(leftShoulder, rightShoulder);

  // Hip-fallback: when the user is sitting at a desk or framed chest-up, hips
  // fall below MIN_VISIBILITY. Synthesize a hip midpoint directly below the
  // shoulder midpoint at ~1.4x shoulder distance so the chest piece can still
  // anchor (pitch defaults to 0; yaw/roll still come from real shoulders).
  const hipsVisible = isUsableLandmark(leftHipRaw) && isUsableLandmark(rightHipRaw);
  const shoulderSpan = Math.hypot(
    rightShoulder.x - leftShoulder.x,
    rightShoulder.y - leftShoulder.y
  );
  const hipMid: PoseLandmark = hipsVisible
    ? average(leftHipRaw, rightHipRaw)
    : {
        x: shoulderMid.x,
        y: Math.min(1, shoulderMid.y + shoulderSpan * 1.4),
        z: shoulderMid.z,
        visibility: 0.5
      };

  const leftX = options.mirrorX ? 1 - leftShoulder.x : leftShoulder.x;
  const rightX = options.mirrorX ? 1 - rightShoulder.x : rightShoulder.x;
  const centerX = options.mirrorX ? 1 - shoulderMid.x : shoulderMid.x;

  const shoulderDx = rightX - leftX;
  const shoulderDy = rightShoulder.y - leftShoulder.y;
  const shoulderDistance = Math.hypot(shoulderDx, shoulderDy);

  if (shoulderDistance < MIN_SEGMENT) {
    return null;
  }

  const torsoDx = (options.mirrorX ? 1 - hipMid.x : hipMid.x) - centerX;
  const torsoDy = hipMid.y - shoulderMid.y;
  const torsoDz = hipMid.z - shoulderMid.z;
  const torsoLength = Math.hypot(torsoDx, torsoDy, torsoDz);

  if (torsoLength < MIN_SEGMENT) {
    return null;
  }

  // Shoulder-line normal yaw: rotating the chest about Y also tilts the
  // shoulder line in z (left shoulder closer than right when twisting toward
  // camera-left). Project (shoulderDx, shoulderDz) and fold into yaw with a
  // small weight so tests remain stable but real torso twist is captured.
  const shoulderDz = (options.mirrorX ? -1 : 1) * (rightShoulder.z - leftShoulder.z);
  const shoulderYaw = Math.abs(shoulderDx) > MIN_SEGMENT
    ? Math.atan2(shoulderDz, Math.abs(shoulderDx))
    : 0;

  const positionZ = clamp((-shoulderMid.z - hipMid.z) * 0.5, -1, 1);
  const pitch = clamp(Math.atan2(-torsoDz, Math.hypot(torsoDx, torsoDy)), -0.75, 0.75);
  const torsoYaw = Math.atan2(torsoDx, torsoDy);
  const yaw = clamp(torsoYaw + 0.5 * shoulderYaw, -0.6, 0.6);
  const baseRoll = Math.atan2(shoulderDy, Math.abs(shoulderDx));
  const roll = clamp(options.mirrorX ? -baseRoll : baseRoll, -0.9, 0.9);

  return {
    position: {
      x: clamp(centerX, 0, 1),
      y: clamp(shoulderMid.y, 0, 1),
      z: positionZ
    },
    scale: shoulderDistance,
    rotation: {
      x: pitch,
      y: yaw,
      z: roll
    },
    confidence: clamp(
      ((leftShoulder.visibility ?? 1) + (rightShoulder.visibility ?? 1)) * 0.5 *
        (hipsVisible ? 1 : 0.55),
      0,
      1
    )
  };
}
