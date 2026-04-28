// Phase 8.11 — style embeddings + /style-me contract tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  embedText,
  embedGarment,
  garmentToText,
  cosineSimilarity,
  styleNeighbours,
  buildEmbeddingIndex,
  EMBEDDING_VERSION,
} from "../app/lib/style-embeddings.mjs";
import { buildStyleIndex } from "../app/lib/build-style-index.mjs";
import { readCatalog } from "../app/lib/catalog-persistence.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const PAGE = resolve(ROOT, "app/style-me/page.tsx");
const LAYOUT = resolve(ROOT, "app/style-me/layout.tsx");
const ISLAND = resolve(ROOT, "app/style-me/StyleMeBrowser.jsx");
const INDEX_OUT = resolve(ROOT, "public/data/style-index.json");

test("embedText: returns L2-normalised Float32Array of requested dim", () => {
  const v = embedText("oversized cream cotton tee", 256);
  assert.equal(v.length, 256);
  assert.ok(v instanceof Float32Array);
  let sum = 0;
  for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
  assert.ok(Math.abs(sum - 1) < 1e-5, `expected unit norm, got ${sum}`);
});

test("embedText: empty/garbage input returns zero-length-norm vector", () => {
  const v = embedText("", 64);
  assert.equal(v.length, 64);
  for (const x of v) assert.equal(x, 0);
});

test("embedText: dim bounds enforced", () => {
  assert.throws(() => embedText("hi", 8), /dim must be/);
  assert.throws(() => embedText("hi", 9999), /dim must be/);
});

test("embedText: deterministic — same input → identical vector", () => {
  const a = embedText("denim jacket", 128);
  const b = embedText("denim jacket", 128);
  for (let i = 0; i < a.length; i++) assert.equal(a[i], b[i]);
});

test("cosineSimilarity: identical text → ~1.0", () => {
  const a = embedText("soft cotton crewneck", 256);
  const b = embedText("soft cotton crewneck", 256);
  const s = cosineSimilarity(a, b);
  assert.ok(Math.abs(s - 1) < 1e-5);
});

test("cosineSimilarity: closely related > unrelated", () => {
  const target = embedText("oversized cotton tee", 256);
  const close = embedText("loose cotton t-shirt", 256);
  const far = embedText("leather biker jacket", 256);
  assert.ok(cosineSimilarity(target, close) > cosineSimilarity(target, far));
});

test("cosineSimilarity: rejects mismatched lengths", () => {
  assert.throws(() => cosineSimilarity(new Float32Array(4), new Float32Array(8)), /same length/);
});

test("garmentToText: pulls every text-bearing field", () => {
  const t = garmentToText({
    name: "Acme Tee",
    brand: "Acme",
    tagline: "the everyday baseline",
    category: "tops",
    fabric: "cotton",
    tags: ["staple", "minimal"],
    materials: { composition: [{ name: "organic cotton", pct: 100 }] },
  });
  assert.match(t, /Acme/);
  assert.match(t, /baseline/);
  assert.match(t, /staple/);
  assert.match(t, /organic cotton/);
});

test("buildEmbeddingIndex: stores one vector per garment id", () => {
  const corpus = [
    { id: "a-1", name: "Cotton Tee", category: "tops", fabric: "cotton" },
    { id: "b-2", name: "Denim Jacket", category: "outerwear", fabric: "denim" },
  ];
  const idx = buildEmbeddingIndex(corpus, 64);
  assert.equal(idx.dim, 64);
  assert.equal(idx.vectors.size, 2);
  assert.ok(idx.vectors.get("a-1") instanceof Float32Array);
});

test("styleNeighbours: returns top-k matches sorted desc by score, excludes self", () => {
  const corpus = [
    { id: "tee-cotton", name: "Cream Cotton Tee", category: "tops", fabric: "cotton" },
    { id: "tee-cotton-2", name: "White Cotton T-shirt", category: "tops", fabric: "cotton" },
    { id: "jacket-denim", name: "Denim Trucker Jacket", category: "outerwear", fabric: "denim" },
    { id: "boot-leather", name: "Leather Combat Boot", category: "footwear", fabric: "leather" },
  ];
  const target = corpus[0];
  const out = styleNeighbours(target, corpus, { k: 2 });
  assert.equal(out.length, 2);
  // Self must be excluded.
  assert.ok(out.every((r) => r.id !== "tee-cotton"));
  // Sorted desc.
  assert.ok(out[0].score >= out[1].score);
  // Most similar should be the other cotton tee.
  assert.equal(out[0].id, "tee-cotton-2");
});

