// Phase 7.59 — guard: the retailer signup form surfaces the embed
// knobs the iframe actually consumes. Pre-7.59 the snippet only had
// data-shop-id/data-retailer/data-position/data-color and hardcoded
// '#6C5CE7' as the colour — the most valuable knobs (data-product-id +
// data-garment-image, wired in 7.56 + 7.58) and the brand-colour theming
// (wired in 7.57) were invisible to retailers.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SIGNUP = readFileSync(
  resolve(__dirname, "..", "app/retailer/signup/page.tsx"),
  "utf8",
);

test("signup snippet surfaces data-product-id (Phase 7.56 wiring)", () => {
  assert.match(
    SIGNUP,
    /data-product-id/,
    "app/retailer/signup/page.tsx must reference data-product-id so the add-to-cart CTA is reachable from the install flow.",
  );
});

test("signup snippet surfaces data-garment-image (Phase 7.58 wiring)", () => {
  assert.match(
    SIGNUP,
    /data-garment-image/,
    "app/retailer/signup/page.tsx must reference data-garment-image so the 'Try this product on' CTA is reachable from the install flow.",
  );
});

test("signup form renders a brand-colour picker (<input type=\"color\">) (Phase 7.57 wiring)", () => {
  assert.match(
    SIGNUP,
    /type=["']color["']/,
    "app/retailer/signup/page.tsx must render a <input type=\"color\"> picker so retailers can set their brand colour.",
  );
});

test("signup snippet does NOT hardcode data-color=\"#6C5CE7\" (it must come from state)", () => {
  // Hardcoding defeats the whole point of Phase 7.57 retailer-brand
  // theming — a retailer copy/pastes the snippet and gets VirtualFit
  // purple no matter what they pick.
  assert.doesNotMatch(
    SIGNUP,
    /data-color=["']#6C5CE7["']/,
    "Hardcoded data-color=\"#6C5CE7\" defeats Phase 7.57 brand-colour theming. Use ${brandColor} state interpolation instead.",
  );
});
