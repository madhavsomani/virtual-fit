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

test("pricing page still redirects to /?waitlist=1 (pair guard with home page consumer)", () => {
  // Producer side. If a future agent removes this redirect, the home
  // page's ?waitlist=1 effect becomes dead code and this test fires.
  assert.match(
    PRICING,
    /window\.location\.href\s*=\s*["']\/\?waitlist=1["']/,
    "pricing page must still redirect to /?waitlist=1 — pair guard with home page consumer",
  );
});

test("pricing 'checkout not yet enabled' alert text is consistent with the redirect", () => {
  // Pre-7.73 the alert said "join the waitlist on /mirror" but
  // redirected to "/" — copy/destination mismatch that confused users.
  assert.doesNotMatch(
    PRICING,
    /join the waitlist on \/mirror/,
    "pricing alert must not say 'join the waitlist on /mirror' — the redirect goes to / (home), not /mirror",
  );
  assert.match(
    PRICING,
    /join the waitlist on the home page/,
    "pricing alert must say 'join the waitlist on the home page' to match the redirect destination",
  );
});
