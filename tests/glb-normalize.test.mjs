import assert from "node:assert/strict";
import test from "node:test";
import { computeNormalizeScale } from "../app/lib/glb-normalize-pure.mjs";

test("scales unit cube to targetSize 2 → factor 2", () => {
  assert.equal(computeNormalizeScale(1.0, 2.0), 2.0);
});

test("scales 4-unit dimension to targetSize 2 → factor 0.5", () => {
  assert.equal(computeNormalizeScale(4.0, 2.0), 0.5);
});

test("default targetSize is 2.0", () => {
  assert.equal(computeNormalizeScale(1.0), 2.0);
});

test("returns 1 when maxDim is 0 or negative (no-op)", () => {
  assert.equal(computeNormalizeScale(0), 1);
  assert.equal(computeNormalizeScale(-3, 2), 1);
});

test("returns 1 for NaN/Infinity (defensive)", () => {
  assert.equal(computeNormalizeScale(NaN), 1);
  assert.equal(computeNormalizeScale(Infinity), 1);
});

test("custom targetSize honored", () => {
  assert.equal(computeNormalizeScale(2.0, 1.0), 0.5);
  assert.equal(computeNormalizeScale(0.5, 1.0), 2.0);
});

test("static guard: /mirror/page.tsx uses normalizeGlb everywhere", async () => {
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const { dirname, resolve } = await import("node:path");
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(resolve(__dirname, "../app/mirror/page.tsx"), "utf8");
  // Helper is imported.
  assert.match(src, /from\s+["']\.\.\/lib\/glb-normalize["']/);
  assert.match(src, /normalizeGlb\(/);
  // No more inline Box3().setFromObject lift-and-center duplication.
  // (One occurrence may remain inside utility code, so allow at most 0 in mirror.)
  const inlineCount = (src.match(/new\s+THREE\.Box3\(\)\.setFromObject/g) || []).length;
  assert.equal(inlineCount, 0, `expected 0 inline Box3 calls in mirror, got ${inlineCount}`);
});
