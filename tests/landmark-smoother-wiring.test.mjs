// Phase 8.1 — landmark-smoother wiring guards in /mirror.
// Static-grep contract tests (same pattern as 7.99/7.100/7.103/7.106/7.110).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGE = path.resolve(__dirname, "../app/mirror/page.tsx");
const src = fs.readFileSync(PAGE, "utf8");
const sansComments = src
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|[^:])\/\/.*$/gm, "$1");

test("mirror imports createLandmarkSmoother from dedicated module", () => {
  assert.match(
    sansComments,
    /import\s*\{\s*createLandmarkSmoother\s*\}\s*from\s*["']\.\/landmark-smoother(\.js)?["']/,
    "expected createLandmarkSmoother import"
  );
});

test("smoother is held in a useRef (single instance per mount)", () => {
  assert.match(
    sansComments,
    /landmarkSmoother\s*=\s*useRef\(\s*createLandmarkSmoother\(/,
    "expected useRef-backed landmarkSmoother instance"
  );
});

test("raw landmarks are smoothed BEFORE downstream consumers", () => {
  // Both consumers (updateGarmentFromLandmarks + detectGestureRef) must see
  // the smoothed array — not the raw result.landmarks[0]. Static guard.
  assert.match(
    sansComments,
    /landmarkSmoother\.current\.smooth\(\s*result\.landmarks\[0\]\s*\)/,
    "smoother must wrap result.landmarks[0]"
  );
  // Regression lock: neither consumer may be called with the raw array.
  assert.doesNotMatch(
    sansComments,
    /updateGarmentFromLandmarks\(\s*result\.landmarks\[0\]\s*\)/,
    "updateGarmentFromLandmarks must not receive raw landmarks"
  );
  assert.doesNotMatch(
    sansComments,
    /detectGestureRef\.current\?\.\(\s*result\.landmarks\[0\]\s*\)/,
    "gesture detector must not receive raw landmarks"
  );
});

test("smoother resets on session start (no cross-session bleed)", () => {
  // The reset must live in the same block as trackingTelemetry.current.reset()
  // so it can't drift independently. Window-scan around that anchor.
  const idx = sansComments.indexOf("trackingTelemetry.current.reset()");
  assert.ok(idx > 0, "tracking telemetry reset anchor missing");
  const window = sansComments.slice(idx, idx + 600);
  assert.match(
    window,
    /landmarkSmoother\.current\.reset\(\s*\)/,
    "landmarkSmoother.reset() must run alongside tracking-telemetry reset"
  );
});

test("exactly ONE smoother instance (no parallel smoothers)", () => {
  const matches = sansComments.match(/createLandmarkSmoother\(/g) ?? [];
  assert.equal(matches.length, 1, `expected exactly 1 createLandmarkSmoother() call site, found ${matches.length}`);
});
