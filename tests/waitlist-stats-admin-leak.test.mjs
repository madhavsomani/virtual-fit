// Phase 7.82 — guard: /api/waitlist-stats admin path PII leak fix.
//
// Pre-7.82 the admin auth had two stacked leaks:
//   (1) `process.env.ADMIN_KEY || 'vfit-admin-2026'` — if env var
//       unset, the literal 'vfit-admin-2026' (which lives in this
//       open-source repo) became a valid key.
//   (2) `if (key !== adminKey && key !== 'admin')` — the literal
//       string 'admin' was a hardcoded backdoor. Visiting
//       /api/waitlist-stats?key=admin returned full PII for every
//       real waitlist signup: email, revenue intent, killer feature,
//       timestamp, the last 10 entries verbatim.
//
// This test exercises the actual handler with a JSONL fixture written
// to /tmp and asserts:
//   - ?key=admin (the old backdoor) returns 401 — NEVER 200 with PII.
//   - The hardcoded fallback 'vfit-admin-2026' is NEVER accepted.
//   - With ADMIN_KEY unset, every key returns 503 (misconfigured).
//   - With ADMIN_KEY set, only the correct key returns 200 + PII.
//   - The public-no-key path still returns ONLY {retailers} (Phase 7.63).

import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const HANDLER_PATH = resolve(__dirname, "..", "api", "waitlist-stats", "index.js");
const LOG_PATH = "/tmp/virtualfit-waitlist.jsonl";

// JSONL fixture — 2 real retailer signups (PII), 1 test, 1 telemetry.
const FIXTURE = [
  { email: "alice@shop.com", revenue: "yes-monthly", wouldPay: "49", killerFeature: "rotation tracking", source: "retailer-signup", timestamp: new Date().toISOString() },
  { email: "bob@store.io", revenue: "yes-yearly", wouldPay: "490", killerFeature: "no install", source: "website", timestamp: new Date().toISOString() },
  { email: "test+e2e@example.com", isTest: true, source: "e2e-test", timestamp: new Date().toISOString() },
  { email: "event@retailer-x", source: "embed-widget", revenue: "widget_opened", timestamp: new Date().toISOString() },
].map(JSON.stringify).join("\n") + "\n";

function writeFixture() {
  writeFileSync(LOG_PATH, FIXTURE);
}
function clearFixture() {
  try { if (existsSync(LOG_PATH)) unlinkSync(LOG_PATH); } catch {}
}

function makeContext() {
  const logs = [];
  const log = Object.assign((...a) => logs.push(["log", a.join(" ")]), {
    info: (...a) => logs.push(["info", a.join(" ")]),
    warn: (...a) => logs.push(["warn", a.join(" ")]),
    error: (...a) => logs.push(["error", a.join(" ")]),
  });
  return { log, res: null, _logs: logs };
}
function makeReq(query) {
  return { method: "GET", query: query || {}, headers: {} };
}

function freshHandler() {
  delete require.cache[HANDLER_PATH];
  return require(HANDLER_PATH);
}

test("?key=admin (old backdoor) returns 401 — NEVER PII", async () => {
  writeFixture();
  process.env.ADMIN_KEY = "real-secret-2026-rotated";
  try {
    const handler = freshHandler();
    const ctx = makeContext();
    await handler(ctx, makeReq({ key: "admin" }));
    assert.equal(ctx.res.status, 401, "?key=admin must NOT auth");
    assert.equal(
      JSON.stringify(ctx.res.body || {}).includes("alice@shop.com"),
      false,
      "401 body must NOT leak any PII",
    );
  } finally {
    delete process.env.ADMIN_KEY;
    clearFixture();
  }
});

test("hardcoded fallback 'vfit-admin-2026' is NOT accepted (env=unset → 503)", async () => {
  writeFixture();
  delete process.env.ADMIN_KEY;
  try {
    const handler = freshHandler();
    const ctx = makeContext();
    await handler(ctx, makeReq({ key: "vfit-admin-2026" }));
    assert.equal(
      ctx.res.status,
      503,
      "with ADMIN_KEY unset, even the old fallback string must return 503 (misconfigured), not 200",
    );
    assert.equal(
      JSON.stringify(ctx.res.body || {}).includes("alice@shop.com"),
      false,
      "503 body must NOT leak any PII",
    );
    // Operator visibility: 503 path must log an error so a missing
    // env var shows up in App Insights instead of silently failing.
    assert.ok(
      ctx._logs.some(
        ([lvl, msg]) =>
          lvl === "error" && String(msg).includes("ADMIN_KEY"),
      ),
      "must emit an error log naming ADMIN_KEY when the env var is missing",
    );
  } finally {
    clearFixture();
  }
});

