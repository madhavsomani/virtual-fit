// Phase 7.109 — proactive guidance derivation.
//
// 7.102 surfaces the per-frame "held" chip when an axis has stalled for
// thresholdFrames in a row (default 6). That's REACTIVE: the user already
// sees the overlay drift before the chip fires.
//
// This module is PROACTIVE: it watches the running totals (totals[axis] /
// totalFrames) and emits a softer hint BEFORE the per-frame chip would
// trigger. If yaw has been bad 35% of the recent window even though right
// NOW it's fresh, we should still nudge "face the camera" — the next stall
// is statistically imminent.
//
// Contract:
//   - Pure: input is a tracking-telemetry snapshot, output is a hint or null.
//   - Output: { axis, label, ratio, severity: "soft"|"firm" } or null.
//   - severity: "soft" when ratio in [softThreshold, firmThreshold);
//                "firm" when ratio >= firmThreshold.
//   - Defensive: missing/non-finite snapshot → null. No frames yet → null.
//   - Warmup: requires at least `minFrames` (default 30 frames ~= 1s @ 30fps)
//     before emitting ANY hint. A 5-frame session with one bad frame would
//     show 20% — that's noise, not signal.
//   - Priority order matches 7.102: yaw > depth > pitch > roll. Same UX
//     ordering keeps the proactive hint and the reactive chip from
//     contradicting each other on which axis to address first.
//   - MUST NOT collide with the chip: if the snapshot's `held[axis]` for the
//     candidate axis is true, the chip is already showing — return null and
//     let the chip own the surface.

const AXES = /** @type {const} */ (["yaw", "depth", "pitch", "roll"]);

const LABELS = {
  yaw:   "Try to face the camera",
  depth: "Try moving closer to the camera",
  pitch: "Try standing a bit straighter",
  roll:  "Try keeping your shoulders level",
};

/**
 * @param {{
 *   snapshot: object,
 *   minFrames?: number,
 *   softThreshold?: number,
 *   firmThreshold?: number,
 * }} opts
 * @returns {{ axis: "yaw"|"depth"|"pitch"|"roll", label: string, ratio: number, severity: "soft"|"firm" } | null}
 */
export function deriveProactiveGuidance({
  snapshot,
  minFrames = 30,
  softThreshold = 0.25,
  firmThreshold = 0.5,
} = {}) {
  if (!snapshot || typeof snapshot !== "object") return null;

  const total = snapshot.totalFrames;
  if (typeof total !== "number" || !Number.isFinite(total) || total < minFrames) {
    return null;
  }

  const totals = snapshot.totals;
  const held = snapshot.held;
  if (!totals || typeof totals !== "object") return null;

  let chosen = null;
  for (const axis of AXES) {
    const v = totals[axis];
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) continue;
    const ratio = v / total;
    if (!Number.isFinite(ratio) || ratio < softThreshold) continue;

    // If the per-frame chip is already on for this axis, defer to it —
    // emitting both at once is noisy and sometimes contradictory.
    if (held && held[axis] === true) continue;

    const severity = ratio >= firmThreshold ? "firm" : "soft";
    chosen = { axis, label: LABELS[axis], ratio, severity };
    break; // priority order is fixed; first match wins
  }

  return chosen;
}

export const PROACTIVE_GUIDANCE_AXES = AXES;
export const PROACTIVE_GUIDANCE_LABELS = LABELS;
