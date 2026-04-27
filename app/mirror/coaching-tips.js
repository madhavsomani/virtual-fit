// Phase 7.112 — pure derivation: 1-3 prioritized coaching tips for the
// session, derived from the same summary the quality badge uses.
//
// THE GAP THIS CLOSES: 7.111 grades a session ("Fair"). 7.112 tells the
// user *how* to get to "Good": which axes were the worst, what to do about
// each, in priority order. "You got Fair, here's exactly how to get Good."
//
// Each tip is keyed by axis ('yaw'|'pitch'|'roll'|'depth') so the HUD can
// render an icon per tip without inlining strings. Tips are filtered by
// `heldRatio >= TIP_THRESHOLD` (default 0.10) so we don't fabricate
// problems where there weren't any. Capped at 3 because more than 3
// simultaneous "try X" instructions is just noise.
//
// Pure: no React, no DOM, no clock. Same testability rules as every other
// derivation in this folder.

const TIP_THRESHOLD = 0.10;
const MAX_TIPS = 3;

// Same priority order as 7.102 chip + 7.109 proactive pill: yaw > depth >
// pitch > roll. Stable across the codebase so the worst-axis the badge
// blamed is the first tip the coaching screen surfaces.
const PRIORITY = ["yaw", "depth", "pitch", "roll"];

// UX copy. Each tip pairs a short imperative title with a one-sentence
// "why" that acknowledges the on-screen failure mode. Title-only would
// read as nagging ("Face the camera." "Stand up straighter."); the why-
// line says "I see what happened, here's the fix."
const TIPS = Object.freeze({
  yaw: Object.freeze({
    axis: "yaw",
    title: "Face the camera straight on",
    detail: "Side angles confuse the body model and the overlay drifts off your shoulders.",
  }),
  depth: Object.freeze({
    axis: "depth",
    title: "Stand a step closer to the camera",
    detail: "Smaller silhouettes lose joint detail, so the garment can't lock to your body.",
  }),
  pitch: Object.freeze({
    axis: "pitch",
    title: "Hold the camera at chest height",
    detail: "Steep up- or down-angles flatten depth cues and the overlay tilts the wrong way.",
  }),
  roll: Object.freeze({
    axis: "roll",
    title: "Keep the phone level (vertical)",
    detail: "A tilted frame fights the body's roll axis and causes the garment to wobble.",
  }),
});

export const COACHING_TIP_AXES = Object.freeze([...PRIORITY]);
export const COACHING_TIP_THRESHOLD = TIP_THRESHOLD;
export const COACHING_TIP_MAX = MAX_TIPS;
export const COACHING_TIPS = TIPS;

/**
 * @param {{
 *   summary: any,
 *   threshold?: number,
 *   maxTips?: number,
 * }} input
 * @returns {Array<{ axis: string, title: string, detail: string, ratio: number }>}
 */
export function deriveCoachingTips(input) {
  if (!input || typeof input !== "object") return [];
  const { summary } = input;
  if (!summary || typeof summary !== "object") return [];
  const perAxis = summary.perAxis;
  if (!perAxis || typeof perAxis !== "object") return [];

  const totalFrames = summary.totalFrames;
  if (
    typeof totalFrames !== "number" ||
    !Number.isFinite(totalFrames) ||
    totalFrames <= 0
  ) {
    return [];
  }

  const threshold =
    typeof input.threshold === "number" &&
    Number.isFinite(input.threshold) &&
    input.threshold >= 0
      ? input.threshold
      : TIP_THRESHOLD;
  const maxTips =
    typeof input.maxTips === "number" &&
    Number.isFinite(input.maxTips) &&
    input.maxTips >= 0
      ? Math.floor(input.maxTips)
      : MAX_TIPS;

  /** @type {Array<{ axis: string, title: string, detail: string, ratio: number }>} */
  const out = [];
  // Walk in priority order so ties resolve to the canonical axis ranking
  // and the badge's worstAxis is always tip #1 when it qualifies.
  for (const axis of PRIORITY) {
    if (out.length >= maxTips) break;
    const a = perAxis[axis];
    if (!a || typeof a !== "object") continue;
    const ratio = a.heldRatio;
    if (typeof ratio !== "number" || !Number.isFinite(ratio)) continue;
    if (ratio < threshold) continue;
    const tip = TIPS[axis];
    if (!tip) continue;
    out.push({ axis, title: tip.title, detail: tip.detail, ratio });
  }
  return out;
}
