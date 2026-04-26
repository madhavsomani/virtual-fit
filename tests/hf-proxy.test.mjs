// Phase 7.86 — guard: client HF lib calls must default to the same-origin
// proxy when no explicit token is provided. Pre-7.86 the libs threw
// "NEXT_PUBLIC_HF_TOKEN is not configured" whenever the env var was
// unset, which broke the entire Photo→3D vision on production (CI
// doesn't ship the token, by design — Phase 7.83 scanner blocks it).
//
// This guard locks in the proxy-default routing so a future agent can't
// accidentally re-introduce the throw-on-missing-env-var pattern that
// gated the whole pipeline behind a publicly-leaked token.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const SEGMENT_SRC = readFileSync(resolve(ROOT, "app/lib/garment-segment.ts"), "utf8");
const RMBG_SRC = readFileSync(resolve(ROOT, "app/lib/remove-background.ts"), "utf8");
const PROXY_SRC = readFileSync(resolve(ROOT, "api/hf-proxy/index.js"), "utf8");
const PROXY_FN = readFileSync(resolve(ROOT, "api/hf-proxy/function.json"), "utf8");

test("api/hf-proxy/function.json exists and binds POST + OPTIONS at hf-proxy/{*model}", () => {
  const fn = JSON.parse(PROXY_FN);
  const trigger = fn.bindings.find((b) => b.type === "httpTrigger");
  assert.ok(trigger, "function.json must declare an httpTrigger binding");
  assert.equal(trigger.authLevel, "anonymous", "proxy must be anonymous (client-callable)");
  assert.deepEqual(
    [...trigger.methods].sort(),
    ["options", "post"],
    "proxy must accept POST + OPTIONS (CORS preflight)",
  );
  assert.equal(
    trigger.route,
    "hf-proxy/{*model}",
    "proxy must use the catch-all model path so /api/hf-proxy/{owner}/{model} resolves",
  );
});

test("hf-proxy reads HF_TOKEN from server-side env (NOT NEXT_PUBLIC_HF_TOKEN)", () => {
  assert.match(
    PROXY_SRC,
    /process\.env\.HF_TOKEN\b/,
    "proxy must read HF_TOKEN from server env",
  );
  assert.doesNotMatch(
    PROXY_SRC,
    /process\.env\.NEXT_PUBLIC_HF_TOKEN/,
    "proxy MUST NOT read NEXT_PUBLIC_HF_TOKEN from env (comments + operator-facing error message are allowed to mention the name).",
  );
});

test("hf-proxy allowlists ONLY segformer + RMBG (no open-relay)", () => {
  // Phase 7.86 contract: proxy is not a transparent forwarder for
  // arbitrary HF models. Locking the allowlist down keeps an attacker
  // from burning the operator's HF account quota by POSTing huge
  // requests to other paths via /api/hf-proxy/llama-405b/etc.
  assert.match(PROXY_SRC, /mattmdjaga\/segformer_b2_clothes/);
  assert.match(PROXY_SRC, /briaai\/RMBG-1\.4/);
  assert.match(PROXY_SRC, /ALLOWED_MODELS/);
  assert.match(PROXY_SRC, /403/, "proxy must return 403 for non-allowlisted models");
});

test("hf-proxy hard-fails 503 (not 200) when HF_TOKEN env is unset", () => {
  // Phase 7.82 pattern: never silently succeed-with-empty when an
  // operator-configured secret is missing. 503 Misconfigured is the
  // signal to Madhav that the SWA Application Settings need HF_TOKEN.
  assert.match(PROXY_SRC, /HF_TOKEN is not configured/);
  assert.match(PROXY_SRC, /503/);
});

test("hf-proxy caps upload size to defend against amplification abuse", () => {
  assert.match(PROXY_SRC, /MAX_BYTES/);
  assert.match(PROXY_SRC, /413/, "proxy must return 413 (payload too large) on oversize uploads");
});

test("garment-segment.ts defaults to /api/hf-proxy/ when no token is provided", () => {
  // Pre-7.86: libs threw "NEXT_PUBLIC_HF_TOKEN is not configured" when
  // the env was unset. Post-7.86: libs build a proxy URL and let the
  // server add auth. Lock in the new default routing.
  assert.match(SEGMENT_SRC, /\/api\/hf-proxy\//);
  assert.match(SEGMENT_SRC, /HF_PROXY_URL/);
  assert.doesNotMatch(
    SEGMENT_SRC,
    /throw new Error\(\s*"NEXT_PUBLIC_HF_TOKEN is not configured/,
    "garment-segment must NOT throw when NEXT_PUBLIC_HF_TOKEN is unset — that's the bug 7.86 fixes. The proxy path lets the server supply the token.",
  );
});

test("remove-background.ts defaults to /api/hf-proxy/ when no token is provided", () => {
  assert.match(RMBG_SRC, /\/api\/hf-proxy\//);
  assert.match(RMBG_SRC, /HF_RMBG_PROXY_URL/);
  assert.doesNotMatch(
    RMBG_SRC,
    /throw new Error\(\s*"NEXT_PUBLIC_HF_TOKEN is not configured/,
    "remove-background must NOT throw when NEXT_PUBLIC_HF_TOKEN is unset.",
  );
});

test("garment-segment + remove-background still honor explicit opts.token (test/local-dev path)", () => {
  // Test fixtures in tests/garment-segment.test.mjs and tests/remove-background.test.mjs
  // pass opts.token explicitly. Make sure that path STILL works (we
  // only changed the default-no-token behavior).
  assert.match(SEGMENT_SRC, /opts\?\.token/);
  assert.match(SEGMENT_SRC, /HF_DIRECT_URL/);
  assert.match(RMBG_SRC, /opts\?\.token/);
  assert.match(RMBG_SRC, /HF_RMBG_DIRECT_URL/);
});
