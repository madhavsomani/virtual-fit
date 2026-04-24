// Phase 7.48 — guard: PWA icons referenced by manifest.json actually exist
// at the declared dimensions.
//
// Pre-7.48 manifest.json declared /icon-192.png and /icon-512.png with
// purpose: "any maskable", but neither file existed in public/. Chrome's
// "Install app" omnibox prompt requires a valid 192x192+ icon to fire,
// iOS "Add to Home Screen" falls back to a page screenshot, Lighthouse
// fails the installable-PWA criterion, and Android renders a generic
// globe in the task switcher. Same brand-trust class as Phases 7.32 /
// 7.33 / 7.40 / 7.43 / 7.46 / 7.47.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PUBLIC = resolve(ROOT, "public");
const MANIFEST = resolve(PUBLIC, "manifest.json");

function readPngDimensions(buf) {
  if (buf.length < 24) return null;
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) if (buf[i] !== sig[i]) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function loadManifest() {
  const txt = readFileSync(MANIFEST, "utf8");
  return JSON.parse(txt);
}

test("manifest.json parses and declares at least one icon", () => {
  const m = loadManifest();
  assert.ok(Array.isArray(m.icons), "manifest.icons must be an array");
  assert.ok(m.icons.length > 0, "manifest must declare at least one icon");
});

test("every icon referenced by manifest.json exists in public/", () => {
  const m = loadManifest();
  for (const icon of m.icons) {
    assert.ok(typeof icon.src === "string", `icon entry missing src: ${JSON.stringify(icon)}`);
    const rel = icon.src.replace(/^\//, "");
    const path = join(PUBLIC, rel);
    assert.ok(
      existsSync(path),
      `manifest references ${icon.src} but ${path} does not exist — Chrome 'Install' prompt and iOS 'Add to Home Screen' will fail.`,
    );
  }
});

test("each manifest icon's PNG dimensions match its declared sizes", () => {
  const m = loadManifest();
  for (const icon of m.icons) {
    const rel = icon.src.replace(/^\//, "");
    const path = join(PUBLIC, rel);
    const buf = readFileSync(path);
    const dims = readPngDimensions(buf);
    assert.ok(dims, `${icon.src} is not a valid PNG`);
    // sizes is "192x192" (or space-separated list). Use the first.
    const declared = String(icon.sizes || "").split(/\s+/)[0];
    const m1 = declared.match(/^(\d+)x(\d+)$/);
    assert.ok(m1, `manifest icon ${icon.src} has malformed sizes: ${icon.sizes}`);
    const [, w, h] = m1;
    assert.equal(
      dims.width,
      Number(w),
      `${icon.src} width ${dims.width} ≠ declared ${w} (manifest claims sizes="${icon.sizes}").`,
    );
    assert.equal(
      dims.height,
      Number(h),
      `${icon.src} height ${dims.height} ≠ declared ${h} (manifest claims sizes="${icon.sizes}").`,
    );
  }
});

test("icon files are not empty placeholders (>= 2KB each)", () => {
  const m = loadManifest();
  for (const icon of m.icons) {
    const rel = icon.src.replace(/^\//, "");
    const size = statSync(join(PUBLIC, rel)).size;
    assert.ok(
      size >= 2 * 1024,
      `${icon.src} is ${size} bytes — likely a placeholder. A real branded PNG icon is well over 2KB.`,
    );
  }
});

test("manifest icons declare 'any' or 'maskable' purpose (W3C installability)", () => {
  const m = loadManifest();
  // Per W3C, installability requires at least one icon with purpose
  // including 'any' (or no purpose, which defaults to 'any').
  const ok = m.icons.some((icon) => {
    const purpose = String(icon.purpose ?? "any").toLowerCase();
    return purpose.split(/\s+/).some((p) => p === "any" || p === "maskable");
  });
  assert.ok(
    ok,
    "At least one manifest icon must have purpose including 'any' or 'maskable' for PWA installability.",
  );
});
