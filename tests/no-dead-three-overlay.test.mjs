// Phase 7.42 — guard: the dead `ThreeOverlay` component stays dead.
//
// Pre-7.42 `app/components/ThreeOverlay.tsx` was a 158-line parallel
// Three.js + GLTFLoader + shoulder-anchor renderer with ZERO callers
// (its own export was the only mention in the entire repo). It duplicated
// capabilities that live inline inside `app/mirror/page.tsx`. Risk: a
// future agent <ThreeOverlay /> it into a route and ships a regressed
// renderer; pose-tracking bugfixes would have to be applied twice. The
// directory `app/components/` itself only contained this file, so the
// whole directory went with it.

import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    let s;
    try {
      s = statSync(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      if (name === "node_modules" || name === ".next" || name === "dist") continue;
      walk(full, out);
    } else if (/\.(ts|tsx|js|mjs|cjs|jsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

test("the dead ThreeOverlay component file does not exist", () => {
  const dead = resolve(ROOT, "app/components/ThreeOverlay.tsx");
  assert.ok(
    !existsSync(dead),
    "app/components/ThreeOverlay.tsx was deleted in Phase 7.42 (zero callers, parallel renderer to /mirror). Do not resurrect it.",
  );
});

test("no source under app/ references the symbol ThreeOverlay", () => {
  const target = resolve(ROOT, "app");
  if (!existsSync(target)) return;
  const files = walk(target);
  const hits = [];
  for (const f of files) {
    let src;
    try {
      src = readFileSync(f, "utf8");
    } catch {
      continue;
    }
    if (/\bThreeOverlay\b/.test(src)) {
      hits.push(f);
    }
  }
  assert.deepEqual(
    hits,
    [],
    `ThreeOverlay symbol still referenced in:\n${hits.join("\n")}\nThe component was deleted; remove the import/usage.`,
  );
});
test("no source anywhere in the workspace imports from app/components/ThreeOverlay", () => {
  // Guards against a stale relative import like `../components/ThreeOverlay`
  // surviving in a route file or test. (This test file itself mentions the
  // path string in this very comment, so we exclude __filename.)
  const self = fileURLToPath(import.meta.url);
  const dirs = ["app", "api", "lib", "tests"]
    .map((d) => resolve(ROOT, d))
    .filter((d) => existsSync(d));
  const files = dirs.flatMap((d) => walk(d)).filter((f) => f !== self);
  const hits = [];
  for (const f of files) {
    let src;
    try {
      src = readFileSync(f, "utf8");
    } catch {
      continue;
    }
    if (/components\/ThreeOverlay/.test(src)) {
      hits.push(f);
    }
  }
  assert.deepEqual(
    hits,
    [],
    `Stale import path "components/ThreeOverlay" still present in:\n${hits.join("\n")}`,
  );
});
