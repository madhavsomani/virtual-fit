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
  const leftHip = landmarks[POSE_LANDMARKS.leftHip];
  const rightHip = landmarks[POSE_LANDMARKS.rightHip];

  if (
    !isUsableLandmark(leftShoulder) ||
    !isUsableLandmark(rightShoulder) ||
    !isUsableLandmark(leftHip) ||
    !isUsableLandmark(rightHip)
  ) {
    return null;
  }

  const shoulderMid = average(leftShoulder, rightShoulder);
  const hipMid = average(leftHip, rightHip);

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

  const positionZ = clamp((-shoulderMid.z - hipMid.z) * 0.5, -1, 1);
  const pitch = clamp(Math.atan2(-torsoDz, Math.hypot(torsoDx, torsoDy)), -0.75, 0.75);
  const yaw = clamp(Math.atan2(torsoDx, torsoDy), -0.45, 0.45);
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
    }
  };
}
