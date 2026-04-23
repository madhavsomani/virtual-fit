// Phase 7.27 — guard: `app/generate-3d/page.tsx` had ~83 lines of
// unreachable "legacy multi-provider" code preserved "for reference"
// after a `return;`. The block hard-coded a Meshy/Replicate polling
// pattern (HARD RULE #2: no paid APIs) and revived the `isMock`
// 2D-texture path Phase 7.8 already rejected (HARD RULE #1). Hold the
// line: the live HF/Hunyuan3D-2 multipart path is the *only* supported
// flow on this page.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(
  resolve(__dirname, "../app/generate-3d/page.tsx"),
  "utf8",
);

function code() {
  let s = SRC.replace(/\/\*[\s\S]*?\*\//g, "");
  s = s
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
  return s;
}

test("generate-3d/page.tsx does not reference Meshy", () => {
  // Meshy is a paid API; HARD RULE #2 forbids paid APIs. Catch any
  // attempt to revive the polling fallback.
  assert.doesNotMatch(
    code(),
    /Meshy/i,
    "Meshy is a paid API. HARD RULE #2: free providers only.",
  );
});

test("generate-3d/page.tsx does not reference Replicate", () => {
  // Replicate is a paid hosting provider; HARD RULE #2 same as above.
  assert.doesNotMatch(
    code(),
    /Replicate/i,
    "Replicate is paid. HARD RULE #2: HF Spaces / HF Inference / free GLBs.",
  );
});

test("generate-3d/page.tsx does not branch on a 2D `isMock` response", () => {
  // Phase 7.8 stripped the `isMock` flat-overlay path. The legacy block
  // that revived it was deleted in Phase 7.27. Don't bring it back.
  assert.doesNotMatch(
    code(),
    /\bisMock\b/,
    "isMock was a 2D-texture flat-overlay branch. HARD RULE #1: no 2D.",
  );
});

test("generate-3d/page.tsx does not poll an async `pollUrl` provider", () => {
  // The polling-and-await pattern was the Meshy fallback. The live HF
  // path returns the GLB binary synchronously in one POST.
  assert.doesNotMatch(
    code(),
    /\bpollUrl\b/,
    "pollUrl was the Meshy async API. HARD RULE #2: no paid APIs.",
  );
});

test("generate-3d/page.tsx does not contain a 'never reached' marker", () => {
  // If anyone leaves dead code with this comment again, fail the build
  // before it ships to a visitor's bundle.
  assert.doesNotMatch(
    code(),
    /never reached/i,
    "Don't ship 'never reached' code. Delete it.",
  );
});
