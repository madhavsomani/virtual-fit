// Phase 7.68 — guard: <virtualfit-button> web component must
// (a) prefer the per-product VirtualFit.tryOnProduct() API over the
// legacy setGarment+open path so multiple buttons on a Shopify
// collection grid don't race on shared config.garmentImage, and
// (b) derive the new-tab fallback base URL from the loading script's
// src origin instead of hardcoding the prod URL (same fix as 7.67's
// embed.js change).

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMPONENT = readFileSync(
  resolve(__dirname, "..", "public/virtualfit-button.js"),
  "utf8",
);
const EMBED = readFileSync(
  resolve(__dirname, "..", "public/embed.js"),
  "utf8",
);

test("<virtualfit-button> prefers VirtualFit.tryOnProduct over setGarment+open", () => {
  // The click handler must call tryOnProduct when available, with
  // BOTH garmentImage AND productId. Pre-7.68 it called setGarment
  // (only garmentImage) then open() — no productId tracking and the
  // try_on_product analytics event from 7.62 never fired.
  assert.match(
    COMPONENT,
    /window\.VirtualFit\.tryOnProduct\(\s*\{/,
    "<virtualfit-button> click handler must invoke VirtualFit.tryOnProduct({...})",
  );
  assert.match(
    COMPONENT,
    /tryOnProduct\(\s*\{[^}]*garmentImage:\s*garmentImage[^}]*productId:\s*productId/s,
    "tryOnProduct call must pass BOTH garmentImage AND productId from the component's attributes",
  );
  // The branch must guard with `typeof === 'function'` so older embed.js
  // (pre-7.62, no tryOnProduct method) still works via the legacy path.
  assert.match(
    COMPONENT,
    /typeof\s+window\.VirtualFit\.tryOnProduct\s*===\s*['"]function['"]/,
    "tryOnProduct branch must be guarded by `typeof === 'function'` so older embed.js falls through to the legacy setGarment+open path",
  );
});

test("legacy setGarment+open fallback path still exists for pre-7.62 embed.js", () => {
  // If a retailer pins an older embed.js (pre-7.62), the component must
  // still work. setGarment + open must remain reachable.
  assert.match(COMPONENT, /window\.VirtualFit\.setGarment/, "legacy setGarment fallback must remain");
  assert.match(COMPONENT, /window\.VirtualFit\.open/, "legacy open() fallback must remain");
});

test("new-tab fallback base URL is derived from the loading script's src (no hardcoded prod)", () => {
  // The pre-7.68 line was `var base = 'https://virtualfit.app';` (with
  // semicolon ending an assignment). Forbid that exact pattern; require
  // the IIFE-derived equivalent.
  assert.doesNotMatch(
    COMPONENT,
    /var\s+base\s*=\s*['"]https:\/\/virtualfit\.app['"]\s*;/,
    "<virtualfit-button> must not hardcode `var base = '...virtualfit.app...';` — derive from script.src like embed.js (Phase 7.67)",
  );
  assert.match(COMPONENT, /document\.currentScript/, "base URL derivation must use document.currentScript");
  assert.match(COMPONENT, /new URL\([^)]*\)\.origin/, "base URL must extract origin via new URL(...).origin");
  // Defensive fallback to prod when script.src is unset.
  assert.match(
    COMPONENT,
    /return\s+['"]https:\/\/virtualfit\.app['"]\s*;/,
    "base URL derivation must have a defensive `return 'https://virtualfit.app';` fallback",
  );
});

test("tryOnProduct API still exists on window.VirtualFit (pair guard with embed.js)", () => {
  // If a future agent removes tryOnProduct from embed.js, the web
  // component's preferred path silently falls through to the legacy
  // path and the per-product analytics event stops firing. Pair guard.
  assert.match(
    EMBED,
    /tryOnProduct:\s*function/,
    "embed.js must still expose VirtualFit.tryOnProduct (the web component prefers it)",
  );
});
