function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

const KEY_POSE_LANDMARK_INDICES = new Set([11, 12, 23, 24]);

/**
 * Build drawable landmark points for a mirrored pose overlay canvas.
 *
 * @param {{
 *   landmarks?: Array<{ x?: number, y?: number, visibility?: number }> | null,
 *   frameWidthPx?: number | null,
 *   frameHeightPx?: number | null,
 *   minVisibility?: number
 * }} input
 * @returns {Array<{ x: number, y: number, radius: number, color: string }>}
 */
export function buildPoseLandmarkOverlayPoints(input) {
  const landmarks = input?.landmarks;
  const frameWidthPx = input?.frameWidthPx;
  const frameHeightPx = input?.frameHeightPx;
  const minVisibility = Number.isFinite(input?.minVisibility) ? Number(input.minVisibility) : 0.2;

  if (!Array.isArray(landmarks) || !Number.isFinite(frameWidthPx) || !Number.isFinite(frameHeightPx)) {
    return [];
  }

  if (frameWidthPx <= 0 || frameHeightPx <= 0) {
    return [];
  }

  const points = [];

  for (let index = 0; index < landmarks.length; index += 1) {
    const landmark = landmarks[index];

    if (!landmark || !Number.isFinite(landmark.x) || !Number.isFinite(landmark.y)) {
      continue;
    }

    if (Number.isFinite(landmark.visibility) && Number(landmark.visibility) < minVisibility) {
      continue;
    }

    const mirroredX = Math.round(clamp((1 - Number(landmark.x)) * Number(frameWidthPx), 0, Number(frameWidthPx)));
    const y = Math.round(clamp(Number(landmark.y) * Number(frameHeightPx), 0, Number(frameHeightPx)));
    const isKeyPoint = KEY_POSE_LANDMARK_INDICES.has(index);

    points.push({
      x: mirroredX,
      y,
      radius: isKeyPoint ? 4 : 2,
      color: isKeyPoint ? "rgba(120, 200, 255, 0.95)" : "rgba(78, 255, 174, 0.85)"
    });
  }

  return points;
}
