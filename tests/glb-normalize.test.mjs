import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { computeNormalizeScale, normalizeGlb } from "../app/lib/glb-normalize.ts";

function withComputeVertexNormalsSpy(geometry) {
  const original = geometry.computeVertexNormals.bind(geometry);
  let callCount = 0;
  geometry.computeVertexNormals = () => {
    callCount += 1;
    return original();
  };
  return () => callCount;
}

test("computeNormalizeScale scales finite dimensions", () => {
  assert.equal(computeNormalizeScale(1.0, 2.0), 2.0);
  assert.equal(computeNormalizeScale(4.0, 2.0), 0.5);
  assert.equal(computeNormalizeScale(1.0), 2.0);
  assert.equal(computeNormalizeScale(2.0, 1.0), 0.5);
  assert.equal(computeNormalizeScale(0.5, 1.0), 2.0);
});

test("computeNormalizeScale returns 1 for broken inputs", () => {
  assert.equal(computeNormalizeScale(NaN), 1);
  assert.equal(computeNormalizeScale(Infinity), 1);
  assert.equal(computeNormalizeScale(0), 1);
  assert.equal(computeNormalizeScale(-3, 2), 1);
  assert.equal(computeNormalizeScale(2, Infinity), 1);
});

test("normalizeGlb repairs normals, bakes centering, and fixes near-opaque transparency", () => {
  const missingNormals = new THREE.BufferGeometry();
  missingNormals.setAttribute("position", new THREE.Float32BufferAttribute([
    -0.5, -0.5, 0,
    0.5, -0.5, 0,
    0, 0.5, 0,
  ], 3));
  const missingNormalsCalls = withComputeVertexNormalsSpy(missingNormals);

  const zeroNormals = new THREE.BufferGeometry();
  zeroNormals.setAttribute("position", new THREE.Float32BufferAttribute([
    -0.5, -0.5, 0,
    0.5, -0.5, 0,
    0, 0.5, 0,
  ], 3));
  zeroNormals.setAttribute("normal", new THREE.Float32BufferAttribute(new Float32Array(9), 3));
  const zeroNormalsCalls = withComputeVertexNormalsSpy(zeroNormals);

  const validNormals = new THREE.BufferGeometry();
  validNormals.setAttribute("position", new THREE.Float32BufferAttribute([
    -0.5, -0.5, 0,
    0.5, -0.5, 0,
    0, 0.5, 0,
  ], 3));
  validNormals.setAttribute("normal", new THREE.Float32BufferAttribute([
    0, 0, 1,
    0, 0, 1,
    0, 0, 1,
  ], 3));
  const validNormalsCalls = withComputeVertexNormalsSpy(validNormals);

  const transparentMaterial = new THREE.MeshStandardMaterial({
    opacity: 0.9995,
    transparent: true,
  });
  const stableMaterial = new THREE.MeshStandardMaterial({
    opacity: 0.5,
    transparent: true,
  });

  const meshA = new THREE.Mesh(missingNormals, transparentMaterial);
  meshA.position.set(5, 0, 0);

  const meshB = new THREE.Mesh(zeroNormals, stableMaterial);
  meshB.position.set(7, 0, 0);

  const meshC = new THREE.Mesh(validNormals, new THREE.MeshStandardMaterial());
  meshC.position.set(9, 0, 0);

  const scene = new THREE.Group();
  scene.add(meshA, meshB, meshC);

  const normalized = normalizeGlb({ scene });
  const center = new THREE.Box3().setFromObject(normalized).getCenter(new THREE.Vector3());

  assert.equal(normalized, scene);
  assert.equal(normalized.frustumCulled, false);
  assert.deepEqual(normalized.position.toArray(), [0, 0, 0]);
  assert.equal(missingNormalsCalls(), 1);
  assert.equal(zeroNormalsCalls(), 1);
  assert.equal(validNormalsCalls(), 0);
  assert.ok(missingNormals.getAttribute("normal"));
  assert.equal(transparentMaterial.transparent, false);
  assert.equal(stableMaterial.transparent, true);
  assert.equal(meshA.castShadow, true);
  assert.equal(transparentMaterial.side, THREE.DoubleSide);
  assert.ok(Math.abs(center.x) < 1e-6);
  assert.ok(Math.abs(center.y) < 1e-6);
  assert.ok(Math.abs(center.z) < 1e-6);
});

test("normalizeGlb leaves scale at 1 and warns when bounds are non-finite", () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([
    NaN, 0, 0,
    1, 0, 0,
    0, 1, 0,
  ], 3));

  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(geometry, new THREE.MeshStandardMaterial()));

  const originalError = console.error;
  console.error = () => {};
  try {
    const normalized = normalizeGlb({ scene });
    assert.equal(normalized.scale.x, 1);
    assert.equal(normalized.scale.y, 1);
    assert.equal(normalized.scale.z, 1);
    assert.equal(normalized.userData.normalizeWarning, "non-finite-bounds");
    assert.equal(normalized.frustumCulled, false);
  } finally {
    console.error = originalError;
  }
});

test("static guard: /mirror/page.tsx uses normalizeGlb everywhere", async () => {
  const { readFileSync } = await import("node:fs");
  const { fileURLToPath } = await import("node:url");
  const { dirname, resolve } = await import("node:path");
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const src = readFileSync(resolve(__dirname, "../app/mirror/page.tsx"), "utf8");
  assert.match(src, /from\s+["']\.\.\/lib\/glb-normalize["']/);
  assert.match(src, /normalizeGlb\(/);
  const inlineCount = (src.match(/new\s+THREE\.Box3\(\)\.setFromObject/g) || []).length;
  assert.equal(inlineCount, 0, `expected 0 inline Box3 calls in mirror, got ${inlineCount}`);
});
