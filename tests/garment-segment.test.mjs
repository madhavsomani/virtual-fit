import assert from "node:assert/strict";
import test from "node:test";

import {
  pickGarmentEntries,
  unionMaskAlpha,
  coverageFraction,
  GARMENT_LABELS,
} from "../app/lib/garment-segment-helpers.mjs";

test("GARMENT_LABELS contains expected upper-body classes", () => {
  for (const l of ["Upper-clothes", "Dress", "Coat"]) assert.ok(GARMENT_LABELS.has(l));
});

test("pickGarmentEntries filters out non-garment classes", () => {
  const entries = [
    { label: "Background", mask: "x" },
    { label: "Hair", mask: "x" },
    { label: "Upper-clothes", mask: "u" },
    { label: "Pants", mask: "p" },
    { label: "Hat", mask: "x" },
  ];
  const picked = pickGarmentEntries(entries);
  assert.equal(picked.length, 2);
  assert.deepEqual(picked.map((e) => e.label).sort(), ["Pants", "Upper-clothes"]);
});

test("pickGarmentEntries handles empty / malformed input", () => {
  assert.deepEqual(pickGarmentEntries([]), []);
  assert.deepEqual(pickGarmentEntries(null), []);
  assert.deepEqual(pickGarmentEntries([null, { label: 1 }, { mask: "x" }]), []);
});

test("unionMaskAlpha takes max of all input masks per pixel", () => {
  const a = [0, 100, 50, 0];
  const b = [10, 50, 200, 0];
  const c = [0, 0, 0, 5];
  const u = unionMaskAlpha([a, b, c], 4);
  assert.deepEqual(Array.from(u), [10, 100, 200, 5]);
});

test("unionMaskAlpha returns all zeros for no masks", () => {
  const u = unionMaskAlpha([], 5);
  assert.deepEqual(Array.from(u), [0, 0, 0, 0, 0]);
});

test("coverageFraction counts pixels above threshold", () => {
  const alpha = new Uint8ClampedArray([0, 5, 17, 200, 255]);
  // threshold=16 → 17, 200, 255 = 3 of 5
  assert.equal(coverageFraction(alpha, 16), 3 / 5);
});

test("coverageFraction empty input → 0", () => {
  assert.equal(coverageFraction(new Uint8ClampedArray([])), 0);
});
