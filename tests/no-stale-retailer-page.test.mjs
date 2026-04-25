// Phase 7.61 — guard: /retailer is a redirect to /retailer/signup, not
// a duplicate signup page. Pre-7.61 it was a no-auth demo that
// hardcoded VirtualFit purple, had no shopId, and no PDP knobs —
// silently defeating Phases 7.56/7.57/7.58 brand theming + embed knobs.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PAGE = readFileSync(
  resolve(__dirname, "..", "app/retailer/page.tsx"),
  "utf8",
);

test("/retailer page is a server-side redirect to /retailer/signup", () => {
  assert.match(
    PAGE,
    /redirect\(["']\/retailer\/signup["']\)/,
    "app/retailer/page.tsx must call redirect('/retailer/signup') — single source of truth for the install flow.",
  );
  assert.match(
    PAGE,
    /from\s+["']next\/navigation["']/,
    "app/retailer/page.tsx must import redirect from 'next/navigation'.",
  );
});

test("/retailer page is NOT the stale duplicate signup form (no useState, no <input>)", () => {
  // Catches a regression where someone re-introduces the duplicate flow.
  // The redirect is the whole point — no client-side form belongs here.
  assert.doesNotMatch(
    PAGE,
    /\buseState\b/,
    "app/retailer/page.tsx must not be a client component with state — redirect to /retailer/signup instead.",
  );
  assert.doesNotMatch(
    PAGE,
    /<input/,
    "app/retailer/page.tsx must not render form inputs — redirect to /retailer/signup instead.",
  );
  // Also catches the specific 7.57-defeating pattern (hardcoded brand purple).
  assert.doesNotMatch(
    PAGE,
    /data-color=["']#6C5CE7["']/,
    "app/retailer/page.tsx must not contain a hardcoded 'data-color=\"#6C5CE7\"' embed snippet — that defeats Phase 7.57.",
  );
});
