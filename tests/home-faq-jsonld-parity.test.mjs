// Phase 7.79 — guard: homepage FAQ accordion + FAQPage JSON-LD must
// share a single source (app/home-faq-data.ts) so schema text matches
// rendered DOM verbatim. Same parity-by-construction pattern as
// Phase 7.78's pricing FAQ guard.
//
// Critical: the JSON-LD MUST live in app/page.tsx (route-scoped), NOT
// app/layout.tsx (site-wide) — emitting FAQPage on /pricing or
// /retailer/signup where no matching accordion DOM exists earns a
// Google penalty for schema-without-content.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP = resolve(__dirname, "..", "app");

const FAQ_DATA = readFileSync(resolve(APP, "home-faq-data.ts"), "utf8");
const PAGE = readFileSync(resolve(APP, "page.tsx"), "utf8");
const ROOT_LAYOUT = readFileSync(resolve(APP, "layout.tsx"), "utf8");

test("home-faq-data.ts exports HOME_FAQ with non-trivial entries", () => {
  assert.match(
    FAQ_DATA,
    /export\s+const\s+HOME_FAQ\s*:/,
    "must export `const HOME_FAQ`",
  );
  const qCount = (FAQ_DATA.match(/^\s*q:\s*"/gm) || []).length;
  const aCount = (FAQ_DATA.match(/^\s*a:\s*"/gm) || []).length;
  const eCount = (FAQ_DATA.match(/^\s*emoji:\s*"/gm) || []).length;
  assert.ok(qCount >= 3, `must have at least 3 FAQ entries, got ${qCount}`);
  assert.equal(qCount, aCount, "every q must have a matching a");
  assert.equal(qCount, eCount, "every entry must include emoji + q + a");
});

test("app/page.tsx imports + maps over HOME_FAQ (no inline FAQ literal)", () => {
  assert.match(
    PAGE,
    /import\s*\{\s*HOME_FAQ\s*\}\s*from\s*["']\.\/home-faq-data["']/,
    "page.tsx must import { HOME_FAQ } from './home-faq-data'",
  );
  assert.match(
    PAGE,
    /HOME_FAQ\.map\(/,
    "page.tsx must render the accordion via HOME_FAQ.map(...)",
  );
  // Negative: must not contain the old inline question text. If a
  // future agent re-inlines, schema drifts from DOM and Google ignores
  // the FAQ rich result.
  assert.doesNotMatch(
    PAGE,
    /\u{1F4C5} When does it launch\?/u,
    "page.tsx must NOT inline the FAQ summaries — they live in home-faq-data.ts so the JSON-LD below stays parity-matched",
  );
});

test("app/page.tsx emits the FAQPage JSON-LD reading from HOME_FAQ", () => {
  // The JSON-LD script tag must exist in page.tsx (route-scoped).
  assert.match(
    PAGE,
    /type=["']application\/ld\+json["']/,
    "page.tsx must include a <script type='application/ld+json'>",
  );
  assert.match(PAGE, /["']@context["']\s*:\s*["']https:\/\/schema\.org["']/);
  assert.match(PAGE, /["']@type["']\s*:\s*["']FAQPage["']/);
  assert.match(
    PAGE,
    /mainEntity:\s*HOME_FAQ\.map/,
    "FAQPage.mainEntity must be built from HOME_FAQ.map(...) — single source of truth",
  );
  assert.match(PAGE, /["']@type["']\s*:\s*["']Question["']/);
  assert.match(PAGE, /["']@type["']\s*:\s*["']Answer["']/);
});

test("FAQPage JSON-LD is NOT in the root layout (would emit on every route)", () => {
  // app/layout.tsx is shared by ALL routes. If FAQPage lived there,
  // /pricing /retailer/signup /redeem etc. would all emit FAQPage
  // schema with no matching FAQ DOM → Google penalty for
  // schema-without-content. Pricing has its OWN FAQPage in
  // /pricing/layout.tsx (Phase 7.78), which is fine because it's
  // route-scoped and matches that page's accordion.
  assert.doesNotMatch(
    ROOT_LAYOUT,
    /["']@type["']\s*:\s*["']FAQPage["']/,
    "FAQPage JSON-LD must NOT live in app/layout.tsx (root, all routes). It belongs in app/page.tsx (homepage) or per-route layouts.",
  );
  // Site-wide SoftwareApplication from Phase 7.77 must still be there.
  assert.match(
    ROOT_LAYOUT,
    /["']@type["']\s*:\s*["']SoftwareApplication["']/,
    "Phase 7.77 SoftwareApplication JSON-LD must still be in root layout",
  );
});
