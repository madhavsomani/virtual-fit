import { test } from "node:test";
import assert from "node:assert/strict";

import { loadPrefs, savePrefs, DEFAULT_PREFS, PREFS_KEY } from "../lib/prefs.ts";

function makeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, v),
    _data: data
  };
}

test("loadPrefs returns defaults when storage is null", () => {
  assert.deepEqual(loadPrefs(null), DEFAULT_PREFS);
});

test("loadPrefs returns defaults when key missing", () => {
  assert.deepEqual(loadPrefs(makeStorage()), DEFAULT_PREFS);
});

test("loadPrefs round-trips a saved value", () => {
  const s = makeStorage();
  savePrefs(s, { outfitId: "helmetOnly", variantId: "stealth", debugLandmarks: true });
  assert.deepEqual(loadPrefs(s), { outfitId: "helmetOnly", variantId: "stealth", debugLandmarks: true });
});

test("loadPrefs falls back when stored ids are unknown", () => {
  const s = makeStorage({ [PREFS_KEY]: JSON.stringify({ outfitId: "nope", variantId: "bad", debugLandmarks: 1 }) });
  const p = loadPrefs(s);
  assert.equal(p.outfitId, DEFAULT_PREFS.outfitId);
  assert.equal(p.variantId, DEFAULT_PREFS.variantId);
  assert.equal(p.debugLandmarks, DEFAULT_PREFS.debugLandmarks);
});

test("loadPrefs survives malformed JSON", () => {
  const s = makeStorage({ [PREFS_KEY]: "{not json" });
  assert.deepEqual(loadPrefs(s), DEFAULT_PREFS);
});

test("savePrefs writes JSON under the canonical key", () => {
  const s = makeStorage();
  savePrefs(s, { outfitId: "armsOnly", variantId: "hulkbuster", debugLandmarks: false });
  assert.equal(JSON.parse(s._data.get(PREFS_KEY)).outfitId, "armsOnly");
});

test("savePrefs is a no-op for null storage", () => {
  savePrefs(null, DEFAULT_PREFS); // must not throw
});

test("loadPrefs handles partial saved values", () => {
  const s = makeStorage({ [PREFS_KEY]: JSON.stringify({ outfitId: "chestOnly" }) });
  const p = loadPrefs(s);
  assert.equal(p.outfitId, "chestOnly");
  assert.equal(p.variantId, DEFAULT_PREFS.variantId);
  assert.equal(p.debugLandmarks, DEFAULT_PREFS.debugLandmarks);
});
