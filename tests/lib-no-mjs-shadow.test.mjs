// Phase 7.4 — guard: bare `.mjs` siblings of `.ts` modules must not exist
// in app/lib, otherwise Next's resolver picks the .mjs and the typed exports
// silently disappear (caused "Attempted import error" warnings until 7764363).

import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LIB = resolve(__dirname, "../app/lib");

test("no .mjs file in app/lib shares a basename with a .ts/.tsx file", () => {
  const files = readdirSync(LIB);
  const tsBaseNames = new Set(
    files
      .filter((f) => f.endsWith(".ts") || f.endsWith(".tsx"))
      .map((f) => f.replace(/\.(ts|tsx)$/, "")),
  );
  const conflicts = files
    .filter((f) => f.endsWith(".mjs"))
    .map((f) => f.replace(/\.mjs$/, ""))
    .filter((base) => tsBaseNames.has(base));
  assert.deepEqual(
    conflicts,
    [],
    `Bare .mjs siblings of TS modules will shadow typed exports: ${conflicts.join(", ")}. ` +
      `Rename to <name>-pure.mjs.`,
  );
});

test("pure .mjs files are reachable for node:test", async () => {
  const a = await import("../app/lib/glb-normalize-pure.mjs");
  const b = await import("../app/lib/image-to-glb-pure.mjs");
  assert.equal(typeof a.computeNormalizeScale, "function");
  assert.equal(typeof b.imageToGlbPipelineImpl, "function");
});
