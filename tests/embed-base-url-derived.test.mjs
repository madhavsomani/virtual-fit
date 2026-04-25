// Phase 7.67 — guard: BASE_URL is derived from the script tag's src
// (document.currentScript.src origin) instead of being hardcoded to
// https://virtualfit.app. This unbreaks dev (localhost:3000), preview
// deploys (*.azurestaticapps.net), and retailer-proxied embed.js.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EMBED = readFileSync(
  resolve(__dirname, "..", "public/embed.js"),
  "utf8",
);

test("embed.js BASE_URL is NOT a hardcoded constant string assignment", () => {
  // The literal `var BASE_URL = 'https://virtualfit.app'` (with semicolon
  // ending the statement) was the pre-7.67 hardcoded line. The new code
  // assigns BASE_URL from an IIFE that reads script.src. Forbid the
  // single-line literal assignment pattern.
  assert.doesNotMatch(
    EMBED,
    /var\s+BASE_URL\s*=\s*['"]https:\/\/virtualfit\.app['"]\s*;/,
    "BASE_URL must not be a hardcoded constant — derive from script.src so dev/preview/proxy domains work",
  );
});

test("embed.js BASE_URL is derived from the script tag's src origin", () => {
  // Must reference script.src and a URL parse to .origin.
  assert.match(EMBED, /script\.src/, "BASE_URL derivation must reference script.src");
  assert.match(EMBED, /new URL\(\s*src\s*\)/, "BASE_URL derivation must parse script.src via new URL(src)");
  assert.match(EMBED, /\.origin/, "BASE_URL derivation must extract .origin (not full src — strip path)");
});

test("embed.js still has a defensive fallback to the prod URL when script.src is unavailable", () => {
  // The IIFE must still resolve to something valid if script.src is
  // unset (e.g. inline script injection in some test harnesses).
  // Without a fallback the widget would crash on the next BASE_URL +
  // '/mirror/' concatenation.
  assert.match(
    EMBED,
    /return\s+['"]https:\/\/virtualfit\.app['"]\s*;/,
    "BASE_URL derivation must have a defensive fallback `return 'https://virtualfit.app';` for when script.src is unset",
  );
});

test("embed.js BASE_URL still flows into iframe URL + postMessage origin + telemetry fetch (regression hammer)", () => {
  // Prove the consumers still use BASE_URL — we replaced the assignment
  // expression, not the variable, so all reads should still resolve.
  assert.match(EMBED, /BASE_URL\s*\+\s*['"]\/mirror\//, "BASE_URL must still build the iframe URL");
  assert.match(EMBED, /new URL\(BASE_URL\)\.origin/, "BASE_URL must still gate the postMessage origin check");
  assert.match(EMBED, /BASE_URL\s*\+\s*['"]\/api\/waitlist['"]/, "BASE_URL must still target the waitlist endpoint");
  assert.match(EMBED, /postMessage\(\s*msg\s*,\s*BASE_URL\s*\)/, "BASE_URL must still be the postMessage targetOrigin");
});
