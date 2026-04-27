// Phase 7.111 — wiring contract for the end-of-session quality badge.
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
const STRIPPED = SRC.replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n")
  .map((l) => l.replace(/\/\/.*$/, ""))
  .join("\n");

test("imports deriveSessionQuality from the dedicated module", () => {
  assert.match(
    STRIPPED,
    /import\s*\{\s*deriveSessionQuality\s*\}\s*from\s*["']\.\/session-quality\.js["']/,
  );
});

test("uses useState typed by ReturnType<typeof deriveSessionQuality>", () => {
  assert.match(
    STRIPPED,
    /useState<\s*\n?\s*ReturnType<typeof\s+deriveSessionQuality>\s*\n?\s*>\(\s*null\s*\)/,
  );
});

test("derivation runs UNGATED — quality is user-facing, not behind ?debugTelemetry", () => {
  // The badge IS the user-facing feedback loop. If it were gated on the
  // debug URL flag, real users would never see it. Verify the
  // deriveSessionQuality call lives OUTSIDE the debugTelemetry gate.
  const callIdx = STRIPPED.indexOf("deriveSessionQuality({ summary }");
  assert.ok(callIdx >= 0, "expected deriveSessionQuality call");
  // Walk back ~600 chars; must NOT see the debugTelemetry params check
  // before we hit a try { boundary.
  const window = STRIPPED.slice(Math.max(0, callIdx - 600), callIdx);
  // Order: try { ... derive ... params.get("debugTelemetry") ... append }
  const debugIdx = window.indexOf('debugTelemetry');
  assert.equal(
    debugIdx,
    -1,
    "deriveSessionQuality must run BEFORE the debugTelemetry gate (it's user-facing, not opt-in)",
  );
});

test("persistence (appendSessionSummary) STAYS gated on ?debugTelemetry=1", () => {
  // The 7.106 opt-in contract for *persistence* must not regress with this
  // wiring change. Quality badge is ungated; storage stays opt-in.
  const appendIdx = STRIPPED.indexOf("appendSessionSummary(summary)");
  assert.ok(appendIdx >= 0);
  const window = STRIPPED.slice(Math.max(0, appendIdx - 400), appendIdx);
  assert.match(window, /params\.get\(["']debugTelemetry["']\)\s*===\s*["']1["']/);
});

test("badge is auto-cleared via setTimeout — no permanent overlay", () => {
  // Without auto-clear the badge would block the camera view forever after
  // a session ends.
  const stIdx = STRIPPED.indexOf("setSessionQuality(quality)");
  assert.ok(stIdx >= 0);
  const window = STRIPPED.slice(stIdx, stIdx + 600);
  assert.match(window, /setTimeout\(\s*\(\)\s*=>\s*\{[\s\S]*?setSessionQuality\(/);
});

test("badge auto-clear uses a stable-identity check (only clear if it's still THIS quality)", () => {
  // If the user starts a new session in <6s and the new session is also
  // graded, the OLD setTimeout would overwrite the new badge if naively
  // implemented. Verify the cleared-only-if-still-this-instance pattern.
  assert.match(
    STRIPPED,
    /setSessionQuality\(\s*\(prev\)\s*=>\s*\(?\s*prev\s*===\s*quality\s*\?\s*null\s*:\s*prev/,
  );
});

test("badge is cleared on session START (no stale grade across sessions)", () => {
  // Find the session-start block via sessionStartedAtRef = Date.now() and
  // verify setSessionQuality(null) is in the same block.
  const startIdx = STRIPPED.indexOf("sessionStartedAtRef.current = Date.now()");
  assert.ok(startIdx >= 0);
  const window = STRIPPED.slice(startIdx, startIdx + 400);
  assert.match(window, /setSessionQuality\(\s*null\s*\)/);
});

test("renders <div> with data-testid=session-quality-badge AND data-tier AND data-tone", () => {
  assert.match(STRIPPED, /data-testid="session-quality-badge"/);
  assert.match(STRIPPED, /data-tier=\{sessionQuality\.tier\}/);
  assert.match(STRIPPED, /data-tone=\{sessionQuality\.tone\}/);
});

test("badge has pointerEvents:'none' (must not block underlying Start button)", () => {
  const idx = STRIPPED.indexOf('data-testid="session-quality-badge"');
  assert.ok(idx >= 0);
  const window = STRIPPED.slice(idx, idx + 1500);
  assert.match(window, /pointerEvents\s*:\s*["']none["']/);
});

test("UX copy comes from derived state (label + caption); page MUST NOT inline tier strings", () => {
  // {sessionQuality.label} and {sessionQuality.caption} must appear; canonical
  // tier labels and captions live in session-quality.js. If the page inlines
  // them, a future copy change would drift across two files.
  assert.match(STRIPPED, /\{sessionQuality\.label\}/);
  assert.match(STRIPPED, /\{sessionQuality\.caption\}/);
  assert.doesNotMatch(STRIPPED, /Smooth tracking the whole session/);
  assert.doesNotMatch(STRIPPED, /Mostly steady — minor catches/);
  assert.doesNotMatch(STRIPPED, /Some lag — try better lighting/);
  assert.doesNotMatch(STRIPPED, /Frequent holds — try moving closer/);
});

test("exactly ONE deriveSessionQuality call site (no copy-paste drift)", () => {
  const calls = STRIPPED.match(/deriveSessionQuality\(/g) ?? [];
  assert.equal(calls.length, 1, `expected 1 call, got ${calls.length}`);
});
