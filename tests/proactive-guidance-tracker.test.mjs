// Phase 7.110 — hysteresis/cooldown tracker contract.
import test from "node:test";
import assert from "node:assert/strict";
import {
  createProactiveGuidanceTracker,
  PROACTIVE_GUIDANCE_DEFAULT_COOLDOWN_MS,
} from "../app/mirror/proactive-guidance-tracker.js";

const ZERO = { yaw: 0, pitch: 0, roll: 0, depth: 0 };
const FALSE = { yaw: false, pitch: false, roll: false, depth: false };
const snap = (over = {}) => ({
  totalFrames: 100,
  holds: { ...ZERO },
  maxHold: { ...ZERO },
  totals: { ...ZERO, ...(over.totals ?? {}) },
  held: { ...FALSE, ...(over.held ?? {}) },
});

test("default cooldown is 4s (locked)", () => {
  assert.equal(PROACTIVE_GUIDANCE_DEFAULT_COOLDOWN_MS, 4000);
});

test("first emission passes through unchanged", () => {
  const t = createProactiveGuidanceTracker();
  const out = t.evaluate(snap({ totals: { yaw: 30 } }), 0);
  assert.equal(out?.axis, "yaw");
  assert.equal(out?.severity, "soft");
});

test("steady-state same-axis emission keeps emitting (no cooldown until derivation goes null)", () => {
  const t = createProactiveGuidanceTracker();
  const s = snap({ totals: { yaw: 30 } });
  // Five ticks 200ms apart — the underlying derivation never goes null,
  // so the tracker should keep returning the hint each call.
  for (let i = 0; i < 5; i += 1) {
    const out = t.evaluate(s, i * 200);
    assert.equal(out?.axis, "yaw", `tick ${i} should still emit yaw`);
  }
});

test("when derivation drops to null, tracker starts cooldown and same-axis re-qualification within window is suppressed", () => {
  const t = createProactiveGuidanceTracker({ cooldownMs: 4000 });
  // t=0: emit yaw at 30%.
  assert.equal(t.evaluate(snap({ totals: { yaw: 30 } }), 0)?.axis, "yaw");
  // t=1000: derivation returns null (totals reset to healthy).
  assert.equal(t.evaluate(snap({ totals: { yaw: 0 } }), 1000), null);
  // t=2000: yaw qualifies again. We're 1s into a 4s cooldown → suppress.
  assert.equal(t.evaluate(snap({ totals: { yaw: 30 } }), 2000), null);
  // t=4500: still inside cooldown (until=5000). Suppress.
  assert.equal(t.evaluate(snap({ totals: { yaw: 30 } }), 4500), null);
  // t=5001: cooldown elapsed → re-emit.
  assert.equal(t.evaluate(snap({ totals: { yaw: 30 } }), 5001)?.axis, "yaw");
});

test("a DIFFERENT axis qualifying mid-cooldown emits immediately (different signal)", () => {
  const t = createProactiveGuidanceTracker({ cooldownMs: 4000 });
  assert.equal(t.evaluate(snap({ totals: { yaw: 30 } }), 0)?.axis, "yaw");
  assert.equal(t.evaluate(snap({ totals: { yaw: 0 } }), 1000), null);
  // In cooldown on yaw. Now depth qualifies.
  const out = t.evaluate(snap({ totals: { depth: 30 } }), 2000);
  assert.equal(out?.axis, "depth");
  // After emitting depth, depth is the new lastAxis. Cooldown was cleared.
  // If depth then drops, we cool down on DEPTH, not yaw.
  assert.equal(t.evaluate(snap({ totals: { depth: 0 } }), 3000), null);
  // yaw qualifying now should NOT be suppressed (not the cooldown axis).
  assert.equal(t.evaluate(snap({ totals: { yaw: 30 } }), 4000)?.axis, "yaw");
});

test("brief dip below threshold doesn't immediately re-flash the pill — cooldown debounces", () => {
  // The exact bug 7.110 was created to fix.
  const t = createProactiveGuidanceTracker({ cooldownMs: 4000 });
  // Pill on.
  assert.equal(t.evaluate(snap({ totals: { yaw: 30 } }), 0)?.axis, "yaw");
  // 100ms later: a brief recovery flushes one frame to "fresh."
  assert.equal(t.evaluate(snap({ totals: { yaw: 0 } }), 100), null);
  // 200ms later: yaw bad again (it was always going to be).
  // Without hysteresis the pill flashes back. With hysteresis: suppressed.
  assert.equal(t.evaluate(snap({ totals: { yaw: 30 } }), 200), null);
});

