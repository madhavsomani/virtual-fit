// Phase 7.101 — per-axis null-hold telemetry for the 6-DOF pose pipeline.
//
// 7.88/7.89/7.91/7.98 made each Euler/depth axis strict-null: when the source
// signal is unreliable, the function returns null and the smoother HOLDS the
// last good value instead of fabricating "neutral."
//
// But: from the outside (HUD, devtools, dashboards) we cannot tell which axis
// just held vs. updated, or how often. This module is the observability layer.
//
// Design goals:
//   - Pure (no React, no DOM). Same module unit-testable + reusable.
//   - O(1) per frame. We're inside requestAnimationFrame; allocations matter.
//   - Snapshot is structurally cloneable — safe to ship to a worker / postMessage.
//
// The Phase 7.99 lesson applies here too: this counter is policy-only. A future
// HUD that reads `state.holds.pitch` MUST treat 0 as "fresh frame" and any
// positive value as "held." The static-grep guards in
// mirror-strict-null-regression-guard.test.mjs already protect the upstream
// strict-null contract; this module only protects the *observability* of it.

/**
 * @typedef {Object} TrackingTelemetryState
 * @property {number} totalFrames        - frames the tracker has processed since createTrackingTelemetry()
 * @property {{ yaw: number, pitch: number, roll: number, depth: number }} holds   - per-axis CURRENT consecutive-hold streak
 * @property {{ yaw: number, pitch: number, roll: number, depth: number }} maxHold - per-axis longest streak observed
 * @property {{ yaw: number, pitch: number, roll: number, depth: number }} totals  - per-axis cumulative null-frame count
 * @property {{ yaw: boolean, pitch: boolean, roll: boolean, depth: boolean }} held - convenience: holds[axis] > 0
 */

const AXES = /** @type {const} */ (["yaw", "pitch", "roll", "depth"]);

function makeAxisRecord(value) {
  return { yaw: value, pitch: value, roll: value, depth: value };
}

/**
 * Construct a fresh telemetry instance.
 *
 * @returns {{
 *   recordFrame: (input: Partial<Record<typeof AXES[number], unknown>>) => void,
 *   snapshot: () => TrackingTelemetryState,
 *   reset: () => void,
 * }}
 */
export function createTrackingTelemetry() {
  let totalFrames = 0;
  const holds = makeAxisRecord(0);
  const maxHold = makeAxisRecord(0);
  const totals = makeAxisRecord(0);

  return {
    /**
     * Record a single tracker frame. `input[axis] === null` means the strict-null
     * function returned null and the smoother held the last good value. Anything
     * else (a finite number) is treated as a fresh measurement that resets the
     * current streak for that axis.
     *
     * Unknown / extra keys on `input` are ignored. Missing keys default to
     * "fresh" (NOT held) — this matches the production wiring where every axis
     * is computed every frame; if the caller truly omits an axis, treating it as
     * fresh keeps the streak counter from spuriously climbing.
     */
    recordFrame(input) {
      totalFrames += 1;
      const safe = input ?? {};
      for (const axis of AXES) {
        if (safe[axis] === null) {
          holds[axis] += 1;
          totals[axis] += 1;
          if (holds[axis] > maxHold[axis]) maxHold[axis] = holds[axis];
        } else {
          holds[axis] = 0;
        }
      }
    },

    /**
     * Returns a structurally-cloneable snapshot of current state. Safe to
     * postMessage to a worker, JSON.stringify, or render in a HUD. Each call
     * allocates fresh objects — callers are NOT mutating internal state.
     */
    snapshot() {
      return {
        totalFrames,
        holds: { ...holds },
        maxHold: { ...maxHold },
        totals: { ...totals },
        held: {
          yaw:   holds.yaw   > 0,
          pitch: holds.pitch > 0,
          roll:  holds.roll  > 0,
          depth: holds.depth > 0,
        },
      };
    },

    reset() {
      totalFrames = 0;
      for (const axis of AXES) {
        holds[axis] = 0;
        maxHold[axis] = 0;
        totals[axis] = 0;
      }
    },
  };
}
