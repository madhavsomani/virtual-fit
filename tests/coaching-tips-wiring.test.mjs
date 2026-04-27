// Phase 7.112 — wiring contract for the per-axis coaching tips list.
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
const STRIPPED = SRC.replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n")
  .map((l) => l.replace(/\/\/.*$/, ""))
  .join("\n");

test("imports deriveCoachingTips from the dedicated module", () => {
  assert.match(
    STRIPPED,
    /import\s*\{\s*deriveCoachingTips\s*\}\s*from\s*["']\.\/coaching-tips\.js["']/,
  );
});

test("uses useState typed by ReturnType<typeof deriveCoachingTips>", () => {
  assert.match(
    STRIPPED,
    /useState<\s*\n?\s*ReturnType<typeof\s+deriveCoachingTips>\s*\n?\s*>\(\s*\[\]\s*\)/,
  );
});

test("derivation runs UNGATED (same lifecycle as the quality badge)", () => {
  const callIdx = STRIPPED.indexOf("deriveCoachingTips({ summary }");
  assert.ok(callIdx >= 0, "expected deriveCoachingTips call");
  const window = STRIPPED.slice(Math.max(0, callIdx - 600), callIdx);
  assert.equal(
    window.indexOf("debugTelemetry"),
    -1,
    "deriveCoachingTips must run BEFORE the debugTelemetry gate",
  );
});

test("tips share the badge's auto-clear setTimeout (single timer, not two)", () => {
  // The badge and tips MUST clear together — split timers would let them
  // drift out of sync (badge clears at t=6s, tips linger). Same instance
  // closure for setSessionQuality + setCoachingTips inside the same setTimeout.
  const stIdx = STRIPPED.indexOf("setCoachingTips(tips)");
  assert.ok(stIdx >= 0);
  const window = STRIPPED.slice(stIdx, stIdx + 800);
  // Identity-checked clear (matches the 7.111 pattern).
  assert.match(
    window,
    /setCoachingTips\(\s*\(prev\)\s*=>\s*\(?\s*prev\s*===\s*tips\s*\?\s*\[\]\s*:\s*prev/,
  );
});

test("tips cleared on session START (no stale tips across sessions)", () => {
  const startIdx = STRIPPED.indexOf("sessionStartedAtRef.current = Date.now()");
  assert.ok(startIdx >= 0);
  const window = STRIPPED.slice(startIdx, startIdx + 500);
  assert.match(window, /setCoachingTips\(\s*\[\]\s*\)/);
});

test("render branch is gated on warning/danger tone (success grades skip coaching)", () => {
  // Success-grade sessions don't need coaching — surfacing tips with a
  // green "Excellent" badge would read as condescending.
  assert.match(
    STRIPPED,
    /sessionQuality\.tone\s*===\s*["']warning["']\s*\|\|\s*sessionQuality\.tone\s*===\s*["']danger["']/,
  );
});

test("render branch ALSO requires coachingTips.length > 0 (no empty list flash)", () => {
  assert.match(STRIPPED, /coachingTips\.length\s*>\s*0/);
});

test("renders <ul data-testid=session-quality-tips> with <li data-testid=session-quality-tip data-axis>", () => {
  assert.match(STRIPPED, /data-testid="session-quality-tips"/);
  assert.match(STRIPPED, /data-testid="session-quality-tip"/);
  assert.match(STRIPPED, /data-axis=\{tip\.axis\}/);
});

test("tip text comes from derived state; UX copy NOT inlined", () => {
  assert.match(STRIPPED, /\{tip\.title\}/);
  assert.match(STRIPPED, /\{tip\.detail\}/);
  // Canonical UX strings live in coaching-tips.js. If the page inlines them,
  // a future copy change drifts across two files.
  assert.doesNotMatch(STRIPPED, /Face the camera straight on/);
  assert.doesNotMatch(STRIPPED, /Stand a step closer to the camera/);
  assert.doesNotMatch(STRIPPED, /Hold the camera at chest height/);
  assert.doesNotMatch(STRIPPED, /Keep the phone level/);
});

test("exactly ONE deriveCoachingTips call site (no copy-paste drift)", () => {
  const calls = STRIPPED.match(/deriveCoachingTips\(/g) ?? [];
  assert.equal(calls.length, 1, `expected 1 call, got ${calls.length}`);
});
