// Phase 8.17 — TrueDepth WebXR support module tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  detectTrueDepthSupport,
  buildTrueDepthSessionInit,
  tryStartTrueDepthSession,
  readTrueDepthPreference,
  writeTrueDepthPreference,
  TRUEDEPTH_DEFAULTS,
  TRUEDEPTH_VERSION,
} from "../app/lib/truedepth.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const UA_IPHONE15_172 =
  "Mozilla/5.0 (iPhone15,3; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15";
const UA_IPHONE12_172 =
  "Mozilla/5.0 (iPhone13,2; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15"; // iPhone 12 ⇒ iPhone13,2
const UA_IPHONE11_172 =
  "Mozilla/5.0 (iPhone12,1; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15"; // iPhone 11 ⇒ iPhone12,1 — pre-A14
const UA_IPHONE15_171 =
  "Mozilla/5.0 (iPhone15,3; CPU iPhone OS 17_1 like Mac OS X) AppleWebKit/605.1.15";
const UA_DESKTOP =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15";

const fakeXr = () => ({ isSessionSupported: async () => true, requestSession: async () => ({ id: "xr-1" }) });

test("detectTrueDepthSupport: SSR (no env, no global navigator) → reason 'ssr'", () => {
  const r = detectTrueDepthSupport({}); // no userAgent / no xr
  assert.equal(r.supported, false);
  assert.equal(r.reason, TRUEDEPTH_DEFAULTS.REASON.NO_XR);
});

test("detectTrueDepthSupport: navigator.xr missing → 'no-xr'", () => {
  const r = detectTrueDepthSupport({ userAgent: UA_IPHONE15_172 });
  assert.equal(r.supported, false);
  assert.equal(r.reason, "no-xr");
});

test("detectTrueDepthSupport: desktop UA blocked even with xr present", () => {
  const r = detectTrueDepthSupport({ userAgent: UA_DESKTOP, xr: fakeXr() });
  assert.equal(r.supported, false);
  assert.equal(r.reason, "ua-not-front-depth");
});

test("detectTrueDepthSupport: iPhone 11 (pre-A14) blocked", () => {
  const r = detectTrueDepthSupport({ userAgent: UA_IPHONE11_172, xr: fakeXr() });
  assert.equal(r.supported, false);
  assert.equal(r.reason, "ua-not-front-depth");
});

test("detectTrueDepthSupport: iPhone 15 on iOS 17.1 blocked (need 17.2+)", () => {
  const r = detectTrueDepthSupport({ userAgent: UA_IPHONE15_171, xr: fakeXr() });
  assert.equal(r.supported, false);
  assert.equal(r.reason, "ua-not-front-depth");
});

test("detectTrueDepthSupport: iPhone 12+ on iOS 17.2+ → supported", () => {
  for (const ua of [UA_IPHONE12_172, UA_IPHONE15_172]) {
    const r = detectTrueDepthSupport({ userAgent: ua, xr: fakeXr() });
    assert.equal(r.supported, true, `expected supported for ${ua} (got ${r.reason})`);
    assert.equal(r.ios.major, 17);
    assert.equal(r.ios.minor, 2);
  }
});

test("buildTrueDepthSessionInit: defaults include depth-sensing as REQUIRED", () => {
  const init = buildTrueDepthSessionInit();
  assert.deepEqual(init.requiredFeatures, ["depth-sensing"]);
  assert.ok(init.optionalFeatures.includes("camera-access"));
  assert.ok(init.optionalFeatures.includes("anchors"));
  assert.deepEqual(init.depthSensing.dataFormatPreference, TRUEDEPTH_DEFAULTS.preferredFormats);
  assert.deepEqual(init.depthSensing.usagePreference, TRUEDEPTH_DEFAULTS.preferredUsage);
});

test("buildTrueDepthSessionInit: rejects unknown format / usage strings", () => {
  assert.throws(() => buildTrueDepthSessionInit({ formats: ["weird-format"] }), /unknown format/);
  assert.throws(() => buildTrueDepthSessionInit({ usage: ["weird-usage"] }), /unknown usage/);
});

test("tryStartTrueDepthSession: returns ok+session on supported device", async () => {
  const navLike = { userAgent: UA_IPHONE15_172, xr: fakeXr() };
  const r = await tryStartTrueDepthSession(navLike);
  assert.equal(r.ok, true);
  assert.deepEqual(r.session, { id: "xr-1" });
  assert.equal(r.reason, "ok");
});

test("tryStartTrueDepthSession: returns ok=false on unsupported UA, no session call attempted", async () => {
  let called = 0;
  const xr = {
    isSessionSupported: async () => { called++; return true; },
    requestSession: async () => { called++; return {}; },
  };
  const r = await tryStartTrueDepthSession({ userAgent: UA_DESKTOP, xr });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "ua-not-front-depth");
  assert.equal(called, 0, "must not even probe XR on UA-blocked devices");
});

test("tryStartTrueDepthSession: distinguishes user-declined from unknown failure", async () => {
  const denied = await tryStartTrueDepthSession({
    userAgent: UA_IPHONE15_172,
    xr: {
      isSessionSupported: async () => true,
      requestSession: async () => { throw new Error("Permission denied by user"); },
    },
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.reason, "user-declined");

  const unknown = await tryStartTrueDepthSession({
    userAgent: UA_IPHONE15_172,
    xr: {
      isSessionSupported: async () => true,
      requestSession: async () => { throw new Error("WebGL context lost"); },
    },
  });
  assert.equal(unknown.ok, false);
  assert.equal(unknown.reason, "unknown-failure");
});

test("tryStartTrueDepthSession: surfaces 'no-depth-api' when isSessionSupported returns false", async () => {
  const r = await tryStartTrueDepthSession({
    userAgent: UA_IPHONE15_172,
    xr: { isSessionSupported: async () => false, requestSession: async () => ({}) },
  });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "no-depth-api");
});

test("readTrueDepthPreference / writeTrueDepthPreference round-trip", () => {
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  assert.equal(readTrueDepthPreference(storage), null);
  writeTrueDepthPreference(storage, true);
  assert.equal(readTrueDepthPreference(storage), true);
  writeTrueDepthPreference(storage, false);
  assert.equal(readTrueDepthPreference(storage), false);
});

test("readTrueDepthPreference: missing storage returns null (SSR-safe)", () => {
  assert.equal(readTrueDepthPreference(null), null);
  assert.equal(readTrueDepthPreference({}), null);
  assert.equal(writeTrueDepthPreference(null, true), false);
});

test("TRUEDEPTH_DEFAULTS frozen + version semver", () => {
  assert.ok(Object.isFrozen(TRUEDEPTH_DEFAULTS));
  assert.ok(Object.isFrozen(TRUEDEPTH_DEFAULTS.preferredFormats));
  assert.ok(Object.isFrozen(TRUEDEPTH_DEFAULTS.preferredUsage));
  assert.ok(Object.isFrozen(TRUEDEPTH_DEFAULTS.REASON));
  assert.match(TRUEDEPTH_VERSION, /^\d+\.\d+\.\d+$/);
});

test("VISION GUARD: truedepth module never references 2D fallback / paid APIs / Tailscale", () => {
  const src = readFileSync(resolve(ROOT, "app/lib/truedepth.mjs"), "utf8");
  assert.ok(!/2d-overlay|garmentTexture/i.test(src));
  assert.ok(!/openai\.com|cohere\.ai|anthropic\.com/i.test(src));
  assert.ok(!/ts\.net|tailscale/i.test(src));
});
