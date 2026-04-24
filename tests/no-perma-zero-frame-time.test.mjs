// Phase 7.33 — guard: dead `autoSaveSettings`, `frameTime`, `primaryColor`,
// and `themeColors` stay deleted. Same UX-lie pattern as Phase 7.32's
// sound system: `useState(initial)` with a setter that's never called →
// pinned-forever value displayed in the UI as if it were live.
//
// The general rule this enforces: never display a perf metric whose
// state has zero `set*` writers.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const MIRROR = resolve(ROOT, "app/mirror/page.tsx");

function strip(src) {
  // Drop block + line comments so retrospective Phase 7.33 prose is OK.
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
}

test("dead `autoSaveSettings` stays gone (no useState, no gate)", () => {
  const src = strip(readFileSync(MIRROR, "utf8"));
  assert.doesNotMatch(src, /\bautoSaveSettings\b/, "Resurrected `autoSaveSettings` — it was a perma-true with no writer.");
  assert.doesNotMatch(src, /\bsetAutoSaveSettings\b/);
});

test("dead `frameTime` stays gone, and no perma-zero perf metric reappears", () => {
  const src = strip(readFileSync(MIRROR, "utf8"));
  assert.doesNotMatch(src, /\bframeTime\b/, "Resurrected `frameTime` — must have a real writer before any UI displays it.");
  assert.doesNotMatch(src, /\bsetFrameTime\b/);
});

test("dead `themeColors` stays gone (Phase 7.33); `primaryColor` is now Phase 7.57's theme prop", () => {
  const src = strip(readFileSync(MIRROR, "utf8"));
  // Phase 7.33 deleted the dead derived `primaryColor` value + its source
  // `themeColors`. Phase 7.57 reintroduced `primaryColor` as the embed
  // theme prop name (URL: ?primaryColor=, postMessage: data.theme.primaryColor)
  // — BUT the dead React state and themeColors map MUST stay gone. Guard
  // the surviving anti-patterns directly.
  assert.doesNotMatch(src, /\bthemeColors\b/, "Resurrected `themeColors` — its only reader was the dead `primaryColor` derived value.");
  assert.doesNotMatch(src, /const\s+primaryColor\s*=/, "Resurrected the dead derived `primaryColor` const — use Phase 7.57's `themePrimaryColor` state instead.");
});

test("the perf overlay no longer renders a `⚡ Frame: …ms` row pinned to 0", () => {
  // Catches the literal-string anti-pattern the deleted JSX used. Strip
  // comments so retrospective Phase 7.33 prose (which intentionally quotes
  // the deleted JSX) doesn't false-positive.
  const src = strip(readFileSync(MIRROR, "utf8"));
  assert.doesNotMatch(
    src,
    /⚡ Frame:\s*\{[^}]*frameTime[^}]*\}/,
    "The `⚡ Frame: {frameTime}ms` row showed `0.0ms` forever. Don't bring it back without a real per-frame writer.",
  );
});
