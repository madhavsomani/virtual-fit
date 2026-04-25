// Phase 7.62 — guard: VirtualFit.tryOnProduct API + demo-store wiring.
// Pre-7.62 the demo store's product cards did NOTHING when clicked —
// the per-product superpower (Phases 7.56/7.58/7.59) was buried.

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
const DEMO = readFileSync(
  resolve(__dirname, "..", "public/demo-store.html"),
  "utf8",
);

test("public/embed.js exposes window.VirtualFit.tryOnProduct on the public API", () => {
  // Method must appear in the public API object literal (the `window.VirtualFit = { ... }` block).
  assert.match(
    EMBED,
    /tryOnProduct:\s*function/,
    "embed.js must expose tryOnProduct: function(opts) on window.VirtualFit",
  );
});

test("tryOnProduct updates config.garmentImage BEFORE rebuilding the iframe URL", () => {
  // Order matters: buildIframeUrl() reads from config, so the rebuild
  // must happen AFTER the assignment. If we rebuild first then assign,
  // the new garmentImage never reaches the iframe and the demo silently
  // pipelines the previous product (or nothing).
  const block = EMBED.match(/tryOnProduct:\s*function[\s\S]*?\n\s{4,6}\},/);
  assert.ok(block, "tryOnProduct function block must be locatable");
  const body = block[0];
  const assignIdx = body.indexOf("config.garmentImage = ");
  const rebuildIdx = body.indexOf("buildIframeUrl()");
  assert.ok(assignIdx > -1, "tryOnProduct must assign config.garmentImage");
  assert.ok(rebuildIdx > -1, "tryOnProduct must call buildIframeUrl()");
  assert.ok(
    assignIdx < rebuildIdx,
    "config.garmentImage must be assigned BEFORE buildIframeUrl() rebuilds the iframe URL",
  );
});

test("tryOnProduct is a no-op rebuild when the same product is clicked twice (HF Spaces quota guard)", () => {
  // Re-loading the iframe with the same garmentImage triggers another
  // 30-90s segformer→TRELLIS pipeline run and burns HF Spaces quota.
  // Must guard with a changed-check.
  const block = EMBED.match(/tryOnProduct:\s*function[\s\S]*?\n\s{4,6}\},/);
  assert.ok(block, "tryOnProduct function block must be locatable");
  assert.match(
    block[0],
    /!==\s*config\.garmentImage|config\.garmentImage\s*!==/,
    "tryOnProduct must compare new garmentImage to current config.garmentImage and skip rebuild on no-change (HF Spaces quota guard)",
  );
});

test("public/demo-store.html wires at least 3 product cards to VirtualFit.tryOnProduct", () => {
  // Proves the wiring isn't half-done — pre-7.62 it was zero.
  const cardCalls = DEMO.match(/VirtualFit\.tryOnProduct\(/g) || [];
  assert.ok(
    cardCalls.length >= 3,
    `demo-store.html must call VirtualFit.tryOnProduct from ≥3 product cards (found ${cardCalls.length})`,
  );
});

test("demo-store product card onclick passes both garmentImage AND productId", () => {
  // Both knobs must reach the iframe — productId for the add-to-cart
  // CTA (Phase 7.56), garmentImage for the try-on pipeline (Phase 7.58).
  const calls = DEMO.match(/VirtualFit\.tryOnProduct\(\{[^}]+\}\)/g) || [];
  assert.ok(calls.length > 0, "must find at least one tryOnProduct call");
  for (const call of calls) {
    assert.match(call, /garmentImage:/, `tryOnProduct call missing garmentImage: ${call}`);
    assert.match(call, /productId:/, `tryOnProduct call missing productId: ${call}`);
  }
});

test("demo-store no longer shows the dead 'Try On Available' badge (replaced by clickable CTA)", () => {
  // The pre-7.62 badge claimed try-on was available but nothing happened.
  // The new badge ('Click to try on') matches the actual behaviour.
  assert.doesNotMatch(
    DEMO,
    /Try On Available/,
    "demo-store.html must not show 'Try On Available' badge — it claimed a behaviour that didn't exist before Phase 7.62",
  );
});
