import type { ArmorTransform } from "./armor";

/**
 * Exponential smoothing for armor transforms.
 *
 * Raw MediaPipe landmark output ticks per video frame and contains noise
 * that visibly jitters the armor mesh. We blend each new transform with
 * the previously emitted transform using a simple low-pass filter:
 *
 *   smoothed = prev * (1 - alpha) + next * alpha
 *
 * `alpha` is in (0, 1]. Higher = more responsive, lower = smoother.
 * `null` inputs reset the filter so the next sample is emitted as-is.
 *
 * Pure: state lives inside the closure returned by `createTransformSmoother`,
 * NOT in module scope, so multiple consumers (and tests) stay isolated.
 */

export interface TransformSmootherOptions {
  /** Position/scale low-pass coefficient. Defaults to 0.35. */
  positionAlpha?: number;
  /** Rotation low-pass coefficient. Defaults to 0.4 (rotation feels slower at low alpha). */
  rotationAlpha?: number;
}

export interface TransformSmoother {
  push(next: ArmorTransform | null): ArmorTransform | null;
  reset(): void;
}

const DEFAULT_POS_ALPHA = 0.35;
const DEFAULT_ROT_ALPHA = 0.4;

function clampAlpha(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  if (value <= 0) return fallback;
  if (value > 1) return 1;
  return value;
}

function lerp(prev: number, next: number, alpha: number): number {
  return prev + (next - prev) * alpha;
}

function lerpAngle(prev: number, next: number, alpha: number): number {
  // Shortest-arc interpolation so wrap-around (e.g. -π → +π) doesn't spin.
  let delta = next - prev;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  return prev + delta * alpha;
}

export function createTransformSmoother(
  options: TransformSmootherOptions = {}
): TransformSmoother {
  const posAlpha = clampAlpha(options.positionAlpha, DEFAULT_POS_ALPHA);
  const rotAlpha = clampAlpha(options.rotationAlpha, DEFAULT_ROT_ALPHA);
  let prev: ArmorTransform | null = null;

  return {
    push(next) {
      if (next === null) {
        prev = null;
        return null;
      }
      if (prev === null) {
        prev = cloneTransform(next);
        return cloneTransform(next);
      }
      const blended: ArmorTransform = {
        position: {
          x: lerp(prev.position.x, next.position.x, posAlpha),
          y: lerp(prev.position.y, next.position.y, posAlpha),
          z: lerp(prev.position.z, next.position.z, posAlpha)
        },
        scale: lerp(prev.scale, next.scale, posAlpha),
        rotation: {
          x: lerpAngle(prev.rotation.x, next.rotation.x, rotAlpha),
          y: lerpAngle(prev.rotation.y, next.rotation.y, rotAlpha),
          z: lerpAngle(prev.rotation.z, next.rotation.z, rotAlpha)
        },
        confidence: lerp(prev.confidence, next.confidence, posAlpha)
      };
      prev = cloneTransform(blended);
      return blended;
    },
    reset() {
      prev = null;
    }
  };
}

function cloneTransform(t: ArmorTransform): ArmorTransform {
  return {
    position: { x: t.position.x, y: t.position.y, z: t.position.z },
    scale: t.scale,
    rotation: { x: t.rotation.x, y: t.rotation.y, z: t.rotation.z },
    confidence: t.confidence
  };
}