test("styleNeighbours: free-text query also works", () => {
  const corpus = [
    { id: "tee-1", name: "Cream Cotton Tee", category: "tops", fabric: "cotton" },
    { id: "jacket-1", name: "Black Leather Biker", category: "outerwear", fabric: "leather" },
  ];
  const out = styleNeighbours("soft cotton tee", corpus, { k: 1 });
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "tee-1");
});

test("styleNeighbours: validates k bounds + corpus shape", () => {
  assert.throws(() => styleNeighbours("x", "not-array"), /corpus must be array/);
  assert.throws(() => styleNeighbours("x", [], { k: 0 }), /k must be/);
  assert.throws(() => styleNeighbours("x", [], { k: 51 }), /k must be/);
});

test("EMBEDDING_VERSION is frozen + carries algorithm/dim/version", () => {
  assert.ok(Object.isFrozen(EMBEDDING_VERSION));
  assert.equal(EMBEDDING_VERSION.algorithm, "fnv1a-bigram-bow");
  assert.ok(Number.isInteger(EMBEDDING_VERSION.dim));
  assert.match(EMBEDDING_VERSION.version, /^\d+\.\d+\.\d+$/);
});

test("INTEGRATION: every shipped garment embeds successfully", () => {
  const { garments } = readCatalog();
  assert.ok(garments.length >= 12);
  for (const g of garments) {
    const v = embedGarment(g);
    assert.equal(v.length, EMBEDDING_VERSION.dim);
    let sum = 0;
    for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
    assert.ok(Math.abs(sum - 1) < 1e-4, `garment ${g.id}: not unit-norm`);
  }
});

test("INTEGRATION: shipped catalog yields meaningful neighbours", () => {
  const { garments } = readCatalog();
  // Use a cotton/tops-flavoured query and assert the top hit is something
  // tops-y, not e.g. a leather jacket.
  const out = styleNeighbours("cotton tee everyday baseline", garments, { k: 3 });
  assert.equal(out.length, 3);
  // At least one of the top-3 should be a `tops` category garment.
  assert.ok(out.some((r) => r.garment.category === "tops"), JSON.stringify(out.map((r) => ({ id: r.id, c: r.garment.category, s: r.score }))));
});

test("buildStyleIndex: writes a JSON sidecar with one vector per garment", () => {
  const r = buildStyleIndex();
  assert.equal(r.ok, true);
  assert.ok(r.count >= 12);
  assert.ok(existsSync(INDEX_OUT));
  const payload = JSON.parse(readFileSync(INDEX_OUT, "utf8"));
  assert.equal(payload.count, r.count);
  assert.ok(Array.isArray(payload.entries));
  assert.equal(payload.entries[0].vector.length, EMBEDDING_VERSION.dim);
  assert.equal(payload.embeddingVersion.algorithm, "fnv1a-bigram-bow");
});

test("/style-me page + layout + island exist", () => {
  assert.ok(existsSync(PAGE));
  assert.ok(existsSync(LAYOUT));
  assert.ok(existsSync(ISLAND));
});

test("/style-me page is server, island is client", () => {
  const page = readFileSync(PAGE, "utf8");
  assert.ok(!page.includes('"use client"'));
  const island = readFileSync(ISLAND, "utf8");
  assert.match(island.split("\n")[0], /['"]use client['"]/);
});

test("/style-me Try-on link includes garment + fabric + styleMatch", () => {
  const island = readFileSync(ISLAND, "utf8");
  assert.match(island, /\/mirror\?garment=/);
  assert.match(island, /fabric=/);
  assert.match(island, /styleMatch=/);
});

test("/style-me layout exposes per-route SEO metadata", () => {
  const layout = readFileSync(LAYOUT, "utf8");
  assert.match(layout, /Style Me/);
  assert.match(layout, /metadata/);
});

test("VISION GUARD: style-embeddings + /style-me never import 2D fallback", () => {
  for (const f of [
    resolve(ROOT, "app/lib/style-embeddings.mjs"),
    resolve(ROOT, "app/lib/build-style-index.mjs"),
    PAGE,
    ISLAND,
  ]) {
    const src = readFileSync(f, "utf8");
    assert.ok(!src.includes("2d-overlay"), `${f} imports 2d-overlay`);
    assert.ok(!src.includes("garmentTexture"), `${f} references garmentTexture`);
  }
});

test("VISION GUARD: no paid API endpoint referenced (no openai/cohere/anthropic urls)", () => {
  const src = readFileSync(resolve(ROOT, "app/lib/style-embeddings.mjs"), "utf8");
  assert.ok(!/openai\.com|cohere\.ai|anthropic\.com/i.test(src));
});
