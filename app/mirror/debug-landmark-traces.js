function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Append one debug landmark trace entry into a bounded ring-like array.
 *
 * @param {{
 *   traces?: Array<object>,
 *   trace?: object,
 *   maxEntries?: number
 * }} input
 * @returns {Array<object>}
 */
export function appendDebugLandmarkTrace(input) {
  const traces = Array.isArray(input?.traces) ? input.traces : [];
  const trace = input?.trace;
  const maxEntries = Number.isFinite(input?.maxEntries) ? Number(input.maxEntries) : 120;

  if (!trace || typeof trace !== "object") {
    return traces;
  }

  const boundedMax = Math.round(clamp(maxEntries, 1, 2000));
  const next = [...traces, trace];

  if (next.length <= boundedMax) {
    return next;
  }

  return next.slice(next.length - boundedMax);
}

/**
 * Build one normalized debug landmark trace entry.
 *
 * @param {{
 *   nowMs?: number,
 *   trackingMode?: string,
 *   landmarkCount?: number,
 *   poseConfidence?: number | null,
 *   fallbackConfidence?: number | null,
 *   overlayEnabled?: boolean
 * }} input
 * @returns {{
 *   nowMs: number,
 *   trackingMode: string,
 *   landmarkCount: number,
 *   poseConfidence: number | null,
 *   fallbackConfidence: number | null,
 *   overlayEnabled: boolean
 * } | null}
 */
export function buildDebugLandmarkTraceEntry(input) {
  if (!Number.isFinite(input?.nowMs)) {
    return null;
  }

  const landmarkCount = Number.isFinite(input?.landmarkCount) ? Math.max(0, Math.round(Number(input.landmarkCount))) : 0;
  const trackingMode = typeof input?.trackingMode === "string" && input.trackingMode.length > 0 ? input.trackingMode : "UNKNOWN";

  return {
    nowMs: Math.round(Number(input.nowMs)),
    trackingMode,
    landmarkCount,
    poseConfidence: Number.isFinite(input?.poseConfidence) ? Number(Number(input.poseConfidence).toFixed(2)) : null,
    fallbackConfidence: Number.isFinite(input?.fallbackConfidence) ? Number(Number(input.fallbackConfidence).toFixed(2)) : null,
    overlayEnabled: Boolean(input?.overlayEnabled)
  };
}

/**
 * Resolve one replay snapshot from collected debug traces.
 *
 * @param {{ traces?: Array<object>, replayIndex?: number | null }} input
 * @returns {{ index: number, total: number, trace: object } | null}
 */
export function buildDebugLandmarkReplaySnapshot(input) {
  const traces = Array.isArray(input?.traces) ? input.traces : [];

  if (traces.length === 0) {
    return null;
  }

  const total = traces.length;
  const fallbackIndex = total - 1;
  const requestedIndex = Number.isFinite(input?.replayIndex) ? Number(input.replayIndex) : fallbackIndex;
  const index = Math.round(clamp(requestedIndex, 0, total - 1));

  return {
    index,
    total,
    trace: traces[index]
  };
}

/**
 * Step replay index forward/backward through recorded traces.
 *
 * @param {{ traces?: Array<object>, replayIndex?: number | null, direction?: number, loop?: boolean }} input
 * @returns {{ index: number, total: number } | null}
 */
export function stepDebugLandmarkReplay(input) {
  const traces = Array.isArray(input?.traces) ? input.traces : [];

  if (traces.length === 0) {
    return null;
  }

  const total = traces.length;
  const currentIndex = Number.isFinite(input?.replayIndex)
    ? Math.round(clamp(Number(input.replayIndex), 0, total - 1))
    : total - 1;
  const direction = Number.isFinite(input?.direction) ? Math.sign(Number(input.direction)) || 0 : 1;
  const loop = input?.loop !== false;

  let nextIndex = currentIndex + direction;

  if (loop) {
    if (nextIndex < 0) nextIndex = total - 1;
    if (nextIndex >= total) nextIndex = 0;
  } else {
    nextIndex = Math.round(clamp(nextIndex, 0, total - 1));
  }

  return {
    index: nextIndex,
    total
  };
}
