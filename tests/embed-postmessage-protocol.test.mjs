// Phase 7.53 — guard: the embed postMessage protocol is implemented on
// BOTH sides of the iframe boundary.
//
// Pre-7.53 only the parent side (public/embed.js) was built. The iframe
// (app/mirror/page.tsx) never posted virtualfit:ready, never listened for
// virtualfit:set-garment, and never posted virtualfit:garment-changed.
// The whole bidirectional protocol documented at the top of embed.js was
// half-built. Same UX-actually-works class as Phases 7.40 + 7.32.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const MIRROR = readFileSync(resolve(ROOT, "app/mirror/page.tsx"), "utf8");
const EMBED = readFileSync(resolve(ROOT, "public/embed.js"), "utf8");

test("mirror page posts virtualfit:ready to the embedding parent", () => {
  assert.match(
    MIRROR,
    /'virtualfit:ready'/,
    "app/mirror/page.tsx must reference the literal 'virtualfit:ready' message type.",
  );
  // The post must target window.parent (not window.top, not arbitrary).
  assert.match(
    MIRROR,
    /window\.parent\.postMessage\([^)]*virtualfit:ready/s,
    "app/mirror/page.tsx must call window.parent.postMessage(...) with virtualfit:ready.",
  );
});

test("mirror page guards incoming messages by event.source === window.parent", () => {
  // event.origin can't be validated (retailer origin unknown a priori),
  // so source identity is the only correct guard. Forbids the lazy
  // mistake of a wide-open message listener.
  assert.match(
    MIRROR,
    /event\.source\s*!==\s*window\.parent/,
    "app/mirror/page.tsx message listener must guard `event.source !== window.parent` to reject other-window noise.",
  );
});

test("mirror page handles virtualfit:set-garment from the parent", () => {
  assert.match(
    MIRROR,
    /'virtualfit:set-garment'/,
    "app/mirror/page.tsx must accept the parent\u2192iframe `virtualfit:set-garment` message.",
  );
});

test("mirror page posts virtualfit:garment-changed when a GLB finishes loading", () => {
  assert.match(
    MIRROR,
    /'virtualfit:garment-changed'/,
    "app/mirror/page.tsx must post `virtualfit:garment-changed` so the parent embed widget can fire analytics.",
  );
});

test("mirror page posts virtualfit:screenshot to the embedding parent on capture", () => {
  // Phase 7.54: declared in embed.js; pre-7.54 the iframe never sent it.
  assert.match(
    MIRROR,
    /'virtualfit:screenshot'/,
    "app/mirror/page.tsx must reference the literal 'virtualfit:screenshot' message type.",
  );
  assert.match(
    MIRROR,
    /window\.parent\.postMessage\([^)]*virtualfit:screenshot/s,
    "app/mirror/page.tsx must call window.parent.postMessage(...) with virtualfit:screenshot.",
  );
});

test("public/embed.js still declares matching parent-side handlers (cross-side regression guard)", () => {
  // If a future edit removes one side without the other, surface it here.
  assert.match(EMBED, /'virtualfit:ready'/, "embed.js must still handle 'virtualfit:ready' from the iframe.");
  assert.match(
    EMBED,
    /'virtualfit:garment-changed'/,
    "embed.js must still handle 'virtualfit:garment-changed' from the iframe.",
  );
  assert.match(
    EMBED,
    /'virtualfit:set-garment'|virtualfit:set-garment/,
    "embed.js must still document/define the parent\u2192iframe 'virtualfit:set-garment' message.",
  );
});

test("mirror page reads ?embed=true and posts virtualfit:close from a close button", () => {
  // Phase 7.55: declared in embed.js; pre-7.55 the iframe had no close UI
  // and never honored the ?embed=true URL flag.
  assert.match(
    MIRROR,
    /searchParams\.get\(['"]embed['"]\)/,
    "app/mirror/page.tsx must read ?embed=true so it knows it's running inside the embed widget.",
  );
  assert.match(
    MIRROR,
    /'virtualfit:close'/,
    "app/mirror/page.tsx must reference the literal 'virtualfit:close' message type.",
  );
  assert.match(
    MIRROR,
    /window\.parent\.postMessage\([^)]*virtualfit:close/s,
    "app/mirror/page.tsx must call window.parent.postMessage(...) with virtualfit:close.",
  );
});

test("public/embed.js still handles virtualfit:close from the iframe (cross-side guard)", () => {
  assert.match(EMBED, /'virtualfit:close'/, "embed.js must still handle 'virtualfit:close' from the iframe.");
});

test("mirror page reads ?productId and posts virtualfit:add-to-cart from a CTA", () => {
  // Phase 7.56: declared in embed.js; pre-7.56 the iframe never read the
  // productId or sent the message — the conversion-funnel hook was dead.
  assert.match(
    MIRROR,
    /searchParams\.get\(['"]productId['"]\)/,
    "app/mirror/page.tsx must read ?productId so the add-to-cart CTA knows which SKU to send.",
  );
  assert.match(
    MIRROR,
    /'virtualfit:add-to-cart'/,
    "app/mirror/page.tsx must reference the literal 'virtualfit:add-to-cart' message type.",
  );
  assert.match(
    MIRROR,
    /window\.parent\.postMessage\([^)]*virtualfit:add-to-cart/s,
    "app/mirror/page.tsx must call window.parent.postMessage(...) with virtualfit:add-to-cart.",
  );
});

test("public/embed.js still handles virtualfit:add-to-cart from the iframe (cross-side guard)", () => {
  assert.match(
    EMBED,
    /'virtualfit:add-to-cart'/,
    "embed.js must still handle 'virtualfit:add-to-cart' from the iframe.",
  );
});

test("mirror page reads ?primaryColor and handles virtualfit:set-theme (Phase 7.57)", () => {
  // Pre-7.57 the iframe ignored both the URL param and the postMessage
  // and rendered every embed CTA in VirtualFit purple. Brands care
  // intensely about colour matching their site.
  assert.match(
    MIRROR,
    /searchParams\.get\(['"]primaryColor['"]\)/,
    "app/mirror/page.tsx must read ?primaryColor= so the embed CTAs use the retailer's brand colour.",
  );
  assert.match(
    MIRROR,
    /'virtualfit:set-theme'/,
    "app/mirror/page.tsx must handle 'virtualfit:set-theme' (was deferred in Phase 7.53; real in 7.57).",
  );
});

test("mirror page does NOT hardcode #6C5CE7 in the embed add-to-cart CTA (regression hammer)", () => {
  // Phase 7.57: the embed-mode add-to-cart CTA must use themePrimaryColor.
  // Forbid hardcoded '#6C5CE7' inside the add-to-cart JSX block. The rest
  // of mirror/page.tsx still uses #6C5CE7 freely for non-embed UI — that
  // is intentional and out of scope for Phase 7.57 (separate item).
  const lines = MIRROR.split("\n");
  const startIdx = lines.findIndex(l => l.includes('aria-label="Add to cart"'));
  assert.ok(startIdx >= 0, "add-to-cart aria-label not found");
  // Scan forward up to 60 lines for the closing of the button JSX.
  const slice = lines.slice(startIdx, startIdx + 60).join("\n");
  assert.doesNotMatch(
    slice,
    /'#6C5CE7'/,
    "add-to-cart CTA must not hardcode '#6C5CE7' — use themePrimaryColor so retailer brand colour wins.",
  );
  assert.match(
    slice,
    /themePrimaryColor/,
    "add-to-cart CTA must reference themePrimaryColor.",
  );
});
