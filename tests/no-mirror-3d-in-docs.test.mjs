// Phase 7.20 — guard: forward-looking launch + setup docs must not
// advertise `/mirror-3d` as a destination URL. The route still exists as
// a redirect shim (kept for backwards compat with already-shared launch
// links), but every new share should point to the canonical `/mirror`
// to avoid the extra client-side React redirect hop and duplicate-content
// indexing.
//
// `docs/3D_BUG_REPORT_2026-04-20.md` is exempt as a historical record.

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
const DOCS = resolve(ROOT, "docs");

// Files that are historical records or explicitly discuss the redirect
// itself; allowed to mention `/mirror-3d`.
const ALLOWLIST = new Set([
  "3D_BUG_REPORT_2026-04-20.md",
]);

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

test("no forward-looking doc advertises /mirror-3d as a destination", () => {
  const offenders = [];
  for (const p of walk(DOCS).filter((p) => p.endsWith(".md"))) {
    const base = p.split("/").pop();
    if (ALLOWLIST.has(base)) continue;
    const c = readFileSync(p, "utf8");
    if (/\/mirror-3d\b/.test(c)) offenders.push(p);
  }
  assert.deepEqual(
    offenders,
    [],
    "Update these docs to point to /mirror instead of /mirror-3d, " +
      "or add the file to ALLOWLIST if it's a historical record.",
  );
});
