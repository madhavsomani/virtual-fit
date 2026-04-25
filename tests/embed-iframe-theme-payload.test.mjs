// Phase 7.65 — guard: fontFamily / buttonRadius are valid for the
// LAUNCH BUTTON styling (embed.js paints the floating button), but
// they're DEAD on the iframe URL and DEAD in the virtualfit:set-theme
// postMessage payload. Mirror's set-theme handler reads ONLY
// data.theme.primaryColor; the other fields were silent no-ops.
//
// This test enforces the contract: don't lie about what the iframe
// can theme. If a future agent re-adds fontFamily/buttonRadius to
// either surface, they MUST also implement the consumer in mirror in
// the same commit (consumer-pair guard).

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

test("embed.js does NOT forward fontFamily/buttonRadius on the iframe URL (mirror ignores them)", () => {
  assert.doesNotMatch(
    EMBED,
    /params\.set\(\s*['"]fontFamily['"]/,
    "embed.js must not forward ?fontFamily= — mirror does not call searchParams.get('fontFamily')",
  );
  assert.doesNotMatch(
    EMBED,
    /params\.set\(\s*['"]buttonRadius['"]/,
    "embed.js must not forward ?buttonRadius= — mirror does not call searchParams.get('buttonRadius')",
  );
});

test("embed.js's virtualfit:set-theme postMessage payload only includes consumed fields (primaryColor)", () => {
  // Find the case 'virtualfit:ready' block and inspect the theme payload.
  const idx = EMBED.indexOf("case 'virtualfit:ready':");
  assert.ok(idx > -1, "virtualfit:ready handler must exist");
  // Slice forward until the next `break;` to capture only this case body.
  const after = EMBED.slice(idx, idx + 600);
  const breakIdx = after.indexOf("break;");
  assert.ok(breakIdx > -1, "virtualfit:ready case body must end with break;");
  const body = after.slice(0, breakIdx);
  // Must include primaryColor (the one field mirror consumes).
  assert.match(body, /primaryColor:/, "set-theme payload must include primaryColor");
  // Must NOT include the dead fields. Mirror's set-theme handler only
  // reads data.theme.primaryColor — pre-7.65 the payload also shipped
  // fontFamily/buttonRadius/shopId, all silently ignored on receive.
  assert.doesNotMatch(body, /fontFamily:/, "set-theme payload must not include fontFamily — mirror ignores it");
  assert.doesNotMatch(body, /buttonRadius:/, "set-theme payload must not include buttonRadius — mirror ignores it");
  assert.doesNotMatch(body, /shopId:/, "set-theme payload must not include shopId — mirror ignores it (analytics use config.shopId on the parent side)");
});

test("mirror still does not consume fontFamily/buttonRadius (consumer-pair guard)", () => {
  // If a future agent implements the consumer, this test should be
  // updated alongside the embed.js re-introduction in the SAME commit.
  assert.doesNotMatch(
    MIRROR,
    /searchParams\.get\(\s*['"]fontFamily['"]/,
    "mirror reads fontFamily but embed.js no longer forwards it — re-add embed.js in the SAME commit",
  );
  assert.doesNotMatch(
    MIRROR,
    /searchParams\.get\(\s*['"]buttonRadius['"]/,
    "mirror reads buttonRadius but embed.js no longer forwards it — re-add embed.js in the SAME commit",
  );
  // Also: mirror's set-theme handler must still only read primaryColor.
  // If a future agent reads data.theme.fontFamily or data.theme.buttonRadius
  // in the handler, this trips and forces them to re-add the postMessage payload field.
  const setThemeIdx = MIRROR.indexOf("'virtualfit:set-theme'");
  assert.ok(setThemeIdx > -1, "mirror must still handle virtualfit:set-theme");
  const handler = MIRROR.slice(setThemeIdx, setThemeIdx + 400);
  assert.doesNotMatch(handler, /data\.theme\.fontFamily/, "mirror set-theme handler reads fontFamily — re-add embed.js payload field in SAME commit");
  assert.doesNotMatch(handler, /data\.theme\.buttonRadius/, "mirror set-theme handler reads buttonRadius — re-add embed.js payload field in SAME commit");
});

test("embed.js still uses fontFamily/buttonRadius for the LAUNCH BUTTON styling (regression hammer)", () => {
  // The fields stay valid for embed.js's own launch button — this test
  // proves we didn't accidentally strip the legitimate use site too.
  assert.match(EMBED, /'\s*font-family:\s*'\s*\+\s*config\.fontFamily/, "embed.js must still apply config.fontFamily to the launch button CSS");
  assert.match(EMBED, /'\s*border-radius:\s*'\s*\+\s*config\.buttonRadius/, "embed.js must still apply config.buttonRadius to the launch button CSS");
});
