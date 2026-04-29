#!/usr/bin/env node
// `npm run stress` — 5-session concurrent stress test on the host machine.
import { stressTest, checkStressBudgets, STRESS_BUDGETS_MS, STRESS_VERSION } from "../app/lib/stress.mjs";

const result = stressTest({ sessions: 5, framesPerSession: 240, anchors: 24, seed: 42 });
const violations = checkStressBudgets(result, STRESS_BUDGETS_MS);

const fmt = (s) => `p50=${s.p50.toFixed(2)}ms p95=${s.p95.toFixed(2)}ms p99=${s.p99.toFixed(2)}ms`;
console.log(`vfit-stress v${STRESS_VERSION}  sessions=${result.sessions}  frames/session=${result.framesPerSession}  anchors=${result.anchors}`);
console.log(`  wall=${result.wallMs.toFixed(1)}ms  aggregate=${result.aggregateFps.toFixed(1)} fps  bottleneck=${result.bottleneck} (p95 ${result.bottleneckP95Ms.toFixed(2)}ms)`);
for (const s of result.perSession) {
  console.log(`  ${s.id}: tracking ${fmt(s.tracking)}  render ${fmt(s.render)}`);
}
if (violations.length) {
  console.error("\n❌ STRESS BUDGET VIOLATIONS:");
  for (const v of violations) console.error("  - " + v);
  process.exit(1);
}
console.log("\n✅ all stress budgets met");
