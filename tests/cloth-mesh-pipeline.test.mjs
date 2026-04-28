// Phase 8.3 — cloth-mesh-pipeline contract tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createClothMesh, stepCloth, setAnchor } from "../app/mirror/cloth-sim.js";
import {
  buildClothGeometry,
  updateClothPositions,
  computeClothNormals,
  mapAnchorsFromShoulders,
} from "../app/mirror/cloth-mesh-pipeline.js";

test("buildClothGeometry produces correct buffer sizes", () => {
  const c = createClothMesh({ width: 4, height: 6, spacing: 0.1 });
  const g = buildClothGeometry(c);
  assert.equal(g.positions.length, 4 * 6 * 3, "positions: 3 per particle");
  assert.equal(g.uvs.length, 4 * 6 * 2, "uvs: 2 per particle");
  assert.equal(g.normals.length, 4 * 6 * 3, "normals: 3 per particle");
  // (W-1)*(H-1) quads * 2 triangles * 3 indices = 3*5*2*3 = 90
  assert.equal(g.indices.length, 90);
});

test("buildClothGeometry: positions populated from initial particle positions", () => {
  const c = createClothMesh({ width: 3, height: 3, spacing: 0.1 });
  const g = buildClothGeometry(c);
  // Particle 0 = top-left; (W-1)/2 = 1 → x = -0.1, y = 0
  assert.ok(Math.abs(g.positions[0] - -0.1) < 1e-6);
  assert.ok(Math.abs(g.positions[1] - 0) < 1e-6);
  assert.equal(g.positions[2], 0);
});

test("buildClothGeometry UVs cover full [0,1]² with V flipped (top-row → v=1)", () => {
  const c = createClothMesh({ width: 4, height: 5, spacing: 0.1 });
  const g = buildClothGeometry(c);
  // Top-left particle (idx 0): u=0, v=1
  assert.equal(g.uvs[0], 0);
  assert.equal(g.uvs[1], 1);
  // Top-right (idx 3): u=1, v=1
  assert.equal(g.uvs[3 * 2], 1);
  assert.equal(g.uvs[3 * 2 + 1], 1);
  // Bottom-left (idx 4*4 = 16): u=0, v=0
  assert.equal(g.uvs[16 * 2], 0);
  assert.equal(g.uvs[16 * 2 + 1], 0);
});

test("buildClothGeometry indices: every triangle has 3 distinct in-range vertices", () => {
  const c = createClothMesh({ width: 5, height: 5, spacing: 0.1 });
  const g = buildClothGeometry(c);
  for (let i = 0; i < g.indices.length; i += 3) {
    const a = g.indices[i], b = g.indices[i + 1], c2 = g.indices[i + 2];
    assert.notEqual(a, b);
    assert.notEqual(b, c2);
    assert.notEqual(a, c2);
    assert.ok(a < 25 && b < 25 && c2 < 25, "indices in range");
  }
});

test("buildClothGeometry triangles are CCW when viewed from +z (front-facing)", () => {
  const c = createClothMesh({ width: 3, height: 3, spacing: 0.1 });
  const g = buildClothGeometry(c);
  // First triangle: tl(0,0,0)=p0, bl(0,-0.1,0)=p3, tr(0.1,0,0)=p1
  // For first cell: tl is particle (0,0). Compute face normal.
  const a = 0, b = 3, c2 = 1;
  const ax = g.positions[a*3], ay = g.positions[a*3+1];
  const bx = g.positions[b*3], by = g.positions[b*3+1];
  const cx = g.positions[c2*3], cy = g.positions[c2*3+1];
  const e1x = bx - ax, e1y = by - ay;
  const e2x = cx - ax, e2y = cy - ay;
  const nz = e1x * e2y - e1y * e2x; // z-component of cross
  assert.ok(nz > 0, `triangle must be CCW (front-facing): nz=${nz}`);
});

test("buildClothGeometry rejects bad cloth dimensions", () => {
  assert.throws(() => buildClothGeometry({ width: 1, height: 5, particles: [] }));
  assert.throws(() => buildClothGeometry({ width: 5, height: 1, particles: [] }));
  assert.throws(() => buildClothGeometry({ width: 3, height: 3, particles: [] }));
});

test("updateClothPositions overwrites buffer with current particle positions", () => {
  const c = createClothMesh({ width: 3, height: 3, spacing: 0.1 });
  const g = buildClothGeometry(c);
  // Move every particle to (1,2,3)
  for (const p of c.particles) { p.x = 1; p.y = 2; p.z = 3; }
  updateClothPositions(c, g.positions);
  for (let i = 0; i < g.positions.length; i += 3) {
    assert.equal(g.positions[i], 1);
    assert.equal(g.positions[i + 1], 2);
    assert.equal(g.positions[i + 2], 3);
  }
});

