// Phase 7.111 — pure derivation: a session's overall tracking quality
// translated to a four-band user-facing label.
//
// Inputs come from the session-summary builder (7.104): overallHeldRatio in
// [0,1]. Bands tuned to match what users will perceive on screen:
//
//   excellent: ≤ 5%  held → smooth, almost imperceptible smoothing
//   good:      ≤ 15% held → occasional micro-corrections, still feels live
//   fair:      ≤ 30% held → noticeable holds, garment lags behind motion
//   poor:      >  30% held → frequent holds, overlay clearly fights the body
//
// Returns a stable enum + a sentence-cased label + a short caption hint and
// a tone (used by the HUD to pick a color band). Pure: no React, no DOM, no
// clock. Same testability rules as every other derivation in this folder.
//
// Defensive: invalid input → null (HUD should hide rather than mislead).

const BANDS = [
  { tier: "excellent", maxRatio: 0.05, label: "Excellent",
    caption: "Smooth tracking the whole session.", tone: "success" },
  { tier: "good", maxRatio: 0.15, label: "Good",
    caption: "Mostly steady — minor catches.", tone: "success" },
  { tier: "fair", maxRatio: 0.30, label: "Fair",
    caption: "Some lag — try better lighting next time.", tone: "warning" },
  { tier: "poor", maxRatio: Infinity, label: "Poor",
    caption: "Frequent holds — try moving closer in good light.", tone: "danger" },
];

export const SESSION_QUALITY_TIERS = Object.freeze(
  BANDS.map((b) => b.tier),
);

/**
 * @param {{ summary: any }} input
 * @returns {{ tier: string, label: string, caption: string, tone: string, ratio: number } | null}
 */
export function deriveSessionQuality(input) {
  if (!input || typeof input !== "object") return null;
  const { summary } = input;
  if (!summary || typeof summary !== "object") return null;

  // Need a finite ratio in [0,1]; total frames must be > 0 (otherwise we're
  // grading a zero-frame session, which is meaningless).
  const ratio = summary.overallHeldRatio;
  const totalFrames = summary.totalFrames;
  if (typeof ratio !== "number" || !Number.isFinite(ratio)) return null;
  if (typeof totalFrames !== "number" || !Number.isFinite(totalFrames) || totalFrames <= 0) {
    return null;
  }
  if (ratio < 0 || ratio > 1) return null;

  for (const band of BANDS) {
    if (ratio <= band.maxRatio) {
      return {
        tier: band.tier,
        label: band.label,
        caption: band.caption,
        tone: band.tone,
        ratio,
      };
    }
  }
  // Unreachable (last band has Infinity), but TS-style exhaustiveness guard.
  return null;
}

export const SESSION_QUALITY_BANDS = Object.freeze(
  BANDS.map((b) => Object.freeze({ ...b })),
);
