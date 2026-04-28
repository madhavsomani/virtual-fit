// Phase 7.73 — guard: ?waitlist=1 from /pricing's "checkout not yet
// enabled" redirect must scroll-and-focus the home page's waitlist
// email input. Pre-7.73 this was a dead-API-surface bug ACROSS pages:
// the producer (pricing's window.location.href = "/?waitlist=1") emitted
// a contract the consumer (app/page.tsx) never read, so users landed on
// the hero with no indication the form they were promised was below.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOME = readFileSync(
  resolve(__dirname, "..", "app/page.tsx"),
  "utf8",
);
const PRICING = readFileSync(
  resolve(__dirname, "..", "app/pricing/page.tsx"),
  "utf8",
);

test("home page reads ?waitlist=1 from window.location.search", () => {
  assert.match(
    HOME,
    /URLSearchParams\(\s*window\.location\.search\s*\)/,
    "home page must read ?waitlist=1 via URLSearchParams(window.location.search)",
  );
  assert.match(
    HOME,
    /params\.get\(\s*['"]waitlist['"]\s*\)\s*!==?\s*['"]1['"]/,
    "home page must compare params.get('waitlist') === '1' (or !== '1' for early return)",
  );
});

test("home page scrolls to and focuses the waitlist-email input when ?waitlist=1", () => {
  assert.match(
    HOME,
    /id=["']waitlist-email["']/,
    "the email input must have id='waitlist-email' so getElementById can find it",
  );
  assert.match(
    HOME,
    /document\.getElementById\(\s*["']waitlist-email["']\s*\)/,
    "home page must look up the email input by id='waitlist-email'",
  );
  assert.match(
    HOME,
    /scrollIntoView/,
    "home page must call scrollIntoView so the user sees the form below the hero",
  );
  assert.match(
    HOME,
    /\.focus\(\)/,
    "home page must call .focus() so the user can start typing immediately",
  );
});

test("home page guards the ?waitlist=1 effect with typeof window check (SSR safety)", () => {
  // The useEffect runs on client only, but the URLSearchParams +
  // window.location access must still defensively guard typeof window
  // so future server-component refactors don't crash.
  assert.match(
    HOME,
    /typeof\s+window\s*===?\s*["']undefined["']/,
    "home page's ?waitlist=1 effect must guard `typeof window === 'undefined'` for SSR safety",
  );
});

test("pricing page no longer needs the waitlist redirect (P8.15 shipped real Stripe wiring)", () => {
  // Phase 8.15 replaced the placeholder pricing page with real plans +
  // Stripe test-mode checkout links. The producer-side waitlist redirect
  // is intentionally retired. The home-page consumer guard above still
  // protects ?waitlist=1 if other callers ever emit it again.
  assert.doesNotMatch(PRICING, /window\.location\.href\s*=\s*["']\/\?waitlist=1["']/);
});

test("pricing page does not contain the legacy 'join the waitlist on /mirror' alert (still bad copy)", () => {
  assert.doesNotMatch(PRICING, /join the waitlist on \/mirror/);
});
