import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

import garments from "../data/garments.json" with { type: "json" };

const garmentsJsonUrl = new URL("../data/garments.json", import.meta.url).href;
const garmentTypesUrl = new URL("../lib/garment-types.ts", import.meta.url).href;
const garmentLibrarySource = readFileSync(new URL("../lib/garment-library.ts", import.meta.url), "utf8")
  .replace('from "@/data/garments.json";', `from "${garmentsJsonUrl}" with { type: "json" };`)
  .replace('from "@/lib/garment-types";', `from "${garmentTypesUrl}";`);

const tempDir = mkdtempSync(join(tmpdir(), "vf8-garment-library-"));
const tempModuleUrl = new URL("garment-library.testable.ts", pathToFileURL(`${tempDir}/`));

writeFileSync(tempModuleUrl, garmentLibrarySource, "utf8");

const {
  GARMENT_CATEGORIES,
  GARMENT_LIBRARY,
  findGarment,
  hasAsset,
  listGarments
} = await import(`${tempModuleUrl.href}?t=${Date.now()}`);

const REQUIRED_CATEGORIES = ["tshirt", "jacket", "pants", "dress", "hoodie"];
const ALL_CATEGORIES = ["tshirt", "jacket", "pants", "dress", "hoodie", "shorts", "skirt"];

test("data/garments.json contains exactly 8 entries", () => {
  assert.equal(garments.length, 8);
  assert.equal(GARMENT_LIBRARY.length, 8);
});

test("every required category appears at least once", () => {
  const categories = new Set(garments.map((garment) => garment.category));

  for (const category of REQUIRED_CATEGORIES) {
    assert.equal(categories.has(category), true);
  }
});

test("every id is unique and lowercase kebab-case", () => {
  const ids = garments.map((garment) => garment.id);
  const uniqueIds = new Set(ids);

  assert.equal(uniqueIds.size, ids.length);

  for (const id of ids) {
    assert.match(id, /^[a-z0-9-]+$/);
  }
});

test("every assetUrl matches the garment path contract", () => {
  for (const garment of garments) {
    assert.match(garment.assetUrl, /^\/garments\/[a-z0-9-]+\.glb$/);
  }
});

test("every previewGradient is a length-2 array with from/to Tailwind tokens", () => {
  for (const garment of garments) {
    assert.equal(Array.isArray(garment.previewGradient), true);
    assert.equal(garment.previewGradient.length, 2);
    assert.equal(typeof garment.previewGradient[0], "string");
    assert.equal(typeof garment.previewGradient[1], "string");
    assert.match(garment.previewGradient[0], /^from-/);
    assert.match(garment.previewGradient[1], /^to-/);
  }
});

test("every createdAt is a valid Date", () => {
  for (const garment of garments) {
    assert.equal(Number.isNaN(Date.parse(garment.createdAt)), false);
  }
});

test("anchors are sensible for the garment categories", () => {
  const expectedAnchors = {
    tshirt: "torso",
    hoodie: "torso",
    jacket: "torso",
    pants: "legs",
    shorts: "legs",
    dress: "full-body",
    skirt: "legs"
  };

  for (const garment of garments) {
    assert.equal(garment.anchor, expectedAnchors[garment.category]);
  }
});

test("listGarments returns all 8 entries with no filters", () => {
  assert.equal(listGarments().length, 8);
});

test('listGarments({ category: "tshirt" }) returns only tshirts', () => {
  const tshirts = listGarments({ category: "tshirt" });

  assert.ok(tshirts.length >= 1);
  assert.equal(tshirts.every((garment) => garment.category === "tshirt"), true);
});

test('listGarments({ anchor: "torso" }) returns at least the torso garments', () => {
  const torsoGarments = listGarments({ anchor: "torso" });
  const categories = new Set(torsoGarments.map((garment) => garment.category));

  assert.ok(torsoGarments.length >= 3);
  assert.equal(categories.has("tshirt"), true);
  assert.equal(categories.has("hoodie"), true);
  assert.equal(categories.has("jacket"), true);
});

test("findGarment resolves known ids and misses unknown ones", () => {
  const knownGarment = garments[0];

  assert.deepEqual(findGarment(knownGarment.id), knownGarment);
  assert.equal(findGarment("nope"), undefined);
});

test("hasAsset validates catalog URLs without filesystem checks", () => {
  for (const garment of GARMENT_LIBRARY) {
    assert.equal(hasAsset(garment), true);
    assert.equal(hasAsset({ ...garment, assetUrl: "/wrong.glb" }), false);
  }
});

test("GARMENT_CATEGORIES contains all 7 enum values", () => {
  assert.deepEqual([...GARMENT_CATEGORIES].sort(), [...ALL_CATEGORIES].sort());
});
