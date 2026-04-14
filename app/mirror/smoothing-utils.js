function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function sanitizeAlpha(alpha) {
  if (!Number.isFinite(alpha)) {
    return 0.35;
  }

  return clamp(alpha, 0.01, 1);
}

/**
 * @param {number | null | undefined} previous
 * @param {number | null | undefined} next
 * @param {{ alpha?: number, min?: number, max?: number }} [options]
 * @returns {number | null}
 */
export function smoothScalar(previous, next, options = {}) {
  if (!Number.isFinite(next)) {
    return null;
  }

  const alpha = sanitizeAlpha(options.alpha ?? 0.35);
  const min = Number.isFinite(options.min) ? options.min : -Infinity;
  const max = Number.isFinite(options.max) ? options.max : Infinity;

  if (!Number.isFinite(previous)) {
    return clamp(Number(next), min, max);
  }

  const smoothed = Number(previous) + (Number(next) - Number(previous)) * alpha;
  return clamp(smoothed, min, max);
}

/**
 * @param {{ left: number, top: number, width: number, height: number } | null | undefined} previous
 * @param {{ left: number, top: number, width: number, height: number }} next
 * @param {{ alpha?: number }} [options]
 */
export function smoothOverlayRect(previous, next, options = {}) {
  const alpha = sanitizeAlpha(options.alpha ?? 0.32);

  return {
    left: smoothScalar(previous?.left, next.left, { alpha, min: 0, max: 1 }) ?? clamp(next.left, 0, 1),
    top: smoothScalar(previous?.top, next.top, { alpha, min: 0, max: 1 }) ?? clamp(next.top, 0, 1),
    width: smoothScalar(previous?.width, next.width, { alpha, min: 0.08, max: 1 }) ?? clamp(next.width, 0.08, 1),
    height: smoothScalar(previous?.height, next.height, { alpha, min: 0.08, max: 1 }) ?? clamp(next.height, 0.08, 1)
  };
}
