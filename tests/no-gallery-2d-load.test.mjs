// Phase 7.6 — guard: gallery selection must not TextureLoader PNGs onto the
// invisible 2D anchor. Both `switchGarment` and `loadSavedGarment` had dead
// 2D paths that did nothing visible since Phase 7.2.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIRROR = readFileSync(resolve(__dirname, "../app/mirror/page.tsx"), "utf8");

test("no TextureLoader.load(garment.path …) — gallery PNG path is dead", () => {
  assert.doesNotMatch(MIRROR, /loader\.load\(\s*garment\.path/);
});

test("no TextureLoader.load(garment.dataUrl …) — savedGarments 2D path is dead", () => {
  assert.doesNotMatch(MIRROR, /loader\.load\(\s*garment\.dataUrl/);
});

test("no garmentLoading state spinner (selection is sync now)", () => {
  // Ban the React state pair AND the JSX gate.
  assert.doesNotMatch(MIRROR, /\bsetGarmentLoading\b/);
  assert.doesNotMatch(MIRROR, /\bgarmentLoading\s*&&/);
});

test("switchGarment + loadSavedGarment still defined and reachable", () => {
  assert.match(MIRROR, /const\s+switchGarment\s*=\s*useCallback/);
  assert.match(MIRROR, /const\s+loadSavedGarment\s*=\s*useCallback/);
});
