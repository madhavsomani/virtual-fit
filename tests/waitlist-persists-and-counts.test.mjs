// Phase 7.40 — guard: api/waitlist/index.js must (a) require fs, (b)
// declare logPath, (c) actually call fs.appendFileSync before the
// milestone-webhook block.
//
// Pre-7.40 the milestone block at the bottom of the function did
// `fs.readFileSync(logPath, ...)` with neither symbol defined, so every
// real signup hit a swallowed ReferenceError and the milestone webhook
// never fired. The /api/waitlist-stats endpoint reads the same logPath
// to compute `count`, `recentSignups`, etc., but no one was appending —
// so the "live retailer count" used on /retailer/signup was a permanent
// zero.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const WAITLIST = resolve(ROOT, "api/waitlist/index.js");
const STATS = resolve(ROOT, "api/waitlist-stats/index.js");

function strip(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
}

test("waitlist endpoint requires fs", () => {
  const src = strip(readFileSync(WAITLIST, "utf8"));
  assert.match(
    src,
    /require\(\s*['"]fs['"]\s*\)/,
    "api/waitlist/index.js must require('fs') — the milestone block calls fs.readFileSync.",
  );
});

test("waitlist endpoint and stats endpoint share the same logPath constant value", () => {
  const wsrc = strip(readFileSync(WAITLIST, "utf8"));
  const ssrc = strip(readFileSync(STATS, "utf8"));
  // Extract the logPath value from each. Both must point at the same file.
  const wMatch = wsrc.match(/logPath\s*=\s*['"]([^'"]+)['"]/);
  const sMatch = ssrc.match(/logPath\s*=\s*['"]([^'"]+)['"]/);
  assert.ok(wMatch, "waitlist endpoint must declare a logPath constant.");
  assert.ok(sMatch, "stats endpoint must declare a logPath constant.");
  assert.equal(
    wMatch[1],
    sMatch[1],
    `waitlist (${wMatch[1]}) and stats (${sMatch[1]}) must read/write the SAME file or the count is permanently zero.`,
  );
});

test("waitlist endpoint appends to the JSONL log before the milestone block", () => {
  const src = strip(readFileSync(WAITLIST, "utf8"));
  // Both must exist.
  const appendIdx = src.search(/fs\.appendFileSync\s*\(\s*logPath/);
  const milestoneIdx = src.indexOf("MILESTONE_WEBHOOK_URL");
  assert.ok(
    appendIdx > 0,
    "waitlist endpoint must call fs.appendFileSync(logPath, ...) — without it /api/waitlist-stats stays at zero.",
  );
  assert.ok(milestoneIdx > 0, "expected milestone webhook block (MILESTONE_WEBHOOK_URL) to still exist.");
  assert.ok(
    appendIdx < milestoneIdx,
    "fs.appendFileSync must run BEFORE the milestone block so the count includes the just-arrived entry.",
  );
});
