// Phase 7.109 — proactive guidance derivation contract.
import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveProactiveGuidance,
  PROACTIVE_GUIDANCE_AXES,
  PROACTIVE_GUIDANCE_LABELS,
} from "../app/mirror/proactive-guidance.js";

const ZERO = { yaw: 0, pitch: 0, roll: 0, depth: 0 };
const FALSE = { yaw: false, pitch: false, roll: false, depth: false };

const snap = (over = {}) => ({
  totalFrames: 100,
  holds: { ...ZERO },
  maxHold: { ...ZERO },
  totals: { ...ZERO, ...(over.totals ?? {}) },
  held: { ...FALSE, ...(over.held ?? {}) },
});

test("priority order is yaw > depth > pitch > roll (matches 7.102 chip ordering)", () => {
  assert.deepEqual([...PROACTIVE_GUIDANCE_AXES], ["yaw", "depth", "pitch", "roll"]);
});

test("labels are stable strings (UX copy lock)", () => {
  assert.equal(PROACTIVE_GUIDANCE_LABELS.yaw,   "Try to face the camera");
  assert.equal(PROACTIVE_GUIDANCE_LABELS.depth, "Try moving closer to the camera");
  assert.equal(PROACTIVE_GUIDANCE_LABELS.pitch, "Try standing a bit straighter");
  assert.equal(PROACTIVE_GUIDANCE_LABELS.roll,  "Try keeping your shoulders level");
});

test("invalid snapshot → null (defensive)", () => {
  for (const bad of [null, undefined, "nope", 42, []]) {
    assert.equal(deriveProactiveGuidance({ snapshot: bad }), null);
  }
});

test("missing totalFrames or non-finite → null", () => {
  assert.equal(deriveProactiveGuidance({ snapshot: { totals: ZERO, held: FALSE } }), null);
  const s1 = snap(); s1.totalFrames = NaN;
  assert.equal(deriveProactiveGuidance({ snapshot: s1 }), null);
  const s2 = snap(); s2.totalFrames = Infinity;
  assert.equal(deriveProactiveGuidance({ snapshot: s2 }), null);
});

test("warmup: under minFrames (default 30) returns null even if ratio looks bad", () => {
  const s = snap({ totals: { yaw: 8 } });
  s.totalFrames = 10;
  assert.equal(deriveProactiveGuidance({ snapshot: s }), null);
});

test("warmup is configurable via minFrames", () => {
  const s = snap({ totals: { yaw: 8 } });
  s.totalFrames = 10;
  const hint = deriveProactiveGuidance({ snapshot: s, minFrames: 5 });
  assert.equal(hint?.axis, "yaw");
});

test("ratio below softThreshold → null", () => {
  const s = snap({ totals: { yaw: 20 } });
  assert.equal(deriveProactiveGuidance({ snapshot: s }), null);
});

test("ratio in [softThreshold, firmThreshold) → severity 'soft'", () => {
  const s = snap({ totals: { yaw: 30 } });
  const hint = deriveProactiveGuidance({ snapshot: s });
  assert.equal(hint?.axis, "yaw");
  assert.equal(hint?.severity, "soft");
  assert.equal(hint?.label, PROACTIVE_GUIDANCE_LABELS.yaw);
  assert.ok(Math.abs(hint.ratio - 0.3) < 1e-9);
});

test("ratio >= firmThreshold → severity 'firm'", () => {
  const s = snap({ totals: { yaw: 60 } });
  const hint = deriveProactiveGuidance({ snapshot: s });
  assert.equal(hint?.severity, "firm");
});

test("priority: yaw beats depth beats pitch beats roll when multiple axes qualify", () => {
  const s = snap({ totals: { yaw: 40, depth: 40, pitch: 40, roll: 40 } });
  assert.equal(deriveProactiveGuidance({ snapshot: s })?.axis, "yaw");

  const s2 = snap({ totals: { yaw: 0, depth: 40, pitch: 40, roll: 40 } });
  assert.equal(deriveProactiveGuidance({ snapshot: s2 })?.axis, "depth");

  const s3 = snap({ totals: { pitch: 40, roll: 40 } });
  assert.equal(deriveProactiveGuidance({ snapshot: s3 })?.axis, "pitch");

  const s4 = snap({ totals: { roll: 40 } });
  assert.equal(deriveProactiveGuidance({ snapshot: s4 })?.axis, "roll");
});

test("defers to the per-frame chip: when held[axis]=true, that axis is skipped", () => {
  const s = snap({
    totals: { yaw: 60, depth: 40 },
    held: { yaw: true },
  });
  const hint = deriveProactiveGuidance({ snapshot: s });
  assert.equal(hint?.axis, "depth");
});

test("if EVERY qualifying axis is currently held, returns null (chip owns the surface)", () => {
  const s = snap({
    totals: { yaw: 60, depth: 60, pitch: 60, roll: 60 },
    held: { yaw: true, pitch: true, roll: true, depth: true },
  });
  assert.equal(deriveProactiveGuidance({ snapshot: s }), null);
});

test("non-finite totals[axis] is skipped, not propagated", () => {
  const s = snap({ totals: { yaw: NaN, depth: 40 } });
  const hint = deriveProactiveGuidance({ snapshot: s });
  assert.equal(hint?.axis, "depth");
});

test("zero totals across the board → null (healthy session)", () => {
  const s = snap({ totals: ZERO });
  assert.equal(deriveProactiveGuidance({ snapshot: s }), null);
});

test("thresholds are configurable", () => {
  const s = snap({ totals: { yaw: 15 } });
  assert.equal(deriveProactiveGuidance({ snapshot: s }), null);
  const hint = deriveProactiveGuidance({ snapshot: s, softThreshold: 0.1, firmThreshold: 0.5 });
  assert.equal(hint?.severity, "soft");
  const hint2 = deriveProactiveGuidance({ snapshot: s, softThreshold: 0.1, firmThreshold: 0.12 });
  assert.equal(hint2?.severity, "firm");
});

test("output is JSON-stringifiable (matches every other observability layer)", () => {
  const s = snap({ totals: { depth: 40 } });
  const hint = deriveProactiveGuidance({ snapshot: s });
  const round = JSON.parse(JSON.stringify(hint));
  assert.deepEqual(round, hint);
});
