// Phase 7.89 — guard: mirror/page.tsx must use computeDepthScaleStrict + skip the
// smoothing update on null. Pre-7.89 it had inline `((ls.z ?? 0) + (rs.z ?? 0))/2`
// which silently fabricated avgZ=0 → depthScale=1.0 ("neutral distance") on
// missing-z frames and made the garment "breathe" (shrink toward neutral on
// each z-dip, rubber-band back when z recovered). Lock the regression out.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SRC = readFileSync(resolve(ROOT, "app/mirror/page.tsx"), "utf8");

test("mirror/page.tsx imports computeDepthScaleStrict from body-metrics", () => {
  assert.match(
    SRC,
    /import\s*\{[^}]*\bcomputeDepthScaleStrict\b[^}]*\}\s*from\s*["']\.\/body-metrics(?:\.js)?["']/,
    "mirror page must import computeDepthScaleStrict alongside computeBodyYaw + computeBodyPitch",
  );
});

test("mirror/page.tsx no longer hand-rolls the inline avgShoulderZ depth computation", () => {
  // The old lines were:
  //   const avgShoulderZ = ((ls.z ?? 0) + (rs.z ?? 0)) / 2;
  //   const depthScale = 1.0 - (avgShoulderZ * 0.4);
  // Lock the regression — any future inline `?? 0` on .z arithmetic
  // for depth fails this guard.
  assert.doesNotMatch(
    SRC,
    /const\s+avgShoulderZ\s*=/,
    "remove the inline avgShoulderZ assignment — use computeDepthScaleStrict which returns null on bad z",
  );
  assert.doesNotMatch(
    SRC,
    /\(ls\.z\s*\?\?\s*0\)\s*\+\s*\(rs\.z\s*\?\?\s*0\)/,
    "the `(ls.z ?? 0) + (rs.z ?? 0)` pattern fabricates avgZ=0 on missing z — must not return",
  );
});

test("mirror/page.tsx skips the depth smoothing update when computeDepthScaleStrict returns null", () => {
  // Smoother must be conditionally invoked. If clampedDepth is null, the
  // smoothed value remains unchanged (last good value held). Pattern:
  //   if (clampedDepth !== null) { smoothPos.current.depth = smoothScalar(...) }
  assert.match(
    SRC,
    /if\s*\(\s*clampedDepth\s*!==\s*null\s*\)\s*\{[\s\S]{0,400}smoothPos\.current\.depth\s*=\s*smoothScalar/,
    "depth smoothing must be gated by `if (clampedDepth !== null)` so null skips the update and holds the last good value",
  );
});
