// Phase 7.107 — pure CSV serializer contract.
import test from "node:test";
import assert from "node:assert/strict";
import { summariesToCsv, CSV_COLUMNS } from "../app/mirror/session-summary-csv.js";
import { buildSessionSummary } from "../app/mirror/session-summary.js";

const ZERO = { yaw: 0, pitch: 0, roll: 0, depth: 0 };
const sample = (totals = { yaw: 10, pitch: 0, roll: 0, depth: 5 }) => ({
  totalFrames: 100,
  holds: { ...ZERO },
  maxHold: { yaw: 7, pitch: 0, roll: 0, depth: 3 },
  totals,
  held: { yaw: false, pitch: false, roll: false, depth: false },
});

test("column order is locked (additions go at end; removals bump major)", () => {
  // Lock the FIRST seven (highest-information columns) so a refactor that
  // reshuffles for "readability" trips the test instead of silently
  // breaking analytics pipelines that index by column position.
  assert.deepEqual(
    CSV_COLUMNS.slice(0, 7),
    [
      "schemaVersion",
      "sessionId",
      "startedAtMs",
      "durationMs",
      "totalFrames",
      "worstAxis",
      "overallHeldRatio",
    ],
  );
  // And the per-axis groups stay grouped + ordered yaw/pitch/roll/depth.
  for (const group of ["totals", "maxHold", "heldRatio"]) {
    const idx = CSV_COLUMNS.indexOf(`${group}.yaw`);
    assert.ok(idx >= 0, `${group}.yaw must exist`);
    assert.equal(CSV_COLUMNS[idx + 1], `${group}.pitch`);
    assert.equal(CSV_COLUMNS[idx + 2], `${group}.roll`);
    assert.equal(CSV_COLUMNS[idx + 3], `${group}.depth`);
  }
});

test("empty input still emits a header row (stable schema for analytics)", () => {
  const csv = summariesToCsv([]);
  const lines = csv.split("\r\n");
  assert.equal(lines[0], CSV_COLUMNS.join(","));
  // Trailing CRLF after the header → lines is [header, ""].
  assert.equal(lines.length, 2);
  assert.equal(lines[1], "");
});

test("non-array input safely returns just a header", () => {
  assert.equal(summariesToCsv(null), CSV_COLUMNS.join(",") + "\r\n");
  assert.equal(summariesToCsv(undefined), CSV_COLUMNS.join(",") + "\r\n");
  assert.equal(summariesToCsv("nope"), CSV_COLUMNS.join(",") + "\r\n");
});

test("renders a real summary into a row with values in the locked column order", () => {
  const summary = buildSessionSummary({
    snapshot: sample(),
    sessionId: "s_abc",
    startedAtMs: 1700000000000,
    endedAtMs:   1700000010000,
  });
  const csv = summariesToCsv([summary]);
  const [, row] = csv.split("\r\n");
  const cells = row.split(",");
  assert.equal(cells[0], "1");                  // schemaVersion
  assert.equal(cells[1], "s_abc");              // sessionId
  assert.equal(cells[2], "1700000000000");
  assert.equal(cells[3], "10000");              // durationMs
  assert.equal(cells[4], "100");                // totalFrames
  assert.equal(cells[5], "yaw");                // worstAxis
  assert.equal(cells[6], "0.1");                // overallHeldRatio = 10/100
});

test("missing/null/undefined fields render as empty cells (NOT 'undefined')", () => {
  const partial = { schemaVersion: 1, sessionId: "p" };
  const csv = summariesToCsv([partial]);
  const [, row] = csv.split("\r\n");
  const cells = row.split(",");
  assert.equal(cells[0], "1");
  assert.equal(cells[1], "p");
  // All other cells must be "" — no "undefined" strings leaking into analytics.
  for (let i = 2; i < CSV_COLUMNS.length; i += 1) {
    assert.equal(cells[i], "", `col ${CSV_COLUMNS[i]} should be empty, got "${cells[i]}"`);
  }
});

test("non-finite numbers (NaN/Infinity) render as empty cells, not literal 'NaN'", () => {
  // A future regression upstream could write NaN into a counter; analytics
  // must not see literal "NaN" strings (they break numeric aggregations).
  const broken = {
    schemaVersion: 1, sessionId: "b",
    totalFrames: NaN,
    overallHeldRatio: Infinity,
    totals: { yaw: -Infinity, pitch: 5, roll: 0, depth: 0 },
  };
  const csv = summariesToCsv([broken]);
  const [, row] = csv.split("\r\n");
  const cells = row.split(",");
  assert.equal(cells[CSV_COLUMNS.indexOf("totalFrames")], "");
  assert.equal(cells[CSV_COLUMNS.indexOf("overallHeldRatio")], "");
  assert.equal(cells[CSV_COLUMNS.indexOf("totals.yaw")], "");
  assert.equal(cells[CSV_COLUMNS.indexOf("totals.pitch")], "5");
});

test("RFC 4180 quoting: fields with , \" \\r \\n are wrapped + internal quotes doubled", () => {
  const tricky = {
    schemaVersion: 1,
    sessionId: 'has,comma "quote"\nand\nnewline',
  };
  const csv = summariesToCsv([tricky]);
  // The sessionId cell occupies column index 1. Because it contains a
  // newline, splitting on \r\n would over-split the row — so check via includes.
  assert.ok(
    csv.includes('"has,comma ""quote""\nand\nnewline"'),
    `expected RFC4180-quoted cell, got: ${csv}`,
  );
});

test("multiple summaries each get their own row, header first", () => {
  const a = buildSessionSummary({
    snapshot: sample({ yaw: 30, pitch: 0, roll: 0, depth: 0 }),
    sessionId: "a", startedAtMs: 1000, endedAtMs: 2000,
  });
  const b = buildSessionSummary({
    snapshot: sample({ yaw: 0, pitch: 0, roll: 0, depth: 80 }),
    sessionId: "b", startedAtMs: 3000, endedAtMs: 5000,
  });
  const csv = summariesToCsv([a, b]);
  const lines = csv.split("\r\n");
  assert.equal(lines[0], CSV_COLUMNS.join(","));
  assert.equal(lines.length, 4); // header + 2 rows + trailing ""
  assert.match(lines[1], /^1,a,/);
  assert.match(lines[2], /^1,b,/);
  // Per-row worstAxis differs.
  const aWorst = lines[1].split(",")[CSV_COLUMNS.indexOf("worstAxis")];
  const bWorst = lines[2].split(",")[CSV_COLUMNS.indexOf("worstAxis")];
  assert.equal(aWorst, "yaw");
  assert.equal(bWorst, "depth");
});

test("output ends with CRLF (RFC 4180 line terminator)", () => {
  const csv = summariesToCsv([buildSessionSummary({ snapshot: sample() })]);
  assert.ok(csv.endsWith("\r\n"));
});
