#!/usr/bin/env node
// `npm run bench` entry point. Prints summary, exits non-zero on budget violations.
import { bench, checkBudgets, BUDGETS_MS, BENCH_VERSION } from "../app/lib/bench.mjs";

const result = bench({ frames: 600, anchors: 24, seed: 42 });
const violations = checkBudgets(result.summary, BUDGETS_MS);

const fmt = (s) => `p50=${s.p50.toFixed(2)}ms p95=${s.p95.toFixed(2)}ms p99=${s.p99.toFixed(2)}ms max=${s.max.toFixed(2)}ms`;
console.log(`vfit-bench v${BENCH_VERSION}  frames=${result.summary.frames}  anchors=${result.summary.anchors}`);
console.log(`  tracking: ${fmt(result.summary.tracking)}  budget p95<=${BUDGETS_MS.tracking_p95}ms p99<=${BUDGETS_MS.tracking_p99}ms`);
console.log(`  render:   ${fmt(result.summary.render)}  budget p95<=${BUDGETS_MS.render_p95}ms p99<=${BUDGETS_MS.render_p99}ms`);

if (violations.length) {
  console.error("\n❌ BUDGET VIOLATIONS:");
  for (const v of violations) console.error("  - " + v);
  process.exit(1);
}
console.log("\n✅ all budgets met");
