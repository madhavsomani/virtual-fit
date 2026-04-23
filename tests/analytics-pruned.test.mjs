// Phase 7.16 — guard: `app/lib/analytics.ts` was pruned of marketplace/widget/
// retailer event noise. Keep it narrow. New events should only land here when
// a real caller exists.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(
  resolve(__dirname, "../app/lib/analytics.ts"),
  "utf8",
);

// Strip block + line comments so retrospective Phase 7.16 prose in the file
// header doesn't trip these guards.
function code() {
  let s = SRC.replace(/\/\*[\s\S]*?\*\//g, "");
  s = s
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
  return s;
}

const DEAD_METHODS = [
  "mirrorOpen",
  "garmentSelect",
  "widgetOpened",
  "widgetClosed",
  "garmentChanged",
  "addToCart",
  "retailerSignup",
];

const DEAD_EVENTS = [
  "mirror_open",
  "garment_select",
  "widget_opened",
  "widget_closed",
  "garment_changed",
  "add_to_cart",
  "retailer_signup",
];

test("analytics.ts does not re-add marketplace/widget convenience methods", () => {
  const c = code();
  for (const m of DEAD_METHODS) {
    assert.doesNotMatch(c, new RegExp(`\\b${m}\\b`), `${m} resurrected`);
  }
});

test("analytics.ts EventName union does not re-add dead event strings", () => {
  const c = code();
  for (const e of DEAD_EVENTS) {
    assert.doesNotMatch(c, new RegExp(`["']${e}["']`), `${e} resurrected`);
  }
});

test("analytics.ts still exposes the four real convenience methods", () => {
  const c = code();
  for (const m of ["pageView", "waitlistSignup", "checkoutStart", "checkoutComplete", "getAll", "clear"]) {
    assert.match(c, new RegExp(`\\b${m}\\b`), `${m} missing`);
  }
});
