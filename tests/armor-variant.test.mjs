import { test } from "node:test";
import assert from "node:assert/strict";

import { ARMOR_VARIANTS, getVariant, nextVariant } from "../lib/armor-variant.ts";

test("4 variants registered", () => {
  assert.equal(ARMOR_VARIANTS.length, 4);
});

test("getVariant returns matching record", () => {
  assert.equal(getVariant("stealth").label, "Stealth");
});

test("getVariant falls back to classic for unknown id", () => {
  // @ts-expect-error intentional bad id
  assert.equal(getVariant("nope").id, "classic");
});

test("nextVariant cycles through all and wraps", () => {
  let id = ARMOR_VARIANTS[0].id;
  const seen = new Set([id]);
  for (let i = 0; i < ARMOR_VARIANTS.length; i++) {
    id = nextVariant(id).id;
    seen.add(id);
  }
  assert.equal(seen.size, ARMOR_VARIANTS.length);
  assert.equal(nextVariant(ARMOR_VARIANTS.at(-1).id).id, ARMOR_VARIANTS[0].id);
});

test("every variant has hex colors and finite reactor boost", () => {
  for (const v of ARMOR_VARIANTS) {
    assert.match(v.primary, /^#[0-9a-fA-F]{6}$/);
    assert.match(v.accent, /^#[0-9a-fA-F]{6}$/);
    assert.match(v.emissive, /^#[0-9a-fA-F]{6}$/);
    assert.ok(Number.isFinite(v.reactorBoost) && v.reactorBoost > 0);
  }
});
