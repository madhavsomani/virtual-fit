// Phase 7.71 — guard: the /retailer/signup page's iframeSnippet (the
// "iframe direct" install option) must NOT include &shopId= or
// &retailer= URL params. mirror/page.tsx never calls
// searchParams.get('shopId') or searchParams.get('retailer') (proven by
// the Phase 7.70 consumer-pair guard), so suggesting retailers add them
// to a hand-crafted iframe URL is the same dead-API-surface lie that
// 7.70 fixed on the embed.js side.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SIGNUP = readFileSync(
  resolve(__dirname, "..", "app/retailer/signup/page.tsx"),
  "utf8",
);
const MIRROR = readFileSync(
  resolve(__dirname, "..", "app/mirror/page.tsx"),
  "utf8",
);

// Slice out the iframeSnippet template literal so unrelated mentions
// elsewhere in the file (form labels, postMessage docs, prose) don't
// false-positive the guard.
function iframeSnippetBody() {
  const start = SIGNUP.indexOf("const iframeSnippet =");
  assert.ok(start > -1, "iframeSnippet must be declared in /retailer/signup");
  // Template literal ends at the first `;` after the opening backtick.
  const tickStart = SIGNUP.indexOf("`", start);
  const tickEnd = SIGNUP.indexOf("`", tickStart + 1);
  return SIGNUP.slice(tickStart, tickEnd + 1);
}

test("/retailer/signup iframeSnippet does NOT include &shopId= URL param", () => {
  const body = iframeSnippetBody();
  assert.doesNotMatch(
    body,
    /[?&]shopId=/,
    "iframeSnippet must not include &shopId= — mirror never reads it (Phase 7.70 stripped the same on the embed.js side)",
  );
});

test("/retailer/signup iframeSnippet does NOT include &retailer= URL param", () => {
  const body = iframeSnippetBody();
  assert.doesNotMatch(
    body,
    /[?&]retailer=/,
    "iframeSnippet must not include &retailer= — mirror never reads it",
  );
});

test("/retailer/signup iframeSnippet still includes the params mirror DOES read (regression)", () => {
  const body = iframeSnippetBody();
  // Required: embed=true (always), primaryColor= (theming).
  assert.match(body, /[?&]embed=true/, "iframeSnippet must still include embed=true");
  assert.match(body, /[?&]primaryColor=/, "iframeSnippet must still include primaryColor=");
  // iframeExtras conditionally appends productId/garmentImage; the
  // template references the variable so prove the substitution is wired.
  assert.match(body, /\$\{iframeExtras\}/, "iframeSnippet must still interpolate iframeExtras (productId/garmentImage)");
});

test("mirror/page.tsx still doesn't read shopId or retailer (consumer-pair with Phase 7.70)", () => {
  // Pair guard: if a future agent re-adds searchParams.get('shopId') or
  // searchParams.get('retailer') to mirror, restore the iframeSnippet
  // forwarding at the same time.
  assert.doesNotMatch(
    MIRROR,
    /searchParams\.get\(\s*['"]shopId['"]\s*\)/,
    "mirror still doesn't read shopId — if you add it back, also re-add the iframeSnippet forwarding",
  );
  assert.doesNotMatch(
    MIRROR,
    /searchParams\.get\(\s*['"]retailer['"]\s*\)/,
    "mirror still doesn't read retailer — if you add it back, also re-add the iframeSnippet forwarding",
  );
});

test("/retailer/signup script-tag embedSnippet variants still expose data-shop-id / data-retailer (telemetry attribution)", () => {
  // The <script> tag snippet (NOT iframe) must still surface
  // data-shop-id + data-retailer because embed.js reads those on the
  // PARENT window for trackEvent attribution. Only the IFRAME URL
  // forwarding was dead. Sanity-check both embedSnippet and pdpSnippet
  // still emit them so we don't accidentally regress.
  assert.match(SIGNUP, /data-shop-id="\$\{shopId\}"/, "embed/pdp snippets must still surface data-shop-id (parent-side telemetry)");
  assert.match(SIGNUP, /data-retailer="\$\{form\.shopName\}"/, "embed/pdp snippets must still surface data-retailer (parent-side telemetry)");
});