test("updateClothPositions rejects mismatched buffer", () => {
  const c = createClothMesh({ width: 3, height: 3, spacing: 0.1 });
  assert.throws(() => updateClothPositions(c, new Float32Array(10)));
});

test("computeClothNormals: flat cloth at z=0 → all normals point +z", () => {
  const c = createClothMesh({ width: 4, height: 4, spacing: 0.1 });
  const g = buildClothGeometry(c);
  computeClothNormals(g.positions, g.indices, g.normals);
  for (let i = 0; i < g.normals.length; i += 3) {
    assert.ok(Math.abs(g.normals[i]) < 1e-6, "nx ≈ 0");
    assert.ok(Math.abs(g.normals[i + 1]) < 1e-6, "ny ≈ 0");
    assert.ok(g.normals[i + 2] > 0.99, `nz ≈ 1: ${g.normals[i + 2]}`);
  }
});

test("computeClothNormals: degenerate triangle falls back to +z", () => {
  const positions = new Float32Array([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const indices = new Uint32Array([0, 1, 2]);
  const normals = new Float32Array(9);
  computeClothNormals(positions, indices, normals);
  for (let i = 0; i < 9; i += 3) {
    assert.equal(normals[i + 2], 1, "fallback +z");
  }
});

test("computeClothNormals all unit length (or fallback +z)", () => {
  const c = createClothMesh({ width: 6, height: 6, spacing: 0.05 });
  for (let i = 0; i < 30; i++) stepCloth(c, { dt: 1 / 60 });
  const g = buildClothGeometry(c);
  updateClothPositions(c, g.positions);
  computeClothNormals(g.positions, g.indices, g.normals);
  for (let i = 0; i < g.normals.length; i += 3) {
    const len = Math.hypot(g.normals[i], g.normals[i + 1], g.normals[i + 2]);
    assert.ok(Math.abs(len - 1) < 1e-6, `normal ${i / 3}: len=${len}`);
  }
});

test("mapAnchorsFromShoulders interpolates pinned row between L and R shoulders", () => {
  const c = createClothMesh({ width: 4, height: 4, spacing: 0.1 });
  const updated = mapAnchorsFromShoulders(
    {
      leftShoulder: { x: -0.5, y: 1, z: 0 },
      rightShoulder: { x: 0.5, y: 1, z: 0 },
    },
    c,
    setAnchor
  );
  assert.equal(updated, 4, "all 4 top-row anchors set");
  // Linear interp at t=0,1/3,2/3,1
  assert.ok(Math.abs(c.particles[0].x - -0.5) < 1e-9);
  assert.ok(Math.abs(c.particles[1].x - (-0.5 + 1/3)) < 1e-9);
  assert.ok(Math.abs(c.particles[2].x - (-0.5 + 2/3)) < 1e-9);
  assert.ok(Math.abs(c.particles[3].x - 0.5) < 1e-9);
});

test("mapAnchorsFromShoulders bails on missing/non-finite landmarks", () => {
  const c = createClothMesh({ width: 4, height: 4, spacing: 0.1 });
  assert.equal(mapAnchorsFromShoulders(null, c, setAnchor), 0);
  assert.equal(mapAnchorsFromShoulders({}, c, setAnchor), 0);
  assert.equal(
    mapAnchorsFromShoulders(
      { leftShoulder: { x: 0, y: 0, z: 0 }, rightShoulder: { x: NaN, y: 0, z: 0 } },
      c,
      setAnchor
    ),
    0
  );
});

test("end-to-end: build → step → update → recompute → no NaN, normals stay unit", () => {
  const c = createClothMesh({ width: 8, height: 12, spacing: 0.05, bend: true });
  const g = buildClothGeometry(c);
  for (let frame = 0; frame < 60; frame++) {
    stepCloth(c, { dt: 1 / 60 });
    updateClothPositions(c, g.positions);
    computeClothNormals(g.positions, g.indices, g.normals);
  }
  for (let i = 0; i < g.positions.length; i++) {
    assert.ok(Number.isFinite(g.positions[i]), `position[${i}] NaN`);
  }
  for (let i = 0; i < g.normals.length; i += 3) {
    const len = Math.hypot(g.normals[i], g.normals[i + 1], g.normals[i + 2]);
    assert.ok(Math.abs(len - 1) < 1e-6 || Math.abs(g.normals[i + 2] - 1) < 1e-6);
  }
});
