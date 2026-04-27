// Phase 7.109 — wiring contract for the proactive guidance pill in
// mirror/page.tsx. Same static-grep playbook as 7.103 / 7.106 / 7.107.
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

test("imports deriveProactiveGuidance from the dedicated module", () => {
  assert.match(
    STRIPPED,
    /import\s*\{\s*deriveProactiveGuidance\s*\}\s*from\s*["']\.\/proactive-guidance\.js["']/,
  );
});

test("uses useState typed by ReturnType<typeof deriveProactiveGuidance>", () => {
  // Lock the typing pattern so the state can never drift to a wider type
  // (e.g. `any`) that would silently mask a derivation contract change.
  assert.match(
    STRIPPED,
    /useState<\s*\n?\s*ReturnType<typeof\s+deriveProactiveGuidance>\s*\n?\s*>\(\s*null\s*\)/,
  );
});

test("polls via setInterval at 1000ms (NOT rAF, NOT 200ms) — slow-changing aggregate", () => {
  // Phase 7.110 swapped the inline deriveProactiveGuidance() call for
  // proactiveGuidanceTracker.current.evaluate(...). Use that as the anchor.
  const idx = STRIPPED.indexOf("proactiveGuidanceTracker.current.evaluate(");
  assert.ok(idx >= 0, "expected proactiveGuidanceTracker.evaluate call site");
  const window = STRIPPED.slice(Math.max(0, idx - 500), idx + 800);
  assert.match(window, /setInterval\(\s*\(\)\s*=>\s*\{[\s\S]*?\}\s*,\s*1000\s*\)/);
  assert.doesNotMatch(window, /requestAnimationFrame\(/);
});

test("setter is shallow-equal (axis + severity) to avoid spurious re-renders", () => {
  assert.match(
    STRIPPED,
    /setProactiveHint\(\(prev\)\s*=>\s*\{[\s\S]*?prev\.axis\s*===\s*next\.axis[\s\S]*?prev\.severity\s*===\s*next\.severity[\s\S]*?\}\)/,
  );
});

test("renders a pill with data-testid=proactive-hint AND data-axis AND data-severity", () => {
  assert.match(STRIPPED, /data-testid="proactive-hint"/);
  assert.match(STRIPPED, /data-axis=\{proactiveHint\.axis\}/);
  assert.match(STRIPPED, /data-severity=\{proactiveHint\.severity\}/);
});

test("pill render branch is gated on the proactiveHint state (not a raw ref read)", () => {
  // {proactiveHint && (...)} — the gate must be the state, not e.g.
  // {trackingTelemetry.current.snapshot().totals.yaw > 30 && ...}.
  assert.match(STRIPPED, /\{\s*proactiveHint\s*&&\s*\(/);
});

test("pill has pointerEvents:'none' (must not block underlying clicks)", () => {
  // Locate the pill block by its testid and check pointerEvents nearby.
  const idx = STRIPPED.indexOf('data-testid="proactive-hint"');
  assert.ok(idx >= 0);
  const window = STRIPPED.slice(idx, idx + 1200);
  assert.match(window, /pointerEvents\s*:\s*["']none["']/);
});

test("pill label comes from derived state (not inlined here, contract lives in the module)", () => {
  // {proactiveHint.label} must appear; LABELS strings must NOT appear inline.
  assert.match(STRIPPED, /\{proactiveHint\.label\}/);
  // Defensive: the canonical UX strings live in proactive-guidance.js. If the
  // page ever inlines them, a future copy change would drift across two files.
  assert.doesNotMatch(STRIPPED, /Try to face the camera/);
  assert.doesNotMatch(STRIPPED, /Try moving closer to the camera/);
});

test("exactly ONE proactive evaluate call site (no copy-paste drift, post-7.110 hysteresis tracker)", () => {
  // Phase 7.110 replaced the direct deriveProactiveGuidance() call with the
  // hysteresis tracker's evaluate(). Lock at exactly one tracker call site.
  const calls = STRIPPED.match(/proactiveGuidanceTracker\.current\.evaluate\(/g) ?? [];
  assert.equal(calls.length, 1, `expected 1 tracker.evaluate call, got ${calls.length}`);
  // And the direct derivation function MUST NOT be called from the page —
  // it lives behind the tracker now (the typeof reference for useState
  // typing is OK; that's not a call expression).
  const directCalls = STRIPPED.match(/\bderiveProactiveGuidance\s*\(/g) ?? [];
  assert.equal(
    directCalls.length,
    0,
    `direct deriveProactiveGuidance() calls must go through the tracker, found ${directCalls.length}`,
  );
});

test("Phase 7.110: imports + instantiates createProactiveGuidanceTracker as a useRef", () => {
  assert.match(
    STRIPPED,
    /import\s*\{\s*createProactiveGuidanceTracker\s*\}\s*from\s*["']\.\/proactive-guidance-tracker\.js["']/,
  );
  assert.match(
    STRIPPED,
    /const\s+proactiveGuidanceTracker\s*=\s*useRef\(\s*createProactiveGuidanceTracker\(\)\s*\)/,
  );
});

test("Phase 7.110: tracker.evaluate is called with both snapshot AND Date.now() (clock injected, not embedded)", () => {
  // The pure-with-time pattern: evaluate(snapshot, nowMs). Page must pass the
  // current clock; tracker must NOT call Date.now() internally (verified
  // separately in tests/proactive-guidance-tracker.test.mjs by deterministic
  // time control, but lock the call shape here too).
  assert.match(
    STRIPPED,
    /proactiveGuidanceTracker\.current\.evaluate\(\s*trackingTelemetry\.current\.snapshot\(\)\s*,\s*Date\.now\(\)\s*,?\s*\)/,
  );
});

test("Phase 7.110: tracker.reset() is called on session start (matches trackingTelemetry.reset cadence)", () => {
  // Without reset on session start, a fresh session would inherit the prior
  // session's cooldown axis and silently suppress a real first-second hint.
  assert.match(STRIPPED, /proactiveGuidanceTracker\.current\.reset\(\)/);
});
