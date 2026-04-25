// Phase 7.81 — guard: /api/waitlist must NOT send a formsubmit.co email
// for entries where isTest is true (or source is 'e2e-test'/'telemetry').
//
// Pre-7.81 the `isTest` flag was computed but unused at the email-send
// site, so every Playwright/E2E run flooded madhavsomani007@gmail.com
// with "🎯 VirtualFit Waitlist: e2e+...@example.com" notifications.
// Same inbox-flooding class as the Phase 7.66 telemetry leak (which
// closed the embed-widget side; this closes the test-traffic side).
//
// Strategy: stub global.fetch, invoke the handler with three payloads
// (real, isTest:true, source:'e2e-test'), assert fetch was called for
// the real entry only AND that the formsubmit URL never appears in
// recorded calls for the test entries. Telemetry entries
// (source:'embed-widget') already short-circuit before email send via
// Phase 7.66 — we re-assert that here too so a future refactor that
// re-orders the gates can't quietly regress.

import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Resolve the handler path. The handler is a CommonJS Azure Function
// at app/api/waitlist/index.js — load it with require so we get the
// real module-evaluated handler (not a transpiled copy).
const HANDLER_PATH = resolve(
  __dirname,
  "..",
  "api",
  "waitlist",
  "index.js",
);

// Minimal Azure Functions context shim. The real ctx exposes
// context.log + context.log.info/warn/error and context.res. The
// handler only writes to context.res and reads context.log.*.
function makeContext() {
  const logs = [];
  const log = Object.assign(
    (...args) => logs.push(["log", args.join(" ")]),
    {
      info: (...args) => logs.push(["info", args.join(" ")]),
      warn: (...args) => logs.push(["warn", args.join(" ")]),
      error: (...args) => logs.push(["error", args.join(" ")]),
    },
  );
  const ctx = { log, res: null, _logs: logs };
  return ctx;
}

function makeReq(body) {
  return {
    method: "POST",
    headers: { "user-agent": "test-runner" },
    body,
  };
}

// Stub global.fetch + capture every call. Restore after.
function withFetchStub(fn) {
  const calls = [];
  const orig = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    calls.push({ url: String(url), opts });
    return {
      ok: true,
      status: 200,
      json: async () => ({}),
      text: async () => "",
    };
  };
  return Promise.resolve(fn(calls)).finally(() => {
    globalThis.fetch = orig;
  });
}

test("real signup (no isTest, no special source) DOES send formsubmit email", async () => {
  // Clear require cache so each test loads a fresh handler instance.
  delete require.cache[HANDLER_PATH];
  const handler = require(HANDLER_PATH);
  await withFetchStub(async (calls) => {
    const ctx = makeContext();
    await handler(
      ctx,
      makeReq({
        email: "real-user@example.com",
        revenue: "yes-monthly",
        wouldPay: "49",
        source: "website",
      }),
    );
    const formsubmitCalls = calls.filter((c) =>
      c.url.includes("formsubmit.co"),
    );
    assert.equal(
      formsubmitCalls.length,
      1,
      "real signup must trigger exactly one formsubmit.co email",
    );
    assert.match(
      formsubmitCalls[0].url,
      /madhavsomani007@gmail\.com/,
      "formsubmit URL must address Madhav's inbox",
    );
    assert.equal(ctx.res.status, 200);
  });
});

test("isTest:true signup does NOT send formsubmit email", async () => {
  delete require.cache[HANDLER_PATH];
  const handler = require(HANDLER_PATH);
  await withFetchStub(async (calls) => {
    const ctx = makeContext();
    await handler(
      ctx,
      makeReq({
        email: "e2e+isTest@example.com",
        source: "website",
        isTest: true,
      }),
    );
    const formsubmitCalls = calls.filter((c) =>
      c.url.includes("formsubmit.co"),
    );
    assert.equal(
      formsubmitCalls.length,
      0,
      "isTest:true must skip formsubmit.co email send",
    );
    assert.equal(ctx.res.status, 200, "test entry still returns 200 success");
    // The skip log line must fire so we can grep production logs to
    // confirm the gate is working.
    const skipLog = ctx._logs.find(([_lvl, msg]) =>
      String(msg).includes("Skipped formsubmit email for test entry"),
    );
    assert.ok(
      skipLog,
      "must emit a 'Skipped formsubmit email for test entry' info log",
    );
  });
});

test("source:'e2e-test' signup does NOT send formsubmit email", async () => {
  delete require.cache[HANDLER_PATH];
  const handler = require(HANDLER_PATH);
  await withFetchStub(async (calls) => {
    const ctx = makeContext();
    await handler(
      ctx,
      makeReq({
        email: "playwright@example.com",
        source: "e2e-test",
      }),
    );
    const formsubmitCalls = calls.filter((c) =>
      c.url.includes("formsubmit.co"),
    );
    assert.equal(
      formsubmitCalls.length,
      0,
      "source:'e2e-test' must skip formsubmit.co email send",
    );
    assert.equal(ctx.res.status, 200);
  });
});

test("source:'embed-widget' telemetry STILL short-circuits (Phase 7.66 preserved)", async () => {
  delete require.cache[HANDLER_PATH];
  const handler = require(HANDLER_PATH);
  await withFetchStub(async (calls) => {
    const ctx = makeContext();
    await handler(
      ctx,
      makeReq({
        email: "event@my-shop",
        source: "embed-widget",
        revenue: "widget_opened",
      }),
    );
    // Telemetry short-circuits BEFORE the email send (Phase 7.66) and
    // BEFORE the JSONL append. Net effect: zero outbound fetch calls.
    assert.equal(
      calls.length,
      0,
      "embed-widget telemetry must not trigger ANY outbound fetch (no formsubmit, no milestone webhook)",
    );
    assert.equal(ctx.res.status, 200);
    assert.equal(
      ctx.res.body && ctx.res.body.telemetry,
      true,
      "telemetry response body must include {telemetry: true}",
    );
  });
});

test("missing email returns 400 without contacting formsubmit", async () => {
  delete require.cache[HANDLER_PATH];
  const handler = require(HANDLER_PATH);
  await withFetchStub(async (calls) => {
    const ctx = makeContext();
    await handler(ctx, makeReq({ source: "website" }));
    assert.equal(ctx.res.status, 400);
    assert.equal(
      calls.filter((c) => c.url.includes("formsubmit.co")).length,
      0,
      "validation failure must not flap formsubmit",
    );
  });
});
