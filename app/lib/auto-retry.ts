// Phase 7.94 — auto-retry policy for the Photo→3D pipeline.
//
// When humanizePipelineError (Phase 7.92) reports `retryable: true`, the user
// shouldn't have to babysit the page. Most retryable failures are transient
// shared-resource problems (TRELLIS queue full at peak, brief network blip,
// HF Space cold-starting). The fix: auto-retry with backoff, surfacing a
// countdown so the user sees what's happening and can cancel if they want.
//
// Design decisions (deliberate, locked by tests):
// - MAX 3 attempts after the initial try. Any more and we're hammering a
//   service that's clearly down — switch to "Try Again" manual mode.
// - Backoff is failure-class-aware, not just exponential:
//     queue_full / "TRELLIS is busy"   → 30s, 60s, 120s   (queue drains slowly)
//     "TRELLIS hit a snag" / 5xx       → 10s, 20s, 40s    (transient server)
//     "3D generation stalled"          → 15s, 30s, 60s    (timeout — give it space)
//     "Network problem"                → 5s, 10s, 20s     (likely flap, retry fast)
//     "Cancelled"                      → never auto-retry (user action)
//     anything else retryable          → 10s, 20s, 40s    (default backoff)
// - "retryable: false" classes never auto-retry (Photo too large, format
//   not supported, HF service not configured, segformer failed) — manual
//   action required (different photo / operator fix).
// - Returns null when no auto-retry should occur. UI hides the countdown.
//
// Pure module: no React, no setTimeout, no DOM. Tests assert the policy;
// the UI layer wraps a setTimeout around the returned delay.

import type { HumanError } from "./humanize-pipeline-error";

export const MAX_AUTO_RETRY_ATTEMPTS = 3;

export type AutoRetryPlan = {
  delayMs: number;
  attempt: number; // 1-indexed: 1 = first auto-retry, MAX = last
  reason: string; // Human label for the countdown UI ("TRELLIS busy")
};

/**
 * Compute the next auto-retry delay for a given humanized error and the
 * number of auto-retry attempts already made (0 on first failure).
 *
 * Returns null when:
 *   - humanError.retryable === false (manual action required)
 *   - the failure class is "Cancelled" (user explicitly aborted)
 *   - attemptsAlready >= MAX_AUTO_RETRY_ATTEMPTS (give up, show manual)
 */
export function planAutoRetry(
  humanError: HumanError | null | undefined,
  attemptsAlready: number,
): AutoRetryPlan | null {
  if (!humanError) return null;
  if (!humanError.retryable) return null;
  if (humanError.title === "Cancelled") return null;
  if (attemptsAlready >= MAX_AUTO_RETRY_ATTEMPTS) return null;

  const attempt = attemptsAlready + 1; // 1-indexed
  const ladder = backoffLadder(humanError.title);
  // Cap the index so attempt 4+ would reuse the last value (defensive; we
  // already gate with MAX above).
  const idx = Math.min(attempt - 1, ladder.length - 1);
  return {
    delayMs: ladder[idx],
    attempt,
    reason: humanError.title,
  };
}

function backoffLadder(title: string): number[] {
  switch (title) {
    case "TRELLIS is busy right now":
      return [30_000, 60_000, 120_000];
    case "TRELLIS hit a snag":
      return [10_000, 20_000, 40_000];
    case "3D generation stalled":
      return [15_000, 30_000, 60_000];
    case "Network problem":
      return [5_000, 10_000, 20_000];
    default:
      return [10_000, 20_000, 40_000];
  }
}
