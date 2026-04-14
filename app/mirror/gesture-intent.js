/**
 * Detect left-swipe intent from hand movement samples.
 *
 * @param {{
 *   previousX?: number | null,
 *   currentX?: number | null,
 *   deltaTimeMs?: number | null,
 *   handPresenceMetric?: number | null,
 *   minDeltaX?: number,
 *   minVelocityX?: number,
 *   minHandPresence?: number
 * }} input
 * @returns {{ detected: boolean, deltaX: number, velocityX: number, reason: string }}
 */
export function detectLeftSwipeIntent(input) {
  const previousX = input?.previousX;
  const currentX = input?.currentX;
  const deltaTimeMs = input?.deltaTimeMs;
  const handPresenceMetric = input?.handPresenceMetric;

  const minDeltaX = Number.isFinite(input?.minDeltaX) ? Number(input.minDeltaX) : 0.1;
  const minVelocityX = Number.isFinite(input?.minVelocityX) ? Number(input.minVelocityX) : 0.0012;
  const minHandPresence = Number.isFinite(input?.minHandPresence) ? Number(input.minHandPresence) : 0.5;

  if (
    !Number.isFinite(previousX) ||
    !Number.isFinite(currentX) ||
    !Number.isFinite(deltaTimeMs) ||
    deltaTimeMs <= 0
  ) {
    return { detected: false, deltaX: 0, velocityX: 0, reason: "invalid-sample" };
  }

  if (!Number.isFinite(handPresenceMetric) || Number(handPresenceMetric) < minHandPresence) {
    return { detected: false, deltaX: 0, velocityX: 0, reason: "insufficient-hand-presence" };
  }

  const deltaX = Number(currentX) - Number(previousX);
  const velocityX = deltaX / Number(deltaTimeMs);

  if (deltaX >= 0) {
    return { detected: false, deltaX: Number(deltaX.toFixed(4)), velocityX: Number(velocityX.toFixed(6)), reason: "not-left-direction" };
  }

  const leftDistance = Math.abs(deltaX);
  const leftSpeed = Math.abs(velocityX);

  if (leftDistance < minDeltaX) {
    return {
      detected: false,
      deltaX: Number(deltaX.toFixed(4)),
      velocityX: Number(velocityX.toFixed(6)),
      reason: "distance-below-threshold"
    };
  }

  if (leftSpeed < minVelocityX) {
    return {
      detected: false,
      deltaX: Number(deltaX.toFixed(4)),
      velocityX: Number(velocityX.toFixed(6)),
      reason: "velocity-below-threshold"
    };
  }

  return {
    detected: true,
    deltaX: Number(deltaX.toFixed(4)),
    velocityX: Number(velocityX.toFixed(6)),
    reason: "left-swipe-detected"
  };
}

/**
 * Detect right-swipe intent from hand movement samples.
 *
 * @param {{
 *   previousX?: number | null,
 *   currentX?: number | null,
 *   deltaTimeMs?: number | null,
 *   handPresenceMetric?: number | null,
 *   minDeltaX?: number,
 *   minVelocityX?: number,
 *   minHandPresence?: number
 * }} input
 * @returns {{ detected: boolean, deltaX: number, velocityX: number, reason: string }}
 */
export function detectRightSwipeIntent(input) {
  const previousX = input?.previousX;
  const currentX = input?.currentX;
  const deltaTimeMs = input?.deltaTimeMs;
  const handPresenceMetric = input?.handPresenceMetric;

  const minDeltaX = Number.isFinite(input?.minDeltaX) ? Number(input.minDeltaX) : 0.1;
  const minVelocityX = Number.isFinite(input?.minVelocityX) ? Number(input.minVelocityX) : 0.0012;
  const minHandPresence = Number.isFinite(input?.minHandPresence) ? Number(input.minHandPresence) : 0.5;

  if (
    !Number.isFinite(previousX) ||
    !Number.isFinite(currentX) ||
    !Number.isFinite(deltaTimeMs) ||
    deltaTimeMs <= 0
  ) {
    return { detected: false, deltaX: 0, velocityX: 0, reason: "invalid-sample" };
  }

  if (!Number.isFinite(handPresenceMetric) || Number(handPresenceMetric) < minHandPresence) {
    return { detected: false, deltaX: 0, velocityX: 0, reason: "insufficient-hand-presence" };
  }

  const deltaX = Number(currentX) - Number(previousX);
  const velocityX = deltaX / Number(deltaTimeMs);

  if (deltaX <= 0) {
    return {
      detected: false,
      deltaX: Number(deltaX.toFixed(4)),
      velocityX: Number(velocityX.toFixed(6)),
      reason: "not-right-direction"
    };
  }

  if (deltaX < minDeltaX) {
    return {
      detected: false,
      deltaX: Number(deltaX.toFixed(4)),
      velocityX: Number(velocityX.toFixed(6)),
      reason: "distance-below-threshold"
    };
  }

  if (velocityX < minVelocityX) {
    return {
      detected: false,
      deltaX: Number(deltaX.toFixed(4)),
      velocityX: Number(velocityX.toFixed(6)),
      reason: "velocity-below-threshold"
    };
  }

  return {
    detected: true,
    deltaX: Number(deltaX.toFixed(4)),
    velocityX: Number(velocityX.toFixed(6)),
    reason: "right-swipe-detected"
  };
}

