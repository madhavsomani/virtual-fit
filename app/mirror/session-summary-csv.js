// Phase 7.107 — pure CSV serializer for session summaries.
//
// Exists separately from the React page so it's unit-testable AND so
// downstream tooling (e.g. a node-side analytics script) can reuse it
// without dragging in a DOM. Same single-responsibility split as
// 7.104 (builder) vs 7.105 (log) vs 7.106 (wiring).
//
// Contract:
//   - Stable column ORDER (additions go at the end; removals bump major)
//   - Defensive: missing fields render as empty cell, not "undefined"
//   - RFC 4180 quoting: any field containing , " \r \n is wrapped in
//     double-quotes with internal " escaped as ""
//   - Header row always present (even for empty input) so analytics
//     pipelines see a stable schema even when zero sessions captured

const COLUMNS = /** @type {const} */ ([
  "schemaVersion",
  "sessionId",
  "startedAtMs",
  "durationMs",
  "totalFrames",
  "worstAxis",
  "overallHeldRatio",
  "totals.yaw", "totals.pitch", "totals.roll", "totals.depth",
  "maxHold.yaw", "maxHold.pitch", "maxHold.roll", "maxHold.depth",
  "heldRatio.yaw", "heldRatio.pitch", "heldRatio.roll", "heldRatio.depth",
]);

function getNested(obj, path) {
  if (!obj || typeof obj !== "object") return "";
  const parts = path.split(".");
  let cur = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return "";
    cur = cur[p];
  }
  if (cur == null) return "";
  if (typeof cur === "number" && !Number.isFinite(cur)) return "";
  return cur;
}

function csvEscape(value) {
  // null/undefined → empty cell (NOT "null" or "undefined" strings).
  if (value === "" || value == null) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * @param {Array<object>} summaries
 * @returns {string}
 */
export function summariesToCsv(summaries) {
  const rows = [COLUMNS.join(",")];
  if (!Array.isArray(summaries)) return rows.join("\r\n") + "\r\n";
  for (const s of summaries) {
    const cells = COLUMNS.map((col) => csvEscape(getNested(s, col)));
    rows.push(cells.join(","));
  }
  return rows.join("\r\n") + "\r\n";
}

export const CSV_COLUMNS = COLUMNS;
