// Phase 7.5 — guard: the dead "default yellow shirt" texture-loader path
// must not come back. The 2D anchor is invisible; eagerly fetching a PNG
// to texture an invisible mesh is dead bandwidth.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIRROR = readFileSync(resolve(__dirname, "../app/mirror/page.tsx"), "utf8");

test("`loadDefaultTexture` and `defaultTextureRef` are gone", () => {
  // Allow them inside Phase 7.5 prose comments; ban code references.
  // Strip line comments before grepping.
  const code = MIRROR.split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
  assert.doesNotMatch(code, /\bloadDefaultTexture\b/);
  assert.doesNotMatch(code, /\bdefaultTextureRef\b/);
});

test("no eager fetch of /garments/yellow-shirt-nobg.png on mount", () => {
  // The TextureLoader.load("/garments/yellow-shirt-nobg.png", …) is the
  // signature of the dead path.
  assert.doesNotMatch(
    MIRROR,
    /TextureLoader[\s\S]{0,200}\/garments\/yellow-shirt-nobg\.png/,
  );
});

test("`createShirtMesh` no longer takes a texture argument", () => {
  // Anchor is invisible; the texture branch is gone.
  assert.match(
    MIRROR,
    /const\s+createShirtMesh\s*=\s*useCallback\(\(\)\s*=>/,
  );
  assert.doesNotMatch(MIRROR, /createShirtMesh\(texture\)/);
});
