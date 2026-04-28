// Phase 8.9 — Footwear anchor composer.
//
// Companion to landmark-smoother.js / cloth-mesh-pipeline.js. Pure
// adapter: takes MediaPipe Pose landmarks for a single foot (left or
// right) and returns the {position, rotation, scale} a Three.js shoe
// GLB needs to sit naturally on that foot.
//
// MediaPipe Pose landmarks used (BlazePose 33-point):
//   25  LEFT_KNEE
//   26  RIGHT_KNEE
//   27  LEFT_ANKLE
//   28  RIGHT_ANKLE
//   29  LEFT_HEEL
//   30  RIGHT_HEEL
//   31  LEFT_FOOT_INDEX  (toe)
//   32  RIGHT_FOOT_INDEX (toe)
//
// Coordinates are normalised image-space (x,y in [0,1], z in metres-ish
// from BlazePose). We treat z=0 as the camera plane; positive z = away.
//
// API (intentionally THREE-free so the same module runs under node:test):
//   composeFootAnchor({ landmarks, side, smoothing })
//     → { position:[x,y,z], rotation:[ex,ey,ez], scale:number, visibility:number }
//
// `position` is the centre between heel and toe (i.e. the shoe's footprint
// midpoint). `rotation.z` aligns the shoe to the heel→toe axis. `scale`
// scales a 1-unit-long template shoe to match the heel→toe distance in
// image-space. `visibility` is min of contributing landmarks so the
// caller can fade the overlay when the foot leaves frame.

export const FOOT_LANDMARK_INDEX = Object.freeze({
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
});

export const FOOT_SIDES = Object.freeze(["left", "right"]);

function pickIndices(side) {
  if (side === "left") {
    return {
      knee: FOOT_LANDMARK_INDEX.LEFT_KNEE,
      ankle: FOOT_LANDMARK_INDEX.LEFT_ANKLE,
      heel: FOOT_LANDMARK_INDEX.LEFT_HEEL,
      toe: FOOT_LANDMARK_INDEX.LEFT_FOOT_INDEX,
    };
  }
  if (side === "right") {
    return {
      knee: FOOT_LANDMARK_INDEX.RIGHT_KNEE,
      ankle: FOOT_LANDMARK_INDEX.RIGHT_ANKLE,
      heel: FOOT_LANDMARK_INDEX.RIGHT_HEEL,
      toe: FOOT_LANDMARK_INDEX.RIGHT_FOOT_INDEX,
    };
  }
  throw new Error(`composeFootAnchor: side must be 'left' or 'right' (got ${JSON.stringify(side)})`);
}

function isLandmark(lm) {
  return (
    lm &&
    typeof lm.x === "number" &&
    typeof lm.y === "number" &&
    typeof lm.z === "number" &&
    Number.isFinite(lm.x) &&
    Number.isFinite(lm.y) &&
    Number.isFinite(lm.z)
  );
}

/**
 * Compose anchor for one foot.
 * @param {{landmarks: Array<{x:number,y:number,z:number,visibility?:number}>, side: 'left'|'right', smoothing?: number}} opts
 * @returns {{position:[number,number,number], rotation:[number,number,number], scale:number, visibility:number, valid:boolean}}
 */
export function composeFootAnchor({ landmarks, side, smoothing = 0 } = {}) {
  if (!Array.isArray(landmarks)) {
    return invalid("landmarks must be an array");
  }
  const idx = pickIndices(side);
  const heel = landmarks[idx.heel];
  const toe = landmarks[idx.toe];
  const ankle = landmarks[idx.ankle];

  if (!isLandmark(heel) || !isLandmark(toe) || !isLandmark(ankle)) {
    return invalid("missing required heel/toe/ankle landmark");
  }

  const visibility = Math.min(
    typeof heel.visibility === "number" ? heel.visibility : 1,
    typeof toe.visibility === "number" ? toe.visibility : 1,
    typeof ankle.visibility === "number" ? ankle.visibility : 1,
  );

  // Position: midpoint of heel and toe (the shoe's footprint centre).
  const position = [
    (heel.x + toe.x) / 2,
    (heel.y + toe.y) / 2,
    (heel.z + toe.z) / 2,
  ];

  // Heel→toe vector for in-plane orientation.
  const dx = toe.x - heel.x;
  const dy = toe.y - heel.y;
  const dz = toe.z - heel.z;
  const lenXY = Math.sqrt(dx * dx + dy * dy);
  const len3D = Math.sqrt(dx * dx + dy * dy + dz * dz);
  // Guard tiny denominators (foot facing camera straight on).
  const safeLenXY = Math.max(lenXY, 1e-6);
  const safeLen3D = Math.max(len3D, 1e-6);

  // Yaw (rotation around image-vertical Y axis): from heel→toe horizontal
  // angle in image plane. atan2 keeps the sign; foot pointing right of
  // camera → +ve yaw.
  const yaw = Math.atan2(dz, dx);
  // Roll (rotation around heel→toe axis): use ankle relative to heel→toe
  // midpoint to detect pronation/supination. Small effect by default.
  const roll = Math.atan2(ankle.x - position[0], position[1] - ankle.y) * 0.25;
  // Pitch (rotation around image-horizontal X axis): foot tip raised vs
  // heel = ankle higher than midpoint between heel & toe.
  const pitch = Math.atan2(dy, safeLenXY);

  // Scale: heel→toe length in image space. A template shoe with bounds
  // [0,1] gets multiplied by this to match.
  const scale = safeLen3D;

  // Optional smoothing handled by caller; here we just expose `smoothing`
  // pass-through so the caller can plumb landmark-smoother in front of us.
  // (Pure module: no internal state.)
  void smoothing;

  return {
    position,
    rotation: [pitch, yaw, roll],
    scale,
    visibility,
    valid: true,
  };
}

function invalid(reason) {
  return {
    position: [0, 0, 0],
    rotation: [0, 0, 0],
    scale: 0,
    visibility: 0,
    valid: false,
    reason,
  };
}

/**
 * Compose both feet at once (typical mirror frame). Returns
 * `{ left, right }` — either side may be `valid: false` independently.
 */
export function composeBothFeet({ landmarks, smoothing = 0 } = {}) {
  return {
    left: composeFootAnchor({ landmarks, side: "left", smoothing }),
    right: composeFootAnchor({ landmarks, side: "right", smoothing }),
  };
}

/**
 * Parse the `mode` query string for /mirror.
 *   ?mode=footwear  → 'footwear'
 *   anything else / missing → 'topwear' (default — current shoulder-anchor flow)
 */
export function parseMirrorMode(searchParamsLike) {
  if (!searchParamsLike) return "topwear";
  let mode;
  if (typeof searchParamsLike === "string") {
    mode = searchParamsLike;
  } else if (typeof searchParamsLike.get === "function") {
    mode = searchParamsLike.get("mode");
  } else if (typeof searchParamsLike === "object" && "mode" in searchParamsLike) {
    mode = searchParamsLike.mode;
  }
  return mode === "footwear" ? "footwear" : "topwear";
}

export const SUPPORTED_MIRROR_MODES = Object.freeze(["topwear", "footwear"]);
