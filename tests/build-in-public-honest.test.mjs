// Phase 7.22 — guard: /build-in-public used to render visitor-localStorage
// values as if they were aggregate site totals (same broken pattern as the
// deleted /admin/stats). New visitors saw "$0 MRR / 0 Page Views / 0
// Waitlist Signups" because each browser only sees its own activity. Now
// the page is a static snapshot — no localStorage reads, no per-visitor
// stats. Stay that way.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SRC = readFileSync(
  resolve(ROOT, "app/build-in-public/page.tsx"),
  "utf8",
);

function strip(src) {
  let s = src.replace(/\/\*[\s\S]*?\*\//g, "");
  s = s
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
  return s;
}

const CODE = strip(SRC);

test("/build-in-public does not read localStorage", () => {
  assert.doesNotMatch(
    CODE,
    /localStorage\s*\.\s*getItem/,
    "Per-visitor localStorage stats were stripped in Phase 7.22 because " +
      "they rendered as aggregate totals to every visitor (same broken " +
      "pattern as /admin/stats). Use a server-rendered data source if you " +
      "want real metrics here.",
  );
});

test("/build-in-public does not advertise a per-visitor MRR hero", () => {
  // The old MRR hero rendered ${stats.mrr} which was always $0 for fresh
  // visitors. Ban "MONTHLY RECURRING REVENUE" wording so it can't quietly
  // come back with the same broken source.
  assert.doesNotMatch(
    CODE,
    /MONTHLY RECURRING REVENUE/i,
    "MRR hero relied on per-visitor localStorage and lied to every new " +
      "visitor. Wire to real revenue (server-rendered) before re-adding.",
  );
});

test("/build-in-public does not reference the deleted Admin dashboard milestone", () => {
  // Phase 7.19 deleted /admin and /admin/stats. The old milestone list
  // included "Admin dashboard" as a shipped milestone — now misleading.
  assert.doesNotMatch(CODE, /Admin dashboard/);
});
