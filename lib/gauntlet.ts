/**
 * Forearm (gauntlet) anchor transforms for VF-12 prototype.
 *
 * Sibling to lib/armor.ts (chest) and lib/helmet.ts (head). Computes one
 * transform per arm using MediaPipe Pose landmarks already produced by the
 * same tracker — no extra model.
 *
 * Inputs (per arm):
 *   - shoulder (11/12), elbow (13/14), wrist (15/16)
 *
 * Output per arm:
 *   - position: midpoint of elbow→wrist (forearm center), normalized image coords
 *   - scale: elbow-to-wrist distance (forearm length)
 *   - rotation.z: forearm angle in image plane (atan2(wrist-elbow))
 *   - rotation.y: gross arm yaw approximated from shoulder→wrist x delta
 *   - confidence: avg visibility of the three landmarks
 *
 * Pure / deterministic / clock-free.
 */

import type { PoseLandmark } from "./armor";

export const ARM_LANDMARKS = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftElbow: 13,
  rightElbow: 14,
  leftWrist: 15,
  rightWrist: 16
} as const;

export interface GauntletTransform {
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
  wrist: PoseLandmark | undefined,
  opts: ComputeOpts
): GauntletTransform | null {
  if (!isUsable(elbow) || !isUsable(wrist)) return null;

  const dx = wrist.x - elbow.x;
  const dy = wrist.y - elbow.y;
  const length = Math.hypot(dx, dy);
  if (length < MIN_SEGMENT) return null;

  // Roll/pitch left at zero; rotation.z is the in-plane forearm angle.
  // atan2(dy,dx) of an elbow→wrist that points down-and-out gives an angle in
  // image-y-down space; flip dy so it matches the renderer's y-up convention.
  const rawAngle = Math.atan2(-dy, dx);
  // Renderer expects "0 = pointing right". We rotate so that 0 = pointing
  // straight down (typical relaxed-arm orientation), then mirror as needed.
  const angle = rawAngle + Math.PI / 2;
  const rotZ = clamp(opts.mirrorX ? -angle : angle, -Math.PI, Math.PI);

  // Approximate gross arm yaw from shoulder→wrist horizontal delta. Useful
  // for hinting the gauntlet's facing when arms swing forward/back.
  let rotY = 0;
  if (isUsable(shoulder)) {
    const xy = wrist.x - shoulder.x;
    const yawRaw = Math.atan(xy * 1.4);
    rotY = clamp(opts.mirrorX ? -yawRaw : yawRaw, -1.0, 1.0);
  }

  const cx = (elbow.x + wrist.x) / 2;
  const cy = (elbow.y + wrist.y) / 2;
  const cz = (elbow.z + wrist.z) / 2;

  const visSum =
    (elbow.visibility ?? 1) +
    (wrist.visibility ?? 1) +
    (isUsable(shoulder) ? (shoulder.visibility ?? 1) : 0.5);

  return {
    side,
    position: {
      x: clamp(opts.mirrorX ? 1 - cx : cx, 0, 1),
      y: clamp(cy, 0, 1),
      z: clamp(-cz, -1, 1)
    },
    scale: length,
    rotation: { x: 0, y: rotY, z: rotZ },
    confidence: clamp(visSum / 3, 0, 1)
  };
}

export function computeGauntletTransforms(
  landmarks: readonly PoseLandmark[],
  opts: ComputeOpts = {}
): { left: GauntletTransform | null; right: GauntletTransform | null } {
  return {
    left: computeOne(
      "left",
      landmarks[ARM_LANDMARKS.leftShoulder],
      landmarks[ARM_LANDMARKS.leftElbow],
      landmarks[ARM_LANDMARKS.leftWrist],
      opts
    ),
    right: computeOne(
      "right",
      landmarks[ARM_LANDMARKS.rightShoulder],
      landmarks[ARM_LANDMARKS.rightElbow],
      landmarks[ARM_LANDMARKS.rightWrist],
      opts
    )
  };
}
