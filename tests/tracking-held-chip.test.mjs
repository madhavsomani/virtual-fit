// Phase 7.102 — tracking-held-chip derivation contract.
import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveTrackingHeldChip,
  TRACKING_HELD_AXIS_LABELS,
  TRACKING_HELD_AXIS_PRIORITY,
} from "../app/mirror/tracking-held-chip.js";
import { createTrackingTelemetry } from "../app/mirror/tracking-telemetry.js";

const ZERO_HOLDS = { yaw: 0, pitch: 0, roll: 0, depth: 0 };
const snap = (holds, extra = {}) => ({
  totalFrames: 100,
  holds: { ...ZERO_HOLDS, ...holds },
  maxHold: { ...ZERO_HOLDS, ...holds },
  totals: { ...ZERO_HOLDS, ...holds },
  held: {
    yaw: (holds.yaw ?? 0) > 0,
    pitch: (holds.pitch ?? 0) > 0,
    roll: (holds.roll ?? 0) > 0,
    depth: (holds.depth ?? 0) > 0,
  },
  ...extra,
});

test("returns null when no snapshot is provided", () => {
  assert.equal(deriveTrackingHeldChip({}), null);
  assert.equal(deriveTrackingHeldChip({ snapshot: null }), null);
  assert.equal(deriveTrackingHeldChip(undefined), null);
});

test("returns null when no axis exceeds threshold", () => {
  assert.equal(deriveTrackingHeldChip({ snapshot: snap({}) }), null);
  // Just BELOW the default 6-frame threshold.
  assert.equal(deriveTrackingHeldChip({ snapshot: snap({ yaw: 5 }) }), null);
});

test("triggers exactly at the default threshold (6 frames)", () => {
  const chip = deriveTrackingHeldChip({ snapshot: snap({ yaw: 6 }) });
  assert.ok(chip);
  assert.equal(chip.visible, true);
  assert.equal(chip.primaryAxis, "yaw");
  assert.deepEqual(chip.axes, ["yaw"]);
  assert.equal(chip.since, 6);
  assert.equal(chip.label, TRACKING_HELD_AXIS_LABELS.yaw);
});

test("custom thresholdFrames honored", () => {
  // 3-frame threshold = 50ms at 60fps; useful for E2E or aggressive cues.
  const chip = deriveTrackingHeldChip({
    snapshot: snap({ pitch: 4 }),
    thresholdFrames: 3,
  });
  assert.ok(chip);
  assert.equal(chip.primaryAxis, "pitch");
});

test("ignores non-finite or fractional thresholdFrames safely", () => {
  // Falls back to default 6.
  assert.equal(deriveTrackingHeldChip({ snapshot: snap({ yaw: 5 }), thresholdFrames: NaN }), null);
  assert.ok(deriveTrackingHeldChip({ snapshot: snap({ yaw: 6 }), thresholdFrames: NaN }));
  // Floors fractions.
  assert.ok(deriveTrackingHeldChip({ snapshot: snap({ yaw: 4 }), thresholdFrames: 4.9 }));
});

test("priority order: yaw > depth > pitch > roll for primaryAxis", () => {
  // All four held above threshold simultaneously.
  const all = snap({ yaw: 10, pitch: 12, roll: 14, depth: 8 });
  const chip = deriveTrackingHeldChip({ snapshot: all });
  assert.ok(chip);
  assert.equal(chip.primaryAxis, "yaw");
  assert.deepEqual(chip.axes, ["yaw", "depth", "pitch", "roll"]);
  assert.deepEqual(TRACKING_HELD_AXIS_PRIORITY, ["yaw", "depth", "pitch", "roll"]);
});

test("axes list excludes axes below threshold even when others are held", () => {
  const chip = deriveTrackingHeldChip({
    snapshot: snap({ yaw: 10, pitch: 5, roll: 8, depth: 0 }),
  });
  assert.ok(chip);
  // pitch=5 < 6 threshold, depth=0; only yaw + roll surface.
  assert.deepEqual(chip.axes, ["yaw", "roll"]);
  assert.equal(chip.primaryAxis, "yaw");
});

test("since = SHORTEST hold among visible axes (conservative claim)", () => {
  const chip = deriveTrackingHeldChip({
    snapshot: snap({ yaw: 30, pitch: 6, roll: 18 }),
  });
  assert.ok(chip);
  assert.equal(chip.since, 6, "must reflect newest held axis, not longest");
});

test("each axis has a human-readable label (no missing entries)", () => {
  for (const axis of TRACKING_HELD_AXIS_PRIORITY) {
    assert.equal(typeof TRACKING_HELD_AXIS_LABELS[axis], "string");
    assert.ok(TRACKING_HELD_AXIS_LABELS[axis].length > 0);
  }
});

test("integrates with createTrackingTelemetry — chip appears after threshold null frames", () => {
  const t = createTrackingTelemetry();
  // 5 null pitch frames → no chip yet.
  for (let i = 0; i < 5; i += 1) {
    t.recordFrame({ yaw: 0, pitch: null, roll: 0, depth: 1 });
  }
  assert.equal(deriveTrackingHeldChip({ snapshot: t.snapshot() }), null);
  // 6th null frame → chip on.
  t.recordFrame({ yaw: 0, pitch: null, roll: 0, depth: 1 });
  const chip = deriveTrackingHeldChip({ snapshot: t.snapshot() });
  assert.ok(chip);
  assert.equal(chip.primaryAxis, "pitch");
  assert.equal(chip.since, 6);
  // One fresh pitch frame → chip off again (current streak = 0).
  t.recordFrame({ yaw: 0, pitch: 0.1, roll: 0, depth: 1 });
  assert.equal(deriveTrackingHeldChip({ snapshot: t.snapshot() }), null);
});
