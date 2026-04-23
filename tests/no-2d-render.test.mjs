// Phase 7.2 — regression guard: /mirror must never render the 2D anchor plane,
// and the legacy `?garmentTexture=` URL-param flat-overlay path must stay deleted.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIRROR = readFileSync(resolve(__dirname, "../app/mirror/page.tsx"), "utf8");

test("the 2D anchor mesh stays invisible (no `mesh.visible = true|showGarment`)", () => {
  assert.doesNotMatch(MIRROR, /\bmesh\.visible\s*=\s*true\b/);
  assert.doesNotMatch(MIRROR, /\bmesh\.visible\s*=\s*showGarment\b/);
  // It SHOULD be explicitly forced false.
  assert.match(MIRROR, /mesh\.visible\s*=\s*false/);
});

test("`?garmentTexture=` URL-param flat-overlay effect is gone", () => {
  // The deleted block always pulled `garmentTextureUrl` inside a useEffect deps array.
  assert.doesNotMatch(MIRROR, /\[garmentTextureUrl,\s*cameraOn,\s*createShirtMesh\]/);
  // And the user-facing "Loading garment image" string is gone.
  assert.doesNotMatch(MIRROR, /Loading garment image/);
  assert.doesNotMatch(MIRROR, /flat overlay/);
});

test("mirror file still parses the GLB-only path (smoke)", () => {
  // Sanity: GLB loader + pipeline + normalize helper still wired.
  assert.match(MIRROR, /normalizeGlb\(/);
  assert.match(MIRROR, /imageToGlbPipeline\(/);
  assert.match(MIRROR, /garment3DModelRef/);
});
