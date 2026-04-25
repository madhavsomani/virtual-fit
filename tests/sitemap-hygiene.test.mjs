// Phase 7.76 — guard: sitemap.xml must NOT list /retailer/ (redirect
// source, Phase 7.61 308 → /retailer/signup) and MUST NOT list
// /checkout/success/ (post-purchase, Phase 7.75 noindex). Both
// redirect-source and noindex pages waste crawl budget and confuse
// canonical signal.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITEMAP = readFileSync(
  resolve(__dirname, "..", "public/sitemap.xml"),
  "utf8",
);
const RETAILER_PAGE = readFileSync(
  resolve(__dirname, "..", "app/retailer/page.tsx"),
  "utf8",
);

test("sitemap does NOT list /retailer/ (Phase 7.61 redirects it to /retailer/signup)", () => {
  // Pair guard: only fire if /retailer/page.tsx still redirects (so we
  // don't punish a future agent who legitimately restores /retailer
  // as a real page).
  const stillRedirects = /redirect\(\s*["']\/retailer\/signup["']\s*\)/.test(
    RETAILER_PAGE,
  );
  if (!stillRedirects) {
    // /retailer is no longer a redirect — skip; future agent should
    // re-add /retailer to sitemap.
    return;
  }
  // The literal "/retailer/<close>" — we must allow /retailer/signup/.
  // Match <loc>https://virtualfit.app/retailer/</loc> exactly.
  assert.doesNotMatch(
    SITEMAP,
    /<loc>\s*https:\/\/virtualfit\.app\/retailer\/\s*<\/loc>/,
    "sitemap must not list /retailer/ — Phase 7.61 redirects it to /retailer/signup. Listing both wastes crawl budget.",
  );
});

test("sitemap DOES still list /retailer/signup/ (the redirect target)", () => {
  assert.match(
    SITEMAP,
    /<loc>\s*https:\/\/virtualfit\.app\/retailer\/signup\/\s*<\/loc>/,
    "sitemap must list /retailer/signup/ — primary retailer conversion page",
  );
});

test("sitemap does NOT list /checkout/success/ (Phase 7.75 set noindex,nofollow)", () => {
  assert.doesNotMatch(
    SITEMAP,
    /<loc>[^<]*\/checkout\/success/,
    "sitemap must not list /checkout/success/ — Phase 7.75 marked it noindex,nofollow (Stripe session_id leak guard)",
  );
});

test("sitemap loc entries all use the canonical https://virtualfit.app domain", () => {
  // Phase 7.46 fix regression hammer: no Azure SWA preview hostnames,
  // no http://, no localhost.
  const locs = [...SITEMAP.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map(
    (m) => m[1],
  );
  assert.ok(locs.length > 0, "sitemap must have at least one <loc> entry");
  for (const loc of locs) {
    assert.ok(
      loc.startsWith("https://virtualfit.app/"),
      `every <loc> must start with https://virtualfit.app/ — found: ${loc}`,
    );
    assert.doesNotMatch(
      loc,
      /azurestaticapps\.net|localhost|127\.0\.0\.1/,
      `<loc> must not reference Azure preview/localhost — found: ${loc}`,
    );
  }
});

test("sitemap lastmod entries are not older than 90 days (sanity)", () => {
  // Sitemap freshness signal — if every entry's lastmod is months stale,
  // crawlers will deprioritize. 90-day soft window prevents the file
  // from quietly rotting.
  const lastmods = [
    ...SITEMAP.matchAll(/<lastmod>\s*(\d{4}-\d{2}-\d{2})\s*<\/lastmod>/g),
  ].map((m) => m[1]);
  assert.ok(lastmods.length > 0, "sitemap must have at least one lastmod");
  const now = Date.now();
  const NINETY_DAYS = 90 * 24 * 60 * 60 * 1000;
  for (const lm of lastmods) {
    const ts = Date.parse(lm + "T00:00:00Z");
    assert.ok(
      !Number.isNaN(ts),
      `lastmod must parse as ISO date — found: ${lm}`,
    );
    assert.ok(
      now - ts < NINETY_DAYS,
      `lastmod ${lm} is older than 90 days — bump it when you touch the sitemap`,
    );
  }
});

test("robots.txt references the canonical sitemap URL", () => {
  const robots = readFileSync(
    resolve(__dirname, "..", "public/robots.txt"),
    "utf8",
  );
  assert.match(
    robots,
    /Sitemap:\s*https:\/\/virtualfit\.app\/sitemap\.xml/,
    "robots.txt must reference https://virtualfit.app/sitemap.xml",
  );
});
