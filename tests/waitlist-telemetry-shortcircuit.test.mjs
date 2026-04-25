// Phase 7.66 — guard: telemetry events from the embed widget
// (source='embed-widget') must short-circuit early in /api/waitlist
// and NOT flow through the real-signup pipeline (no JSONL append,
// no formsubmit email, no milestone webhook scan).
//
// Pre-7.66 every widget_opened / widget_closed / garment_changed /
// add_to_cart / try_on_product POST silently:
//   - appended to /tmp/virtualfit-waitlist.jsonl (unbounded growth)
//   - emailed madhavsomani007@gmail.com via formsubmit (inbox flood)
//   - re-read the entire JSONL to re-evaluate milestones
// All on a hot path triggered by retailer button clicks.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const WAITLIST = readFileSync(
  resolve(__dirname, "..", "api/waitlist/index.js"),
  "utf8",
);

test("api/waitlist short-circuits embed-widget telemetry before JSONL append", () => {
  // Find the short-circuit branch.
  const branchIdx = WAITLIST.indexOf("entry.source === 'embed-widget'");
  assert.ok(
    branchIdx > -1,
    "/api/waitlist must branch on entry.source === 'embed-widget' to short-circuit telemetry",
  );
  // The JSONL append must come AFTER the branch (which returns), so the
  // branch's `return` short-circuits before any append could run.
  const appendIdx = WAITLIST.search(/^\s*fs\.appendFileSync\(logPath/m);
  assert.ok(appendIdx > -1, "JSONL append must still exist for real signups");
  assert.ok(
    branchIdx < appendIdx,
    "embed-widget branch must come BEFORE the JSONL append (so telemetry never appends)",
  );
  // The branch body must contain `return` to short-circuit.
  const branchBody = WAITLIST.slice(branchIdx, branchIdx + 600);
  assert.match(
    branchBody,
    /return\s*;/,
    "embed-widget branch must `return` to short-circuit the rest of the handler",
  );
});

test("embed-widget short-circuit returns 200 (so the widget doesn't retry)", () => {
  const branchIdx = WAITLIST.indexOf("entry.source === 'embed-widget'");
  const branchBody = WAITLIST.slice(branchIdx, branchIdx + 600);
  assert.match(
    branchBody,
    /status:\s*200/,
    "telemetry branch must return status 200 so the embed widget doesn't retry on failure",
  );
  // Body must not falsely claim a real signup happened.
  assert.match(
    branchBody,
    /telemetry:\s*true/,
    "telemetry branch body should mark the response as telemetry (not a real signup) — prevents downstream code from treating it as a lead",
  );
});

test("embed-widget short-circuit happens BEFORE formsubmit email send (Madhav's inbox protection)", () => {
  const branchIdx = WAITLIST.indexOf("entry.source === 'embed-widget'");
  const formSubmitIdx = WAITLIST.indexOf("https://formsubmit.co/ajax");
  assert.ok(formSubmitIdx > -1, "formsubmit email send must still exist for real signups");
  assert.ok(
    branchIdx < formSubmitIdx,
    "embed-widget branch must come BEFORE the formsubmit fetch — pre-7.66 every widget_opened spammed Madhav's inbox",
  );
});

test("embed-widget short-circuit happens BEFORE milestone webhook scan (hot-path file read protection)", () => {
  const branchIdx = WAITLIST.indexOf("entry.source === 'embed-widget'");
  const webhookIdx = WAITLIST.indexOf("process.env.MILESTONE_WEBHOOK_URL");
  assert.ok(webhookIdx > -1, "milestone webhook code must still exist for real signups");
  assert.ok(
    branchIdx < webhookIdx,
    "embed-widget branch must come BEFORE the milestone webhook block — pre-7.66 every widget click triggered a full JSONL re-read",
  );
});

test("real-signup pipeline is intact (regression hammer)", () => {
  // Prove we didn't accidentally short-circuit non-telemetry traffic.
  // The handler must still: append to JSONL, formsubmit, milestone-scan.
  assert.match(WAITLIST, /fs\.appendFileSync\(logPath/, "real signup must still append to JSONL");
  assert.match(WAITLIST, /formsubmit\.co/, "real signup must still send formsubmit notification");
  assert.match(WAITLIST, /MILESTONE_WEBHOOK_URL/, "real signup must still evaluate milestone webhook");
});
