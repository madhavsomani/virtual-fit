// Phase 7.17 — guard: `/test-3d` was a 255-line dev/QA leftover that
// shipped to all users. It loaded the Khronos rubber-duck/box/avocado
// sample GLBs (the exact "uploaded a sari, got a duck" noise flagged in
// docs/3D_BUG_REPORT_2026-04-20.md) and pulled them from
// raw.githubusercontent.com on every visit. Stay deleted.

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

test("app/test-3d/ stays deleted", () => {
  assert.ok(
    !existsSync(resolve(APP, "test-3d")),
    "Phase 7.17 deleted /test-3d (rubber-duck Khronos-sample QA scaffolding " +
      "shipped to all users). Do not bring it back.",
  );
});

test("no app/** route fetches Khronos glTF-Sample-Models from raw.githubusercontent.com", () => {
  const offenders = [];
  for (const p of walk(APP).filter((p) => /\.(ts|tsx|mjs|js)$/.test(p))) {
    const c = strip(readFileSync(p, "utf8"));
    if (/raw\.githubusercontent\.com\/KhronosGroup\/glTF-Sample-Models/.test(c)) {
      offenders.push(p);
    }
  }
  assert.deepEqual(offenders, [], "Khronos sample-models URL resurfaced");
});

test("no app/** route advertises a /test-3d link", () => {
  const offenders = [];
  for (const p of walk(APP).filter((p) => /\.(ts|tsx|mjs|js)$/.test(p))) {
    const c = strip(readFileSync(p, "utf8"));
    // Match Link href / router.push / navigate to "/test-3d"
    if (/['"`]\/test-3d['"`]/.test(c)) offenders.push(p);
  }
  assert.deepEqual(offenders, [], "/test-3d link resurfaced");
});
