// JS-importable mirror of computeNormalizeScale for node:test.
export function computeNormalizeScale(maxDim, targetSize = 2.0) {
  if (!Number.isFinite(maxDim) || maxDim <= 0) return 1;
  return targetSize / maxDim;
}