/**
 * Detect whether a gesture candidate should be suppressed as accidental.
 *
 * @param {{
 *   leftIntentDetected?: boolean,
 *   rightIntentDetected?: boolean,
 *   handPresenceMetric?: number | null,
 *   velocityX?: number | null,
 *   deltaTimeMs?: number | null,
 *   minHandPresence?: number,
 *   maxAbsVelocityX?: number,
 *   minDeltaTimeMs?: number
 * }} input
 * @returns {{ suppressed: boolean, reason: string }}
 */
export function detectAccidentalGestureSuppression(input) {
  const leftIntentDetected = Boolean(input?.leftIntentDetected);
  const rightIntentDetected = Boolean(input?.rightIntentDetected);
  const handPresenceMetric = input?.handPresenceMetric;
  const velocityX = input?.velocityX;
  const deltaTimeMs = input?.deltaTimeMs;

  const minHandPresence = Number.isFinite(input?.minHandPresence) ? Number(input.minHandPresence) : 0.5;
  const maxAbsVelocityX = Number.isFinite(input?.maxAbsVelocityX) ? Number(input.maxAbsVelocityX) : 0.012;
  const minDeltaTimeMs = Number.isFinite(input?.minDeltaTimeMs) ? Number(input.minDeltaTimeMs) : 40;

  if (!leftIntentDetected && !rightIntentDetected) {
    return { suppressed: true, reason: "no-intent-detected" };
  }

  if (leftIntentDetected && rightIntentDetected) {
    return { suppressed: true, reason: "conflicting-directions" };
  }

  if (!Number.isFinite(handPresenceMetric) || Number(handPresenceMetric) < minHandPresence) {
    return { suppressed: true, reason: "insufficient-hand-presence" };
  }

  if (!Number.isFinite(deltaTimeMs) || Number(deltaTimeMs) < minDeltaTimeMs) {
    return { suppressed: true, reason: "window-too-short" };
  }

  if (!Number.isFinite(velocityX)) {
    return { suppressed: true, reason: "invalid-velocity" };
  }

  if (Math.abs(Number(velocityX)) > maxAbsVelocityX) {
    return { suppressed: true, reason: "velocity-spike" };
  }

  return { suppressed: false, reason: "intent-accepted" };
}

/**
 * Detect whether a gesture trigger should be blocked by cooldown timing.
 *
 * @param {{
 *   lastGestureAtMs?: number | null,
 *   nowMs?: number | null,
 *   cooldownMs?: number
 * }} input
 * @returns {{ inCooldown: boolean, remainingMs: number, reason: string }}
 */
export function detectGestureCooldownWindow(input) {
  const lastGestureAtMs = input?.lastGestureAtMs;
  const nowMs = input?.nowMs;
  const cooldownMs = Number.isFinite(input?.cooldownMs) ? Number(input.cooldownMs) : 700;

  if (!Number.isFinite(lastGestureAtMs)) {
    return { inCooldown: false, remainingMs: 0, reason: "no-prior-gesture" };
  }

  if (!Number.isFinite(nowMs)) {
    return { inCooldown: true, remainingMs: Math.round(cooldownMs), reason: "invalid-time-sample" };
  }

  const elapsedMs = Number(nowMs) - Number(lastGestureAtMs);

  if (elapsedMs >= cooldownMs) {
    return { inCooldown: false, remainingMs: 0, reason: "cooldown-complete" };
  }

  const remainingMs = Math.max(0, Math.round(cooldownMs - elapsedMs));
  return { inCooldown: true, remainingMs, reason: "cooldown-active" };
}

