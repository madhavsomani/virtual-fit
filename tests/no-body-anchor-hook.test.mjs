// Phase 7.28 — guard: `app/hooks/useBodyAnchor.ts` was deleted along with
// the entire `app/hooks/` directory it solely populated. Of 3 exports
// (computeAnchor, updateMeshPosition, reset) only computeAnchor had any
// caller, and only `confidence` of its 4-field return was read,
// duplicating an avg-vis gate already in mirror/page.tsx. The Phase 1.3
// "parallel signal source" experiment never replaced the smoothPos
// positioner. Hold the line: if you want a body-anchor abstraction,
// design one and replace the smoothPos block, don't run a parallel
// allocator in the webcam loop for nothing.

import assert from "node:assert/strict";
import test from "node:test";
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const APP = resolve(ROOT, "app");

function walk(dir) {
  const out = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function strip(src) {
  let s = src.replace(/\/\*[\s\S]*?\*\//g, "");
  s = s
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
  return s;
}

test("app/hooks/useBodyAnchor.ts stays deleted", () => {
  assert.ok(
    !existsSync(resolve(APP, "hooks/useBodyAnchor.ts")),
    "Phase 7.28 deleted the parallel-signal-source hook. If you want a " +
      "body-anchor abstraction, design one and replace the smoothPos " +
      "positioner; don't run a parallel allocator in the webcam loop.",
  );
});

test("no app/** file imports useBodyAnchor", () => {
  const offenders = [];
  for (const p of walk(APP).filter((p) => /\.(ts|tsx|mjs|js)$/.test(p))) {
    const c = strip(readFileSync(p, "utf8"));
    if (/\buseBodyAnchor\b/.test(c)) offenders.push(p);
  }
  assert.deepEqual(
    offenders,
    [],
    "useBodyAnchor was deleted in Phase 7.28. Don't re-import it.",
  );
});
