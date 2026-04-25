// Phase 7.72 — guard: the "Open Try-On Preview" link in /retailer/signup
// must (a) NOT include &shopId= or &retailer= URL params (mirror never
// reads them — Phase 7.70 + 7.71 stripped the same dead params from
// embed.js's iframe URL builder and the iframeSnippet template), and
// (b) MUST include &primaryColor= so the preview the retailer sees
// actually reflects THEIR brand color (the whole point of "see what
// your customers will get").

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

// Slice out the "Open Try-On Preview" anchor href so unrelated mentions
// elsewhere in the file don't false-positive. The href is on a single
// template-literal line so just grab the line.
function previewHrefLine() {
  // Find the "Open Try-On Preview" button text first, then walk
  // backwards to the href line above it.
  const labelIdx = SIGNUP.indexOf("Open Try-On Preview");
  assert.ok(labelIdx > -1, "/retailer/signup must still have an 'Open Try-On Preview' button");
  const before = SIGNUP.slice(0, labelIdx);
  const hrefIdx = before.lastIndexOf("href={`/mirror/");
  assert.ok(
    hrefIdx > -1,
    "preview button's href={`/mirror/...`} must exist immediately above the button text",
  );
  // Walk to the closing backtick.
  const tickEnd = SIGNUP.indexOf("`", hrefIdx + 7);
  return SIGNUP.slice(hrefIdx, tickEnd + 1);
}

test("/retailer/signup preview link does NOT include &shopId= URL param", () => {
  const href = previewHrefLine();
  assert.doesNotMatch(
    href,
    /[?&]shopId=/,
    "preview link must not include &shopId= — mirror never reads it (Phases 7.70+7.71 stripped the same elsewhere)",
  );
});

test("/retailer/signup preview link does NOT include &retailer= URL param", () => {
  const href = previewHrefLine();
  assert.doesNotMatch(
    href,
    /[?&]retailer=/,
    "preview link must not include &retailer= — mirror never reads it",
  );
});

test("/retailer/signup preview link DOES include &primaryColor= so the retailer sees their brand color", () => {
  const href = previewHrefLine();
  assert.match(
    href,
    /[?&]primaryColor=/,
    "preview link must include &primaryColor= — the whole point of 'see what your customers will get' is showing the retailer's brand color in the preview, not VirtualFit purple",
  );
  assert.match(
    href,
    /encodeURIComponent\(brandColor\)/,
    "primaryColor value must come from the form's brandColor state via encodeURIComponent",
  );
});

test("/retailer/signup preview link still includes embed=true (regression hammer)", () => {
  const href = previewHrefLine();
  assert.match(
    href,
    /[?&]embed=true/,
    "preview link must still include embed=true — gates the embedded layout in mirror",
  );
});
