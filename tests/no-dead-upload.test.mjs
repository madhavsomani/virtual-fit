// Phase 7.3 — guard: only the GLB upload path lives on /mirror.
// `handleUpload` (the dead 2D /api/remove-bg path) must not come back.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIRROR = readFileSync(resolve(__dirname, "../app/mirror/page.tsx"), "utf8");

test("dead `handleUpload` (non-3D) is gone", () => {
  // The 2D handler lived as `const handleUpload = useCallback(...)` — only the
  // 3D variant should remain.
  assert.doesNotMatch(MIRROR, /\bconst\s+handleUpload\s*=\s*useCallback/);
  // Sanity: 3D handler still here.
  assert.match(MIRROR, /\bconst\s+handleUpload3D\s*=\s*useCallback/);
});

test("/api/remove-bg fetch (the dead 2D endpoint) is gone", () => {
  assert.doesNotMatch(MIRROR, /\/api\/remove-bg/);
});

test("no useCallback dep array still references the dead handler", () => {
  // Any deps array containing bare `handleUpload` (not handleUpload3D) is stale.
  assert.doesNotMatch(MIRROR, /\[\s*handleUpload\s*,/);
  assert.doesNotMatch(MIRROR, /,\s*handleUpload\s*,/);
  assert.doesNotMatch(MIRROR, /,\s*handleUpload\s*\]/);
});
