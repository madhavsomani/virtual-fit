/**
 * Tracking-status hysteresis gate.
 *
 * Raw per-frame `valid | invalid` signal flickers near edges of detection
 * (one bad frame → status drops to "searching" → next frame back to "locked").
 * This wraps the signal in a counter-based hysteresis:
 *
 *   - "locked" requires `lockFrames` consecutive valid frames
 *   - "searching" requires `unlockFrames` consecutive invalid frames
 *
 * Defaults are asymmetric on purpose: get to "locked" slowly (3 frames @
 * 30fps ≈ 100ms), drop out fast (5 frames ≈ 170ms) — feels responsive when
 * the user steps out of frame, calm when tracking is borderline.
 *
 * Pure: state lives in the closure; clock-free; deterministic.
 */

export type TrackingPhase = "searching" | "locked";

export interface TrackingGateOptions {
  lockFrames?: number;
  unlockFrames?: number;
}

export interface TrackingGate {
  push(valid: boolean): TrackingPhase;
  reset(): void;
}

const DEFAULT_LOCK = 3;
const DEFAULT_UNLOCK = 5;

function clampInt(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const rounded = Math.round(value);
  if (rounded < 1) return fallback;
  return rounded;
}

export function createTrackingGate(options: TrackingGateOptions = {}): TrackingGate {
  const lockN = clampInt(options.lockFrames, DEFAULT_LOCK);
  const unlockN = clampInt(options.unlockFrames, DEFAULT_UNLOCK);

  let phase: TrackingPhase = "searching";
  let validStreak = 0;
  let invalidStreak = 0;

  return {
    push(valid) {
      if (valid) {
        validStreak += 1;
        invalidStreak = 0;
        if (phase === "searching" && validStreak >= lockN) {
          phase = "locked";
        }
      } else {
        invalidStreak += 1;
        validStreak = 0;
        if (phase === "locked" && invalidStreak >= unlockN) {
          phase = "searching";
        }
      }
      return phase;
    },
    reset() {
      phase = "searching";
      validStreak = 0;
      invalidStreak = 0;
    }
  };
}
