// Phase 7.111 — session quality derivation contract.
import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveSessionQuality,
  SESSION_QUALITY_TIERS,
  SESSION_QUALITY_BANDS,
} from "../app/mirror/session-quality.js";

const summary = (over = {}) => ({
  schemaVersion: 1,
  sessionId: "s_test",
  startedAtMs: 0,
  durationMs: 30_000,
  totalFrames: 900,
  worstAxis: "yaw",
  overallHeldRatio: 0.05,
  perAxis: {
    yaw: { totals: 30, maxHold: 6, heldRatio: 0.05 },
    pitch: { totals: 0, maxHold: 0, heldRatio: 0 },
    roll: { totals: 0, maxHold: 0, heldRatio: 0 },
    depth: { totals: 0, maxHold: 0, heldRatio: 0 },
  },
  ...over,
});

test("tiers are stable + ordered best-to-worst (locked enum)", () => {
  assert.deepEqual([...SESSION_QUALITY_TIERS], ["excellent", "good", "fair", "poor"]);
});

test("bands are frozen (no mutation drift)", () => {
  assert.throws(() => { SESSION_QUALITY_BANDS[0].label = "X"; }, TypeError);
});

test("ratio 0 → excellent (zero held = perfect)", () => {
  const out = deriveSessionQuality({ summary: summary({ overallHeldRatio: 0 }) });
  assert.equal(out?.tier, "excellent");
  assert.equal(out?.tone, "success");
});

test("boundary 0.05 → excellent (inclusive upper)", () => {
  assert.equal(
    deriveSessionQuality({ summary: summary({ overallHeldRatio: 0.05 }) })?.tier,
    "excellent",
  );
});

test("0.05+ε → good", () => {
  assert.equal(
    deriveSessionQuality({ summary: summary({ overallHeldRatio: 0.0500001 }) })?.tier,
    "good",
  );
});

test("boundary 0.15 → good", () => {
  assert.equal(
    deriveSessionQuality({ summary: summary({ overallHeldRatio: 0.15 }) })?.tier,
    "good",
  );
});

test("0.15+ε → fair (warning tone)", () => {
  const out = deriveSessionQuality({ summary: summary({ overallHeldRatio: 0.1500001 }) });
  assert.equal(out?.tier, "fair");
  assert.equal(out?.tone, "warning");
});

test("boundary 0.30 → fair", () => {
  assert.equal(
    deriveSessionQuality({ summary: summary({ overallHeldRatio: 0.30 }) })?.tier,
    "fair",
  );
});

test("0.30+ε → poor (danger tone)", () => {
  const out = deriveSessionQuality({ summary: summary({ overallHeldRatio: 0.3000001 }) });
  assert.equal(out?.tier, "poor");
  assert.equal(out?.tone, "danger");
});

test("ratio 1.0 → poor (worst case)", () => {
  assert.equal(
    deriveSessionQuality({ summary: summary({ overallHeldRatio: 1.0 }) })?.tier,
    "poor",
  );
});

test("invalid input → null (defensive: HUD hides rather than mislead)", () => {
  for (const bad of [null, undefined, "nope", 42, [], {}]) {
    assert.equal(deriveSessionQuality(bad), null);
  }
  assert.equal(deriveSessionQuality({ summary: null }), null);
  assert.equal(deriveSessionQuality({ summary: "x" }), null);
});

test("missing/non-finite overallHeldRatio → null", () => {
  for (const bad of [undefined, null, "0.5", NaN, Infinity, -Infinity]) {
    assert.equal(
      deriveSessionQuality({ summary: summary({ overallHeldRatio: bad }) }),
      null,
    );
  }
});

test("ratio outside [0,1] → null", () => {
  assert.equal(
    deriveSessionQuality({ summary: summary({ overallHeldRatio: -0.01 }) }),
    null,
  );
  assert.equal(
    deriveSessionQuality({ summary: summary({ overallHeldRatio: 1.01 }) }),
    null,
  );
});

test("zero-frame session → null (no data, no grade)", () => {
  assert.equal(
    deriveSessionQuality({ summary: summary({ totalFrames: 0, overallHeldRatio: 0 }) }),
    null,
  );
});

test("non-finite totalFrames → null", () => {
  for (const bad of [NaN, Infinity, "900", null]) {
    assert.equal(
      deriveSessionQuality({ summary: summary({ totalFrames: bad }) }),
      null,
    );
  }
});

test("output preserves the actual ratio (not rounded)", () => {
  const out = deriveSessionQuality({ summary: summary({ overallHeldRatio: 0.123456 }) });
  assert.equal(out?.ratio, 0.123456);
});

test("output is JSON-stringifiable", () => {
  const out = deriveSessionQuality({ summary: summary({ overallHeldRatio: 0.2 }) });
  const round = JSON.parse(JSON.stringify(out));
  assert.deepEqual(round, out);
});

test("all four tiers are reachable (no dead bands)", () => {
  const samples = [0, 0.1, 0.2, 0.5];
  const tiers = samples.map(
    (r) => deriveSessionQuality({ summary: summary({ overallHeldRatio: r }) })?.tier,
  );
  assert.deepEqual(tiers, ["excellent", "good", "fair", "poor"]);
});

test("captions are non-empty strings (UX copy lock)", () => {
  for (const r of [0, 0.1, 0.2, 0.5]) {
    const out = deriveSessionQuality({ summary: summary({ overallHeldRatio: r }) });
    assert.equal(typeof out.caption, "string");
    assert.ok(out.caption.length > 0);
  }
});
