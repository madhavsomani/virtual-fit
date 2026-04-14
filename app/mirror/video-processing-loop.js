const DEFAULT_TARGET_FPS = 12;
const MIN_ALLOWED_INTERVAL_MS = 16;

function resolveNow(now) {
  if (typeof now === "function") {
    return now;
  }

  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return () => performance.now();
  }

  return () => Date.now();
}

function resolveRequestFrame(requestFrame) {
  if (typeof requestFrame === "function") {
    return requestFrame;
  }

  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    return window.requestAnimationFrame.bind(window);
  }

  return (callback) =>
    setTimeout(() => {
      callback(Date.now());
    }, MIN_ALLOWED_INTERVAL_MS);
}

function resolveCancelFrame(cancelFrame) {
  if (typeof cancelFrame === "function") {
    return cancelFrame;
  }

  if (typeof window !== "undefined" && typeof window.cancelAnimationFrame === "function") {
    return window.cancelAnimationFrame.bind(window);
  }

  return (id) => clearTimeout(id);
}

export function startVideoProcessingLoop({ onTick, targetFps = DEFAULT_TARGET_FPS, requestFrame, cancelFrame, now }) {
  const tick = typeof onTick === "function" ? onTick : () => undefined;
  const effectiveTargetFps = Number.isFinite(targetFps) && targetFps > 0 ? targetFps : DEFAULT_TARGET_FPS;
  const minFrameIntervalMs = Math.max(MIN_ALLOWED_INTERVAL_MS, Math.round(1000 / effectiveTargetFps));

  const requestFrameFn = resolveRequestFrame(requestFrame);
  const cancelFrameFn = resolveCancelFrame(cancelFrame);
  const nowFn = resolveNow(now);

  let stopped = false;
  let frameHandle = null;
  let lastProcessedAtMs = 0;
  let inFlight = false;

  const onFrame = (frameTimestampMs) => {
    if (stopped) {
      return;
    }

    frameHandle = requestFrameFn(onFrame);

    const nowMs = typeof frameTimestampMs === "number" ? frameTimestampMs : nowFn();
    if (inFlight) {
      return;
    }

    if (lastProcessedAtMs !== 0 && nowMs - lastProcessedAtMs < minFrameIntervalMs) {
      return;
    }

    lastProcessedAtMs = nowMs;
    inFlight = true;

    Promise.resolve(tick(nowMs))
      .catch(() => {
        // Tracking loop is best-effort and should keep running.
      })
      .finally(() => {
        inFlight = false;
      });
  };

  frameHandle = requestFrameFn(onFrame);

  return () => {
    stopped = true;

    if (frameHandle !== null) {
      cancelFrameFn(frameHandle);
      frameHandle = null;
    }
  };
}
