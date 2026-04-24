// Phase 7.49 — guard: public/codes.json must NEVER ship plaintext promo
// codes. Pre-7.49 the file shipped 20 entries like
//   { "code": "VF-LN46CH", "tier": "creator", "days": 30 }
// at https://virtualfit.app/codes.json. Anyone who fetched the URL got
// every code without ever entering one. A plaintext promo manifest on a
// public CDN is a revenue/trust hole regardless of how clever the
// client-side redemption flow is.
//
// Post-7.49 entries look like:
//   { "h": "<sha256 hex>", "tier": "creator", "days": 30 }
// and app/redeem/page.tsx hashes user input before comparing.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const CODES = resolve(ROOT, "public/codes.json");
const REDEEM_PAGE = resolve(ROOT, "app/redeem/page.tsx");

test("public/codes.json exists and parses as a JSON array", () => {
  assert.ok(existsSync(CODES), "public/codes.json must exist (redeem page fetches it)");
  const arr = JSON.parse(readFileSync(CODES, "utf8"));
  assert.ok(Array.isArray(arr), "codes.json must be a JSON array");
  assert.ok(arr.length > 0, "codes.json should not be empty");
});

test("codes.json never ships a plaintext `code` field", () => {
  const arr = JSON.parse(readFileSync(CODES, "utf8"));
  for (const entry of arr) {
    assert.ok(
      !("code" in entry),
      `codes.json entry leaks plaintext code: ${JSON.stringify(entry)} — must be hashed (\`h\`) only.`,
    );
  }
});

test("every codes.json entry uses a 64-char SHA-256 hex hash", () => {
  const arr = JSON.parse(readFileSync(CODES, "utf8"));
  for (const entry of arr) {
    assert.ok(typeof entry.h === "string", `Entry missing \`h\`: ${JSON.stringify(entry)}`);
    assert.match(
      entry.h,
      /^[0-9a-f]{64}$/,
      `Entry \`h\` is not a SHA-256 hex (64 lowercase hex chars): ${entry.h}`,
    );
    assert.ok(typeof entry.tier === "string" && entry.tier.length > 0, "Entry missing \`tier\`");
    assert.ok(Number.isFinite(entry.days) && entry.days > 0, "Entry missing positive \`days\`");
  }
});

test("codes.json contains no obvious VF- plaintext anywhere (raw text scan)", () => {
  const txt = readFileSync(CODES, "utf8");
  assert.doesNotMatch(
    txt,
    /VF-[A-Z0-9]{6,}/,
    "codes.json contains a `VF-XXXXXX`-shaped string — looks like a leaked plaintext promo code.",
  );
});

test("redeem page hashes user input before comparing (no plaintext compare)", () => {
  const src = readFileSync(REDEEM_PAGE, "utf8");
  // Must use SHA-256 via WebCrypto.
  assert.match(
    src,
    /crypto\.subtle\.digest\(\s*["']SHA-256["']/,
    "app/redeem/page.tsx must hash the typed code via crypto.subtle.digest('SHA-256', ...) before lookup.",
  );
  // Must NOT compare raw `c.code === normalizedCode` (the old plaintext
  // path). Lookup must go through `c.h ===`.
  assert.doesNotMatch(
    src,
    /c\.code\s*===/,
    "app/redeem/page.tsx still has a plaintext `c.code === ...` comparison — must compare hashes.",
  );
  assert.match(
    src,
    /c\.h\s*===/,
    "app/redeem/page.tsx must look up codes by their hash field `c.h`.",
  );
});
