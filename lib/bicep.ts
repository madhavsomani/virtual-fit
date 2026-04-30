/**
 * Upper-arm (bicep) anchor transforms for VF-12 prototype.
 *
 * Mirrors lib/gauntlet.ts but uses the shoulder→elbow segment instead of
 * elbow→wrist. Output schema is intentionally identical so the renderer
 * can reuse the same mesh group + apply function for both bicep and
 * gauntlet — just with different anchors.
 *
 * Per arm:
 *   - position = shoulder/elbow midpoint
 *   - scale    = shoulder-to-elbow distance
 *   - rotZ     = in-plane angle (0 = pointing down, like gauntlet)
 *   - rotY     = approximated yaw from shoulder→elbow x delta
 *   - confidence = avg visibility of the two landmarks
 */

import type { PoseLandmark } from "./armor";

export const BICEP_LANDMARKS = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14
} as const;

export interface BicepTransform {
  side: "left" | "right";
  position: { x: number; y: number; z: number };
  scale: number;
  rotation: { x: number; y: number; z: number };
  confidence: number;
}

const MIN_SEGMENT = 1e-5;
const MIN_VISIBILITY = 0.1;

function isUsable(l: PoseLandmark | undefined): l is PoseLandmark {
  return Boolean(
    l &&
      Number.isFinite(l.x) &&
      Number.isFinite(l.y) &&
      Number.isFinite(l.z) &&
      (l.visibility ?? 1) >= MIN_VISIBILITY
  );
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

interface ComputeOpts {
  mirrorX?: boolean;
}

function computeOne(
  side: "left" | "right",
  shoulder: PoseLandmark | undefined,
  elbow: PoseLandmark | undefined,
  opts: ComputeOpts
): BicepTransform | null {
  if (!isUsable(shoulder) || !isUsable(elbow)) return null;

  const dx = elbow.x - shoulder.x;
  const dy = elbow.y - shoulder.y;
  const length = Math.hypot(dx, dy);
  if (length < MIN_SEGMENT) return null;

  const rawAngle = Math.atan2(-dy, dx);
  const angle = rawAngle + Math.PI / 2;
  const rotZ = clamp(opts.mirrorX ? -angle : angle, -Math.PI, Math.PI);

  const yawRaw = Math.atan(dx * 1.4);
  const rotY = clamp(opts.mirrorX ? -yawRaw : yawRaw, -1.0, 1.0);

  const cx = (shoulder.x + elbow.x) / 2;
  const cy = (shoulder.y + elbow.y) / 2;
  const cz = (shoulder.z + elbow.z) / 2;

  const visSum = (shoulder.visibility ?? 1) + (elbow.visibility ?? 1);

  return {
    side,
    position: {
      x: clamp(opts.mirrorX ? 1 - cx : cx, 0, 1),
      y: clamp(cy, 0, 1),
      z: clamp(-cz, -1, 1)
    },
    scale: length,
    rotation: { x: 0, y: rotY, z: rotZ },
    confidence: clamp(visSum / 2, 0, 1)
  };
}

export function computeBicepTransforms(
  landmarks: readonly PoseLandmark[],
  opts: ComputeOpts = {}
): { left: BicepTransform | null; right: BicepTransform | null } {
  return {
    left: computeOne(
      "left",
      landmarks[BICEP_LANDMARKS.leftShoulder],
      landmarks[BICEP_LANDMARKS.leftElbow],
      opts
    ),
    right: computeOne(
      "right",
      landmarks[BICEP_LANDMARKS.rightShoulder],
      landmarks[BICEP_LANDMARKS.rightElbow],
      opts
    )
  };
}
