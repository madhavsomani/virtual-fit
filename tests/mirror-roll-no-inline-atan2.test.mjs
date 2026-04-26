// Phase 7.100 — guard against re-introducing the inline `Math.atan2(deltaY, deltaX)`
// roll computation. Phase 7.98 wired computeBodyRoll(), but the dead inline
// `const tiltAngle = Math.atan2(...)` survived as scaffolding "just in case",
// re-tempting the lurking-lie pattern. 7.100 deleted it; this guard keeps it gone.
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

// Strip block + line comments so prose mentions of the dead patterns
// (in Phase 7.100 commentary) don't cause false positives.
const stripped = SRC
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n")
  .map((l) => l.replace(/\/\/.*$/, ""))
  .join("\n");

test("inline `const tiltAngle = Math.atan2(...)` is gone (7.98 moved roll to computeBodyRoll)", () => {
  assert.doesNotMatch(stripped, /const\s+tiltAngle\s*=\s*Math\.atan2\b/);
});

test("dead `shoulderDeltaY` / `shoulderDeltaX` scaffolding removed", () => {
  assert.doesNotMatch(stripped, /\bshoulderDeltaY\b/);
  assert.doesNotMatch(stripped, /\bshoulderDeltaX\b/);
});

test("computeBodyRoll is the ONLY source of the roll signal", () => {
  // Sanity: the strict-null function is wired in.
  assert.match(SRC, /computeBodyRoll\s*\(\s*\{/);
});
