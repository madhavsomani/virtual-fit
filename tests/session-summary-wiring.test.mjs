// Phase 7.106 — wiring contract for the opt-in session-summary capture in
// mirror/page.tsx. Same static-grep approach as 7.99/7.100/7.103. The
// contract this test enforces:
//
//   1. Imports buildSessionSummary AND appendSessionSummary from the
//      dedicated modules — no inline duplication of the schema.
//   2. The capture site is gated on URL parameter "debugTelemetry=1"
//      (NOT localStorage, NOT a default-on flag). URL flag = deliberate,
//      per-visit, impossible to silently inherit across origins.
//   3. The capture site lives inside a try/catch — telemetry must NEVER
//      break the camera stop path.
//   4. The sessionId passed to buildSessionSummary contains NO PII — no
//      user agent, no device id, no email, no IP. Just an opaque marker
//      derived from the session start timestamp.
//   5. There is exactly ONE appendSessionSummary call site (no copy-paste
//      drift, no second ungated capture path).
//   6. There is NO direct fetch / XMLHttpRequest / sendBeacon call
//      adjacent to the appendSessionSummary call — that would smuggle
//      network egress past the 7.105 module-level NO-NETWORK lock.
//   7. sessionStartedAtRef is set on startCamera and cleared on
//      stopCamera so a stop-without-start is a no-op.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(
  resolve(__dirname, "../app/mirror/page.tsx"),
  "utf8",
);
// Strip block + line comments so prose never matches the regex contract.
const STRIPPED = SRC.replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n")
  .map((l) => l.replace(/\/\/.*$/, ""))
  .join("\n");

test("imports buildSessionSummary + appendSessionSummary from dedicated modules", () => {
  assert.match(
    STRIPPED,
    /import\s*\{\s*buildSessionSummary\s*\}\s*from\s*["']\.\/session-summary\.js["']/,
  );
  assert.match(
    STRIPPED,
    /import\s*\{\s*appendSessionSummary\s*\}\s*from\s*["']\.\/session-summary-log\.js["']/,
  );
});

test("capture site is gated on URL ?debugTelemetry=1 (not localStorage, not default-on)", () => {
  // Match within ~600 chars of the appendSessionSummary call.
  assert.match(
    STRIPPED,
    /params\.get\(["']debugTelemetry["']\)\s*===\s*["']1["'][\s\S]{0,600}appendSessionSummary\(/,
  );
});

test("capture site is wrapped in try/catch (telemetry must not break stop path)", () => {
  // The try block contains both URLSearchParams + appendSessionSummary,
  // and is followed by a catch.
  assert.match(
    STRIPPED,
    /try\s*\{[\s\S]{0,1200}appendSessionSummary\([\s\S]{0,200}\}\s*catch/,
  );
});

test("sessionId passed to buildSessionSummary contains no PII (no UA / device / email / IP)", () => {
  // Locate the buildSessionSummary({ ... }) call (single call site in this file).
  const callMatch = STRIPPED.match(/buildSessionSummary\(\s*\{[\s\S]*?\}\s*\)/);
  assert.ok(callMatch, "expected a buildSessionSummary call site");
  const callBody = callMatch[0];
  // Must reference sessionId.
  assert.match(callBody, /sessionId\s*:/);
  // PII-leak ban-list. The sessionId expression must not pull from these.
  assert.doesNotMatch(callBody, /navigator\.userAgent/);
  assert.doesNotMatch(callBody, /navigator\.platform/);
  assert.doesNotMatch(callBody, /navigator\.language/);
  assert.doesNotMatch(callBody, /\bemail\b/i);
  assert.doesNotMatch(callBody, /\buserId\b/);
  assert.doesNotMatch(callBody, /\bipAddress\b/i);
  assert.doesNotMatch(callBody, /\bdeviceId\b/i);
});

test("exactly ONE appendSessionSummary call site (no drift / no second ungated path)", () => {
  const matches = STRIPPED.match(/appendSessionSummary\(/g) ?? [];
  assert.equal(matches.length, 1, `expected 1 appendSessionSummary call, got ${matches.length}`);
});

test("no fetch/XHR/sendBeacon near the appendSessionSummary call (no smuggled egress)", () => {
  // Window of ~1000 chars around the call.
  const idx = STRIPPED.indexOf("appendSessionSummary(");
  assert.ok(idx >= 0);
  const window = STRIPPED.slice(Math.max(0, idx - 500), idx + 500);
  assert.doesNotMatch(window, /\bfetch\s*\(/);
  assert.doesNotMatch(window, /\bXMLHttpRequest\b/);
  assert.doesNotMatch(window, /\bsendBeacon\b/);
  assert.doesNotMatch(window, /navigator\.\w*[Bb]eacon/);
});

test("sessionStartedAtRef is set on start AND cleared on stop", () => {
  // Set to a Date.now()-ish value somewhere in the source.
  assert.match(STRIPPED, /sessionStartedAtRef\.current\s*=\s*Date\.now\(\)/);
  // Cleared (= null) somewhere too.
  assert.match(STRIPPED, /sessionStartedAtRef\.current\s*=\s*null/);
  // And the gate inside the capture site checks it's not null first
  // (defensive against unmount races / stop-without-start).
  assert.match(
    STRIPPED,
    /sessionStartedAtRef\.current\s*!==\s*null[\s\S]{0,800}appendSessionSummary\(/,
  );
});

test("trackingTelemetry is reset on session start (so each session's totals are isolated)", () => {
  // Without a reset, totals[] would accumulate across sessions and the
  // exported summary's heldRatio would lie about THIS session.
  assert.match(STRIPPED, /trackingTelemetry\.current\.reset\(\)/);
});
