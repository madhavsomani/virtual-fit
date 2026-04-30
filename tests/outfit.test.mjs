import { test } from "node:test";
import assert from "node:assert/strict";

import { OUTFIT_PRESETS, nextOutfit, getOutfit } from "../lib/outfit.ts";

test("4 presets, all unique ids", () => {
  assert.equal(OUTFIT_PRESETS.length, 4);
  const ids = new Set(OUTFIT_PRESETS.map((p) => p.id));
  assert.equal(ids.size, 4);
});

test("nextOutfit cycles through all presets and wraps", () => {
  let cur = OUTFIT_PRESETS[0].id;
  for (let i = 0; i < OUTFIT_PRESETS.length; i++) cur = nextOutfit(cur).id;
  assert.equal(cur, OUTFIT_PRESETS[0].id);
});

test("masks are 0/1 only", () => {
  for (const p of OUTFIT_PRESETS) {
    for (const v of Object.values(p.mask)) {
      assert.ok(v === 0 || v === 1, `mask ${JSON.stringify(p.mask)} has ${v}`);
    }
  }
});

test("helmetOnly only enables helmet", () => {
  const p = getOutfit("helmetOnly");
  assert.equal(p.mask.helmet, 1);
  assert.equal(p.mask.chest, 0);
  assert.equal(p.mask.bicep, 0);
  assert.equal(p.mask.gauntlet, 0);
});

test("armsOnly enables both bicep and gauntlet", () => {
  const p = getOutfit("armsOnly");
  assert.equal(p.mask.bicep, 1);
  assert.equal(p.mask.gauntlet, 1);
  assert.equal(p.mask.chest, 0);
  assert.equal(p.mask.helmet, 0);
});

test("getOutfit on bad id falls back to full", () => {
  // @ts-expect-error intentional bad id
  const p = getOutfit("nonsense");
  assert.equal(p.id, "full");
});
