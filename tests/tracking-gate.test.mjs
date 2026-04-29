import { test } from "node:test";
import assert from "node:assert/strict";

import { createTrackingGate } from "../lib/tracking-gate.ts";

test("starts in searching phase", () => {
  const g = createTrackingGate();
  assert.equal(g.push(false), "searching");
});

test("locks after N=3 consecutive valid frames (default)", () => {
  const g = createTrackingGate();
  assert.equal(g.push(true), "searching");
  assert.equal(g.push(true), "searching");
  assert.equal(g.push(true), "locked");
});

test("single invalid frame does NOT unlock when streak < unlockFrames", () => {
  const g = createTrackingGate();
  g.push(true);
  g.push(true);
  g.push(true); // locked
  assert.equal(g.push(false), "locked"); // 1 bad frame
  assert.equal(g.push(true), "locked"); // recovered
});

test("unlocks after N=5 consecutive invalid frames", () => {
  const g = createTrackingGate();
  for (let i = 0; i < 3; i += 1) g.push(true);
  for (let i = 0; i < 4; i += 1) {
    assert.equal(g.push(false), "locked");
  }
  assert.equal(g.push(false), "searching");
});

test("re-locking requires fresh streak after unlock", () => {
  const g = createTrackingGate();
  for (let i = 0; i < 3; i += 1) g.push(true);
  for (let i = 0; i < 5; i += 1) g.push(false); // unlocked
  assert.equal(g.push(true), "searching");
  assert.equal(g.push(true), "searching");
  assert.equal(g.push(true), "locked");
});

test("custom thresholds honored; reset clears state", () => {
  const g = createTrackingGate({ lockFrames: 1, unlockFrames: 2 });
  assert.equal(g.push(true), "locked");
  assert.equal(g.push(false), "locked");
  assert.equal(g.push(false), "searching");
  g.reset();
  assert.equal(g.push(false), "searching");
  assert.equal(g.push(true), "locked");
});

test("invalid options fall back to defaults", () => {
  const g = createTrackingGate({ lockFrames: -5, unlockFrames: 0 });
  // both invalid → default 3 / 5
  assert.equal(g.push(true), "searching");
  assert.equal(g.push(true), "searching");
  assert.equal(g.push(true), "locked");
  // unlockFrames default 5
  for (let i = 0; i < 4; i += 1) assert.equal(g.push(false), "locked");
  assert.equal(g.push(false), "searching");
});
