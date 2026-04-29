// Phase 8.18 — bench harness tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  bench,
  checkBudgets,
  percentile,
  trackingStep,
  renderStep,
  BUDGETS_MS,
  BENCH_VERSION,
} from "../app/lib/bench.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("BUDGETS_MS frozen + matches PLAN.md targets (50/100ms)", () => {
  assert.ok(Object.isFrozen(BUDGETS_MS));
  assert.equal(BUDGETS_MS.tracking_p95, 50);
  assert.equal(BUDGETS_MS.render_p95, 100);
  assert.match(BENCH_VERSION, /^\d+\.\d+\.\d+$/);
});

test("percentile: p0/p50/p95/p100 on a known set", () => {
  const xs = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
  assert.equal(percentile(xs, 0), 10);
  assert.equal(percentile(xs, 50), 50);
  assert.equal(percentile(xs, 95), 100);
  assert.equal(percentile(xs, 100), 100);
});

test("percentile: rejects empty + out-of-range p", () => {
  assert.throws(() => percentile([], 50), /empty samples/);
  assert.throws(() => percentile([1], -1), /out of range/);
  assert.throws(() => percentile([1], 101), /out of range/);
});

test("trackingStep: alpha=1 returns observation; alpha=0 returns prev", () => {
  const prev = [[0, 0, 0], [1, 1, 1]];
  const obs = [[10, 20, 30], [40, 50, 60]];
  assert.deepEqual(trackingStep(prev, obs, 1), obs);
  assert.deepEqual(trackingStep(prev, obs, 0.0001).map((p) => p.map((v) => Math.round(v * 1000) / 1000)),
    [[0.001, 0.002, 0.003], [1.004, 1.005, 1.006]]);
});

test("trackingStep: rejects mismatched shapes", () => {
  assert.throws(() => trackingStep([[0, 0, 0]], [[0, 0, 0], [1, 1, 1]]), /length mismatch/);
});

test("renderStep: stable with deterministic anchors", () => {
  const kp = [[1, 2, 3], [4, 5, 6]];
  const anchors = [{ id: "a0", boneIndex: 0, matrix: new Array(16).fill(1) }];
  const out = renderStep(kp, anchors);
  assert.equal(out.length, 1);
  assert.equal(out[0].id, "a0");
  assert.ok(typeof out[0].value === "number");
});

test("bench: deterministic with injected synthetic clock (seed reproducible)", () => {
  // Inject a fake monotonically-increasing clock so the bench has zero
  // wall-clock noise — every sample is exactly 1ms apart.
  let t = 0;
  const now = () => (t += 1);
  const r = bench({ frames: 50, anchors: 8, seed: 7, now });
  assert.equal(r.samples.tracking.length, 50);
  assert.equal(r.samples.render.length, 50);
  // With our +1ms clock between each performance.now() call, every
  // span is exactly 1ms.
  assert.equal(r.summary.tracking.p95, 1);
  assert.equal(r.summary.render.p95, 1);
});

test("checkBudgets: returns empty when all percentiles within budget", () => {
  const summary = {
    tracking: { p50: 1, p95: 5, p99: 10, max: 12 },
    render: { p50: 5, p95: 50, p99: 80, max: 90 },
  };
  assert.deepEqual(checkBudgets(summary), []);
});

test("checkBudgets: surfaces tracking + render violations distinctly", () => {
  const summary = {
    tracking: { p50: 1, p95: 999, p99: 999, max: 999 },
    render: { p50: 5, p95: 999, p99: 999, max: 999 },
  };
  const v = checkBudgets(summary);
  assert.equal(v.length, 4);
  assert.ok(v.some((s) => s.startsWith("tracking.p95")));
  assert.ok(v.some((s) => s.startsWith("tracking.p99")));
  assert.ok(v.some((s) => s.startsWith("render.p95")));
  assert.ok(v.some((s) => s.startsWith("render.p99")));
});

test("real-world bench (300 frames, 24 anchors): meets shipped budgets on this machine", () => {
  // This is the exact configuration `npm run bench` ships. Pure JS
  // workload should clear our 50/100 ms budgets by orders of magnitude
  // on any modern Node host; if it doesn't, something genuinely
  // regressed in the hot path.
  const r = bench({ frames: 300, anchors: 24, seed: 42 });
  const v = checkBudgets(r.summary, BUDGETS_MS);
  assert.equal(v.length, 0, `bench violated budgets: ${v.join(", ")}`);
  // Sanity: in pure JS this should be sub-ms even at p99.
  assert.ok(r.summary.tracking.p99 < 5, `tracking.p99 ${r.summary.tracking.p99}ms; pure JS should be sub-ms`);
});

test("npm run bench script exists + delegates to scripts/bench.mjs", () => {
  const pkg = JSON.parse(readFileSync(resolve(ROOT, "package.json"), "utf8"));
  assert.equal(pkg.scripts.bench, "node scripts/bench.mjs");
  assert.ok(existsSync(resolve(ROOT, "scripts/bench.mjs")), "scripts/bench.mjs must exist");
});

test("VISION GUARD: bench module never references 2D / paid APIs / Tailscale", () => {
  const src = readFileSync(resolve(ROOT, "app/lib/bench.mjs"), "utf8");
  assert.ok(!/2d-overlay|garmentTexture/i.test(src));
  assert.ok(!/openai\.com|cohere\.ai|anthropic\.com|replicate\.com/i.test(src));
  assert.ok(!/ts\.net|tailscale/i.test(src));
});
