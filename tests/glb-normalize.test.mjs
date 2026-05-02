import assert from "node:assert/strict";
import test from "node:test";
import * as THREE from "three";
import { computeNormalizeScale, normalizeGlb } from "../lib/glb-normalize.ts";

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

test("normalizeGlb repairs normals, bakes centering, and fixes transparency", () => {
  // Mesh A: missing normals + near-opaque transparent material
  const missingNormals = new THREE.BufferGeometry();
  missingNormals.setAttribute("position", new THREE.Float32BufferAttribute([
    -0.5, -0.5, 0,
    0.5, -0.5, 0,
    0, 0.5, 0,
  ], 3));
  const missingNormalsCalls = withComputeVertexNormalsSpy(missingNormals);

  // Mesh B: all-zero normals + half-transparent material
  const zeroNormals = new THREE.BufferGeometry();
  zeroNormals.setAttribute("position", new THREE.Float32BufferAttribute([
    -0.5, -0.5, 0,
    0.5, -0.5, 0,
    0, 0.5, 0,
  ], 3));
  zeroNormals.setAttribute("normal", new THREE.Float32BufferAttribute(new Float32Array(9), 3));
  const zeroNormalsCalls = withComputeVertexNormalsSpy(zeroNormals);

  // Mesh C: valid normals (should NOT recompute)
  const validNormals = new THREE.BufferGeometry();
  validNormals.setAttribute("position", new THREE.Float32BufferAttribute([
    -0.5, -0.5, 0,
    0.5, -0.5, 0,
    0, 0.5, 0,
  ], 3));
  validNormals.setAttribute("normal", new THREE.Float32BufferAttribute([
    0, 0, 1, 0, 0, 1, 0, 0, 1,
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

  // Returns the same scene group
  assert.equal(normalized, scene);
  // Frustum culling disabled (Fix 5)
  assert.equal(normalized.frustumCulled, false);
  // Position reset to origin (Fix 2: centering baked into geometry)
  assert.deepEqual(normalized.position.toArray(), [0, 0, 0]);
  // Fix 1: missing normals → recomputed
  assert.equal(missingNormalsCalls(), 1);
  assert.equal(zeroNormalsCalls(), 1);
  assert.equal(validNormalsCalls(), 0);
  assert.ok(missingNormals.getAttribute("normal"));
  // Fix 4: near-opaque transparent → transparent=false
  assert.equal(transparentMaterial.transparent, false);
  assert.equal(stableMaterial.transparent, true);
  // Cast shadow enabled
  assert.equal(meshA.castShadow, true);
  // Double-sided
  assert.equal(transparentMaterial.side, THREE.DoubleSide);
  // Centered near origin
  assert.ok(Math.abs(center.x) < 1e-6, `center.x should be ~0, got ${center.x}`);
  assert.ok(Math.abs(center.y) < 1e-6, `center.y should be ~0, got ${center.y}`);
  assert.ok(Math.abs(center.z) < 1e-6, `center.z should be ~0, got ${center.z}`);
});

test("normalizeGlb leaves scale at 1 and warns on non-finite bounds (Fix 3)", () => {
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

test("normalizeGlb accepts a bare THREE.Group (not just GLTF result)", () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([
    -1, -1, 0, 1, -1, 0, 0, 1, 0,
  ], 3));

  const scene = new THREE.Group();
  scene.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()));

  // Pass bare group, not { scene }
  const normalized = normalizeGlb(scene);
  assert.equal(normalized, scene);
  assert.equal(normalized.frustumCulled, false);
});

test("normalizeGlb respects options overrides", () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([
    -1, -1, 0, 1, -1, 0, 0, 1, 0,
  ], 3));
  const normalsSpy = withComputeVertexNormalsSpy(geometry);

  const material = new THREE.MeshStandardMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  const scene = new THREE.Group();
  scene.add(mesh);

  normalizeGlb({ scene }, {
    recomputeNormals: false,
    castShadow: false,
    doubleSide: false,
    bakeCenterIntoGeometry: false,
    targetSize: 1.0,
  });

  assert.equal(normalsSpy(), 0, "normals should not be recomputed");
  assert.equal(mesh.castShadow, false, "castShadow should be false");
  assert.notEqual(material.side, THREE.DoubleSide, "doubleSide should be off");
});

test("loadAndNormalizeGlb export exists", async () => {
  const mod = await import("../lib/glb-normalize.ts");
  assert.equal(typeof mod.loadAndNormalizeGlb, "function");
  assert.equal(typeof mod.normalizeGlb, "function");
  assert.equal(typeof mod.computeNormalizeScale, "function");
});