test("hardcoded fallback 'vfit-admin-2026' is NOT accepted (env=set to OTHER value → 401)", async () => {
  writeFixture();
  process.env.ADMIN_KEY = "real-secret-2026-rotated";
  try {
    const handler = freshHandler();
    const ctx = makeContext();
    await handler(ctx, makeReq({ key: "vfit-admin-2026" }));
    assert.equal(ctx.res.status, 401, "old hardcoded fallback must not auth when env is the new key");
  } finally {
    delete process.env.ADMIN_KEY;
    clearFixture();
  }
});

test("correct ADMIN_KEY returns 200 + full PII payload", async () => {
  writeFixture();
  process.env.ADMIN_KEY = "real-secret-2026-rotated";
  try {
    const handler = freshHandler();
    const ctx = makeContext();
    await handler(ctx, makeReq({ key: "real-secret-2026-rotated" }));
    assert.equal(ctx.res.status, 200);
    const body = ctx.res.body;
    assert.equal(body.count, 2, "must count 2 real signups (alice + bob)");
    assert.equal(body.testCount, 2, "must count 2 non-real (1 isTest + 1 embed-widget)");
    const recentEmails = (body.recentSignups || []).map((s) => s.email);
    assert.ok(recentEmails.includes("alice@shop.com"));
    assert.ok(recentEmails.includes("bob@store.io"));
    assert.ok(body.wtpBreakdown && body.wtpBreakdown["49"] === 1);
  } finally {
    delete process.env.ADMIN_KEY;
    clearFixture();
  }
});

test("wrong key returns 401 (not 200, not 503)", async () => {
  writeFixture();
  process.env.ADMIN_KEY = "real-secret-2026-rotated";
  try {
    const handler = freshHandler();
    const ctx = makeContext();
    await handler(ctx, makeReq({ key: "totally-wrong-guess" }));
    assert.equal(ctx.res.status, 401);
  } finally {
    delete process.env.ADMIN_KEY;
    clearFixture();
  }
});

test("public no-key path STILL returns ONLY {retailers} (Phase 7.63 preserved)", async () => {
  writeFixture();
  process.env.ADMIN_KEY = "real-secret-2026-rotated";
  try {
    const handler = freshHandler();
    const ctx = makeContext();
    await handler(ctx, makeReq({})); // no key
    assert.equal(ctx.res.status, 200);
    const body = ctx.res.body;
    assert.deepEqual(
      Object.keys(body).sort(),
      ["retailers"],
      "public path must expose ONLY {retailers} — no count/recentSignups/wtpBreakdown leak",
    );
    assert.equal(body.retailers, 1, "must count 1 retailer-signup (alice)");
  } finally {
    delete process.env.ADMIN_KEY;
    clearFixture();
  }
});

test("source files contain neither the hardcoded fallback nor the 'admin' literal as auth gate", () => {
  const src = require("node:fs").readFileSync(HANDLER_PATH, "utf8");
  // Strip line comments + block comments before scanning so the
  // teaching-reference quotes of the old vulnerable code in the
  // header don't trigger the regression detector. We're checking
  // the EXECUTABLE code, not the prose.
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
  // Catch a future agent who reintroduces the env-var fallback.
  assert.doesNotMatch(
    code,
    /process\.env\.ADMIN_KEY\s*\|\|\s*['"]/,
    "executable code must NOT have a hardcoded fallback for ADMIN_KEY (regression catch)",
  );
  // Catch a future agent who reintroduces the 'admin' literal as an
  // OR-fallback for the auth check.
  assert.doesNotMatch(
    code,
    /key\s*!==\s*['"]admin['"]/,
    "executable code must NOT compare key against the literal 'admin' as an auth gate",
  );
});
