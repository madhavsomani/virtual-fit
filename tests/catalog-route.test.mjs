// Phase 8.6 — Catalog data + route contract tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseCatalogJsonl,
  validateCatalog,
  groupByCategory,
  listCategories,
  listFabrics,
  filterCatalog,
  mirrorUrlForCatalogItem,
} from "../app/lib/catalog-data.mjs";
import { KNOWN_FABRIC_KINDS } from "../app/lib/pbr-fabric.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CATALOG_FILE = resolve(ROOT, "public/data/catalog.jsonl");

test("catalog.jsonl exists and is non-empty", () => {
  assert.ok(existsSync(CATALOG_FILE), "catalog.jsonl missing");
  const txt = readFileSync(CATALOG_FILE, "utf8");
  assert.ok(txt.length > 0, "catalog.jsonl is empty");
});

test("parseCatalogJsonl: skips blank lines, parses each JSON line", () => {
  const text = '{"id":"a","name":"A"}\n\n{"id":"b","name":"B"}\n';
  const out = parseCatalogJsonl(text);
  assert.equal(out.length, 2);
  assert.equal(out[0].id, "a");
  assert.equal(out[1].id, "b");
});

test("parseCatalogJsonl: throws with line number on malformed JSON", () => {
  const text = '{"id":"a"}\n{not json}\n';
  assert.throws(
    () => parseCatalogJsonl(text),
    /line 2/,
  );
});

test("parseCatalogJsonl: rejects non-string input", () => {
  assert.throws(() => parseCatalogJsonl(null));
  assert.throws(() => parseCatalogJsonl({ x: 1 }));
});

test("validateCatalog: drops rows missing required fields, returns reasons", () => {
  const { valid, dropped } = validateCatalog([
    { id: "ok", name: "ok", fabric: "cotton", category: "tops", imageUrl: "/a.png", glbUrl: "/a.glb" },
    { id: "bad" }, // missing everything
    null, // not an object
  ]);
  assert.equal(valid.length, 1);
  assert.equal(dropped.length, 2);
  assert.ok(dropped[0].reasons.some((r) => r.includes("missing name")));
  assert.ok(dropped[1].reasons.some((r) => r.includes("not an object")));
});

test("validateCatalog: rejects glbUrl that doesn't end in .glb (vision guard)", () => {
  const { valid, dropped } = validateCatalog([
    { id: "x", name: "x", fabric: "cotton", category: "tops", imageUrl: "/a.png", glbUrl: "/a.png" },
  ]);
  assert.equal(valid.length, 0);
  assert.equal(dropped.length, 1);
  assert.ok(dropped[0].reasons.some((r) => r.includes("must end with .glb")));
});

test("validateCatalog: rejects unknown fabric kinds", () => {
  const { dropped } = validateCatalog([
    { id: "x", name: "x", fabric: "spaceship-hull", category: "tops", imageUrl: "/a.png", glbUrl: "/a.glb" },
  ]);
  assert.ok(dropped[0].reasons.some((r) => r.includes("unknown fabric")));
});

