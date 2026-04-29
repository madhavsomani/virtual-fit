// Phase 8.20 — wrap-doc guard test.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const REPO = resolve(ROOT, "..");
const DOC = resolve(REPO, "docs/phase-8-wrap.md");
const PLAN = resolve(REPO, "PLAN.md");
const README = resolve(ROOT, "README.md");

test("docs/phase-8-wrap.md exists", () => {
  assert.ok(existsSync(DOC), "docs/phase-8-wrap.md must exist");
});

test("wrap doc covers every shipped P8.x item by id", () => {
  const md = readFileSync(DOC, "utf8");
  const plan = readFileSync(PLAN, "utf8");
  // Find every P8.N marker in PLAN that is checked done.
  const shipped = new Set();
  for (const m of plan.matchAll(/^- \[x\] \*\*(P8\.\d+)\*\*/gm)) {
    shipped.add(m[1]);
  }
  assert.ok(shipped.size >= 19, `expected >=19 shipped P8.x items, found ${shipped.size}`);
  for (const id of shipped) {
    if (id === "P8.20") continue; // wrap doc itself
    assert.ok(md.includes(id), `wrap doc must mention ${id}`);
  }
});

test("wrap doc includes ZERO10 parity table + 80% threshold", () => {
  const md = readFileSync(DOC, "utf8");
  assert.match(md, /ZERO10/);
  assert.match(md, /\bparity\b/i);
  assert.match(md, /80%/);
  // Visual side-by-side QA section must be present so Madhav has a runbook.
  assert.match(md, /side-by-side/i);
});

test("wrap doc cites real perf numbers from bench + stress", () => {
  const md = readFileSync(DOC, "utf8");
  assert.match(md, /npm run bench/);
  assert.match(md, /npm run stress/);
  // Must reference the budgets so a reader can verify against the harnesses.
  assert.match(md, /50ms/);
  assert.match(md, /100ms/);
  // Must call out the bottleneck so Phase 9 perf work has a starting point.
  assert.match(md, /[Bb]ottleneck/);
});

test("README links to the wrap doc + bench + stress + hardware docs", () => {
  const md = readFileSync(README, "utf8");
  assert.match(md, /phase-8-wrap/);
  assert.match(md, /hardware-kit/);
  assert.match(md, /npm run bench/);
  assert.match(md, /npm run stress/);
});

test("wrap doc files Phase 9 candidates without polluting PLAN.md", () => {
  const md = readFileSync(DOC, "utf8");
  const plan = readFileSync(PLAN, "utf8");
  // Phase 9 ideas live in the wrap doc only; PLAN is the live ship log.
  assert.match(md, /Phase 9/);
  // Must be at least 3 candidates so Madhav has real triage choices.
  const phase9Ids = (md.match(/VF-1[1-9]/g) || []);
  assert.ok(phase9Ids.length >= 3, `expected >=3 Phase 9 VF candidates, found ${phase9Ids.length}`);
  // PLAN.md must NOT have promoted any of them yet.
  for (const id of new Set(phase9Ids)) {
    assert.ok(!plan.includes(`**${id}**`), `${id} should not be in PLAN.md until Madhav signs off`);
  }
});

test("VISION GUARD: wrap doc never references 2D fallbacks / paid APIs / Tailscale URLs in client", () => {
  const md = readFileSync(DOC, "utf8");
  // 2D fallbacks must be explicitly rejected, not advertised.
  assert.ok(!/2D garment fallback (renders|works|enabled)/i.test(md));
  // Paid APIs absent.
  assert.ok(!/openai\.com|cohere\.ai|anthropic\.com|replicate\.com/i.test(md));
  // Tailscale must only appear in the "what we did NOT ship" framing,
  // never as a recommended client-code config.
  if (/tailscale|ts\.net/i.test(md)) {
    assert.match(md, /not ship|back-office|wall(s)? off/i);
  }
});
