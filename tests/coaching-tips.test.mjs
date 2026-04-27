// Phase 7.112 — coaching tips derivation contract.
import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveCoachingTips,
  COACHING_TIP_AXES,
  COACHING_TIP_THRESHOLD,
  COACHING_TIP_MAX,
  COACHING_TIPS,
} from "../app/mirror/coaching-tips.js";

const summary = (over = {}) => ({
  schemaVersion: 1,
  sessionId: "s_test",
  startedAtMs: 0,
  durationMs: 30_000,
  totalFrames: 900,
  worstAxis: "yaw",
  overallHeldRatio: 0.2,
  perAxis: {
    yaw:   { totals: 0, maxHold: 0, heldRatio: 0 },
    pitch: { totals: 0, maxHold: 0, heldRatio: 0 },
    roll:  { totals: 0, maxHold: 0, heldRatio: 0 },
    depth: { totals: 0, maxHold: 0, heldRatio: 0 },
    ...(over.perAxis ?? {}),
  },
  ...over,
});

test("priority order is yaw > depth > pitch > roll (matches 7.102/7.109 chain)", () => {
  assert.deepEqual([...COACHING_TIP_AXES], ["yaw", "depth", "pitch", "roll"]);
});

test("default threshold is 0.10 and max tips is 3 (locked)", () => {
  assert.equal(COACHING_TIP_THRESHOLD, 0.10);
  assert.equal(COACHING_TIP_MAX, 3);
});

test("tip catalog is frozen (no runtime mutation drift)", () => {
  assert.throws(() => { COACHING_TIPS.yaw.title = "X"; }, TypeError);
  assert.throws(() => { COACHING_TIPS.newAxis = {}; }, TypeError);
});

test("invalid input shape → empty array", () => {
  for (const bad of [null, undefined, "x", 42, [], {}]) {
    assert.deepEqual(deriveCoachingTips(bad), []);
  }
  assert.deepEqual(deriveCoachingTips({ summary: null }), []);
  assert.deepEqual(deriveCoachingTips({ summary: { perAxis: null } }), []);
});

test("zero-frame session → empty (no data, no advice)", () => {
  assert.deepEqual(
    deriveCoachingTips({ summary: summary({ totalFrames: 0 }) }),
    [],
  );
});

test("all axes below threshold → empty (don't fabricate problems)", () => {
  const s = summary({
    perAxis: {
      yaw:   { heldRatio: 0.05 },
      pitch: { heldRatio: 0.09 },
      roll:  { heldRatio: 0.0001 },
      depth: { heldRatio: 0.099 },
    },
  });
  assert.deepEqual(deriveCoachingTips({ summary: s }), []);
});

test("single qualifying axis → exactly one tip with correct copy + ratio", () => {
  const s = summary({
    perAxis: { yaw: { heldRatio: 0.4 } },
  });
  const tips = deriveCoachingTips({ summary: s });
  assert.equal(tips.length, 1);
  assert.equal(tips[0].axis, "yaw");
  assert.equal(tips[0].title, COACHING_TIPS.yaw.title);
  assert.equal(tips[0].detail, COACHING_TIPS.yaw.detail);
  assert.equal(tips[0].ratio, 0.4);
});

test("priority chain: yaw, depth, pitch, roll order even when ratios disagree", () => {
  // roll has the highest ratio but yaw must come first by priority rule.
  const s = summary({
    perAxis: {
      yaw:   { heldRatio: 0.11 },
      pitch: { heldRatio: 0.20 },
      roll:  { heldRatio: 0.99 },
      depth: { heldRatio: 0.15 },
    },
  });
  const tips = deriveCoachingTips({ summary: s });
  assert.deepEqual(tips.map((t) => t.axis), ["yaw", "depth", "pitch"]);
  // roll is dropped because we cap at 3.
});

test("cap is exactly maxTips (default 3); 4th qualifying axis is dropped", () => {
  const s = summary({
    perAxis: {
      yaw:   { heldRatio: 0.5 },
      pitch: { heldRatio: 0.5 },
      roll:  { heldRatio: 0.5 },
      depth: { heldRatio: 0.5 },
    },
  });
  const tips = deriveCoachingTips({ summary: s });
  assert.equal(tips.length, 3);
});

