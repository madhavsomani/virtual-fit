// Phase 7.110 — hysteresis / cooldown wrapper around the pure
// deriveProactiveGuidance derivation from 7.109.
//
// THE PROBLEM: 7.109's pure derivation is correct per-call but stateless.
// If a user crosses the soft threshold, sees the nudge, reacts, then
// drifts back across (which is normal: a held-frame burst recovers, totals
// stay above 25% but the user is responding) — the pill keeps showing.
// And if the ratio dips just below 25% for one second then back up, the
// pill flashes off and on. Both behaviors waste attention.
//
// THE FIX: a small state machine wrapping the pure derivation:
//   - "emitted" while the derivation is non-null
//   - "cooldown" for cooldownMs after the derivation goes null OR axis
//     changes (the user has acted; let them keep going)
//   - "idle" once the cooldown elapses
//
// During "cooldown" we suppress re-emission for the SAME axis. A different
// axis qualifying mid-cooldown DOES emit immediately — different problem,
// different signal.
//
// Pure-with-time. The factory takes no clock; evaluate(snapshot, nowMs)
// receives the time externally. Same testability pattern as session-summary
// builder + log appender — no Date.now() inside, deterministic in tests.

import { deriveProactiveGuidance } from "./proactive-guidance.js";

/** @typedef {NonNullable<ReturnType<typeof deriveProactiveGuidance>>} ProactiveGuidanceHint */

const DEFAULT_COOLDOWN_MS = 4000;

/**
 * @param {{
 *   cooldownMs?: number,
 *   minFrames?: number,
 *   softThreshold?: number,
 *   firmThreshold?: number,
 * }} [opts]
 * @returns {{
 *   evaluate: (snapshot: object, nowMs: number) => (ProactiveGuidanceHint | null),
 *   reset: () => void,
 * }}
 */
export function createProactiveGuidanceTracker(opts = {}) {
  const cooldownMs =
    typeof opts.cooldownMs === "number" && Number.isFinite(opts.cooldownMs) && opts.cooldownMs >= 0
      ? opts.cooldownMs
      : DEFAULT_COOLDOWN_MS;
  const passThrough = {
    minFrames: opts.minFrames,
    softThreshold: opts.softThreshold,
    firmThreshold: opts.firmThreshold,
  };

  // Last axis we emitted (currently visible), and a separate record of the
  // axis we're cooling down on (which may persist after the derivation has
  // gone null) plus when the cooldown elapses.
  /** @type {string|null} */ let lastAxis = null;
  /** @type {string|null} */ let cooldownAxis = null;
  /** @type {number|null} */ let cooldownUntil = null;

  return {
    evaluate(snapshot, nowMs) {
      const next = deriveProactiveGuidance({ snapshot, ...passThrough });
      const safeNow =
        typeof nowMs === "number" && Number.isFinite(nowMs) ? nowMs : 0;

      if (!next) {
        // Derivation is clean. If we were emitting, start cooldown on that axis.
        if (lastAxis !== null) {
          cooldownAxis = lastAxis;
          cooldownUntil = safeNow + cooldownMs;
          lastAxis = null;
        }
        return null;
      }

      // Inside a same-axis cooldown? Suppress.
      if (
        cooldownAxis !== null &&
        cooldownUntil !== null &&
        next.axis === cooldownAxis &&
        safeNow < cooldownUntil
      ) {
        return null;
      }

      // Either a different axis (different signal, emit) or cooldown elapsed.
      cooldownAxis = null;
      cooldownUntil = null;
      lastAxis = next.axis;
      return next;
    },
    reset() {
      lastAxis = null;
      cooldownAxis = null;
      cooldownUntil = null;
    },
  };
}

export const PROACTIVE_GUIDANCE_DEFAULT_COOLDOWN_MS = DEFAULT_COOLDOWN_MS;
