// Phase 7.39 — guard: exactly one FPS counter in /mirror.
//
// Pre-7.39 the detect/render loop ran two completely independent FPS
// counters in parallel (`fps` + `setFps` driven by `frameCount.current`
// using `performance.now()`, and `currentFps` + `setCurrentFps` driven by
// `fpsCounterRef.current.frames` using `Date.now()`). They measured the
// same frames, cost two setStates per second, used different time bases,
// and could desync on camera restart since only `setFps(0)` had a reset.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const MIRROR = resolve(ROOT, "app/mirror/page.tsx");

function strip(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
}

test("there is exactly ONE FPS-value useState slot (currentFps)", () => {
  const src = strip(readFileSync(MIRROR, "utf8"));
  // Only count states whose name is the canonical fps numeric counter.
  // Reject any new `[fps, setFps]` or `[someFps, setSomeFps]` that
  // measures the same thing as `currentFps`. Allow related booleans like
  // `lowFpsWarning` / `showFps` (these store distinct semantics).
  const allFpsLike = [
    ...src.matchAll(/const \[(\w+),\s*(set\w+)\]\s*=\s*useState/g),
  ]
    .map((m) => m[1])
    .filter((name) => /^(?:fps|currentFps|liveFps|frameFps|smoothedFps)$/i.test(name));
  assert.deepEqual(
    allFpsLike,
    ["currentFps"],
    `the only allowed FPS-value useState is currentFps; got: ${JSON.stringify(allFpsLike)}`,
  );
});

test("the deleted parallel FPS counter does not come back", () => {
  const src = strip(readFileSync(MIRROR, "utf8"));
  // The parallel counter used a `frameCount` ref + `lastFpsUpdate` ref +
  // `setFps(...)` callsites. None of those should appear in real code.
  assert.doesNotMatch(src, /\bsetFps\s*\(/, "Resurrected setFps — only setCurrentFps is allowed.");
  assert.doesNotMatch(src, /\bconst\s+frameCount\s*=\s*useRef/, "Resurrected frameCount ref.");
  assert.doesNotMatch(src, /\bconst\s+lastFpsUpdate\s*=\s*useRef/, "Resurrected lastFpsUpdate ref.");
});

test("the low-FPS warning gate reads from the canonical counter (single time base)", () => {
  const src = strip(readFileSync(MIRROR, "utf8"));
  // The low-fps logic now lives in the `fpsCounterRef` block. Verify
  // `setLowFpsWarning` is invoked from a block that also sees
  // `fpsCounterRef.current.frames` so we know they share a time base.
  const fpsCounterIdx = src.indexOf("fpsCounterRef.current.frames");
  assert.ok(fpsCounterIdx > 0, "could not locate fpsCounterRef block");
  const slice = src.slice(fpsCounterIdx, fpsCounterIdx + 1500);
  assert.match(
    slice,
    /setLowFpsWarning/,
    "low-FPS warning must be set inside the same block as fpsCounterRef so it shares one time base.",
  );
});
