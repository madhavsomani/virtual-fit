// Phase 7.34 — guard: the dormant `gen3DStatus` / `gen3DProgress` /
// `use3DGeneration` second-generator pipeline stays out of `/mirror`.
//
// The canonical photo→3D path is the `/generate-3d` route (TRELLIS via
// HF Spaces or TripoSR via HF Inference). It persists the resulting GLB
// to localStorage and `/mirror` consumes it. An in-place toggle on
// `/mirror` would be a redundant second generator UI — UX trap and a
// duplicated network/cost surface.

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

test("`/mirror` does not declare a `use3DGeneration` toggle", () => {
  const src = strip(readFileSync(MIRROR, "utf8"));
  assert.doesNotMatch(
    src,
    /\buse3DGeneration\b/,
    "Resurrected `use3DGeneration` — the photo→3D flow lives at /generate-3d. Don't add a second generator UI on /mirror.",
  );
  assert.doesNotMatch(src, /\bsetUse3DGeneration\b/);
});

test("`/mirror` does not declare in-place generation progress state", () => {
  const src = strip(readFileSync(MIRROR, "utf8"));
  assert.doesNotMatch(src, /\bgen3DStatus\b/);
  assert.doesNotMatch(src, /\bsetGen3DStatus\b/);
  assert.doesNotMatch(src, /\bgen3DProgress\b/);
  assert.doesNotMatch(src, /\bsetGen3DProgress\b/);
});

test("`/mirror` does not POST directly to /api/generate-3d", () => {
  // The canonical flow is: user navigates to /generate-3d, the GLB is
  // persisted to localStorage, /mirror loads from localStorage. /mirror
  // itself must not call the generator endpoint.
  const src = strip(readFileSync(MIRROR, "utf8"));
  assert.doesNotMatch(
    src,
    /fetch\([^)]*\/api\/generate-3d/,
    "/mirror must not call /api/generate-3d directly. Use the /generate-3d route + localStorage handoff.",
  );
});
