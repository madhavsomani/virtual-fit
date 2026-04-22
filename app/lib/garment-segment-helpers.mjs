// Phase 4.1 — pure helpers for garment segmentation, extracted for unit testing.

export const GARMENT_LABELS = new Set([
  "Upper-clothes",
  "Dress",
  "Coat",
  "Skirt",
  "Pants",
  "Jumpsuits",
]);

export function pickGarmentEntries(entries) {
  if (!Array.isArray(entries)) return [];
  return entries.filter((e) => e && typeof e.label === "string" && GARMENT_LABELS.has(e.label));
}

export function unionMaskAlpha(masks, length) {
  // masks: Array<Uint8ClampedArray|number[]> all of `length` (single channel grayscale)
  const out = new Uint8ClampedArray(length);
  for (const m of masks) {
    for (let i = 0; i < length; i++) {
      const v = m[i] ?? 0;
      if (v > out[i]) out[i] = v;
    }
  }
  return out;
}

export function coverageFraction(alpha, threshold = 16) {
  let kept = 0;
  for (let i = 0; i < alpha.length; i++) if (alpha[i] > threshold) kept++;
  return alpha.length === 0 ? 0 : kept / alpha.length;
}
