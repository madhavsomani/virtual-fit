// Phase 7.24 — guard: the entire `lib/analytics.ts` module was deleted
// after Phases 7.19, 7.22, and 7.23 confirmed it had four typed writers
// and zero consumers anywhere. The `virtualfit_analytics` localStorage key
// is **dead** — no file in the repo should touch it ever again. If real
// analytics are needed, wire to a real provider (Plausible/PostHog/Umami)
// in one place — not a localStorage ritual that produces orphan write-only
// events.

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

test("app/lib/analytics.ts stays deleted", () => {
  assert.ok(
    !existsSync(resolve(APP, "lib/analytics.ts")),
    "Phase 7.24 deleted the analytics module (zero consumers — every " +
      "visitor paid JSON.parse + JSON.stringify + localStorage.setItem on " +
      "every page view in service of nothing). If you bring analytics " +
      "back, wire to a real provider, not a localStorage ritual.",
  );
});

test("no app/** file references the dead 'virtualfit_analytics' storage key", () => {
  const offenders = [];
  for (const p of walk(APP).filter((p) => /\.(ts|tsx|mjs|js)$/.test(p))) {
    const c = strip(readFileSync(p, "utf8"));
    if (/['"`]virtualfit_analytics['"`]/.test(c)) offenders.push(p);
  }
  assert.deepEqual(
    offenders,
    [],
    "'virtualfit_analytics' is dead. Use a real analytics provider.",
  );
});

test("no app/** file imports from a deleted analytics module", () => {
  const offenders = [];
  for (const p of walk(APP).filter((p) => /\.(ts|tsx|mjs|js)$/.test(p))) {
    const c = strip(readFileSync(p, "utf8"));
    if (/from\s+['"][^'"]*lib\/analytics['"]/.test(c)) offenders.push(p);
  }
  assert.deepEqual(
    offenders,
    [],
    "lib/analytics was deleted in Phase 7.24. Don't re-import it.",
  );
});

test("no app/** file emits a 'code_redeemed' analytics event", () => {
  const offenders = [];
  for (const p of walk(APP).filter((p) => /\.(ts|tsx|mjs|js)$/.test(p))) {
    const c = strip(readFileSync(p, "utf8"));
    if (/['"`]code_redeemed['"`]/.test(c)) offenders.push(p);
  }
  assert.deepEqual(offenders, [], "code_redeemed was a write-only orphan event.");
});
