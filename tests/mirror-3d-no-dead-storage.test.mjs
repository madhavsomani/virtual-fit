// Phase 7.14/7.30 — guard: the `/mirror-3d` route must not probe localStorage
// for keys that are never written. Previously the React page read
// `virtualfit_gallery` (no writers anywhere) and silently auto-redirected to
// a stale model URL on a fresh visit. Phase 7.30 replaced the React page
// entirely with a static `public/mirror-3d/index.html` meta-refresh \u2014 the
// dead-key check now applies to the static file too.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const APP = resolve(ROOT, "app");
const PUBLIC = resolve(ROOT, "public");

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

test("React `app/mirror-3d/page.tsx` stays deleted (Phase 7.30)", () => {
  assert.ok(
    !existsSync(resolve(APP, "mirror-3d/page.tsx")),
    "The React redirect page was deleted in Phase 7.30 in favor of a " +
      "static public/mirror-3d/index.html. If you bring it back, you " +
      "re-introduce the ~100 KB First Load JS bundle and the Suspense " +
      "flash that the static meta-refresh avoids.",
  );
});

test("`public/mirror-3d/index.html` exists and meta-refreshes to /mirror", () => {
  const html = readFileSync(resolve(PUBLIC, "mirror-3d/index.html"), "utf8");
  assert.match(
    html,
    /<meta\s+http-equiv\s*=\s*["']refresh["'][^>]*url\s*=\s*\/mirror/i,
    "public/mirror-3d/index.html must meta-refresh to /mirror.",
  );
  assert.match(
    html,
    /window\.location\.replace/,
    "public/mirror-3d/index.html should also do a JS-side replace for instant nav.",
  );
});

test("public/mirror-3d/index.html does not probe `virtualfit_gallery`", () => {
  // Same dead-key rule applies to the new static page.
  const html = readFileSync(resolve(PUBLIC, "mirror-3d/index.html"), "utf8");
  assert.doesNotMatch(html, /virtualfit_gallery/);
});

test("`virtualfit_gallery` key is unused across the entire app/** source", () => {
  // If this ever fails because someone added a *writer* for the key, it's fine
  // to update the assertion to allow it. The point is to keep dead reads out.
  const offenders = [];
  for (const p of walk(APP).filter((p) => /\.(ts|tsx|mjs|js)$/.test(p))) {
    let txt = readFileSync(p, "utf8");
    // Strip block + line comments so retrospective prose is fine.
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
