// Phase 8.4 — PBR fabric defaults + Sobel normal-map contract tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fabricMaterialDefaults,
  KNOWN_FABRIC_KINDS,
  computeNormalMapFromGrayscale,
  buildUniformRoughnessTexture,
} from "../app/lib/pbr-fabric.mjs";

test("fabricMaterialDefaults: unknown kind falls back to default cotton-like", () => {
  const m = fabricMaterialDefaults({ kind: "spaceship-hull" });
  assert.equal(m.roughness, 0.85);
  assert.equal(m.metalness, 0);
});

test("fabricMaterialDefaults: known fabrics return distinct presets", () => {
  const denim = fabricMaterialDefaults({ kind: "denim" });
  const silk = fabricMaterialDefaults({ kind: "silk" });
  const metallic = fabricMaterialDefaults({ kind: "metallic" });
  assert.ok(silk.roughness < denim.roughness, "silk smoother than denim");
  assert.ok(metallic.metalness > 0.5, "metallic actually metallic");
  assert.ok(silk.sheen > denim.sheen, "silk has more sheen");
});

test("fabricMaterialDefaults: case-insensitive lookup", () => {
  const a = fabricMaterialDefaults({ kind: "DENIM" });
  const b = fabricMaterialDefaults({ kind: "denim" });
  assert.deepEqual(a, b);
});

test("fabricMaterialDefaults: override clamps values to [0,1]", () => {
  const m = fabricMaterialDefaults({ kind: "cotton", override: { roughness: 5, metalness: -1 } });
  assert.equal(m.roughness, 1, "clamped to 1");
  assert.equal(m.metalness, 0, "clamped to 0");
});

test("fabricMaterialDefaults: override of NaN yields 0 (not NaN)", () => {
  const m = fabricMaterialDefaults({ kind: "cotton", override: { roughness: NaN } });
  assert.equal(m.roughness, 0);
});

test("fabricMaterialDefaults: returns NEW object (no preset mutation)", () => {
  const a = fabricMaterialDefaults({ kind: "cotton", override: { roughness: 0.1 } });
  const b = fabricMaterialDefaults({ kind: "cotton" });
  assert.equal(b.roughness, 0.85, "second call must see original preset");
  assert.equal(a.roughness, 0.1);
});

test("KNOWN_FABRIC_KINDS includes core fashion fabrics", () => {
  for (const k of ["cotton", "denim", "silk", "leather", "wool", "polyester"]) {
    assert.ok(KNOWN_FABRIC_KINDS.includes(k), `missing fabric: ${k}`);
  }
});

test("computeNormalMapFromGrayscale: flat (uniform) input → all (~0.5, 0.5, 1.0) normals", () => {
  const w = 8, h = 8;
  const rgba = new Uint8ClampedArray(w * h * 4).fill(128);
  for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255; // alpha
  const n = computeNormalMapFromGrayscale(w, h, rgba, 2.0);
  // All-uniform → gradient = 0 → normal = (0,0,1) → encoded (128, 128, 255).
  for (let i = 0; i < n.length; i += 4) {
    assert.equal(n[i], 128, `R at ${i}`);
    assert.equal(n[i + 1], 128, `G at ${i}`);
    assert.equal(n[i + 2], 255, `B at ${i}`);
    assert.equal(n[i + 3], 255, "alpha=255");
  }
});

test("computeNormalMapFromGrayscale: vertical edge produces non-flat normals", () => {
  const w = 8, h = 4;
  const rgba = new Uint8ClampedArray(w * h * 4);
  // Left half black, right half white → strong horizontal gradient at center.
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = x < w / 2 ? 0 : 255;
      const o = (y * w + x) * 4;
      rgba[o] = v; rgba[o + 1] = v; rgba[o + 2] = v; rgba[o + 3] = 255;
    }
  }
  const n = computeNormalMapFromGrayscale(w, h, rgba, 2.0);
  // At the edge (x=3 or x=4), R should deviate strongly from 128.
  const o = (1 * w + 3) * 4;
  assert.ok(Math.abs(n[o] - 128) > 30, `R at edge should swing: ${n[o]}`);
  // Far from the edge (x=0), should be ~flat.
  const o2 = (1 * w + 0) * 4;
  assert.ok(Math.abs(n[o2] - 128) < 30, `R far from edge should be near flat: ${n[o2]}`);
});

test("computeNormalMapFromGrayscale: validates dimensions + buffer length", () => {
  assert.throws(() => computeNormalMapFromGrayscale(1, 8, new Uint8ClampedArray(32)));
  assert.throws(() => computeNormalMapFromGrayscale(8, 1, new Uint8ClampedArray(32)));
  assert.throws(() => computeNormalMapFromGrayscale(4, 4, new Uint8ClampedArray(16))); // wrong size
  assert.throws(() => computeNormalMapFromGrayscale(4, 4, null));
});

test("computeNormalMapFromGrayscale: every output channel in [0,255]", () => {
  const w = 16, h = 16;
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < rgba.length; i += 4) {
    rgba[i] = (i * 7) & 0xff;
    rgba[i + 1] = (i * 13) & 0xff;
    rgba[i + 2] = (i * 19) & 0xff;
    rgba[i + 3] = 255;
  }
  const n = computeNormalMapFromGrayscale(w, h, rgba, 3.0);
  for (let i = 0; i < n.length; i++) {
    assert.ok(n[i] >= 0 && n[i] <= 255, `out-of-range at ${i}: ${n[i]}`);
  }
});

test("computeNormalMapFromGrayscale: invalid strength falls back to default (no NaN)", () => {
  const rgba = new Uint8ClampedArray(4 * 4 * 4).fill(64);
  for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255;
  const n = computeNormalMapFromGrayscale(4, 4, rgba, NaN);
  for (let i = 0; i < n.length; i++) {
    assert.ok(Number.isFinite(n[i]), "no NaN");
  }
});

test("buildUniformRoughnessTexture: returns RGBA quadruplet at the right gray value", () => {
  const t = buildUniformRoughnessTexture(0.85);
  assert.equal(t.length, 4);
  assert.equal(t[0], 217); // round(0.85 * 255)
  assert.equal(t[1], 217);
  assert.equal(t[2], 217);
  assert.equal(t[3], 255);
});

test("buildUniformRoughnessTexture: clamps out-of-range input", () => {
  assert.equal(buildUniformRoughnessTexture(2)[0], 255);
  assert.equal(buildUniformRoughnessTexture(-1)[0], 0);
  assert.equal(buildUniformRoughnessTexture(NaN)[0], 0);
});
