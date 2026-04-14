/**
 * @typedef {Object} RawLandmark
 * @property {number} [x]
 * @property {number} [y]
 * @property {number} [z]
 * @property {number} [visibility]
 */

/**
 * @typedef {Object} NormalizedLandmark
 * @property {number} x
 * @property {number} y
 * @property {number} z
 * @property {number} visibility
 */

/**
 * @typedef {Object} NormalizedBounds
 * @property {number} minX
 * @property {number} maxX
 * @property {number} minY
 * @property {number} maxY
 * @property {number} width
 * @property {number} height
 * @property {number} centerX
 * @property {number} centerY
 */

function clamp01(value, fallback = 0) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(1, Math.max(0, value));
}

/**
 * @param {RawLandmark | undefined} landmark
 * @param {number} fallbackVisibility
 * @returns {NormalizedLandmark}
 */
function normalizeLandmarkPoint(landmark, fallbackVisibility) {
  return {
    x: clamp01(landmark?.x, 0.5),
    y: clamp01(landmark?.y, 0.5),
    z: Number.isFinite(landmark?.z) ? Number(landmark.z) : 0,
    visibility: clamp01(landmark?.visibility, fallbackVisibility)
  };
}

/**
 * @param {RawLandmark[] | undefined} landmarks
 * @param {{ minLength: number, fallbackVisibility: number }} options
 * @returns {NormalizedLandmark[] | null}
 */
function normalizeLandmarkList(landmarks, options) {
  if (!Array.isArray(landmarks) || landmarks.length < options.minLength) {
    return null;
  }

  return landmarks.map((landmark) => normalizeLandmarkPoint(landmark, options.fallbackVisibility));
}

/**
 * @param {RawLandmark[] | undefined} landmarks
 * @returns {NormalizedLandmark[] | null}
 */
export function normalizePoseLandmarks(landmarks) {
  return normalizeLandmarkList(landmarks, {
    minLength: 33,
    fallbackVisibility: 0.45
  });
}

/**
 * @param {RawLandmark[] | undefined} landmarks
 * @returns {NormalizedLandmark[] | null}
 */
export function normalizeFaceLandmarks(landmarks) {
  return normalizeLandmarkList(landmarks, {
    minLength: 100,
    fallbackVisibility: 0.9
  });
}

/**
 * @param {RawLandmark[][] | undefined} landmarksByHand
 * @returns {NormalizedLandmark[][]}
 */
export function normalizeHandLandmarkSets(landmarksByHand) {
  if (!Array.isArray(landmarksByHand)) {
    return [];
  }

  return landmarksByHand
    .map((landmarks) =>
      normalizeLandmarkList(landmarks, {
        minLength: 21,
        fallbackVisibility: 0.8
      })
    )
    .filter((landmarks) => Array.isArray(landmarks));
}

/**
 * @param {NormalizedLandmark[] | null | undefined} landmarks
 * @returns {NormalizedBounds | null}
 */
export function computeNormalizedBounds(landmarks) {
  if (!Array.isArray(landmarks) || landmarks.length === 0) {
    return null;
  }

  let minX = 1;
  let maxX = 0;
  let minY = 1;
  let maxY = 0;

  for (const landmark of landmarks) {
    minX = Math.min(minX, landmark.x);
    maxX = Math.max(maxX, landmark.x);
    minY = Math.min(minY, landmark.y);
    maxY = Math.max(maxY, landmark.y);
  }

  const width = Math.max(0, maxX - minX);
  const height = Math.max(0, maxY - minY);

  return {
    minX,
    maxX,
    minY,
    maxY,
    width,
    height,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2
  };
}
