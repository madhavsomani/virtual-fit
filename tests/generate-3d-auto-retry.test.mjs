// Phase 7.94 — generate-3d auto-retry wiring guard.
// Pre-7.94 the catch block just rendered the humanized error and waited for
// a manual tap. Post-7.94 retryable failures schedule planAutoRetry-driven
// auto-retries with a visible countdown.
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

test("generate-3d imports planAutoRetry + MAX_AUTO_RETRY_ATTEMPTS", () => {
  assert.match(
    SRC,
    /import\s*\{[^}]*planAutoRetry[^}]*MAX_AUTO_RETRY_ATTEMPTS[^}]*\}\s*from\s*["']\.\.\/lib\/auto-retry["']/,
  );
});

test("generate-3d catch block calls planAutoRetry(humanError, attemptsRef.current)", () => {
  assert.match(
    SRC,
    /planAutoRetry\s*\(\s*humanError\s*,\s*attemptsRef\.current\s*\)/,
  );
});

test("generate-3d schedules auto-retry via setTimeout(..., plan.delayMs)", () => {
  assert.match(SRC, /setTimeout\s*\([^,]+,\s*plan\.delayMs\s*\)/);
});

test("generate-3d ticks a countdown via setInterval (1s tick)", () => {
  assert.match(SRC, /setInterval\s*\(\s*[\s\S]{0,500}?,\s*1000\s*\)/);
});

test("generate-3d renders 'Auto-retrying in Ns…' countdown when active", () => {
  assert.match(SRC, /Auto-retrying in\s*\{state\.retryCountdownSec\}s/);
});

test("generate-3d clears retry timers on reset() and on file-select", () => {
  // clearRetryTimers must exist + be called from both reset and handleFileSelect.
  assert.match(SRC, /const\s+clearRetryTimers\s*=/);
  // Two call sites minimum: reset() and handleFileSelect().
  const calls = SRC.match(/clearRetryTimers\(\)/g) || [];
  assert.ok(calls.length >= 2, `expected >=2 clearRetryTimers() call sites, got ${calls.length}`);
});

test("generate-3d resets attemptsRef.current = 0 on success", () => {
  // After the GLB lands successfully and before the success setState.
  assert.match(SRC, /attemptsRef\.current\s*=\s*0[\s\S]{0,400}status:\s*["']done["']/);
});

test("generate-3d 'Cancel auto-retry' button shows when countdown active", () => {
  assert.match(SRC, /Cancel auto-retry/);
});
