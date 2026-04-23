// Phase 7.25 — guard: HARD RULE #1 says "NO 2D garment rendering. Strip
// all 2D fallback code." The 3D/2D mode toggle was hidden in Phase 1.2 by
// wrapping it in `{false && ...}`, then deleted entirely in Phase 7.25
// along with its `prefer3D` state and `mirror.preferredMode` localStorage
// key. Catch any future resurrection of the toggle or its storage key.

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

test("no app/** file references the dead 'mirror.preferredMode' storage key", () => {
  const offenders = [];
  for (const p of walk(APP).filter((p) => /\.(ts|tsx|mjs|js)$/.test(p))) {
    const c = strip(readFileSync(p, "utf8"));
    if (/['"`]mirror\.preferredMode['"`]/.test(c)) offenders.push(p);
  }
  assert.deepEqual(
    offenders,
    [],
    "'mirror.preferredMode' was the toggle key for the deleted 2D/3D " +
      "switch. HARD RULE: 3D-only — no toggle to express.",
  );
});

test("no app/** file declares a `prefer3D` or `setPrefer3D` symbol", () => {
  const offenders = [];
  for (const p of walk(APP).filter((p) => /\.(ts|tsx|mjs|js)$/.test(p))) {
    const c = strip(readFileSync(p, "utf8"));
    if (/\b(set)?[Pp]refer3D\b/.test(c)) offenders.push(p);
  }
  assert.deepEqual(
    offenders,
    [],
    "`prefer3D` was state for the deleted 2D/3D toggle. 3D-only enforced.",
  );
});

test("mirror/page.tsx does not render a '2D' UI label or 'Fast 2D' status", () => {
  const path = resolve(APP, "mirror/page.tsx");
  if (!existsSync(path)) return;
  const c = strip(readFileSync(path, "utf8"));
  // The deleted toggle's label was "🖼️ 2D" and its status text was
  // "🖼️ Fast 2D mode — instant overlay". Ban both — nothing in the
  // mirror UI should advertise a 2D mode to the user.
  assert.doesNotMatch(
    c,
    /Fast 2D mode/,
    "Removed in Phase 7.25 — there is no 2D mode.",
  );
  assert.doesNotMatch(
    c,
    /["'`]\u{1F5BC}\uFE0F 2D["'`]/u,
    "Removed in Phase 7.25 — no '🖼️ 2D' UI label.",
  );
});
