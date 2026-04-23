// Phase 7.26 — guard: `app/lib/telemetry.ts` was deleted (carbon copy of
// the lib/analytics.ts deletion in Phase 7.24). The `virtualfit_telemetry`
// + `virtualfit_session_id` localStorage keys are dead. When real
// telemetry is needed: wire to one server-side provider in one place, not
// a localStorage ring buffer no one reads.

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

test("app/lib/telemetry.ts stays deleted", () => {
  assert.ok(
    !existsSync(resolve(APP, "lib/telemetry.ts")),
    "Phase 7.26 deleted the telemetry module (5 callers in mirror/, zero " +
      "readers of getAll/session/clear). If you bring telemetry back, " +
      "wire to a real provider, not a localStorage ring buffer.",
  );
});

test("no app/** file imports from a deleted telemetry module", () => {
  const offenders = [];
  for (const p of walk(APP).filter((p) => /\.(ts|tsx|mjs|js)$/.test(p))) {
    const c = strip(readFileSync(p, "utf8"));
    if (/from\s+['"][^'"]*lib\/telemetry['"]/.test(c)) offenders.push(p);
  }
  assert.deepEqual(
    offenders,
    [],
    "lib/telemetry was deleted in Phase 7.26. Don't re-import it.",
  );
});

test("no app/** file references the dead 'virtualfit_telemetry' storage key", () => {
  const offenders = [];
  for (const p of walk(APP).filter((p) => /\.(ts|tsx|mjs|js)$/.test(p))) {
    const c = strip(readFileSync(p, "utf8"));
    if (/['"`]virtualfit_telemetry['"`]/.test(c)) offenders.push(p);
  }
  assert.deepEqual(offenders, [], "'virtualfit_telemetry' is dead.");
});

test("no app/** file references the dead 'virtualfit_session_id' storage key", () => {
  // The session UUID was generated for the telemetry sink. With telemetry
  // gone, the consent-free persistent ID has no business being created.
  const offenders = [];
  for (const p of walk(APP).filter((p) => /\.(ts|tsx|mjs|js)$/.test(p))) {
    const c = strip(readFileSync(p, "utf8"));
    if (/['"`]virtualfit_session_id['"`]/.test(c)) offenders.push(p);
  }
  assert.deepEqual(offenders, [], "'virtualfit_session_id' is dead.");
});
