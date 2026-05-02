/**
 * Mock camera system for testing the AR try-on pipeline without a real webcam.
 *
 * Provides:
 * - MockPoseProvider: generates deterministic MediaPipe-format landmarks
 *   for common test scenarios (standing, arms-up, turned, off-center, etc.)
 * - MockCameraFrame: synthetic 2D frame metadata for pipeline testing
 * - createMockPoseTracker: drop-in replacement for the real PoseTracker
 *
 * Usage in tests:
 *   import { createMockPoseTracker, MOCK_POSES } from "../lib/mock-camera.mjs";
 *   const tracker = createMockPoseTracker(MOCK_POSES.standing_front);
 *   const result = tracker.detect(fakeVideo, Date.now());
 *   // result.landmarks is a full 33-point MediaPipe pose
 */

// MediaPipe Pose Landmarker outputs 33 landmarks.
// Reference: https://developers.google.com/mediapipe/solutions/vision/pose_landmarker
const NUM_LANDMARKS = 33;

// Named landmark indices (MediaPipe convention)
const LM = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
};

/**
 * Create a single landmark point.
 * Coordinates are in normalized MediaPipe space (0..1 for x/y, z is depth).
 */
function lm(x, y, z = 0, visibility = 0.99) {
  return { x, y, z, visibility };
}

/**
 * Fill a full 33-landmark array from a sparse definition.
 * Undefined landmarks get placed at (0.5, 0.5, 0) with low visibility.
 */
function buildFullPose(sparse) {
  const full = [];
  for (let i = 0; i < NUM_LANDMARKS; i++) {
    full.push(sparse[i] || lm(0.5, 0.5, 0, 0.01));
  }
  return full;
}

/**
 * Standard standing pose — person facing camera, arms at sides.
 * Good calibration: shoulders visible, centered, proper distance.
 */
function standingFront() {
  const sparse = {};
  // Head
  sparse[LM.NOSE] = lm(0.50, 0.18, -0.02);
  sparse[LM.LEFT_EYE] = lm(0.47, 0.16, -0.02);
  sparse[LM.RIGHT_EYE] = lm(0.53, 0.16, -0.02);
  sparse[LM.LEFT_EAR] = lm(0.44, 0.18, 0.01);
  sparse[LM.RIGHT_EAR] = lm(0.56, 0.18, 0.01);
  sparse[LM.MOUTH_LEFT] = lm(0.48, 0.22, -0.01);
  sparse[LM.MOUTH_RIGHT] = lm(0.52, 0.22, -0.01);

  // Shoulders (key for torso tracking)
  sparse[LM.LEFT_SHOULDER] = lm(0.38, 0.32, 0.0);
  sparse[LM.RIGHT_SHOULDER] = lm(0.62, 0.32, 0.0);

  // Arms at sides
  sparse[LM.LEFT_ELBOW] = lm(0.33, 0.48, 0.02);
  sparse[LM.RIGHT_ELBOW] = lm(0.67, 0.48, 0.02);
  sparse[LM.LEFT_WRIST] = lm(0.32, 0.60, 0.04);
  sparse[LM.RIGHT_WRIST] = lm(0.68, 0.60, 0.04);

  // Hands
  sparse[LM.LEFT_PINKY] = lm(0.31, 0.63, 0.04);
  sparse[LM.RIGHT_PINKY] = lm(0.69, 0.63, 0.04);
  sparse[LM.LEFT_INDEX] = lm(0.32, 0.64, 0.04);
  sparse[LM.RIGHT_INDEX] = lm(0.68, 0.64, 0.04);
  sparse[LM.LEFT_THUMB] = lm(0.33, 0.62, 0.03);
  sparse[LM.RIGHT_THUMB] = lm(0.67, 0.62, 0.03);

  // Hips
  sparse[LM.LEFT_HIP] = lm(0.42, 0.58, 0.0);
  sparse[LM.RIGHT_HIP] = lm(0.58, 0.58, 0.0);

  // Legs
  sparse[LM.LEFT_KNEE] = lm(0.43, 0.75, 0.02);
  sparse[LM.RIGHT_KNEE] = lm(0.57, 0.75, 0.02);
  sparse[LM.LEFT_ANKLE] = lm(0.43, 0.92, 0.01);
  sparse[LM.RIGHT_ANKLE] = lm(0.57, 0.92, 0.01);

  return buildFullPose(sparse);
}

/**
 * Arms raised overhead (T-pose variant for upper-body garment testing).
 */
function armsUp() {
  const base = standingFront();
  // Move arms up
  base[LM.LEFT_ELBOW] = lm(0.30, 0.22, 0.02);
  base[LM.RIGHT_ELBOW] = lm(0.70, 0.22, 0.02);
  base[LM.LEFT_WRIST] = lm(0.28, 0.10, 0.03);
  base[LM.RIGHT_WRIST] = lm(0.72, 0.10, 0.03);
  base[LM.LEFT_PINKY] = lm(0.27, 0.08, 0.03);
  base[LM.RIGHT_PINKY] = lm(0.73, 0.08, 0.03);
  base[LM.LEFT_INDEX] = lm(0.28, 0.07, 0.03);
  base[LM.RIGHT_INDEX] = lm(0.72, 0.07, 0.03);
  return base;
}

/**
 * Person turned slightly left — shoulder depth difference tests yaw.
 */
function turnedLeft() {
  const base = standingFront();
  base[LM.LEFT_SHOULDER] = lm(0.36, 0.32, 0.04);  // farther from camera
  base[LM.RIGHT_SHOULDER] = lm(0.60, 0.32, -0.04); // closer
  base[LM.NOSE] = lm(0.48, 0.18, -0.03);
  return base;
}

