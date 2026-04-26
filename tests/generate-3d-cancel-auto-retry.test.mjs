// Phase 7.97 — /generate-3d gets a dedicated red Cancel button during countdown
// (parity with mirror 7.96). Pre-7.97 the same gray button toggled between
// "Try Again" and "Cancel auto-retry"; the dual-purpose label hid the
// affordance and reset() incorrectly cleared the preview when the user
// just wanted to stop waiting.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(
  resolve(__dirname, "../app/generate-3d/page.tsx"),
  "utf8",
);

test("generate-3d defines a dedicated cancelAutoRetry handler (not reset)", () => {
  assert.match(SRC, /const\s+cancelAutoRetry\s*=\s*\(\s*\)\s*=>\s*\{/);
});

test("cancelAutoRetry clears timers + resets attemptsRef + drops countdown fields", () => {
  const idx = SRC.indexOf("const cancelAutoRetry");
  const region = SRC.slice(idx, idx + 600);
  assert.match(region, /clearRetryTimers\(\)/);
  assert.match(region, /attemptsRef\.current\s*=\s*0/);
  assert.match(region, /retryCountdownSec:\s*undefined/);
});

test("error UI renders a dedicated red Cancel button while countdown is active", () => {
  // Red background = #ef4444 (parity with mirror).
  assert.match(SRC, /background:\s*["']#ef4444["']/);
  assert.match(SRC, /\u2715 Cancel auto-retry \(\{state\.retryCountdownSec\}s\)/);
});

test("error UI cancel button calls cancelAutoRetry (not reset)", () => {
  const idx = SRC.indexOf("Cancel auto-retry ({state.retryCountdownSec}s)");
  assert.ok(idx > 0, "Cancel auto-retry button should exist");
  const region = SRC.slice(Math.max(0, idx - 600), idx);
  assert.match(region, /onClick=\{cancelAutoRetry\}/);
});

test("Try Again / Pick a different photo button is shown only when countdown is inactive", () => {
  // The conditional gate guarantees the gray button is the else-branch.
  assert.match(
    SRC,
    /state\.retryCountdownSec\s*!==\s*undefined\s*&&\s*state\.retryCountdownSec\s*>\s*0\s*\?[\s\S]+?:\s*\([\s\S]+?onClick=\{reset\}/,
  );
});
