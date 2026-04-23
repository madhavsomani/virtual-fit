// Phase 7.14 — guard: `app/mirror-3d/page.tsx` must not probe localStorage
// for keys that are never written. Previously it read `virtualfit_gallery`
// (no writers anywhere in the app) and silently auto-redirected to a stale
// model URL on a fresh visit. Hold the line.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const APP = resolve(ROOT, "app");

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

test("mirror-3d/page.tsx code (comments stripped) does not probe `virtualfit_gallery`", () => {
  let src = readFileSync(resolve(APP, "mirror-3d/page.tsx"), "utf8");
  src = src.replace(/\/\*[\s\S]*?\*\//g, "");
  src = src
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
  assert.doesNotMatch(src, /virtualfit_gallery/);
});

test("`virtualfit_gallery` key is unused across the entire app/** source", () => {
  // If this ever fails because someone added a *writer* for the key, it's fine
  // to update the assertion to allow it. The point is to keep dead reads out.
  const offenders = [];
  for (const p of walk(APP).filter((p) => /\.(ts|tsx|mjs|js)$/.test(p))) {
    let txt = readFileSync(p, "utf8");
    // Strip block + line comments so retrospective Phase 7.14 prose is fine.
    txt = txt.replace(/\/\*[\s\S]*?\*\//g, "");
    txt = txt
      .split("\n")
      .map((l) => l.replace(/\/\/.*$/, ""))
      .join("\n");
    if (/virtualfit_gallery/.test(txt)) offenders.push(p);
  }
  assert.deepEqual(
    offenders,
    [],
    `Dead localStorage key 'virtualfit_gallery' resurrected in: ${offenders.join(", ")}`,
  );
});
