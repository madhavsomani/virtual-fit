// Phase 7.95 — mirror upload-path auto-retry wiring guard (parity with /generate-3d 7.94).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(
  resolve(__dirname, "../app/mirror/page.tsx"),
  "utf8",
);

test("mirror imports planAutoRetry + MAX_AUTO_RETRY_ATTEMPTS from ../lib/auto-retry", () => {
  assert.match(
    SRC,
    /import\s*\{[^}]*planAutoRetry[^}]*MAX_AUTO_RETRY_ATTEMPTS[^}]*\}\s*from\s*["']\.\.\/lib\/auto-retry["']/,
  );
});

test("mirror upload-path catch calls planAutoRetry(human, uploadAttemptsRef.current)", () => {
  const start = SRC.indexOf("imageToGlbPipeline(file");
  assert.ok(start > 0);
  const region = SRC.slice(start, start + 8000);
  assert.match(
    region,
    /planAutoRetry\s*\(\s*human\s*,\s*uploadAttemptsRef\.current\s*\)/,
  );
});

test("mirror schedules auto-retry via setTimeout(..., plan.delayMs)", () => {
  assert.match(SRC, /setTimeout\s*\([^,]+,\s*plan\.delayMs\s*\)/);
});

test("mirror ticks countdown via setInterval (1s tick)", () => {
  // Find the upload-path region specifically — there might be other intervals.
  const start = SRC.indexOf("imageToGlbPipeline(file");
  const region = SRC.slice(start, start + 8000);
  assert.match(region, /setInterval\s*\(\s*[\s\S]{0,500}?,\s*1000\s*\)/);
});

test("mirror status banner renders 'auto-retrying in Ns…' when active", () => {
  assert.match(SRC, /auto-retrying in \$\{remaining\}s/);
});

test("mirror clearUploadRetryTimers exists and is called from multiple sites", () => {
  assert.match(SRC, /const\s+clearUploadRetryTimers\s*=/);
  const calls = SRC.match(/clearUploadRetryTimers\(\)/g) || [];
  assert.ok(calls.length >= 2, `expected >=2 clearUploadRetryTimers() call sites, got ${calls.length}`);
});

test("mirror resets uploadAttemptsRef.current = 0 on success", () => {
  // Right after the success "✨ 3D mesh ready!" status, attempts get cleared.
  assert.match(SRC, /3D mesh ready[\s\S]{0,400}uploadAttemptsRef\.current\s*=\s*0/);
});
