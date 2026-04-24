// Phase 7.36 — regression guard: no route-level page may use the
// corruption-prone `JSON.parse(localStorage.getItem(K) || "[]")` pattern.
//
// Phase 7.35 introduced `safeLoadJson` (handles missing/empty/malformed JSON,
// throwing storage, SSR). Phase 7.36 rolled it out to every page that was
// still using the raw pattern. This test stops the anti-pattern from coming
// back via copy-paste.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const PROTECTED_FILES = [
  "app/page.tsx",
  "app/checkout/success/page.tsx",
  "app/redeem/page.tsx",
  "app/retailer/signup/page.tsx",
  "app/mirror/page.tsx",
];

function strip(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
}

test("no protected page uses the raw `JSON.parse(localStorage.getItem(...)` anti-pattern", () => {
  for (const rel of PROTECTED_FILES) {
    const src = strip(readFileSync(resolve(ROOT, rel), "utf8"));
    assert.doesNotMatch(
      src,
      /JSON\.parse\s*\(\s*localStorage\.getItem\s*\(/,
      `${rel} contains the corruption-prone \`JSON.parse(localStorage.getItem(...))\` pattern. Use safeLoadJson from app/lib/safe-storage instead.`,
    );
  }
});

test("each protected page imports safeLoadJson from app/lib/safe-storage", () => {
  for (const rel of PROTECTED_FILES) {
    const src = readFileSync(resolve(ROOT, rel), "utf8");
    assert.match(
      src,
      /safeLoadJson/,
      `${rel} should reference safeLoadJson — Phase 7.36 rollout.`,
    );
    assert.match(
      src,
      /from\s+["'](?:\.\.?\/)+lib\/safe-storage["']/,
      `${rel} should import from a relative path to lib/safe-storage.`,
    );
  }
});

test("homepage waitlist load guards `.length` with Array.isArray", () => {
  const src = strip(readFileSync(resolve(ROOT, "app/page.tsx"), "utf8"));
  // Must not blindly read .length off whatever came back from storage.
  // Acceptable: `Array.isArray(waitlist) && setWaitlistCount(waitlist.length)`
  // (the helper returns `[]` by default, but a *valid* JSON value of
  // `{"foo":1}` would still be returned and have `.length === undefined`).
  assert.match(
    src,
    /Array\.isArray\s*\(\s*waitlist\s*\)/,
    "Homepage must guard waitlist.length with Array.isArray.",
  );
});
