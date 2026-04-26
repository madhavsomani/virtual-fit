// Phase 7.88 — guard: mirror/page.tsx must use computeBodyYaw + skip the
// smoothing update on null. Pre-7.88 it had inline `(ls.z ?? 0) - (rs.z ?? 0)`
// which silently fabricated yaw=0 on missing-z frames and rubber-banded the
// garment. Lock the regression out at the import + call-site level.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SRC = readFileSync(resolve(ROOT, "app/mirror/page.tsx"), "utf8");

test("mirror/page.tsx imports computeBodyYaw from body-metrics", () => {
  assert.match(
    SRC,
    /import\s*\{[^}]*\bcomputeBodyYaw\b[^}]*\}\s*from\s*["']\.\/body-metrics(?:\.js)?["']/,
    "mirror page must import computeBodyYaw alongside computeBodyPitch",
  );
});

test("mirror/page.tsx no longer hand-rolls the inline shoulderZDelta yaw computation", () => {
  // The old line was:
  //   const shoulderZDelta = (ls.z ?? 0) - (rs.z ?? 0);
  // Lock the regression out — any future inline `?? 0` on .z arithmetic
  // fails this guard.
  assert.doesNotMatch(
    SRC,
    /const\s+shoulderZDelta\s*=/,
    "remove the inline shoulderZDelta assignment — use computeBodyYaw which returns null on bad z",
  );
  assert.doesNotMatch(
    SRC,
    /\(ls\.z\s*\?\?\s*0\)\s*-\s*\(rs\.z\s*\?\?\s*0\)/,
    "the `(ls.z ?? 0) - (rs.z ?? 0)` pattern fabricates yaw=0 on missing z — must not return",
  );
});

test("mirror/page.tsx skips the yaw smoothing update when computeBodyYaw returns null", () => {
  // The yaw smoother must be conditionally invoked. If yaw is null, the
  // smoothed value should remain unchanged (last good value held). Pattern:
  //   if (yawAngle !== null) { smoothPos.current.yaw = smoothScalar(...) }
  assert.match(
    SRC,
    /if\s*\(\s*yawAngle\s*!==\s*null\s*\)\s*\{[\s\S]{0,400}smoothPos\.current\.yaw\s*=\s*smoothScalar/,
    "yaw smoothing must be gated by `if (yawAngle !== null)` so null skips the update and holds the last good value",
  );
});
