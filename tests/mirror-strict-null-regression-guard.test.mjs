// Phase 7.99 — guard against the `computeBodyPitch(...) ?? 0` regression
// that silently defeated Phase 7.91's strict-null contract. Pre-7.99 the
// trailing nullish-coalesce coerced null → 0, making the downstream
// `if (pitchAngle !== null)` smoother gate always-pass and feeding the
// smoother fabricated upright-posture 0 on every bad-z frame.
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

test("computeBodyPitch result is NOT coerced via `?? 0` (7.91 contract preserved)", () => {
  // The exact pattern that defeats strict-null. If this re-appears on the
  // computeBodyPitch call site, the regression is back.
  assert.doesNotMatch(
    SRC,
    /computeBodyPitch\(\{[\s\S]*?\}\)\s*\?\?\s*0/,
  );
});

test("computeBodyYaw result is NOT coerced via `?? 0` (7.88 contract preserved)", () => {
  assert.doesNotMatch(
    SRC,
    /computeBodyYaw\(\{[\s\S]*?\}\)\s*\?\?\s*0/,
  );
});

test("computeBodyRoll result is NOT coerced via `?? 0` (7.98 contract preserved)", () => {
  assert.doesNotMatch(
    SRC,
    /computeBodyRoll\(\{[\s\S]*?\}\)\s*\?\?\s*0/,
  );
});

test("computeDepthScaleStrict result is NOT coerced via `?? 1` or `?? 1.0` (7.89 contract preserved)", () => {
  assert.doesNotMatch(
    SRC,
    /computeDepthScaleStrict\(\{[\s\S]*?\}\)\s*\?\?\s*1(?:\.0+)?/,
  );
});

test("seed-frame bail still checks all 4 axes for null (post-7.98 contract)", () => {
  // mesh.visible = false; return; after a 4-axis null check is the only place
  // that legitimately handles null on the seed frame. If anyone changes this
  // to a 3-axis check (forgetting roll), the seed-frame loophole reopens.
  assert.match(
    SRC,
    /yawAngle === null\s*\|\|\s*clampedDepth === null\s*\|\|\s*pitchAngle === null\s*\|\|\s*rollAngle === null/,
  );
});
