// Phase 7.29 — guard: pure helpers in app/lib/*-helpers.mjs and the
// orchestration helper in app/lib/isolate-garment.mjs are the SINGLE
// truth source. The TS sibling modules (trellis-client.ts,
// remove-background.ts) must re-export from / forward to them, not
// hand-maintain a duplicate function body. Drift between the two
// copies caused exactly the kind of silent divergence we banned in
// Phase 7.4 (lib-no-mjs-shadow).

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP = resolve(__dirname, "../app");

function strip(src) {
  let s = src.replace(/\/\*[\s\S]*?\*\//g, "");
  s = s
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
  return s;
}

test("trellis-client.ts imports extractGlbPath from trellis-helpers.mjs", () => {
  const src = readFileSync(resolve(APP, "lib/trellis-client.ts"), "utf8");
  assert.match(
    src,
    /from\s+["']\.\/trellis-helpers\.mjs["']/,
    "trellis-client.ts must import from trellis-helpers.mjs (single truth source).",
  );
});

test("trellis-client.ts does not redefine extractGlbPath body", () => {
  const code = strip(readFileSync(resolve(APP, "lib/trellis-client.ts"), "utf8"));
  // A redefinition would be `function extractGlbPath(` with a body \u2014 the
  // re-export uses `export const extractGlbPath: ... = _extractGlbPath;`
  // which has no `function` keyword paired with the name.
  assert.doesNotMatch(
    code,
    /function\s+extractGlbPath\s*\(/,
    "Don't redefine extractGlbPath in TS \u2014 import it from trellis-helpers.mjs.",
  );
});

test("remove-background.ts imports isolateGarmentImpl from isolate-garment.mjs", () => {
  const src = readFileSync(resolve(APP, "lib/remove-background.ts"), "utf8");
  assert.match(
    src,
    /from\s+["']\.\/isolate-garment\.mjs["']/,
    "remove-background.ts must import the orchestrator from isolate-garment.mjs.",
  );
});

test("remove-background.ts does not redefine the segformer\u2192RMBG fall-through inline", () => {
  const code = strip(readFileSync(resolve(APP, "lib/remove-background.ts"), "utf8"));
  // The duplicated body would contain the magic threshold + fall-through
  // pattern. The thin wrapper just forwards to isolateGarmentImpl.
  assert.doesNotMatch(
    code,
    /seg\.coverage\s*>\s*0\.02/,
    "Coverage threshold lives in isolate-garment.mjs. Don't restate it in TS.",
  );
});
