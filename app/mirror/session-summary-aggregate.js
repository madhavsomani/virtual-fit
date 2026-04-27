// Phase 7.108 — pure aggregator over a list of session summaries.
//
// Turns the row dump at /debug/telemetry into an at-a-glance reliability
// dashboard for the 6-DOF pipeline. Same single-responsibility split as
// 7.104 (builder) / 7.105 (log) / 7.107 (csv): a pure, JSON-stringifiable
// derivation with no React/DOM coupling so it's unit-testable in isolation
// and reusable by node-side analytics scripts.
//
// Contract:
//   - Input: array of summaries shaped like buildSessionSummary output.
//     Defensive against null/undefined/non-array/items-with-missing-fields.
//   - Output: { sessionCount, totalFrames, medianHeldRatio,
//               worstAxisDistribution, perAxisMedianHeldRatio }.
//     `medianHeldRatio` is null when no summaries have a finite ratio.
//     `worstAxisDistribution` is { yaw, pitch, roll, depth } counts.
//     `perAxisMedianHeldRatio` is { yaw|pitch|roll|depth: number|null }.
//   - Median: for an even-length list of finite numbers, returns the
//     average of the two middle values (standard definition). For an
//     odd-length list, the middle value. For an empty list, null.
//   - Non-finite ratios are skipped before median (NaN/Infinity must never
//     contaminate aggregates — same rule as the 7.107 CSV cell policy).

const AXES = /** @type {const} */ (["yaw", "pitch", "roll", "depth"]);

function median(nums) {
  const finite = nums.filter((n) => typeof n === "number" && Number.isFinite(n));
  if (finite.length === 0) return null;
  finite.sort((a, b) => a - b);
  const mid = Math.floor(finite.length / 2);
  if (finite.length % 2 === 1) return finite[mid];
  return (finite[mid - 1] + finite[mid]) / 2;
}

/**
 * @param {Array<object>} summaries
 * @returns {{
 *   sessionCount: number,
 *   totalFrames: number,
 *   medianHeldRatio: number|null,
 *   worstAxisDistribution: { yaw: number, pitch: number, roll: number, depth: number },
 *   perAxisMedianHeldRatio: { yaw: number|null, pitch: number|null, roll: number|null, depth: number|null },
 * }}
 */
export function aggregateSummaries(summaries) {
  const list = Array.isArray(summaries) ? summaries : [];
  let totalFrames = 0;
  const ratios = [];
  const dist = { yaw: 0, pitch: 0, roll: 0, depth: 0 };
  const perAxis = { yaw: [], pitch: [], roll: [], depth: [] };

  for (const s of list) {
    if (!s || typeof s !== "object") continue;
    if (typeof s.totalFrames === "number" && Number.isFinite(s.totalFrames) && s.totalFrames > 0) {
      totalFrames += s.totalFrames;
    }
    if (typeof s.overallHeldRatio === "number" && Number.isFinite(s.overallHeldRatio)) {
      ratios.push(s.overallHeldRatio);
    }
    if (s.worstAxis && Object.prototype.hasOwnProperty.call(dist, s.worstAxis)) {
      dist[s.worstAxis] += 1;
    }
    if (s.heldRatio && typeof s.heldRatio === "object") {
      for (const ax of AXES) {
        const v = s.heldRatio[ax];
        if (typeof v === "number" && Number.isFinite(v)) perAxis[ax].push(v);
      }
    }
  }

  const perAxisMedianHeldRatio = {
    yaw: median(perAxis.yaw),
    pitch: median(perAxis.pitch),
    roll: median(perAxis.roll),
    depth: median(perAxis.depth),
  };

  return {
    sessionCount: list.filter((s) => s && typeof s === "object").length,
    totalFrames,
    medianHeldRatio: median(ratios),
    worstAxisDistribution: dist,
    perAxisMedianHeldRatio,
  };
}

export const AGGREGATE_AXES = AXES;
