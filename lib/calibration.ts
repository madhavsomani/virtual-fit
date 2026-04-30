/**
 * Calibration gate — decides whether the user is "in frame enough"
 * for the armor to engage. Pure data: returns a CalibrationState that
 * the UI can render as guidance.
 *
 * The gate only requires shoulders. Hips are nice-to-have, not
 * required, since lib/armor synthesizes a hip when they aren't visible.
 *
 * Thresholds use normalized coords (0..1, video space).
 */

import type { PoseLandmark } from "./armor";

export type CalibrationStatus =
  | "no_pose"        // No landmarks at all
  | "too_close"      // Shoulders span too much of the frame
  | "too_far"        // Shoulders span too little of the frame
  | "off_center"     // Shoulder midpoint too far from horizontal center
  | "out_of_frame"   // A shoulder is off-screen
  | "ok";            // Ready to engage

export interface CalibrationState {
  status: CalibrationStatus;
  message: string;
  shoulderSpan: number; // normalized
}

const SHOULDER_LEFT = 11;
const SHOULDER_RIGHT = 12;

const MIN_VIS = 0.3;

// Empirically: typical "good distance" shoulder span ranges 0.18 .. 0.45.
const SPAN_TOO_SMALL = 0.12;
const SPAN_TOO_LARGE = 0.55;

// Off-center if midpoint x is more than this from 0.5.
const CENTER_TOLERANCE = 0.22;

const MESSAGES: Record<CalibrationStatus, string> = {
  no_pose: "Step in front of the camera so we can see your shoulders.",
  out_of_frame: "Both shoulders need to be in the frame.",
  too_close: "Step back — too close to the camera.",
  too_far: "Step closer — you're too far away.",
  off_center: "Center yourself in the frame.",
  ok: "Ready."
};

function isUsable(l: PoseLandmark | undefined): l is PoseLandmark {
  return Boolean(
    l &&
      Number.isFinite(l.x) &&
      Number.isFinite(l.y) &&
      (l.visibility ?? 1) >= MIN_VIS
  );
}

export function computeCalibration(
  landmarks: readonly PoseLandmark[] | null
): CalibrationState {
  if (!landmarks || landmarks.length === 0) {
    return { status: "no_pose", message: MESSAGES.no_pose, shoulderSpan: 0 };
  }
  const ls = landmarks[SHOULDER_LEFT];
  const rs = landmarks[SHOULDER_RIGHT];
  if (!isUsable(ls) || !isUsable(rs)) {
    return { status: "no_pose", message: MESSAGES.no_pose, shoulderSpan: 0 };
  }
  // Out-of-frame: x outside 0..1 (with tiny epsilon).
  const eps = 0.02;
  if (
    ls.x < -eps || ls.x > 1 + eps ||
    rs.x < -eps || rs.x > 1 + eps ||
    ls.y < -eps || ls.y > 1 + eps ||
    rs.y < -eps || rs.y > 1 + eps
  ) {
    return { status: "out_of_frame", message: MESSAGES.out_of_frame, shoulderSpan: 0 };
  }
  const span = Math.hypot(rs.x - ls.x, rs.y - ls.y);
  if (span < SPAN_TOO_SMALL) {
    return { status: "too_far", message: MESSAGES.too_far, shoulderSpan: span };
  }
  if (span > SPAN_TOO_LARGE) {
    return { status: "too_close", message: MESSAGES.too_close, shoulderSpan: span };
  }
  const midX = (ls.x + rs.x) / 2;
  if (Math.abs(midX - 0.5) > CENTER_TOLERANCE) {
    return { status: "off_center", message: MESSAGES.off_center, shoulderSpan: span };
  }
  return { status: "ok", message: MESSAGES.ok, shoulderSpan: span };
}
