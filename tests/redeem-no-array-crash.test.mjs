// Phase 7.38 — guard: /redeem must not crash when /codes.json returns a
// non-array. Pre-7.38 the fetch chain stored whatever came back into
// `validCodes` state, so a CDN misdeploy or a JSON error envelope
// ({"error":"..."}) would land in state and throw `validCodes.find is not
// a function` on the next user click.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const REDEEM = resolve(ROOT, "app/redeem/page.tsx");

function strip(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
}

test("/codes.json fetch chain checks res.ok before parsing", () => {
  const src = strip(readFileSync(REDEEM, "utf8"));
  // The chain must throw on non-2xx so the catch -> setValidCodes([]) path runs,
  // instead of letting `res.json()` parse an error envelope or HTML page.
  const codesIdx = src.indexOf("/codes.json");
  assert.ok(codesIdx > 0, "could not find /codes.json fetch");
  const slice = src.slice(codesIdx, codesIdx + 600);
  assert.match(
    slice,
    /res\.ok|response\.ok/,
    "/codes.json fetch chain must check res.ok — otherwise an HTTP error response gets parsed as JSON.",
  );
});

test("setValidCodes is guarded by Array.isArray (or an array literal)", () => {
  const src = strip(readFileSync(REDEEM, "utf8"));
  // Look at every setValidCodes call site. At least the success-path one
  // must wrap its argument in Array.isArray(...) ? ... : [].
  const calls = [...src.matchAll(/setValidCodes\s*\(([^)]*)\)/g)].map((m) => m[1]);
  assert.ok(calls.length >= 2, `expected at least 2 setValidCodes calls, got ${calls.length}`);
  const hasGuard = calls.some((arg) => /Array\.isArray/.test(arg));
  assert.ok(
    hasGuard,
    "at least one setValidCodes(...) must wrap its argument with Array.isArray(...) ? ... : [] — otherwise a non-array response crashes .find on click.",
  );
});

test("handleRedeem defensively confirms validCodes is an array before .find", () => {
  const src = strip(readFileSync(REDEEM, "utf8"));
  // The defensive read is `Array.isArray(validCodes) ? validCodes : []`
  // followed by `.find` on the local. Reject a bare `validCodes.find`.
  assert.doesNotMatch(
    src,
    /\bvalidCodes\.find\b/,
    "handleRedeem still calls validCodes.find directly. Wrap in Array.isArray(validCodes) ? validCodes : [] first.",
  );
});
