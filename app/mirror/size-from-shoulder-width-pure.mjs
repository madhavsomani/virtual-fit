// Phase 7.31 — pure size estimation extracted from the /mirror render loop.
//
// This is the single truth source. The TS sibling
// `size-from-shoulder-width.ts` re-exports the function with a typed
// signature so Next/TypeScript callers get autocomplete + size literals,
// and node:test can import this file directly.
//
// Maps shoulder width (as a fraction of the video frame width) to a
// clothing size string. Assumes the user is framed at ~1-2 m from the
// camera with shoulders occupying ~22-45% of frame width — reasonable
// for a default laptop webcam at chest height.

/** Ordered (size, upper-bound) pairs. First match wins. */
export const SHOULDER_RATIO_THRESHOLDS = [
  ["XS", 0.22],
  ["S", 0.27],
  ["M", 0.32],
  ["L", 0.38],
  ["XL", 0.45],
  ["XXL", Number.POSITIVE_INFINITY],
];

/**
 * @param {number} ratio shoulder pixel width / video frame width.
 * @returns {"XS"|"S"|"M"|"L"|"XL"|"XXL"}
 */
export function estimateSizeFromShoulderRatio(ratio) {
  // Defensive: NaN compares false to everything; treat NaN/negative as the
  // smallest bucket. +Infinity falls through to the final +Infinity
  // upper-bound and resolves to XXL, which matches user intent (huge
  // shoulder-fraction → biggest size).
  if (Number.isNaN(ratio) || ratio < 0) return "XS";
  for (const [size, upper] of SHOULDER_RATIO_THRESHOLDS) {
    if (ratio < upper) return size;
  }
  return "XXL";
}