/**
 * Detect lost-hands recovery state using a grace timeout window.
 *
 * @param {{
 *   handsDetected?: boolean,
 *   lastHandsSeenAtMs?: number | null,
 *   nowMs?: number | null,
 *   recoveryTimeoutMs?: number
 * }} input
 * @returns {{
 *   shouldRecover: boolean,
 *   graceActive: boolean,
 *   missingForMs: number,
 *   nextLastHandsSeenAtMs: number | null,
 *   reason: string
 * }}
 */
export function detectLostHandsRecovery(input) {
  const handsDetected = Boolean(input?.handsDetected);
  const lastHandsSeenAtMs = input?.lastHandsSeenAtMs;
  const nowMs = input?.nowMs;
  const recoveryTimeoutMs = Number.isFinite(input?.recoveryTimeoutMs) ? Number(input.recoveryTimeoutMs) : 900;

  if (!Number.isFinite(nowMs)) {
    return {
      shouldRecover: false,
      graceActive: false,
      missingForMs: 0,
      nextLastHandsSeenAtMs: Number.isFinite(lastHandsSeenAtMs) ? Number(lastHandsSeenAtMs) : null,
      reason: "invalid-time-sample"
    };
  }

  if (handsDetected) {
    return {
      shouldRecover: false,
      graceActive: false,
      missingForMs: 0,
      nextLastHandsSeenAtMs: Number(nowMs),
      reason: "hands-visible"
    };
  }

  if (!Number.isFinite(lastHandsSeenAtMs)) {
    return {
      shouldRecover: false,
      graceActive: true,
      missingForMs: recoveryTimeoutMs,
      nextLastHandsSeenAtMs: null,
      reason: "no-prior-hands-timestamp"
    };
  }

  const missingForMs = Math.max(0, Math.round(Number(nowMs) - Number(lastHandsSeenAtMs)));

  if (missingForMs >= recoveryTimeoutMs) {
    return {
      shouldRecover: true,
      graceActive: false,
      missingForMs,
      nextLastHandsSeenAtMs: Number(lastHandsSeenAtMs),
      reason: "recovery-timeout-exceeded"
    };
  }

  return {
    shouldRecover: false,
    graceActive: true,
    missingForMs,
    nextLastHandsSeenAtMs: Number(lastHandsSeenAtMs),
    reason: "within-recovery-grace-window"
  };
}

/**
 * Detect lost-pose recovery state using a grace timeout window.
 *
 * @param {{
 *   poseDetected?: boolean,
 *   lastPoseSeenAtMs?: number | null,
 *   nowMs?: number | null,
 *   recoveryTimeoutMs?: number
 * }} input
 * @returns {{
 *   shouldRecover: boolean,
 *   graceActive: boolean,
 *   missingForMs: number,
 *   nextLastPoseSeenAtMs: number | null,
 *   reason: string
 * }}
 */
export function detectLostPoseRecovery(input) {
  const poseDetected = Boolean(input?.poseDetected);
  const lastPoseSeenAtMs = input?.lastPoseSeenAtMs;
  const nowMs = input?.nowMs;
  const recoveryTimeoutMs = Number.isFinite(input?.recoveryTimeoutMs) ? Number(input.recoveryTimeoutMs) : 1200;

  if (!Number.isFinite(nowMs)) {
    return {
      shouldRecover: false,
      graceActive: false,
      missingForMs: 0,
      nextLastPoseSeenAtMs: Number.isFinite(lastPoseSeenAtMs) ? Number(lastPoseSeenAtMs) : null,
      reason: "invalid-time-sample"
    };
  }

  if (poseDetected) {
    return {
      shouldRecover: false,
      graceActive: false,
      missingForMs: 0,
      nextLastPoseSeenAtMs: Number(nowMs),
      reason: "pose-visible"
    };
  }

  if (!Number.isFinite(lastPoseSeenAtMs)) {
    return {
      shouldRecover: false,
      graceActive: true,
      missingForMs: recoveryTimeoutMs,
      nextLastPoseSeenAtMs: null,
      reason: "no-prior-pose-timestamp"
    };
  }

  const missingForMs = Math.max(0, Math.round(Number(nowMs) - Number(lastPoseSeenAtMs)));

  if (missingForMs >= recoveryTimeoutMs) {
    return {
      shouldRecover: true,
      graceActive: false,
      missingForMs,
      nextLastPoseSeenAtMs: Number(lastPoseSeenAtMs),
      reason: "recovery-timeout-exceeded"
    };
  }

  return {
    shouldRecover: false,
    graceActive: true,
    missingForMs,
    nextLastPoseSeenAtMs: Number(lastPoseSeenAtMs),
    reason: "within-recovery-grace-window"
  };
}
