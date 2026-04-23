// Phase 5.2 — static-source assertion that /mirror's upload path uses the
// browser-direct HF pipeline (Phase 4) and never falls back to the deleted
// Tailscale/TripoSR proxy. This is a regression guard; if anyone re-introduces
// the legacy fetch path, this test fails immediately without needing a browser.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIRROR = readFileSync(
  resolve(__dirname, "../app/mirror/page.tsx"),
  "utf8",
);

test("mirror page imports imageToGlbPipeline from app/lib", () => {
  assert.match(
    MIRROR,
    /import \{\s*imageToGlbPipeline\s*\} from ["']\.\.\/lib\/image-to-glb["']/,
  );
});

test("handleUpload3D calls imageToGlbPipeline", () => {
  // Find the handler block and assert the new pipeline call appears inside it.
  const start = MIRROR.indexOf("const handleUpload3D");
  assert.ok(start > -1, "handleUpload3D not found");
  // Take a generous slice; the block is large but contained.
  const block = MIRROR.slice(start, start + 8000);
  assert.match(block, /imageToGlbPipeline\(/);
});

test("handleUpload3D no longer references NEXT_PUBLIC_TRIPOSR_URL", () => {
  assert.doesNotMatch(MIRROR, /NEXT_PUBLIC_TRIPOSR_URL/);
});

test("mirror page contains no Tailscale/ts.net backend URLs", () => {
  assert.doesNotMatch(MIRROR, /\.ts\.net/);
});

test("mirror page exposes pipeline-stage status messages", () => {
  // Confirms the new progress wiring is in place.
  assert.match(MIRROR, /Isolating garment/i);
  assert.match(MIRROR, /Generating 3D mesh on TRELLIS/i);
});
