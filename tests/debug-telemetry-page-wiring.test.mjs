// Phase 7.107 — wiring contract for the /debug/telemetry read-only page.
// Static-grep on the page source. Same playbook as 7.103 / 7.106.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(
  resolve(__dirname, "../app/debug/telemetry/page.tsx"),
  "utf8",
);
const STRIPPED = SRC.replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n")
  .map((l) => l.replace(/\/\/.*$/, ""))
  .join("\n");

test("imports the READ-only log helpers; does NOT import appendSessionSummary", () => {
  assert.match(
    STRIPPED,
    /import\s*\{[^}]*\breadSessionSummaries\b[^}]*\}\s*from\s*["'][^"']*session-summary-log\.js["']/,
  );
  assert.match(
    STRIPPED,
    /import\s*\{[^}]*\bclearSessionSummaries\b[^}]*\}\s*from\s*["'][^"']*session-summary-log\.js["']/,
  );
  // The page MUST NOT be able to manufacture telemetry. appendSessionSummary
  // exists in the same module; ensure it's not imported here.
  assert.doesNotMatch(STRIPPED, /\bappendSessionSummary\b/);
});

test("uses the pure CSV serializer (no inline column drift)", () => {
  assert.match(
    STRIPPED,
    /import\s*\{[^}]*\bsummariesToCsv\b[^}]*\}\s*from\s*["'][^"']*session-summary-csv\.js["']/,
  );
});

test("NO NETWORK: page source has zero fetch / XHR / sendBeacon refs", () => {
  // Same hard rule as the 7.105 module-level lock. The CSV download is a
  // client-side Blob — bytes never leave the device.
  assert.doesNotMatch(STRIPPED, /\bfetch\s*\(/);
  assert.doesNotMatch(STRIPPED, /\bXMLHttpRequest\b/);
  assert.doesNotMatch(STRIPPED, /\bsendBeacon\b/);
  assert.doesNotMatch(STRIPPED, /navigator\.\w*[Bb]eacon/);
});

test("CSV download uses a client-side Blob (not a server endpoint)", () => {
  // new Blob([...], { type: "text/csv..." })
  assert.match(STRIPPED, /new\s+Blob\(\s*\[\s*csv\s*\]/);
  assert.match(STRIPPED, /URL\.createObjectURL/);
  // And cleans up the object URL afterwards (no leak across many downloads).
  assert.match(STRIPPED, /URL\.revokeObjectURL/);
});

test("readSessionSummaries call passes expectedSchemaVersion: 1 (defensive against ancient entries)", () => {
  assert.match(
    STRIPPED,
    /readSessionSummaries\(\s*\{\s*expectedSchemaVersion\s*:\s*1\s*\}\s*\)/,
  );
});

test("Clear is gated behind window.confirm (no silent destruction)", () => {
  assert.match(STRIPPED, /window\.confirm\(/);
});

test("E2E hooks present: data-testid for download, clear, and table", () => {
  assert.match(STRIPPED, /data-testid="telemetry-download-csv"/);
  assert.match(STRIPPED, /data-testid="telemetry-clear"/);
  assert.match(STRIPPED, /data-testid="telemetry-table"/);
});

test("renders ONLY the fields the wiring layer produces (no PII rendering)", () => {
  // Defensive: the page MUST NOT attempt to render anything PII-shaped.
  // Even if a future regression smuggled UA into the summary, this page
  // shouldn't surface it. Same ban-list shape as the 7.106 wiring guard.
  assert.doesNotMatch(STRIPPED, /navigator\.userAgent/);
  assert.doesNotMatch(STRIPPED, /\bemail\b/i);
  assert.doesNotMatch(STRIPPED, /\bipAddress\b/i);
  assert.doesNotMatch(STRIPPED, /\bdeviceId\b/i);
});

test("page is a Next.js client component (uses 'use client')", () => {
  // The first non-empty line / directive must be "use client" — read +
  // clear are localStorage-bound; SSR rendering them would be wrong.
  const firstNonEmpty = SRC.split("\n").map((l) => l.trim()).find((l) => l.length > 0);
  assert.equal(firstNonEmpty, '"use client";');
});