test("threshold is configurable", () => {
  const s = summary({ perAxis: { yaw: { heldRatio: 0.07 } } });
  // Default 0.10 → empty.
  assert.equal(deriveCoachingTips({ summary: s }).length, 0);
  // Lower threshold → emits.
  assert.equal(deriveCoachingTips({ summary: s, threshold: 0.05 }).length, 1);
});

test("maxTips is configurable", () => {
  const s = summary({
    perAxis: {
      yaw: { heldRatio: 0.5 }, pitch: { heldRatio: 0.5 },
      roll: { heldRatio: 0.5 }, depth: { heldRatio: 0.5 },
    },
  });
  assert.equal(deriveCoachingTips({ summary: s, maxTips: 1 }).length, 1);
  assert.equal(deriveCoachingTips({ summary: s, maxTips: 4 }).length, 4);
  // maxTips=0 → empty.
  assert.equal(deriveCoachingTips({ summary: s, maxTips: 0 }).length, 0);
});

test("invalid threshold/maxTips fall back to defaults", () => {
  const s = summary({ perAxis: { yaw: { heldRatio: 0.5 } } });
  for (const bad of [-1, NaN, Infinity, "0.5", null, undefined]) {
    const tips = deriveCoachingTips({ summary: s, threshold: bad });
    assert.equal(tips.length, 1, `threshold=${String(bad)} should fall back`);
  }
  for (const bad of [-1, NaN, Infinity, "3", null]) {
    const tips = deriveCoachingTips({ summary: s, maxTips: bad });
    assert.equal(tips.length, 1, `maxTips=${String(bad)} should fall back`);
  }
});

test("non-finite per-axis heldRatio is skipped (not propagated as NaN tip)", () => {
  const s = summary({
    perAxis: {
      yaw:   { heldRatio: NaN },
      depth: { heldRatio: 0.3 },
    },
  });
  const tips = deriveCoachingTips({ summary: s });
  assert.deepEqual(tips.map((t) => t.axis), ["depth"]);
});

test("missing per-axis entry is skipped silently", () => {
  const s = summary({
    perAxis: { yaw: { heldRatio: 0.3 } /* no depth/pitch/roll */ },
  });
  const tips = deriveCoachingTips({ summary: s });
  assert.equal(tips.length, 1);
  assert.equal(tips[0].axis, "yaw");
});

test("output is JSON-stringifiable + each tip has stable shape", () => {
  const s = summary({
    perAxis: { yaw: { heldRatio: 0.2 }, depth: { heldRatio: 0.2 } },
  });
  const tips = deriveCoachingTips({ summary: s });
  const round = JSON.parse(JSON.stringify(tips));
  assert.deepEqual(round, tips);
  for (const t of tips) {
    assert.deepEqual(Object.keys(t).sort(), ["axis", "detail", "ratio", "title"]);
  }
});

test("each tip detail is a non-empty string (UX copy lock)", () => {
  for (const axis of COACHING_TIP_AXES) {
    assert.equal(typeof COACHING_TIPS[axis].title, "string");
    assert.equal(typeof COACHING_TIPS[axis].detail, "string");
    assert.ok(COACHING_TIPS[axis].title.length > 0);
    assert.ok(COACHING_TIPS[axis].detail.length > 0);
  }
});

test("the badge's worstAxis is always the first tip when it qualifies", () => {
  // Real-world contract: if the badge says 'depth was your worst,' the
  // coaching screen's #1 tip MUST be about depth (not yaw).
  // This is enforced indirectly: priority order is the same as the chip
  // priority, and worstAxis in summary 7.104 is derived from per-axis
  // ratios via the same priority. So when depth has the highest ratio
  // and yaw is below threshold, depth comes first.
  const s = summary({
    worstAxis: "depth",
    perAxis: {
      yaw:   { heldRatio: 0.05 },  // below threshold
      depth: { heldRatio: 0.4 },
      pitch: { heldRatio: 0.3 },
    },
  });
  const tips = deriveCoachingTips({ summary: s });
  assert.equal(tips[0].axis, "depth");
});
