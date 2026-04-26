// Phase 7.102 — derive HUD chip state from a tracking-telemetry snapshot.
//
// Why a separate pure module: the React render layer should NOT decide what
// "long enough to show the user" means. That's product policy (debounce
// threshold, label per axis, dismissal grace). Keep it in a unit-tested
// pure function so we can change thresholds without touching the inner-loop
// rAF code, and so an integration test can drive the chip without mounting
// the whole mirror page.
//
// Contract:
//   - input  = { snapshot, thresholdFrames? }
//   - output = { visible, axes, primaryAxis, label, since } | null when no chip
//
// "since" = the smallest holds[axis] value among the held-and-over-threshold
// axes. UI uses it to render "held for ~Ns" (frame count / fps).

const AXIS_LABELS = {
  yaw:   "Face the camera",
  pitch: "Stand a bit straighter",
  roll:  "Level your shoulders",
  depth: "Step forward",
};

const AXIS_PRIORITY = ["yaw", "depth", "pitch", "roll"];

/**
 * @typedef {import("./tracking-telemetry.js").TrackingTelemetryState} TrackingTelemetryState
 */

/**
 * @param {{ snapshot: TrackingTelemetryState | null | undefined, thresholdFrames?: number }} input
 * @returns {{
 *   visible: true,
 *   axes: Array<"yaw"|"pitch"|"roll"|"depth">,
 *   primaryAxis: "yaw"|"pitch"|"roll"|"depth",
 *   label: string,
 *   since: number,
 * } | null}
 */
export function deriveTrackingHeldChip(input) {
  const snapshot = input?.snapshot;
  if (!snapshot) return null;

  // Default ≈100ms at 60fps. Below this, holds are imperceptible — showing a
  // chip every micro-dip would be more noisy than the lie 7.88+ closed.
  const threshold = Number.isFinite(input?.thresholdFrames)
    ? Math.max(1, Math.floor(input.thresholdFrames))
    : 6;

  const holds = snapshot.holds ?? {};
  const heldAxes = AXIS_PRIORITY.filter(
    (axis) => Number.isFinite(holds[axis]) && holds[axis] >= threshold,
  );
  if (heldAxes.length === 0) return null;

  const primaryAxis = heldAxes[0];

  // since = smallest streak among visible axes. Visually "held for ~Ns" should
  // reflect the SHORTEST one — that's the most conservative claim. Picking the
  // longest would lie about a freshly-held second axis.
  const since = heldAxes.reduce(
    (min, axis) => Math.min(min, holds[axis]),
    Infinity,
  );

  return {
    visible: true,
    axes: heldAxes,
    primaryAxis,
    label: AXIS_LABELS[primaryAxis],
    since,
  };
}

export const TRACKING_HELD_AXIS_LABELS = AXIS_LABELS;
export const TRACKING_HELD_AXIS_PRIORITY = AXIS_PRIORITY;
