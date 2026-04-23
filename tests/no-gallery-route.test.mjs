// Phase 7.21 — guard: `/gallery` was a 238-line dead route that read
// `localStorage["savedGarments"]` while `/mirror` writes to
// `localStorage["virtualfit-saved-garments"]`. Two different keys + two
// different shapes → gallery showed "No saved garments yet" for every
// real user, every visit, since day one. Stay deleted.

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

test("app/gallery/ stays deleted", () => {
  assert.ok(
    !existsSync(resolve(APP, "gallery")),
    "Phase 7.21 deleted /gallery (read 'savedGarments' key that nothing " +
      "ever wrote; mirror writes 'virtualfit-saved-garments' instead). " +
      "If you bring gallery back, unify the storage key + data shape with " +
      "the mirror saved-garments picker first.",
  );
});

test("no app/** route reads or writes the orphan 'savedGarments' key", () => {
  // The mirror writes "virtualfit-saved-garments". The bare "savedGarments"
  // key was orphaned by /gallery and never populated. Catch any future
  // resurrection of the wrong key.
  const offenders = [];
  for (const p of walk(APP).filter((p) => /\.(ts|tsx|mjs|js)$/.test(p))) {
    const c = strip(readFileSync(p, "utf8"));
    if (/['"`]savedGarments['"`]/.test(c)) offenders.push(p);
  }
  assert.deepEqual(
    offenders,
    [],
    "Use the canonical 'virtualfit-saved-garments' key instead of 'savedGarments'",
  );
});

test("no app/** file links to /gallery", () => {
  const offenders = [];
  for (const p of walk(APP).filter((p) => /\.(ts|tsx|mjs|js)$/.test(p))) {
    const c = strip(readFileSync(p, "utf8"));
    if (/['"`]\/gallery['"`]/.test(c)) offenders.push(p);
  }
  assert.deepEqual(offenders, [], "/gallery link resurrected");
});
