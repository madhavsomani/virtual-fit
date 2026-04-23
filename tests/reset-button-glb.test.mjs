// Phase 7.7 — guard: "Default Shirt" reset button must reload the demo GLB,
// not dispose/recreate the invisible 2D anchor and lie via status text.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIRROR = readFileSync(resolve(__dirname, "../app/mirror/page.tsx"), "utf8");

test("`garmentTextureRef` is gone (write-only ref had no consumers)", () => {
  // Strip line comments before grepping.
  const code = MIRROR.split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
  assert.doesNotMatch(code, /\bgarmentTextureRef\b/);
});

test("reset button is wired to demo GLB, not 2D anchor recreate", () => {
  // Strip line comments before grepping (own comments shouldn't trip the test).
  const code = MIRROR.split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
  // Button label updated.
  assert.match(code, /Reset to Demo/);
  assert.doesNotMatch(code, /Default Shirt\b/);
  // Button must reference the demo GLB asset.
  assert.match(code, /\/models\/demo-tshirt\.glb/);
  // The misleading status string is gone.
  assert.doesNotMatch(code, /Default yellow shirt loaded/);
});

test("GLB URL-load effect no longer toggles 2D-anchor visibility (no-op)", () => {
  // The dead "Hide default 2D garment mesh" branch is gone from the GLB
  // URL-param effect (lines ~1297-1356). Only the camera-off teardown may
  // still set visible=false, and that's intentional safety.
  assert.doesNotMatch(MIRROR, /Hide default 2D garment mesh/);
});
