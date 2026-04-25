// Phase 7.78 — guard: /pricing FAQ schema must match visible page
// content. Google penalizes FAQPage JSON-LD whose Q/A pairs don't
// appear verbatim in the rendered DOM, so we share a single PRICING_FAQ
// source and assert: (a) the data module exports the expected shape;
// (b) layout.tsx injects FAQPage JSON-LD reading from that module;
// (c) page.tsx imports + maps over that module (no inline duplicate).

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP = resolve(__dirname, "..", "app");

const FAQ_DATA = readFileSync(resolve(APP, "pricing/faq-data.ts"), "utf8");
const PAGE = readFileSync(resolve(APP, "pricing/page.tsx"), "utf8");
const LAYOUT = readFileSync(resolve(APP, "pricing/layout.tsx"), "utf8");

test("pricing/faq-data.ts exports PRICING_FAQ with non-trivial Q/A pairs", () => {
  assert.match(
    FAQ_DATA,
    /export\s+const\s+PRICING_FAQ\s*:/,
    "must export `const PRICING_FAQ`",
  );
  // Count entries by counting `q:` keys at the start of object literals.
  const qCount = (FAQ_DATA.match(/^\s*q:\s*"/gm) || []).length;
  const aCount = (FAQ_DATA.match(/^\s*a:\s*"/gm) || []).length;
  assert.ok(qCount >= 4, `must have at least 4 FAQ entries, got ${qCount}`);
  assert.equal(qCount, aCount, "every q must have a matching a");
});

test("pricing/page.tsx imports + maps over PRICING_FAQ (not inline duplicate)", () => {
  assert.match(
    PAGE,
    /import\s*\{\s*PRICING_FAQ\s*\}\s*from\s*["']\.\/faq-data["']/,
    "page.tsx must import { PRICING_FAQ } from './faq-data'",
  );
  assert.match(
    PAGE,
    /PRICING_FAQ\.map\(/,
    "page.tsx must render via PRICING_FAQ.map(...) — not an inline FAQ array",
  );
  // Negative: the page must NOT contain the old inline FAQ array. If a
  // future agent re-inlines it, schema and rendered DOM will silently
  // diverge — exactly what FAQPage rich results punish.
  assert.doesNotMatch(
    PAGE,
    /q:\s*["']Is my video private\?["']/,
    "page.tsx must NOT inline the FAQ array — it lives in faq-data.ts so /pricing/layout.tsx can share it for JSON-LD parity",
  );
});

test("pricing/layout.tsx injects FAQPage JSON-LD reading from PRICING_FAQ", () => {
  // Must import shared data — guarantees parity with the visible page.
  assert.match(
    LAYOUT,
    /import\s*\{\s*PRICING_FAQ\s*\}\s*from\s*["']\.\/faq-data["']/,
    "layout.tsx must import { PRICING_FAQ } from './faq-data' (so schema text mirrors visible text)",
  );
  // Must emit a JSON-LD script tag of type application/ld+json.
  assert.match(
    LAYOUT,
    /type=["']application\/ld\+json["']/,
    "layout.tsx must include a <script type='application/ld+json'>",
  );
  // Must declare schema.org FAQPage with mainEntity array of Question/Answer.
  assert.match(LAYOUT, /["']@context["']\s*:\s*["']https:\/\/schema\.org["']/);
  assert.match(LAYOUT, /["']@type["']\s*:\s*["']FAQPage["']/);
  assert.match(LAYOUT, /mainEntity:\s*PRICING_FAQ\.map/);
  assert.match(LAYOUT, /["']@type["']\s*:\s*["']Question["']/);
  assert.match(LAYOUT, /["']@type["']\s*:\s*["']Answer["']/);
});

test("pricing layout still renders {children} (didn't break the route)", () => {
  // Sanity: adding the script tag must not have removed children.
  assert.match(
    LAYOUT,
    /\{\s*children\s*\}/,
    "layout must still render {children} — otherwise /pricing renders blank",
  );
});
