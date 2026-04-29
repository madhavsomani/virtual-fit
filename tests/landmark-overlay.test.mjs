import { test } from "node:test";
import assert from "node:assert/strict";

import { buildOverlayPoints, visibleEdges, OVERLAY_LANDMARKS } from "../lib/landmark-overlay.ts";

function landmarks(overrides) {
  const arr = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 1 }));
  for (const [i, v] of Object.entries(overrides)) {
    arr[Number(i)] = { ...arr[Number(i)], ...v };
  }
  return arr;
}

test("null landmarks → empty array", () => {
  assert.deepEqual(buildOverlayPoints(null), []);
  assert.deepEqual(buildOverlayPoints([]), []);
});

test("returns one point per relevant landmark when all visible", () => {
  const out = buildOverlayPoints(landmarks({}));
  assert.equal(out.length, OVERLAY_LANDMARKS.length);
});

test("low-visibility landmarks are dropped", () => {
  const out = buildOverlayPoints(
    landmarks({
      11: { visibility: 0.05 },
      12: { visibility: 0.9 }
    })
  );
  assert.ok(out.find((p) => p.id === 12));
  assert.equal(out.find((p) => p.id === 11), undefined);
});

test("mirrorX flips x-coords", () => {
  const ls = landmarks({ 11: { x: 0.3 } });
  const a = buildOverlayPoints(ls);
  const b = buildOverlayPoints(ls, { mirrorX: true });
  const ax = a.find((p) => p.id === 11).x;
  const bx = b.find((p) => p.id === 11).x;
  assert.ok(Math.abs(ax + bx - 1) < 1e-9);
});

test("visibleEdges only returns edges whose endpoints are in points", () => {
  // Hide left arm (11/13/15) — edges referencing them should drop.
  const out = buildOverlayPoints(
    landmarks({
      11: { visibility: 0 },
      13: { visibility: 0 },
      15: { visibility: 0 }
    })
  );
  const edges = visibleEdges(out);
  for (const e of edges) {
    assert.notEqual(e.from, 11);
    assert.notEqual(e.to, 11);
    assert.notEqual(e.from, 13);
    assert.notEqual(e.to, 13);
  }
  // Should still have hip line (23↔24).
  assert.ok(edges.find((e) => e.from === 23 && e.to === 24));
});

test("non-finite coords are skipped", () => {
  const out = buildOverlayPoints(landmarks({ 11: { x: NaN } }));
  assert.equal(out.find((p) => p.id === 11), undefined);
});
