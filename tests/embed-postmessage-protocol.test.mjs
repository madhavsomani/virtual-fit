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
