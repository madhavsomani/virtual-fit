// Phase 7.96 — mirror exposes a Cancel button DURING the auto-retry countdown.
// Pre-7.96 the existing Cancel button was gated on `uploading` (set to false
// in the finally block before the countdown starts), so users had no way to
// abort a queued retry once the countdown began.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(resolve(__dirname, "../app/mirror/page.tsx"), "utf8");

test("mirror tracks retryCountdown state (sec, attempt, reason)", () => {
  assert.match(
    SRC,
    /const\s+\[\s*retryCountdown\s*,\s*setRetryCountdown\s*\]\s*=\s*useState/,
  );
});

test("mirror sets retryCountdown when scheduling auto-retry", () => {
  // Inside the if(plan) branch we set initial countdown then update each tick.
  assert.match(
    SRC,
    /setRetryCountdown\s*\(\s*\{\s*sec:\s*remaining\s*,\s*attempt:\s*plan\.attempt\s*,\s*reason:\s*human\.title\s*\}\s*\)/,
  );
});

test("mirror clears retryCountdown=null in clearUploadRetryTimers", () => {
  assert.match(
    SRC,
    /const\s+clearUploadRetryTimers\s*=\s*useCallback\(\s*\(\s*\)\s*=>\s*\{[\s\S]+?setRetryCountdown\s*\(\s*null\s*\)/,
  );
});

test("mirror renders 'Cancel auto-retry (Ns)' button gated on retryCountdown.sec > 0", () => {
  assert.match(
    SRC,
    /!uploading\s*&&\s*retryCountdown\s*&&\s*retryCountdown\.sec\s*>\s*0/,
  );
  assert.match(SRC, /Cancel auto-retry \(\{retryCountdown\.sec\}s\)/);
});

test("mirror Cancel-auto-retry button calls clearUploadRetryTimers + resets attempts", () => {
  // Locate the button block by anchoring on the user-visible label.
  const idx = SRC.indexOf("Cancel auto-retry");
  assert.ok(idx > 0);
  // Walk backwards a bit to find the onClick handler body.
  const region = SRC.slice(Math.max(0, idx - 600), idx);
  assert.match(region, /clearUploadRetryTimers\(\)/);
  assert.match(region, /uploadAttemptsRef\.current\s*=\s*0/);
});
