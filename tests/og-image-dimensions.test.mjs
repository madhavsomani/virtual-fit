// Phase 7.47 — guard: public/og-image.png matches the dimensions every
// social meta tag claims (1200x630).
//
// Pre-7.47 the file was 300x400 / 2.8KB while app/layout.tsx declared
// openGraph.images = [{ width: 1200, height: 630 }] and twitter.card =
// 'summary_large_image' (which requires >=2:1 at 1200x628 minimum). Twitter,
// Facebook, LinkedIn, Discord, Slack all unfurl by reading the actual image
// — a 300x400 image returned for a summary_large_image claim either renders
// microscopic, gets cropped to a sliver, or is rejected. Same brand-trust
// class as Phases 7.32 / 7.33 / 7.40 / 7.43 / 7.46.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const OG_PNG = resolve(ROOT, "public/og-image.png");
const LAYOUT = resolve(ROOT, "app/layout.tsx");

function readPngDimensions(buf) {
  // PNG signature is 8 bytes; first chunk is IHDR.
  // Width  = bytes 16..20 (big-endian uint32)
  // Height = bytes 20..24
  if (buf.length < 24) return null;
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== sig[i]) return null;
  }
  const width = buf.readUInt32BE(16);
  const height = buf.readUInt32BE(20);
  return { width, height };
}

test("public/og-image.png exists", () => {
  assert.ok(
    existsSync(OG_PNG),
    "public/og-image.png is required — the layout.tsx openGraph + twitter meta point at it.",
  );
});

test("og-image.png is exactly 1200x630 (matches openGraph + twitter declarations)", () => {
  const buf = readFileSync(OG_PNG);
  const dims = readPngDimensions(buf);
  assert.ok(dims, "og-image.png is not a valid PNG (header parse failed)");
  assert.equal(
    dims.width,
    1200,
    `og-image.png width must be 1200 (got ${dims.width}). app/layout.tsx declares openGraph.images[0].width=1200; mismatched dimensions cause Twitter/Facebook/LinkedIn to fall back to small-card layouts or reject the image.`,
  );
  assert.equal(
    dims.height,
    630,
    `og-image.png height must be 630 (got ${dims.height}). twitter.card='summary_large_image' requires >=2:1 at 1200x628 minimum.`,
  );
});

test("og-image.png is not an empty placeholder (>= 8KB)", () => {
  const size = statSync(OG_PNG).size;
  assert.ok(
    size >= 8 * 1024,
    `og-image.png is ${size} bytes — likely a placeholder. A real 1200x630 designed share card is well over 8KB.`,
  );
});

test("layout.tsx declares metadataBase so relative og URLs resolve", () => {
  const src = readFileSync(LAYOUT, "utf8");
  assert.match(
    src,
    /metadataBase\s*:\s*new URL\(\s*["']https:\/\/virtualfit\.app["']/,
    "app/layout.tsx must declare metadataBase: new URL('https://virtualfit.app') so /og-image.png resolves to a fully-qualified URL in the rendered HTML — some scrapers refuse relative meta URLs.",
  );
});
