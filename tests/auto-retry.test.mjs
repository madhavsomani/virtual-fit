// Phase 7.94 — planAutoRetry policy unit tests.
import test from "node:test";
import assert from "node:assert/strict";
import { planAutoRetry, MAX_AUTO_RETRY_ATTEMPTS } from "../app/lib/auto-retry.ts";

const he = (title, retryable = true) => ({
  title,
  body: "x",
  action: "x",
  retryable,
  details: "raw",
});

test("non-retryable error → null (no auto-retry, manual action required)", () => {
  assert.equal(planAutoRetry(he("Photo too large", false), 0), null);
  assert.equal(planAutoRetry(he("3D service not configured", false), 0), null);
  assert.equal(planAutoRetry(he("Couldn't isolate the garment", false), 0), null);
});

test("Cancelled never auto-retries (user explicitly aborted)", () => {
  assert.equal(planAutoRetry(he("Cancelled", true), 0), null);
});

test("null/undefined humanError → null", () => {
  assert.equal(planAutoRetry(null, 0), null);
  assert.equal(planAutoRetry(undefined, 0), null);
});

test("after MAX attempts → null (give up, show manual Try Again)", () => {
  assert.equal(planAutoRetry(he("Network problem"), MAX_AUTO_RETRY_ATTEMPTS), null);
  assert.equal(planAutoRetry(he("Network problem"), MAX_AUTO_RETRY_ATTEMPTS + 1), null);
});

test("MAX_AUTO_RETRY_ATTEMPTS = 3 (locked: more than 3 hammers a down service)", () => {
  assert.equal(MAX_AUTO_RETRY_ATTEMPTS, 3);
});

test("TRELLIS queue_full backoff ladder: 30s, 60s, 120s (queue drains slowly)", () => {
  const t = "TRELLIS is busy right now";
  assert.equal(planAutoRetry(he(t), 0)?.delayMs, 30_000);
  assert.equal(planAutoRetry(he(t), 1)?.delayMs, 60_000);
  assert.equal(planAutoRetry(he(t), 2)?.delayMs, 120_000);
});

test("TRELLIS hit-a-snag backoff: 10s, 20s, 40s (transient server)", () => {
  const t = "TRELLIS hit a snag";
  assert.equal(planAutoRetry(he(t), 0)?.delayMs, 10_000);
  assert.equal(planAutoRetry(he(t), 1)?.delayMs, 20_000);
  assert.equal(planAutoRetry(he(t), 2)?.delayMs, 40_000);
});

test("3D generation stalled backoff: 15s, 30s, 60s (timeout, give it space)", () => {
  const t = "3D generation stalled";
  assert.equal(planAutoRetry(he(t), 0)?.delayMs, 15_000);
  assert.equal(planAutoRetry(he(t), 1)?.delayMs, 30_000);
  assert.equal(planAutoRetry(he(t), 2)?.delayMs, 60_000);
});

test("Network problem backoff: 5s, 10s, 20s (likely flap, retry fast)", () => {
  const t = "Network problem";
  assert.equal(planAutoRetry(he(t), 0)?.delayMs, 5_000);
  assert.equal(planAutoRetry(he(t), 1)?.delayMs, 10_000);
  assert.equal(planAutoRetry(he(t), 2)?.delayMs, 20_000);
});

test("Unknown retryable title → default ladder (10s, 20s, 40s)", () => {
  const t = "Something went wrong";
  assert.equal(planAutoRetry(he(t), 0)?.delayMs, 10_000);
  assert.equal(planAutoRetry(he(t), 1)?.delayMs, 20_000);
  assert.equal(planAutoRetry(he(t), 2)?.delayMs, 40_000);
});

test("attempt is 1-indexed: 0 attempts already → attempt=1", () => {
  const p = planAutoRetry(he("Network problem"), 0);
  assert.equal(p?.attempt, 1);
});

test("attempt count progresses: 1 → 2 → 3", () => {
  const t = "Network problem";
  assert.equal(planAutoRetry(he(t), 0)?.attempt, 1);
  assert.equal(planAutoRetry(he(t), 1)?.attempt, 2);
  assert.equal(planAutoRetry(he(t), 2)?.attempt, 3);
});

test("plan.reason is the humanError.title (drives countdown UI label)", () => {
  const t = "TRELLIS is busy right now";
  assert.equal(planAutoRetry(he(t), 0)?.reason, t);
});

test("output shape always has delayMs, attempt, reason for retryable cases", () => {
  const p = planAutoRetry(he("Network problem"), 0);
  assert.ok(p);
  assert.equal(typeof p.delayMs, "number");
  assert.equal(typeof p.attempt, "number");
  assert.equal(typeof p.reason, "string");
  assert.ok(p.delayMs > 0);
});
