// Phase 8.2 — Verlet cloth-sim contract + perf-budget tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createClothMesh, stepCloth, setAnchor } from "../app/mirror/cloth-sim.js";

test("createClothMesh produces W*H particles + grid is centered horizontally", () => {
  const c = createClothMesh({ width: 4, height: 6, spacing: 0.1 });
  assert.equal(c.particles.length, 24);
  // Top-left x = -(width-1)/2 * spacing = -1.5*0.1 = -0.15
  assert.ok(Math.abs(c.particles[0].x - -0.15) < 1e-9);
  // Top-right x = +0.15
  assert.ok(Math.abs(c.particles[3].x - 0.15) < 1e-9);
  // Top row pinned by default
  assert.equal(c.particles[0].pinned, true);
  assert.equal(c.particles[3].pinned, true);
  assert.equal(c.particles[4].pinned, false);
});

test("structural + shear constraints match expected count for 4x6 grid", () => {
  const c = createClothMesh({ width: 4, height: 6, spacing: 0.1 });
  // Structural: (W-1)*H + W*(H-1) = 3*6 + 4*5 = 38
  // Shear:      2*(W-1)*(H-1)     = 2*3*5      = 30
  assert.equal(c.constraints.length, 68);
});

test("bend springs add (W-2)*H + W*(H-2) more constraints when enabled", () => {
  const noBend = createClothMesh({ width: 4, height: 6, spacing: 0.1 });
  const withBend = createClothMesh({ width: 4, height: 6, spacing: 0.1, bend: true });
  // (4-2)*6 + 4*(6-2) = 12 + 16 = 28
  assert.equal(withBend.constraints.length - noBend.constraints.length, 28);
});

test("rest lengths are recorded from initial positions (so step() is at rest at t=0)", () => {
  const c = createClothMesh({ width: 3, height: 3, spacing: 0.2 });
  for (const [a, b, rest] of c.constraints) {
    const pa = c.particles[a], pb = c.particles[b];
    const d = Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z);
    assert.ok(Math.abs(d - rest) < 1e-9, `rest mismatch: ${d} vs ${rest}`);
  }
});

test("pinned particles never move under gravity", () => {
  const c = createClothMesh({ width: 4, height: 4, spacing: 0.1 });
  const top = { ...c.particles[1] };
  for (let i = 0; i < 60; i++) stepCloth(c, { dt: 1 / 60 });
  assert.equal(c.particles[1].x, top.x);
  assert.equal(c.particles[1].y, top.y);
  assert.equal(c.particles[1].z, top.z);
});

test("unpinned particles fall under gravity", () => {
  const c = createClothMesh({ width: 4, height: 4, spacing: 0.1 });
  const bottomLeftIdx = 3 * 4 + 0;
  const before = c.particles[bottomLeftIdx].y;
  for (let i = 0; i < 30; i++) stepCloth(c, { dt: 1 / 60 });
  assert.ok(c.particles[bottomLeftIdx].y < before, `cloth must fall: ${c.particles[bottomLeftIdx].y} < ${before}`);
});

test("cloth doesn't explode (constraints keep distances bounded)", () => {
  const c = createClothMesh({ width: 8, height: 12, spacing: 0.05, bend: true });
  for (let i = 0; i < 120; i++) stepCloth(c, { dt: 1 / 60 });
  for (const [a, b, rest] of c.constraints) {
    const pa = c.particles[a], pb = c.particles[b];
    const d = Math.hypot(pa.x - pb.x, pa.y - pb.y, pa.z - pb.z);
    // 4 constraint iterations + gravity → 50% stretch ceiling is generous
    assert.ok(d < rest * 1.5, `constraint blew up: ${d} vs rest ${rest}`);
    assert.ok(Number.isFinite(pa.x) && Number.isFinite(pa.y), "NaN leaked");
  }
});

test("setAnchor moves only pinned particles + zeroes velocity", () => {
  const c = createClothMesh({ width: 4, height: 4, spacing: 0.1 });
  // Move pinned particle 0
  assert.equal(setAnchor(c, 0, 1, 2, 3), true);
  assert.equal(c.particles[0].x, 1);
  assert.equal(c.particles[0].prevX, 1, "prevX must equal x → zero velocity");
  // Try to move unpinned particle 5 (j=1, i=1)
  assert.equal(setAnchor(c, 5, 9, 9, 9), false);
  assert.notEqual(c.particles[5].x, 9);
});

test("perf budget: 12x16 cloth, 60 steps, 4 iterations runs in <100ms in Node", () => {
  // Realistic body-shirt resolution: 192 particles, ~750 constraints.
  // 60 steps = 1 simulated second of 60fps. Node single-threaded JS ≈ browser
  // worst case (no GPU), so anything <100ms here is safe in production.
  const c = createClothMesh({ width: 12, height: 16, spacing: 0.04, bend: true });
  const t0 = performance.now();
  for (let i = 0; i < 60; i++) stepCloth(c, { dt: 1 / 60 });
  const dt = performance.now() - t0;
  assert.ok(dt < 100, `cloth too slow: ${dt.toFixed(2)}ms for 60 steps (budget 100ms)`);
});

test("anchor-driven cloth: moving anchor drags rest of cloth toward it", () => {
  const c = createClothMesh({ width: 4, height: 6, spacing: 0.1 });
  // Settle at rest
  for (let i = 0; i < 30; i++) stepCloth(c, { dt: 1 / 60, gravity: 0 });
  const bottomMidIdx = 5 * 4 + 1;
  const before = c.particles[bottomMidIdx].x;
  // Move every pinned (top) particle right by 0.5
  for (let i = 0; i < 4; i++) setAnchor(c, i, c.particles[i].x + 0.5, c.particles[i].y, 0);
  for (let i = 0; i < 60; i++) stepCloth(c, { dt: 1 / 60, gravity: 0 });
  assert.ok(c.particles[bottomMidIdx].x > before + 0.3, `cloth must follow anchor: ${c.particles[bottomMidIdx].x} vs ${before + 0.3}`);
});
