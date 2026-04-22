// Phase 4.2 — pure orchestration helper for garment isolation.
// The TS version in remove-background.ts re-exports the same logic; this is the
// JS-importable copy used by node:test.

const COVERAGE_THRESHOLD = 0.02;

export function isFakeBlob(x) {
  return x && typeof x === "object" && typeof x.size === "number";
}

export async function isolateGarmentImpl(input, segment, removeBackground) {
  try {
    const seg = await segment(input);
    if (seg && typeof seg.coverage === "number" && seg.coverage > COVERAGE_THRESHOLD) {
      return { png: seg.garmentPng, method: "segformer" };
    }
  } catch {
    // fall through
  }
  const png = await removeBackground(input);
  return { png, method: "rmbg" };
}
