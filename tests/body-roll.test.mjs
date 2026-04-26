// Phase 7.98 — computeBodyRoll strict-null contract.
// Closes the third Euler-axis lurking lie: pre-7.98 mirror computed roll
// inline as Math.atan2(rs.y - ls.y, |rs.x - ls.x|), which silently
// fabricated tiltAngle=0 ("perfectly upright") whenever both shoulders
// snapped to (0,0) sentinel coordinates or visibility tanked.
import test from "node:test";
import assert from "node:assert/strict";
import { computeBodyRoll } from "../app/mirror/body-metrics.js";

test("returns roll radians from a clean upright pose (≈0)", () => {
  const r = computeBodyRoll({
    leftShoulder:  { x: 0.4, y: 0.5, visibility: 0.9 },
    rightShoulder: { x: 0.6, y: 0.5, visibility: 0.9 },
  });
  assert.ok(r !== null);
  assert.ok(Math.abs(r) < 1e-6, `expected ~0, got ${r}`);
});

test("returns positive roll when right shoulder is lower", () => {
  // dy > 0 with dx > 0 → atan2 returns positive angle.
  const r = computeBodyRoll({
    leftShoulder:  { x: 0.4, y: 0.5,  visibility: 0.9 },
    rightShoulder: { x: 0.6, y: 0.55, visibility: 0.9 },
  });
  assert.ok(r !== null && r > 0);
});

test("returns negative roll when right shoulder is higher", () => {
  const r = computeBodyRoll({
    leftShoulder:  { x: 0.4, y: 0.55, visibility: 0.9 },
    rightShoulder: { x: 0.6, y: 0.5,  visibility: 0.9 },
  });
  assert.ok(r !== null && r < 0);
});

test("returns null when either shoulder missing", () => {
  assert.equal(computeBodyRoll({ leftShoulder: null, rightShoulder: { x: 0.5, y: 0.5 } }), null);
  assert.equal(computeBodyRoll({ leftShoulder: { x: 0.5, y: 0.5 }, rightShoulder: null }), null);
  assert.equal(computeBodyRoll({}), null);
});

test("returns null when shoulder visibility below threshold (default 0.4)", () => {
  // The pre-7.98 inline call would compute a real-looking roll here;
  // strict-null says "don't trust low-vis frames".
  const r = computeBodyRoll({
    leftShoulder:  { x: 0.4, y: 0.5, visibility: 0.2 },
    rightShoulder: { x: 0.6, y: 0.5, visibility: 0.9 },
  });
  assert.equal(r, null);
});

test("returns null when both shoulders snap to (0,0) MediaPipe sentinel", () => {
  // The exact failure mode that fabricated tiltAngle=0 pre-7.98:
  // both shoulders at origin → dx=0 → atan2(0,0)=0 → "perfectly upright".
  const r = computeBodyRoll({
    leftShoulder:  { x: 0, y: 0, visibility: 0.9 },
    rightShoulder: { x: 0, y: 0, visibility: 0.9 },
  });
  assert.equal(r, null);
});

test("returns null on degenerate horizontal spacing (|dx| < 1e-6)", () => {
  // atan2(dy, ~0) returns ±π/2 from numerical noise — NOT a real
  // near-vertical body roll. Strict-null protects the smoother.
  const r = computeBodyRoll({
    leftShoulder:  { x: 0.5,            y: 0.4, visibility: 0.9 },
    rightShoulder: { x: 0.5 + 1e-9,     y: 0.6, visibility: 0.9 },
  });
  assert.equal(r, null);
});

test("returns null on non-finite x or y", () => {
  assert.equal(
    computeBodyRoll({
      leftShoulder:  { x: NaN, y: 0.5, visibility: 0.9 },
      rightShoulder: { x: 0.6, y: 0.5, visibility: 0.9 },
    }),
    null,
  );
  assert.equal(
    computeBodyRoll({
      leftShoulder:  { x: 0.4, y: 0.5,      visibility: 0.9 },
      rightShoulder: { x: 0.6, y: Infinity, visibility: 0.9 },
    }),
    null,
  );
});

test("treats missing visibility as fully visible (back-compat)", () => {
  // Only ls.visibility set; rs.visibility defaults to 1 if undefined.
  const r = computeBodyRoll({
    leftShoulder:  { x: 0.4, y: 0.5, visibility: 0.9 },
    rightShoulder: { x: 0.6, y: 0.5 },
  });
  assert.ok(r !== null);
});

test("custom minVisibility threshold honored", () => {
  // 0.5 visibility is below a 0.7 threshold.
  const r = computeBodyRoll({
    leftShoulder:  { x: 0.4, y: 0.5, visibility: 0.5 },
    rightShoulder: { x: 0.6, y: 0.5, visibility: 0.5 },
    minVisibility: 0.7,
  });
  assert.equal(r, null);
});
