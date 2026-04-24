// Phase 7.37 — guard: the homepage "Skip →" button must back up the email
// to localStorage so a network failure can't silently lose the signup.
//
// Pre-7.37 the Skip button was `fetch(...).finally(setSubmitted)` — no catch,
// no localStorage backup. The user saw "✅ You're on the list!" but the
// email landed nowhere when the network was down. The main submit handler
// already had this backup; the Skip path didn't.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const HOMEPAGE = resolve(ROOT, "app/page.tsx");

function strip(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
}

test("homepage Skip handler is async (so try/catch can wrap the fetch)", () => {
  const src = strip(readFileSync(HOMEPAGE, "utf8"));
  // The Skip button passes onClick={async () => { ... }}. We require at least
  // ONE async onClick handler in the homepage; pre-7.37 the only fetch-using
  // handler was a sync arrow with .finally().
  assert.match(
    src,
    /onClick\s*=\s*\{\s*async\s*\(\s*\)\s*=>/,
    "homepage missing an async onClick handler — Skip button regressed to fire-and-forget fetch.",
  );
});

test("homepage Skip handler persists the email to localStorage", () => {
  const src = strip(readFileSync(HOMEPAGE, "utf8"));
  // The skip-source string locates the relevant handler. Find the slice
  // between that string and the next setSubmitted(true) and check it
  // includes a localStorage.setItem("waitlist") call.
  const skipIdx = src.indexOf("homepage-skip");
  assert.ok(skipIdx > 0, "could not find 'homepage-skip' source tag");
  const slice = src.slice(skipIdx, skipIdx + 1500);
  assert.match(
    slice,
    /localStorage\.setItem\(\s*["']waitlist["']/,
    "Skip button must back up the email to localStorage('waitlist') — otherwise a network failure silently loses the signup.",
  );
});

test("homepage Skip handler does NOT use the bare .finally() fire-and-forget pattern", () => {
  const src = strip(readFileSync(HOMEPAGE, "utf8"));
  const skipIdx = src.indexOf("homepage-skip");
  const slice = src.slice(Math.max(0, skipIdx - 600), skipIdx + 1500);
  // Reject the specific `fetch(...).finally(...)` shape inside the skip handler.
  // A clean async/await + try/catch is the only acceptable shape.
  assert.doesNotMatch(
    slice,
    /fetch\([^)]*\)\s*[,;]?\s*\.\s*finally/,
    "Skip handler is back to fire-and-forget fetch().finally() — a network failure now silently loses the email.",
  );
});
