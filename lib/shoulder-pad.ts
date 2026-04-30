/**
 * Shoulder pad transforms — deltoid covers anchored at each shoulder
 * landmark, oriented along the shoulder→elbow segment with a slight
 * outward tilt. Renders as a small dome-cap sitting on top of the
 * shoulder ball.
 *
 * Symmetry with bicep/gauntlet: same return shape so the renderer can
 * reuse the existing per-arm pipeline (smoother + opacity ease).
 *
 * Uses MediaPipe Pose landmark indices:
 *   11 leftShoulder · 12 rightShoulder · 13 leftElbow · 14 rightElbow
 */

import type { PoseLandmark } from "./armor";

export interface ShoulderTransform {
  position: { x: number; y: number; z: number };
  scale: number; // pad radius in normalized x-units (≈ 0.5 × shoulder-elbow length)
  rotation: { x: number; y: number; z: number };
  confidence: number;
}

export interface ShoulderTransforms {
  left: ShoulderTransform | null;
  right: ShoulderTransform | null;
}

export const SHOULDER_PAD_LANDMARKS = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14
} as const;

const MIN_VIS = 0.15;
const MIN_SEG = 1e-5;

function usable(l: PoseLandmark | undefined): l is PoseLandmark {
  return Boolean(
    l &&
      Number.isFinite(l.x) &&
      Number.isFinite(l.y) &&
      Number.isFinite(l.z) &&
      (l.visibility ?? 1) >= MIN_VIS
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function buildPad(
  shoulder: PoseLandmark,
  elbow: PoseLandmark,
  side: "left" | "right",
  mirrorX: boolean
): ShoulderTransform | null {
  const sx = mirrorX ? 1 - shoulder.x : shoulder.x;
  const ex = mirrorX ? 1 - elbow.x : elbow.x;
  const dx = ex - sx;
  const dy = elbow.y - shoulder.y;
  const dz = elbow.z - shoulder.z;
  const len = Math.hypot(dx, dy);
  if (len < MIN_SEG) return null;

  // Pad is anchored at the shoulder, slightly biased toward the elbow so it
  // sits on the deltoid rather than dead-center on the joint.
  const bias = 0.08;
  const px = sx + dx * bias;
  const py = shoulder.y + dy * bias;
  const pz = shoulder.z + dz * bias;

  // Orient pad along shoulder→elbow with a small outward tilt so the cap's
  // top points up-and-out (like real deltoid armor).
  const armRoll = Math.atan2(-dy, dx) + Math.PI / 2; // 0 = pointing down
  const outwardTilt = side === "left" ? -0.18 : 0.18;
  const rotZ = armRoll + outwardTilt;

  // Pitch from z (forward/back of arm) → small negative pitch when arm goes forward
  const pitch = clamp(Math.atan2(-dz, len), -0.7, 0.7);

  const conf = clamp(
    ((shoulder.visibility ?? 1) + (elbow.visibility ?? 1)) * 0.5,
    0,
    1
  );

  return {
    position: { x: clamp(px, 0, 1), y: clamp(py, 0, 1), z: clamp(-pz, -1, 1) },
    scale: len * 0.55, // pad radius ≈ half shoulder-to-elbow
    rotation: { x: pitch, y: 0, z: rotZ },
    confidence: conf
  };
}

export function computeShoulderPadTransforms(
  landmarks: readonly PoseLandmark[],
  options: { mirrorX?: boolean } = {}
): ShoulderTransforms {
  const mirrorX = options.mirrorX ?? false;
  const ls = landmarks[SHOULDER_PAD_LANDMARKS.leftShoulder];
  const rs = landmarks[SHOULDER_PAD_LANDMARKS.rightShoulder];
  const le = landmarks[SHOULDER_PAD_LANDMARKS.leftElbow];
  const re = landmarks[SHOULDER_PAD_LANDMARKS.rightElbow];

  return {
    left: usable(ls) && usable(le) ? buildPad(ls, le, "left", mirrorX) : null,
    right: usable(rs) && usable(re) ? buildPad(rs, re, "right", mirrorX) : null
  };
}
