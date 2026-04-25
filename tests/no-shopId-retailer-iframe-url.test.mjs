// Phase 7.70 — guard: embed.js must NOT forward shopId/retailer in the
// iframe URL. mirror/page.tsx never calls searchParams.get('shopId') or
// searchParams.get('retailer') — the values arrived and were silently
// dropped on receive. Same dead-API-surface bug class as 7.64 + 7.65.
//
// shopId/retailer ARE still used client-side on embed.js for telemetry
// attribution (trackEvent's email field) — that's fine, those reads
// happen on the parent window before any iframe handoff. This guard
// only forbids the URL-param forwarding into the iframe.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EMBED = readFileSync(
  resolve(__dirname, "..", "public/embed.js"),
  "utf8",
);
const MIRROR = readFileSync(
  resolve(__dirname, "..", "app/mirror/page.tsx"),
  "utf8",
);

// Slice out the buildIframeUrl function body so we only check its params.set
// calls (not unrelated mentions in comments or trackEvent).
function buildIframeUrlBody() {
  const start = EMBED.indexOf("function buildIframeUrl()");
  assert.ok(start > -1, "buildIframeUrl() must exist in embed.js");
  // Function body ends at the next `function ` declaration at module scope.
  const after = EMBED.indexOf("\n  function ", start + 1);
  return EMBED.slice(start, after > -1 ? after : start + 800);
}

test("embed.js buildIframeUrl does NOT forward shopId in the iframe URL", () => {
  const body = buildIframeUrlBody();
  assert.doesNotMatch(
    body,
    /params\.set\(\s*['"]shopId['"]/,
    "buildIframeUrl must not call params.set('shopId', ...) — mirror never reads it",
  );
});

test("embed.js buildIframeUrl does NOT forward retailer in the iframe URL", () => {
  const body = buildIframeUrlBody();
  assert.doesNotMatch(
    body,
    /params\.set\(\s*['"]retailer['"]/,
    "buildIframeUrl must not call params.set('retailer', ...) — mirror never reads it",
  );
});

test("mirror/page.tsx still doesn't read shopId or retailer from searchParams (consumer-pair)", () => {
  // If a future agent adds searchParams.get('shopId') or get('retailer')
  // to mirror, this guard fires — and the embed.js forwarding should be
  // restored at the same time.
  assert.doesNotMatch(
    MIRROR,
    /searchParams\.get\(\s*['"]shopId['"]\s*\)/,
    "mirror/page.tsx still doesn't read shopId — if you add it back, also re-add the embed.js forwarding",
  );
  assert.doesNotMatch(
    MIRROR,
    /searchParams\.get\(\s*['"]retailer['"]\s*\)/,
    "mirror/page.tsx still doesn't read retailer — if you add it back, also re-add the embed.js forwarding",
  );
});

test("embed.js still forwards the params mirror DOES read (regression hammer)", () => {
  const body = buildIframeUrlBody();
  // mirror reads: garment, embed, productId, primaryColor, garmentImage
  // (per mirror/page.tsx grep). embed=true is set unconditionally; the
  // others are conditional on config. Prove they're all still there.
  assert.match(body, /params\.set\(\s*['"]embed['"]\s*,\s*['"]true['"]/, "embed=true must still be set unconditionally");
  assert.match(body, /params\.set\(\s*['"]primaryColor['"]/, "primaryColor must still be forwarded");
  assert.match(body, /params\.set\(\s*['"]productId['"]/, "productId must still be forwarded");
  assert.match(body, /params\.set\(\s*['"]garmentImage['"]/, "garmentImage must still be forwarded");
});

test("embed.js still uses config.shopId/retailer client-side for telemetry attribution", () => {
  // Sanity: we only stripped URL-param forwarding into the iframe.
  // The client-side reads in trackEvent (email field) must remain so
  // server-side telemetry can still attribute events to a shop.
  assert.match(
    EMBED,
    /config\.shopId/,
    "embed.js must still read config.shopId on the parent window (telemetry attribution) — only the iframe URL forwarding was stripped",
  );
  assert.match(
    EMBED,
    /config\.retailer/,
    "embed.js must still read config.retailer on the parent window (telemetry attribution) — only the iframe URL forwarding was stripped",
  );
});
