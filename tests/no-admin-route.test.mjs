// Phase 7.19 — guard: `/admin` and `/admin/stats` deleted as security
// theater + fake-uploader UX. Both pages had `?key=admin` plaintext gates
// (or no gate at all) and exposed user-localStorage debug data on a static
// deploy with no real auth surface. Stay deleted.

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

test("app/admin/ stays deleted", () => {
  assert.ok(
    !existsSync(resolve(APP, "admin")),
    "Phase 7.19 deleted /admin and /admin/stats. Do not bring them back. " +
      "Static-export deploys cannot enforce server-side auth, and the old " +
      "`?key=admin` plaintext gate was security theater.",
  );
});

test("no app/** route links to /admin or /admin/stats", () => {
  const offenders = [];
  for (const p of walk(APP).filter((p) => /\.(ts|tsx|mjs|js)$/.test(p))) {
    const c = strip(readFileSync(p, "utf8"));
    if (/['"`]\/admin(\/[^'"`]*)?['"`]/.test(c)) offenders.push(p);
  }
  assert.deepEqual(offenders, [], "/admin link resurrected");
});

test("no app/** route uses the `?key=admin` plaintext gate", () => {
  const offenders = [];
  for (const p of walk(APP).filter((p) => /\.(ts|tsx|mjs|js)$/.test(p))) {
    const c = strip(readFileSync(p, "utf8"));
    if (/key\s*===?\s*['"`]admin['"`]/.test(c)) offenders.push(p);
  }
  assert.deepEqual(offenders, [], "?key=admin plaintext gate resurrected");
});
