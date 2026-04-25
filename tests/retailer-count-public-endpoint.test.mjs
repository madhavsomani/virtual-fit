// Phase 7.63 — guard: /api/waitlist-stats must expose a public,
// no-auth retailer count for the /retailer/signup social-proof number,
// while keeping PII admin-only.
//
// Pre-7.63 the endpoint gated EVERYTHING behind adminKey, so the
// signup page (which calls without a key) always got 401 and the
// "X retailers already on the waitlist" count never displayed.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENDPOINT = readFileSync(
  resolve(__dirname, "..", "api/waitlist-stats/index.js"),
  "utf8",
);
const SIGNUP = readFileSync(
  resolve(__dirname, "..", "app/retailer/signup/page.tsx"),
  "utf8",
);

test("waitlist-stats has a no-key public path that returns 'retailers' count", () => {
  assert.match(
    ENDPOINT,
    /if\s*\(\s*!key\s*\)/,
    "endpoint must branch on missing ?key= and serve a public path",
  );
  assert.match(
    ENDPOINT,
    /retailers/,
    "endpoint must reference 'retailers' (the field signup/page.tsx reads)",
  );
  assert.match(
    ENDPOINT,
    /source\s*===\s*['"]retailer-signup['"]/,
    "endpoint must filter entries by source === 'retailer-signup' to count retailers (matches the wouldPay tag /retailer/signup writes)",
  );
});

test("public no-key path body must NOT leak PII (no recentSignups / wtpBreakdown / revenueBreakdown / email)", () => {
  // Slice from the !key branch start to the next `return` after that body
  // assignment. Then verify PII identifiers are absent from the public body.
  const noKeyStart = ENDPOINT.indexOf("if (!key)");
  assert.ok(noKeyStart > -1, "no-key branch must exist");
  // Take a generous window (~1500 chars) covering the whole no-key block.
  const window = ENDPOINT.slice(noKeyStart, noKeyStart + 1500);
  // The public body literal lives in this window. PII field names must NOT
  // appear in it (they belong only to the admin path lower in the file).
  assert.doesNotMatch(
    window,
    /recentSignups/,
    "public no-key body must not include recentSignups (PII)",
  );
  assert.doesNotMatch(
    window,
    /wtpBreakdown/,
    "public no-key body must not include wtpBreakdown (PII)",
  );
  assert.doesNotMatch(
    window,
    /revenueBreakdown/,
    "public no-key body must not include revenueBreakdown (PII)",
  );
});

test("admin path still exists and still gates PII (regression hammer)", () => {
  // The admin path must still build wtpBreakdown + recentSignups — proves
  // we collapsed the public path on top instead of removing the admin one.
  assert.match(ENDPOINT, /wtpBreakdown/, "admin path must still compute wtpBreakdown");
  assert.match(ENDPOINT, /recentSignups/, "admin path must still expose recentSignups");
  assert.match(
    ENDPOINT,
    /Invalid key|status:\s*401/,
    "admin path must still 401 on bad/missing key",
  );
});

test("/retailer/signup reads data.retailers (the field the public path now serves)", () => {
  // If someone changes the public field name later, this guard pairs the
  // two ends of the contract so the signup-page read side stays in sync.
  assert.match(
    SIGNUP,
    /data\.retailers/,
    "signup page must read data.retailers — that's the public field /api/waitlist-stats now serves",
  );
});