/**
 * Person leaning right — uneven shoulder heights test roll.
 */
function leaningRight() {
  const base = standingFront();
  base[LM.LEFT_SHOULDER] = lm(0.38, 0.30, 0.0);  // higher
  base[LM.RIGHT_SHOULDER] = lm(0.62, 0.36, 0.0); // lower
  return base;
}

/**
 * Person too close — shoulder span > 0.55 triggers "too_close" calibration.
 */
function tooClose() {
  const base = standingFront();
  base[LM.LEFT_SHOULDER] = lm(0.15, 0.32, 0.0);
  base[LM.RIGHT_SHOULDER] = lm(0.85, 0.32, 0.0);
  base[LM.LEFT_HIP] = lm(0.20, 0.58, 0.0);
  base[LM.RIGHT_HIP] = lm(0.80, 0.58, 0.0);
  return base;
}

/**
 * Person too far — shoulder span < 0.12 triggers "too_far" calibration.
 */
function tooFar() {
  const base = standingFront();
  base[LM.LEFT_SHOULDER] = lm(0.46, 0.32, 0.0);
  base[LM.RIGHT_SHOULDER] = lm(0.54, 0.32, 0.0);
  return base;
}

/**
 * Person shifted left — center offset > 0.22 triggers "off_center" calibration.
 */
function offCenterLeft() {
  const base = standingFront();
  // Shift everything left by 0.25
  for (const l of base) {
    l.x -= 0.25;
  }
  return base;
}

/**
 * Chest-up framing — no hips visible. Tests hip-fallback path.
 */
function chestUpOnly() {
  const base = standingFront();
  // Zero out hips and below
  for (let i = LM.LEFT_HIP; i < NUM_LANDMARKS; i++) {
    base[i] = lm(0.5, 0.5, 0, 0.01); // invisible
  }
  return base;
}

/**
 * No person detected — empty or null landmarks.
 */
function noPerson() {
  return null;
}

/**
 * Catalog of named mock poses for test scenarios.
 */
export const MOCK_POSES = {
  standing_front: standingFront(),
  arms_up: armsUp(),
  turned_left: turnedLeft(),
  leaning_right: leaningRight(),
  too_close: tooClose(),
  too_far: tooFar(),
  off_center_left: offCenterLeft(),
  chest_up_only: chestUpOnly(),
  no_person: noPerson(),
};

/**
 * Landmark index constants — re-exported for test assertions.
 */
export const LANDMARK_INDICES = LM;

/**
 * Create a mock pose tracker that returns deterministic landmarks.
 *
 * Drop-in replacement for the real PoseTracker from lib/pose.ts.
 * Can be configured with:
 * - A static pose (always returns the same landmarks)
 * - A sequence of poses (cycles through them)
 * - A function that computes pose per frame
 *
 * @param {Array|Function|null} poseSource - Landmarks array, array of arrays, or (timestamp) => landmarks
 * @returns {Object} PoseTracker-compatible object with detect() and close()
 */
export function createMockPoseTracker(poseSource) {
  let frameIndex = 0;
  let closed = false;

  function getLandmarks(timestampMs) {
    if (closed) return null;
    if (poseSource === null || poseSource === undefined) return null;
    if (typeof poseSource === "function") return poseSource(timestampMs, frameIndex);
    if (Array.isArray(poseSource) && poseSource.length > 0 && Array.isArray(poseSource[0])) {
      // Sequence of poses — cycle through
      return poseSource[frameIndex % poseSource.length];
    }
    // Static pose
    return poseSource;
  }

  return {
    detect(_video, timestampMs) {
      const landmarks = getLandmarks(timestampMs);
      frameIndex++;
      return { landmarks };
    },
    close() {
      closed = true;
    },
    /** Test helper: number of detect() calls so far */
    get frameCount() { return frameIndex; },
    /** Test helper: whether close() was called */
    get isClosed() { return closed; },
  };
}

/**
 * Create a mock video element for pipeline testing.
 * Returns a plain object with the properties that pose detection reads.
 */
export function createMockVideoElement(width = 1280, height = 720) {
  return {
    videoWidth: width,
    videoHeight: height,
    readyState: 4, // HTMLMediaElement.HAVE_ENOUGH_DATA
    paused: false,
    ended: false,
    currentTime: 0,
  };
}

/**
 * Generate a sequence of poses that simulate a person walking into frame,
 * standing still, then walking out. Useful for end-to-end pipeline tests.
 *
 * @param {number} enterFrames - Number of frames to enter (no_person → standing)
 * @param {number} standFrames - Number of frames standing in place
 * @param {number} exitFrames - Number of frames to exit (standing → no_person)
 * @returns {Function} Pose source function for createMockPoseTracker
 */
export function createWalkInOutSequence(enterFrames = 5, standFrames = 20, exitFrames = 5) {
  const totalFrames = enterFrames + standFrames + exitFrames;
  return (_timestampMs, frameIndex) => {
    if (frameIndex < enterFrames) {
      // Entering: start off-screen, slide to center
      const t = frameIndex / enterFrames;
      const pose = standingFront();
      for (const l of pose) {
        l.x = l.x + (1 - t) * 0.5; // slide from right
        l.visibility = Math.min(0.99, t * 1.2);
      }
      return pose;
    }
    if (frameIndex < enterFrames + standFrames) {
      return standingFront();
    }
    if (frameIndex < totalFrames) {
      // Exiting: slide left and fade
      const t = (frameIndex - enterFrames - standFrames) / exitFrames;
      const pose = standingFront();
      for (const l of pose) {
        l.x = l.x - t * 0.5;
        l.visibility = Math.max(0.01, (1 - t) * 0.99);
      }
      return pose;
    }
    return null; // gone
  };
}
