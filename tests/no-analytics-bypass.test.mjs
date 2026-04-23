// Phase 7.23 — guard: the `virtualfit_analytics` localStorage key must
// only be touched through the typed `analytics` module in `lib/analytics.ts`.
// Before this guard, `/redeem` bypassed the typed `track()` API and wrote
// a `code_redeemed` event that was never in the `EventName` union and had
// zero readers anywhere — pure write-only orphan event polluting the
// visitor's localStorage. Catch any future bypass.

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

// Only the analytics module itself is allowed to touch the storage key.
const ALLOWLIST = new Set([resolve(ROOT, "app/lib/analytics.ts")]);

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

test("only lib/analytics.ts touches the 'virtualfit_analytics' localStorage key", () => {
  const offenders = [];
  for (const p of walk(APP).filter((p) => /\.(ts|tsx|mjs|js)$/.test(p))) {
    if (ALLOWLIST.has(p)) continue;
    const c = strip(readFileSync(p, "utf8"));
    if (/['"`]virtualfit_analytics['"`]/.test(c)) offenders.push(p);
  }
  assert.deepEqual(
    offenders,
    [],
    "Use `analytics.track(...)` from app/lib/analytics.ts. Direct " +
      "localStorage writes to 'virtualfit_analytics' bypass the typed " +
      "EventName surface and produce orphan write-only events.",
  );
});

test("no app/** route emits a 'code_redeemed' analytics event", () => {
  // The `code_redeemed` event was a write-only orphan with zero readers.
  // If we ever surface redemptions, add it to EventName + use track().
  const offenders = [];
  for (const p of walk(APP).filter((p) => /\.(ts|tsx|mjs|js)$/.test(p))) {
    const c = strip(readFileSync(p, "utf8"));
    if (/['"`]code_redeemed['"`]/.test(c)) offenders.push(p);
  }
  assert.deepEqual(
    offenders,
    [],
    "code_redeemed was a write-only orphan event. Add it to EventName " +
      "in lib/analytics.ts and call analytics.track() if you need it.",
  );
});
