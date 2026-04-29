/**
 * Helmet (head) anchor transform for VF-12 prototype.
 *
 * The chest plate already lives in lib/armor.ts. This module computes a
 * separate transform for a head-mounted piece (helmet/visor) using the
 * MediaPipe Pose face landmarks already produced by the same tracker, so
 * we don't need a face-mesh model.
 *
 * Inputs we use:
 *   - nose (0): primary head position
 *   - leftEar (7) / rightEar (8): yaw + scale
 *   - leftShoulder (11) / rightShoulder (12): fallback when only one ear is
 *     visible (head turned), and to estimate head size relative to torso
 *
 * Outputs (same shape grammar as ArmorTransform):
 *   - position: normalized image coords (x,y in [0..1], z relative depth)
 *   - scale: ear-to-ear distance (or fallback derived from shoulders × 0.55)
 *   - rotation: yaw from ear midpoint vs nose offset; roll from ear line
 *   - confidence: 0..1 quality signal (drops in fallback path)
 *
 * Pure / deterministic / clock-free. Exported separately from armor.ts so
 * the renderer can mount it as a sibling Three.Group without touching the
 * chest pipeline.
 */

import type { PoseLandmark } from "./armor";

export const HEAD_LANDMARKS = {
  nose: 0,
  leftEar: 7,
  rightEar: 8,
  leftShoulder: 11,
  rightShoulder: 12
} as const;

export interface HelmetTransform {
  position: { x: number; y: number; z: number };
  scale: number;
  rotation: { x: number; y: number; z: number };
  confidence: number;
}

const MIN_SEGMENT = 1e-5;
const MIN_VISIBILITY = 0.1;

function isFiniteLandmark(l: PoseLandmark | undefined): l is PoseLandmark {
  return Boolean(l && Number.isFinite(l.x) && Number.isFinite(l.y) && Number.isFinite(l.z));
}
function isUsable(l: PoseLandmark | undefined): l is PoseLandmark {
  return isFiniteLandmark(l) && (l.visibility ?? 1) >= MIN_VISIBILITY;
}
function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function computeHelmetTransform(
  landmarks: readonly PoseLandmark[],
  options: { mirrorX?: boolean } = {}
): HelmetTransform | null {
  const nose = landmarks[HEAD_LANDMARKS.nose];
  if (!isUsable(nose)) return null;

  const leftEar = landmarks[HEAD_LANDMARKS.leftEar];
  const rightEar = landmarks[HEAD_LANDMARKS.rightEar];
  const leftShoulder = landmarks[HEAD_LANDMARKS.leftShoulder];
  const rightShoulder = landmarks[HEAD_LANDMARKS.rightShoulder];

  const bothEars = isUsable(leftEar) && isUsable(rightEar);
  const bothShoulders = isUsable(leftShoulder) && isUsable(rightShoulder);

  if (!bothEars && !bothShoulders) {
    // Need at least ears OR shoulders to compute scale/yaw.
    return null;
  }

  // Scale: prefer real ear-to-ear distance, fall back to shoulder span × 0.55
  // (typical head-width / shoulder-width ratio).
  let scale: number;
  let confidence: number;
  let yaw = 0;
  let roll = 0;

  if (bothEars) {
    const dx = rightEar.x - leftEar.x;
    const dy = rightEar.y - leftEar.y;
    scale = Math.hypot(dx, dy);
    if (scale < MIN_SEGMENT) return null;
    // Roll: tilt of the ear line; mirror flips sign with screen.
    const rawRoll = Math.atan2(dy, Math.abs(dx));
    roll = clamp(options.mirrorX ? -rawRoll : rawRoll, -0.9, 0.9);
    // Yaw: nose offset from ear midpoint, normalized by ear span.
    const earMidX = (leftEar.x + rightEar.x) / 2;
    const noseOffset = (nose.x - earMidX) / Math.max(scale, MIN_SEGMENT);
    const rawYaw = Math.atan(noseOffset * 1.6); // amplify to ~±π/3
    yaw = clamp(options.mirrorX ? -rawYaw : rawYaw, -1.0, 1.0);
    confidence =
      ((leftEar.visibility ?? 1) + (rightEar.visibility ?? 1) + (nose.visibility ?? 1)) / 3;
  } else if (bothShoulders) {
    // Fallback: head profile / occluded ear path
    const sdx = rightShoulder.x - leftShoulder.x;
    const sdy = rightShoulder.y - leftShoulder.y;
    const shoulderSpan = Math.hypot(sdx, sdy);
    if (shoulderSpan < MIN_SEGMENT) return null;
    scale = shoulderSpan * 0.55;
    const rawRoll = Math.atan2(sdy, Math.abs(sdx));
    roll = clamp(options.mirrorX ? -rawRoll : rawRoll, -0.9, 0.9);
    // Approximate yaw from nose's horizontal offset relative to shoulder mid.
    const shoulderMidX = (leftShoulder.x + rightShoulder.x) / 2;
    const noseOffset = (nose.x - shoulderMidX) / Math.max(shoulderSpan, MIN_SEGMENT);
    const rawYaw = Math.atan(noseOffset * 1.2);
    yaw = clamp(options.mirrorX ? -rawYaw : rawYaw, -1.0, 1.0);
    // Fallback path is less trustworthy for orientation: scale confidence down.
    confidence =
      0.55 * (((leftShoulder.visibility ?? 1) + (rightShoulder.visibility ?? 1) + (nose.visibility ?? 1)) / 3);
  } else {
    return null; // unreachable; guarded above
  }

  return {
    position: {
      x: clamp(options.mirrorX ? 1 - nose.x : nose.x, 0, 1),
      y: clamp(nose.y, 0, 1),
      z: clamp(-nose.z, -1, 1)
    },
    scale,
    rotation: { x: 0, y: yaw, z: roll },
    confidence: clamp(confidence, 0, 1)
  };
}
