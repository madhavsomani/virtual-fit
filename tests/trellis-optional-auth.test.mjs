// Phase 7.87 — guard: TRELLIS client must NOT throw when no HF token
// is provided. The microsoft/TRELLIS HF Space accepts anonymous Gradio
// requests (verified live: GET /info, POST /upload, queue/join all
// return 200 without Authorization). Pre-7.87 the client threw
// "NEXT_PUBLIC_HF_TOKEN is required for TRELLIS image→3D" the instant
// a user tried to convert a garment to a mesh, which on production
// (where the token is intentionally never inlined to client bundles
// per Phase 7.83/7.86) meant the entire Photo→mesh→overlay vision
// was dead at the third stage.
//
// This guard locks in the optional-token contract so a future agent
// can't accidentally re-introduce the throw-when-missing pattern.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SRC = readFileSync(resolve(ROOT, "app/lib/trellis-client.ts"), "utf8");

test("trellis-client.ts no longer throws when NEXT_PUBLIC_HF_TOKEN is unset", () => {
  // Pre-7.87:
  //   throw new Error("NEXT_PUBLIC_HF_TOKEN is required for TRELLIS image→3D");
  // The fact that this throw existed inside getToken() meant every
  // single Photo→mesh attempt on production hit it before the first
  // network call. Locking out the regression.
  assert.doesNotMatch(
    SRC,
    /throw new Error\(\s*"NEXT_PUBLIC_HF_TOKEN is required for TRELLIS/,
    "trellis-client must NOT throw when NEXT_PUBLIC_HF_TOKEN is unset — that's the bug 7.87 fixes. The TRELLIS HF Space is public and accepts anonymous requests; auth is opt-in for higher rate-limit budget.",
  );
});

test("trellis-client.ts has an authHeaders() helper that conditionally adds Bearer", () => {
  // The new contract: Authorization is added IF a token is available,
  // omitted entirely otherwise. Pre-7.87 every fetch hardcoded
  // `Authorization: Bearer ${token}` which failed at construction
  // when token was undefined.
  assert.match(SRC, /function authHeaders\(/);
  assert.match(
    SRC,
    /token \? \{ Authorization: `Bearer \$\{token\}` \} : \{\}/,
    "authHeaders must return {Authorization} only when token is truthy, never an object with `Bearer undefined`",
  );
});

test("trellis-client.ts getToken() return type is `string | undefined`, not `string`", () => {
  // Type signature change is the structural enforcement. If a future
  // agent narrows it back to `string` the call sites that pass token
  // through to fetch() will start tripping TS errors before runtime.
  assert.match(SRC, /function getToken\([^)]*\): string \| undefined/);
});

test("trellis-client.ts still honors explicit opts.token (auth is opt-in, not removed)", () => {
  // The token path isn't ripped out — it's just optional. A higher
  // anonymous rate-limit on TRELLIS's ZeroGPU queue is real and
  // Madhav (or test fixtures) can still pass a token.
  assert.match(SRC, /opts\?\.token/);
  assert.match(SRC, /process\.env\.NEXT_PUBLIC_HF_TOKEN/);
});

test("trellis-client.ts no fetch call still hardcodes `Bearer ${token}` outside authHeaders()", () => {
  // Defense-in-depth: scan for any remaining `Bearer ${token}` literal
  // OUTSIDE the authHeaders() definition. authHeaders is the only
  // place that should be constructing the header, so every other
  // occurrence is suspicious.
  const lines = SRC.split("\n");
  const offenders = [];
  let inAuthHeaders = false;
  let braceDepth = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/function authHeaders\(/.test(line)) {
      inAuthHeaders = true;
      braceDepth = 0;
    }
    if (inAuthHeaders) {
      braceDepth += (line.match(/\{/g) || []).length;
      braceDepth -= (line.match(/\}/g) || []).length;
      if (braceDepth <= 0 && /\}/.test(line) && !/function authHeaders/.test(line)) {
        inAuthHeaders = false;
      }
      continue;
    }
    if (/Bearer \$\{token\}/.test(line)) {
      offenders.push(`L${i + 1}: ${line.trim()}`);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `Found hardcoded Bearer token outside authHeaders() — every fetch should use authHeaders() so unauthenticated calls work:\n  - ${offenders.join("\n  - ")}`,
  );
});