test("REAL CATALOG: full file parses + every row validates", () => {
  const text = readFileSync(CATALOG_FILE, "utf8");
  const records = parseCatalogJsonl(text);
  assert.ok(records.length >= 10, `need at least 10 catalog entries, got ${records.length}`);
  const { valid, dropped } = validateCatalog(records);
  assert.equal(dropped.length, 0, `dropped rows: ${JSON.stringify(dropped)}`);
  assert.equal(valid.length, records.length);
  // Vision: every entry must have a real GLB on disk.
  for (const r of valid) {
    const glbPath = resolve(ROOT, "public", r.glbUrl.replace(/^\//, ""));
    assert.ok(existsSync(glbPath), `${r.id}: GLB missing on disk: ${glbPath}`);
    assert.ok(KNOWN_FABRIC_KINDS.includes(r.fabric), `${r.id}: bad fabric ${r.fabric}`);
  }
});

test("REAL CATALOG: all ids unique", () => {
  const records = parseCatalogJsonl(readFileSync(CATALOG_FILE, "utf8"));
  const ids = records.map((r) => r.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("groupByCategory groups records correctly", () => {
  const recs = [
    { id: "a", category: "tops" },
    { id: "b", category: "bottoms" },
    { id: "c", category: "tops" },
  ];
  const g = groupByCategory(recs);
  assert.equal(g.get("tops").length, 2);
  assert.equal(g.get("bottoms").length, 1);
});

test("listCategories / listFabrics return distinct sorted values", () => {
  const recs = [
    { category: "outerwear", fabric: "wool" },
    { category: "tops", fabric: "cotton" },
    { category: "tops", fabric: "wool" },
  ];
  assert.deepEqual(listCategories(recs), ["outerwear", "tops"]);
  assert.deepEqual(listFabrics(recs), ["cotton", "wool"]);
});

test("filterCatalog: free-text query hits name, brand, tagline, tags", () => {
  const recs = [
    { id: "1", name: "Cotton Tee", brand: "Acme", tagline: "soft", tags: ["essential"] },
    { id: "2", name: "Denim Jacket", brand: "Heritage", tagline: "structured", tags: ["raw"] },
  ];
  assert.equal(filterCatalog(recs, { query: "cotton" }).length, 1);
  assert.equal(filterCatalog(recs, { query: "heritage" }).length, 1);
  assert.equal(filterCatalog(recs, { query: "ESSENTIAL" }).length, 1, "case-insensitive");
  assert.equal(filterCatalog(recs, { query: "structured" }).length, 1);
  assert.equal(filterCatalog(recs, { query: "" }).length, 2);
});

test("filterCatalog: combined facet + query", () => {
  const recs = [
    { id: "1", name: "A", category: "tops", fabric: "cotton", tags: [] },
    { id: "2", name: "B", category: "tops", fabric: "silk", tags: [] },
    { id: "3", name: "A", category: "outerwear", fabric: "leather", tags: [] },
  ];
  assert.equal(filterCatalog(recs, { query: "a", category: "tops" }).length, 1);
  assert.equal(filterCatalog(recs, { fabric: "silk" }).length, 1);
  assert.equal(filterCatalog(recs, { category: "outerwear", fabric: "leather" }).length, 1);
});

test("mirrorUrlForCatalogItem builds /mirror?garment=&catalogId=&fabric=", () => {
  const url = mirrorUrlForCatalogItem({
    id: "x",
    glbUrl: "/m.glb",
    fabric: "denim",
  });
  assert.ok(url.startsWith("/mirror?"));
  assert.ok(url.includes("garment=%2Fm.glb"));
  assert.ok(url.includes("catalogId=x"));
  assert.ok(url.includes("fabric=denim"));
});

test("mirrorUrlForCatalogItem degrades gracefully", () => {
  assert.equal(mirrorUrlForCatalogItem(null), "/mirror");
  assert.equal(mirrorUrlForCatalogItem({}), "/mirror");
});

test("VISION GUARD: catalog page.tsx never imports a 2D-fallback renderer", () => {
  const src = readFileSync(resolve(ROOT, "app/catalog/page.tsx"), "utf8");
  const browser = readFileSync(resolve(ROOT, "app/catalog/CatalogBrowser.jsx"), "utf8");
  for (const [name, s] of [["page.tsx", src], ["CatalogBrowser.jsx", browser]]) {
    assert.ok(!s.includes("2d-overlay"), `${name}: 2d-overlay imported`);
    assert.ok(!s.includes("garmentTexture"), `${name}: garmentTexture referenced`);
  }
});

test("page.tsx is a server component (no 'use client')", () => {
  const src = readFileSync(resolve(ROOT, "app/catalog/page.tsx"), "utf8");
  const head = src.split("\n").slice(0, 3).join("\n");
  assert.ok(!/['"]use client['"]/.test(head), "/catalog page must be SSR");
});

test("layout.tsx exposes per-route SEO metadata", () => {
  const src = readFileSync(resolve(ROOT, "app/catalog/layout.tsx"), "utf8");
  assert.ok(src.includes("export const metadata"));
  assert.ok(src.includes("openGraph"));
});
