// Phase 7.91 — guard: mirror/page.tsx must null-gate pitch in the smoother
// AND extend the seed-bail to include pitch. Same `?? 0` lie pattern that
// 7.88 (yaw) and 7.89 (depth) closed.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SRC = readFileSync(resolve(ROOT, "app/mirror/page.tsx"), "utf8");

test("mirror/page.tsx pitch smoother is gated by `if (pitchAngle !== null)`", () => {
  // Pre-7.91:
  //   smoothPos.current.pitch = smoothScalar(prev, pitchAngle, ...) ?? pitchAngle;
  // (no null-gate; pre-7.91 computeBodyPitch internally fell back z→0 on missing
  //  inputs, so pitchAngle was rarely null — but post-7.91 it can be, and the
  //  smoother must skip the update.)
  assert.match(
    SRC,
    /if\s*\(\s*pitchAngle\s*!==\s*null\s*\)\s*\{[\s\S]{0,400}smoothPos\.current\.pitch\s*=\s*smoothScalar/,
    "pitch smoothing must be gated by `if (pitchAngle !== null)` so null skips the update and holds the last good lean",
  );
});

test("mirror/page.tsx ready-seed extends bail-out to include pitch === null", () => {
  const start = SRC.indexOf("if (!smoothPos.current.ready)");
  assert.ok(start >= 0);
  const slice = SRC.slice(start, start + 1500);
  const elseIdx = slice.indexOf("} else {");
  const block = slice.slice(0, elseIdx);
  assert.match(
    block,
    /pitchAngle\s*===\s*null/,
    "ready-seed must check `pitchAngle === null` and bail — otherwise seed commits a lie that the post-7.91 null-gate then locks in",
  );
});