test("evaluate handles non-finite/non-number nowMs as 0 (defensive)", () => {
  const t = createProactiveGuidanceTracker({ cooldownMs: 4000 });
  const s = snap({ totals: { yaw: 30 } });
  // First emission with NaN clock → still emits (lastAxis=null).
  assert.equal(t.evaluate(s, NaN)?.axis, "yaw");
  // Drop to null → start cooldown using 0 as now.
  assert.equal(t.evaluate(snap({ totals: { yaw: 0 } }), Infinity), null);
  // Re-qualify with safe clock 0 (still in cooldown until 4000) → suppress.
  assert.equal(t.evaluate(s, 0), null);
  // After cooldown elapses → emit.
  assert.equal(t.evaluate(s, 5000)?.axis, "yaw");
});

test("reset() clears lastAxis + cooldown so the next evaluate emits fresh", () => {
  const t = createProactiveGuidanceTracker({ cooldownMs: 4000 });
  assert.equal(t.evaluate(snap({ totals: { yaw: 30 } }), 0)?.axis, "yaw");
  assert.equal(t.evaluate(snap({ totals: { yaw: 0 } }), 100), null);
  // Inside cooldown.
  assert.equal(t.evaluate(snap({ totals: { yaw: 30 } }), 200), null);
  t.reset();
  // Reset blew away the cooldown — emits immediately.
  assert.equal(t.evaluate(snap({ totals: { yaw: 30 } }), 300)?.axis, "yaw");
});

test("cooldownMs is configurable; cooldownMs=0 means no debounce (passthrough behavior)", () => {
  const t = createProactiveGuidanceTracker({ cooldownMs: 0 });
  assert.equal(t.evaluate(snap({ totals: { yaw: 30 } }), 0)?.axis, "yaw");
  assert.equal(t.evaluate(snap({ totals: { yaw: 0 } }), 100), null);
  // cooldownMs=0 → cooldownUntil=100. now=101 → 101 < 100 is false → emit.
  assert.equal(t.evaluate(snap({ totals: { yaw: 30 } }), 101)?.axis, "yaw");
});

test("invalid cooldownMs (negative / non-finite / wrong type) falls back to default", () => {
  for (const bad of [-1, NaN, Infinity, "4000", null]) {
    const t = createProactiveGuidanceTracker({ cooldownMs: bad });
    assert.equal(t.evaluate(snap({ totals: { yaw: 30 } }), 0)?.axis, "yaw");
    assert.equal(t.evaluate(snap({ totals: { yaw: 0 } }), 100), null);
    // 1s into a 4s default cooldown → suppress.
    assert.equal(t.evaluate(snap({ totals: { yaw: 30 } }), 1100), null);
    // Past 4s cooldown → emit.
    assert.equal(t.evaluate(snap({ totals: { yaw: 30 } }), 4101)?.axis, "yaw");
  }
});

test("threshold opts pass through to the underlying derivation (warmup, soft, firm)", () => {
  // Lower minFrames so a 10-frame snapshot can qualify.
  const s = { ...snap({ totals: { yaw: 8 } }), totalFrames: 10 };
  // Default: warmup=30 → null even from the tracker.
  const def = createProactiveGuidanceTracker();
  assert.equal(def.evaluate(s, 0), null);
  // Configured: warmup=5 → emits.
  const lo = createProactiveGuidanceTracker({ minFrames: 5 });
  assert.equal(lo.evaluate(s, 0)?.axis, "yaw");
});

test("emitted shape matches the underlying derivation exactly (no axis/label/severity drift)", () => {
  const t = createProactiveGuidanceTracker();
  const out = t.evaluate(snap({ totals: { yaw: 60 } }), 0);
  assert.deepEqual(Object.keys(out).sort(), ["axis", "label", "ratio", "severity"].sort());
  assert.equal(out.severity, "firm");
});
