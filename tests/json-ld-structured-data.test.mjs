// Phase 7.77 — guard: app/layout.tsx must inject a JSON-LD
// SoftwareApplication block for rich-result eligibility on every route.
// Pre-7.77 the site shipped zero structured data, so Google had only
// the OG card to work with for SERP enhancement (no app rating slot,
// no price slot, no creator/Org context).

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LAYOUT = readFileSync(
  resolve(__dirname, "..", "app/layout.tsx"),
  "utf8",
);

// Extract the JSON-LD payload from the dangerouslySetInnerHTML
// JSON.stringify(...) call so we can validate it as actual JSON, not
// just regex-match strings.
function parseJsonLd() {
  const m = LAYOUT.match(
    /type="application\/ld\+json"[\s\S]*?JSON\.stringify\(\s*(\{[\s\S]*?\})\s*\)/,
  );
  assert.ok(m, "layout.tsx must include a JSON-LD <script type='application/ld+json'> with JSON.stringify({...})");
  // The captured group is a JS object literal (with unquoted keys).
  // Evaluate it via Function — safe because we're reading our own
  // committed source, not user input.
  // eslint-disable-next-line no-new-func
  return new Function(`return (${m[1]})`)();
}

test("layout.tsx includes a JSON-LD SoftwareApplication block", () => {
  // Surface-level: the script tag and content-type must exist.
  assert.match(
    LAYOUT,
    /type=["']application\/ld\+json["']/,
    "layout.tsx must include a <script type='application/ld+json'>",
  );
  // Must be inside <head> (not <body>) so crawlers without JS still
  // see it.
  const headStart = LAYOUT.indexOf("<head>");
  const headEnd = LAYOUT.indexOf("</head>");
  const bodyStart = LAYOUT.indexOf("<body");
  assert.ok(headStart > -1 && headEnd > -1, "layout.tsx must have <head>...</head>");
  const scriptIdx = LAYOUT.indexOf("application/ld+json");
  assert.ok(
    scriptIdx > headStart && scriptIdx < headEnd,
    "JSON-LD script must be inside <head>...</head>, not <body>",
  );
  assert.ok(
    bodyStart === -1 || scriptIdx < bodyStart,
    "JSON-LD script must come before <body>",
  );
});

test("JSON-LD payload parses as valid JSON-shaped object", () => {
  const ld = parseJsonLd();
  assert.equal(ld["@context"], "https://schema.org", "@context must be schema.org");
  assert.equal(ld["@type"], "SoftwareApplication", "@type must be SoftwareApplication");
});

test("JSON-LD declares name, description, url, applicationCategory, operatingSystem", () => {
  const ld = parseJsonLd();
  assert.equal(ld.name, "VirtualFit", "name must be 'VirtualFit'");
  assert.ok(typeof ld.description === "string" && ld.description.length > 30, "description must be non-trivial");
  assert.equal(ld.url, "https://virtualfit.app", "url must be the canonical apex domain");
  assert.ok(
    typeof ld.applicationCategory === "string" && ld.applicationCategory.length > 0,
    "applicationCategory must be set (Google rich-result requirement)",
  );
  assert.ok(
    typeof ld.operatingSystem === "string" && ld.operatingSystem.length > 0,
    "operatingSystem must be set (Google rich-result requirement)",
  );
});

test("JSON-LD declares an Offer with price=0 USD (free tier as product)", () => {
  const ld = parseJsonLd();
  assert.ok(ld.offers, "offers block must exist (rich-result price slot)");
  assert.equal(ld.offers["@type"], "Offer", "offers.@type must be Offer");
  assert.equal(ld.offers.price, "0", "offers.price must be '0' (string per schema.org spec)");
  assert.equal(ld.offers.priceCurrency, "USD", "offers.priceCurrency must be 'USD'");
});

test("JSON-LD declares a creator Organization", () => {
  const ld = parseJsonLd();
  assert.ok(ld.creator, "creator block must exist");
  assert.equal(ld.creator["@type"], "Organization", "creator.@type must be Organization");
  assert.equal(ld.creator.name, "VirtualFit");
  assert.equal(ld.creator.url, "https://virtualfit.app");
});
