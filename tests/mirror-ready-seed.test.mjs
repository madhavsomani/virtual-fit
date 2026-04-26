// Phase 7.90 — guard: mirror/page.tsx must DEFER first-frame ready=true until
// both yaw and depth are non-null. Otherwise the seed would hard-default
// yaw=0 (facing camera) + depth=1.0 (neutral size), and the 7.88/7.89
// null-gates on subsequent frames would SKIP the smoother updates whenever
// MediaPipe z confidence remained low — locking the garment at the wrong
// values until a clean frame arrived. Same rubber-banding we just fixed,
// just shifted to the seed boundary.
//
// Lock the regression: the seed branch must NOT use `?? 0` / `?? 1.0`
// fallbacks for yaw + depth, and must short-circuit when either is null.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SRC = readFileSync(resolve(ROOT, "app/mirror/page.tsx"), "utf8");

// Extract the `if (!smoothPos.current.ready)` block — keep guards focused.
function readySeedBlock() {
  const start = SRC.indexOf("if (!smoothPos.current.ready)");
  assert.ok(start >= 0, "could not locate the !ready seed block");
  // Take a generous window — the block is small and the next branch starts
  // with `} else {` which we'll cut at.
  const slice = SRC.slice(start, start + 1500);
  const elseIdx = slice.indexOf("} else {");
  assert.ok(elseIdx >= 0, "expected `} else {` after the ready-seed block");
  return slice.slice(0, elseIdx);
}

test("mirror/page.tsx ready-seed: must short-circuit when yaw is null", () => {
  const block = readySeedBlock();
  assert.match(
    block,
    /yawAngle\s*===\s*null/,
    "ready-seed must check `yawAngle === null` and bail (hiding mesh) — otherwise the post-7.88 null-gate locks yaw at the seed default",
  );
});

test("mirror/page.tsx ready-seed: must short-circuit when depth is null", () => {
  const block = readySeedBlock();
  assert.match(
    block,
    /clampedDepth\s*===\s*null/,
    "ready-seed must check `clampedDepth === null` and bail (hiding mesh) — otherwise the post-7.89 null-gate locks depth at the seed default",
  );
});

test("mirror/page.tsx ready-seed: must hide the mesh on the bail path", () => {
  const block = readySeedBlock();
  // Pattern: `if (yawAngle === null || clampedDepth === null) { mesh.visible = false; return; }`
  assert.match(
    block,
    /(yawAngle\s*===\s*null|clampedDepth\s*===\s*null)[\s\S]{0,200}mesh\.visible\s*=\s*false[\s\S]{0,80}return/,
    "ready-seed null-bail must set mesh.visible=false and return so the user sees no garment instead of a wrong-orientation flash",
  );
});

test("mirror/page.tsx ready-seed: must NOT hard-default yaw or depth with `?? 0` / `?? 1.0`", () => {
  const block = readySeedBlock();
  assert.doesNotMatch(
    block,
    /yawAngle\s*\?\?\s*0/,
    "ready-seed must not fall back to yaw=0 (facing-camera lie); short-circuit instead",
  );
  assert.doesNotMatch(
    block,
    /clampedDepth\s*\?\?\s*1(?:\.0)?/,
    "ready-seed must not fall back to depth=1.0 (neutral-distance lie); short-circuit instead",
  );
});

test("mirror/page.tsx ready-seed: actual seed assignment uses raw yawAngle/clampedDepth (no fallback)", () => {
  const block = readySeedBlock();
  // After the bail path, both values are guaranteed non-null. Seed must
  // assign them directly to lock the contract that the seed equals the
  // first real measurement.
  assert.match(
    block,
    /smoothPos\.current\s*=\s*\{[\s\S]*depth:\s*clampedDepth\s*,[\s\S]*yaw:\s*yawAngle\s*,/,
    "seed assignment must use `depth: clampedDepth` and `yaw: yawAngle` directly (post-bail both are non-null)",
  );
});
