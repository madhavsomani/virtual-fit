// Phase 7.64 — guard: the `data-garment-set` knob has been deleted
// because no consumer ever existed in app/mirror/page.tsx. If a future
// agent re-adds the JSDoc / config field / URL forwarding without ALSO
// implementing the consumer in mirror, this test fires and forces the
// fix to be paired (or rejected).

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
const MIRROR = readFileSync(
  resolve(__dirname, "..", "app/mirror/page.tsx"),
  "utf8",
);

test("public/embed.js has no garmentSet / data-garment-set surface (Phase 7.64 strip)", () => {
  assert.doesNotMatch(
    EMBED,
    /data-garment-set/,
    "embed.js must not document data-garment-set — no consumer exists in app/mirror/page.tsx",
  );
  assert.doesNotMatch(
    EMBED,
    /\bgarmentSet\b/,
    "embed.js must not declare a garmentSet config field — no consumer exists",
  );
  assert.doesNotMatch(
    EMBED,
    /params\.set\(\s*['"]garmentSet['"]/,
    "embed.js must not forward ?garmentSet= on the iframe URL — no consumer reads it",
  );
});

test("app/mirror/page.tsx still does not consume garmentSet (consumer-pair guard)", () => {
  // If a future agent implements the consumer, this test should be
  // updated alongside the embed.js re-introduction in the SAME commit.
  // Both ends ship together or neither ships.
  assert.doesNotMatch(
    MIRROR,
    /searchParams\.get\(\s*['"]garmentSet['"]/,
    "mirror reads garmentSet but embed.js no longer forwards it — re-add embed.js in the SAME commit, not a future one",
  );
});
