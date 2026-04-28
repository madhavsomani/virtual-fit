// Phase 8.1 — landmark-smoother contract tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createLandmarkSmoother } from "../app/mirror/landmark-smoother.js";

function lm(x, y, z = 0, visibility = 1) {
  return { x, y, z, visibility };
}

test("first frame passes through verbatim (no origin bias)", () => {
  const s = createLandmarkSmoother({ alpha: 0.5 });
  const input = [lm(0.7, 0.8, -0.1, 0.95), lm(0.3, 0.4, 0.05, 0.9)];
  const out = s.smooth(input);
  assert.equal(out[0].x, 0.7);
  assert.equal(out[0].y, 0.8);
  assert.equal(out[0].z, -0.1);
  assert.equal(out[0].visibility, 0.95);
  assert.equal(out[1].x, 0.3);
});

test("second frame EMA-blends toward new value", () => {
  const s = createLandmarkSmoother({ alpha: 0.5, visAlpha: 1.0 });
  s.smooth([lm(0.0, 0.0, 0.0, 1)]);
  const out = s.smooth([lm(1.0, 1.0, 1.0, 1)]);
  // alpha=0.5 → exactly halfway
  assert.equal(out[0].x, 0.5);
  assert.equal(out[0].y, 0.5);
  assert.equal(out[0].z, 0.5);
});

test("converges to steady value over many frames", () => {
  const s = createLandmarkSmoother({ alpha: 0.5 });
  s.smooth([lm(0.0, 0.0)]);
  let last;
  for (let i = 0; i < 30; i++) last = s.smooth([lm(1.0, 1.0)]);
  assert.ok(Math.abs(last[0].x - 1.0) < 1e-6, `x converged: ${last[0].x}`);
  assert.ok(Math.abs(last[0].y - 1.0) < 1e-6);
});

test("reset() forgets history → next frame is verbatim again", () => {
  const s = createLandmarkSmoother({ alpha: 0.5 });
  s.smooth([lm(0.0, 0.0)]);
  s.reset();
  const out = s.smooth([lm(1.0, 1.0)]);
  assert.equal(out[0].x, 1.0);
  assert.equal(out[0].y, 1.0);
});

test("non-array input passes through unchanged", () => {
  const s = createLandmarkSmoother();
  assert.equal(s.smooth(null), null);
  assert.equal(s.smooth(undefined), undefined);
  assert.deepEqual(s.smooth([]), []);
});

test("visibility uses stiffer alpha (reacts faster than position)", () => {
  const s = createLandmarkSmoother({ alpha: 0.3, visAlpha: 0.9 });
  s.smooth([lm(0.5, 0.5, 0, 1.0)]);
  const out = s.smooth([lm(0.5, 0.5, 0, 0.0)]);
  // visAlpha=0.9 → smoothed visibility = 1 + (0-1)*0.9 = 0.1
  assert.ok(Math.abs(out[0].visibility - 0.1) < 1e-9, `vis=${out[0].visibility}`);
});

test("missing landmark fields don't poison output", () => {
  const s = createLandmarkSmoother({ alpha: 0.5 });
  s.smooth([lm(0.5, 0.5, 0.1, 0.9)]);
  const out = s.smooth([{ x: 0.6 }]); // y/z/visibility absent
  assert.equal(out[0].x, 0.55); // smoothed
  // Other fields shouldn't be fabricated as numbers
  assert.equal(out[0].y, undefined);
  assert.equal(out[0].z, undefined);
  assert.equal(out[0].visibility, undefined);
});

test("non-finite incoming values pass through (no NaN propagation)", () => {
  const s = createLandmarkSmoother({ alpha: 0.5 });
  s.smooth([lm(0.5, 0.5)]);
  const out = s.smooth([lm(NaN, 0.7)]);
  assert.ok(!Number.isFinite(out[0].x));
  assert.equal(out[0].y, 0.6); // 0.5 + (0.7-0.5)*0.5
});

test("invalid alpha falls back to default", () => {
  // alpha <= 0 → invalid; >1 → clamp to 1 (passthrough)
  const sNeg = createLandmarkSmoother({ alpha: -1 });
  sNeg.smooth([lm(0.0, 0.0)]);
  const outNeg = sNeg.smooth([lm(1.0, 1.0)]);
  // Should not be 0 (which would happen if alpha negative was honored)
  assert.ok(outNeg[0].x > 0);

  const sBig = createLandmarkSmoother({ alpha: 5 });
  sBig.smooth([lm(0.0, 0.0)]);
  const outBig = sBig.smooth([lm(1.0, 1.0)]);
  assert.equal(outBig[0].x, 1.0); // alpha=1 → no smoothing
});

test("33 landmarks (full MediaPipe pose) all smoothed independently", () => {
  const s = createLandmarkSmoother({ alpha: 0.5, visAlpha: 1.0 });
  const frame1 = Array.from({ length: 33 }, (_, i) => lm(i / 33, i / 33, 0, 1));
  const frame2 = Array.from({ length: 33 }, (_, i) => lm((i / 33) + 0.1, i / 33, 0, 1));
  s.smooth(frame1);
  const out = s.smooth(frame2);
  assert.equal(out.length, 33);
  for (let i = 0; i < 33; i++) {
    const expectedX = (i / 33) + 0.05; // halfway between i/33 and i/33+0.1
    assert.ok(Math.abs(out[i].x - expectedX) < 1e-9, `idx ${i}: ${out[i].x} vs ${expectedX}`);
  }
});

test("smoother does not mutate input landmarks", () => {
  const s = createLandmarkSmoother({ alpha: 0.5 });
  const input = [lm(0.5, 0.5)];
  s.smooth(input);
  const input2 = [lm(0.7, 0.8)];
  const before = { ...input2[0] };
  s.smooth(input2);
  assert.deepEqual(input2[0], before, "input frame must not be mutated");
});
