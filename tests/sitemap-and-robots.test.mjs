// Phase 7.46 — guard: sitemap + robots.txt point at the canonical
// virtualfit.app domain (not the anonymous Azure SWA preview hostname)
// and list every routable page.tsx under app/.
//
// Pre-7.46 the sitemap rooted everything at
// https://wonderful-sky-0513a3610.7.azurestaticapps.net/ and listed only
// 4 routes — missing /generate-3d/, /build-in-public/, /redeem/. Crawlers
// indexing the Azure URL split SEO equity from the real domain and
// broadcast a throwaway hostname as canonical (same brand-trust class as
// Phases 7.32 / 7.33 / 7.40 / 7.43).

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SITEMAP = resolve(ROOT, "public/sitemap.xml");
const ROBOTS = resolve(ROOT, "public/robots.txt");
const APP_DIR = resolve(ROOT, "app");

const CANONICAL = "https://virtualfit.app";

// Subdirectories that exist under app/ but are NOT routes (and so must not
// be in the sitemap).
const NON_ROUTE = new Set(["lib", "api", "components"]);
// Routes intentionally omitted from the sitemap (post-purchase pages, etc.).
// Phase 7.76: /retailer/ added to opt-outs because /retailer/page.tsx
// is now a permanent redirect to /retailer/signup (Phase 7.61) — listing
// the redirect source in the sitemap wastes crawl budget and confuses
// canonical signal.
const OMITTED_ROUTES = new Set(["/checkout/success/", "/retailer/", "/debug/telemetry/", "/retailer/dashboard/"]);

function discoverRoutes() {
  // Walk app/ and yield every directory that has a page.tsx in it. We treat
  // app/page.tsx as the root "/" route.
  const out = [];
  function walk(dir, urlPrefix) {
    const name = dir === APP_DIR ? "" : dir.slice(APP_DIR.length + 1);
    if (existsSync(join(dir, "page.tsx"))) {
      const url = name === "" ? "/" : `/${name.replace(/\\/g, "/")}/`;
      out.push(url);
    }
    for (const entry of readdirSync(dir)) {
      if (entry.startsWith("_") || entry.startsWith(".")) continue;
      if (NON_ROUTE.has(entry)) continue;
      const full = join(dir, entry);
      let s;
      try { s = statSync(full); } catch { continue; }
      if (s.isDirectory()) walk(full, name);
    }
  }
  walk(APP_DIR, "");
  return out;
}

test("sitemap.xml uses the canonical virtualfit.app domain", () => {
  let xml = readFileSync(SITEMAP, "utf8");
  // Strip XML comments so our own migration note (which names the bad
  // hostname on purpose) doesn't false-positive.
  xml = xml.replace(/<!--[\s\S]*?-->/g, "");
  assert.doesNotMatch(
    xml,
    /azurestaticapps\.net/,
    "sitemap.xml must not reference the anonymous Azure SWA preview hostname (azurestaticapps.net) — use https://virtualfit.app instead.",
  );
  // Every <loc> must start with the canonical base.
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.ok(locs.length > 0, "sitemap.xml has no <loc> entries");
  for (const loc of locs) {
    assert.ok(
      loc.startsWith(`${CANONICAL}/`),
      `sitemap entry must use https://virtualfit.app base, got: ${loc}`,
    );
  }
});

test("robots.txt Sitemap line points at virtualfit.app", () => {
  const txt = readFileSync(ROBOTS, "utf8");
  assert.match(
    txt,
    new RegExp(`^Sitemap:\\s*${CANONICAL.replace(/\./g, "\\.")}/sitemap\\.xml\\s*$`, "m"),
    "robots.txt must declare Sitemap: https://virtualfit.app/sitemap.xml",
  );
  assert.doesNotMatch(
    txt,
    /azurestaticapps\.net/,
    "robots.txt must not reference the anonymous Azure SWA preview hostname.",
  );
});

test("sitemap covers every routable page.tsx under app/ (minus opt-outs)", () => {
  const xml = readFileSync(SITEMAP, "utf8");
  const present = new Set(
    [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map((m) => m[1].slice(CANONICAL.length))
      .map((p) => (p === "" ? "/" : p)),
  );
  const expected = discoverRoutes().filter((r) => !OMITTED_ROUTES.has(r));
  const missing = expected.filter((r) => !present.has(r));
  assert.deepEqual(
    missing,
    [],
    `sitemap.xml is missing routes that exist as page.tsx under app/: ${missing.join(", ")}`,
  );
});

test("sitemap lastmod values are valid dates and not in the future", () => {
  const xml = readFileSync(SITEMAP, "utf8");
  const lastmods = [...xml.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);
  assert.ok(lastmods.length > 0, "no <lastmod> entries in sitemap");
  const now = Date.now();
  for (const lm of lastmods) {
    const t = Date.parse(lm);
    assert.ok(!Number.isNaN(t), `Invalid lastmod date: ${lm}`);
    assert.ok(t <= now + 86_400_000, `lastmod is in the future: ${lm}`);
  }
});

test("no sitemap entry points at a non-route directory (lib/api/components)", () => {
  const xml = readFileSync(SITEMAP, "utf8");
  for (const bad of NON_ROUTE) {
    assert.doesNotMatch(
      xml,
      new RegExp(`<loc>[^<]*/${bad}/`),
      `sitemap.xml must not list /${bad}/ — it isn't a Next route segment.`,
    );
  }
});
