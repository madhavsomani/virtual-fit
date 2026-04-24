// Phase 7.43 — guard: /generate-3d uses the canonical imageToGlbPipeline
// (TRELLIS HF Space), the same path /mirror's upload uses. Pre-7.43 the
// page POSTed multipart/form-data to NEXT_PUBLIC_TRIPOSR_URL — in production
// that env was unset (page rendered "❌ not configured") and locally pointed
// at http://127.0.0.1:7860/generate3d (a personal home machine offline most
// of the time). Same brand-trust class as Phases 7.32 / 7.33 / 7.40.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const PAGE = resolve(ROOT, "app/generate-3d/page.tsx");

function code() {
  const src = readFileSync(PAGE, "utf8");
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
}

test("/generate-3d page imports imageToGlbPipeline", () => {
  const c = code();
  assert.match(
    c,
    /import\s*\{[^}]*imageToGlbPipeline[^}]*\}\s*from\s*["'][^"']*image-to-glb["']/,
    "/generate-3d must import imageToGlbPipeline from ../lib/image-to-glb (the same canonical pipeline /mirror's upload uses).",
  );
});

test("/generate-3d page no longer references NEXT_PUBLIC_TRIPOSR_URL", () => {
  const c = code();
  assert.doesNotMatch(
    c,
    /NEXT_PUBLIC_TRIPOSR_URL/,
    "NEXT_PUBLIC_TRIPOSR_URL was removed in Phase 7.43; do not reintroduce the broken self-hosted Hunyuan3D-2 path.",
  );
  // And the misleading "home service" banner must be gone.
  assert.doesNotMatch(
    c,
    /home service to be online/,
    "The 'requires the home service to be online' banner was a brand-trust violation; the page must not warn users that a personal machine has to be up.",
  );
});

test("/generate-3d page persists GLB to the same localStorage keys /mirror reads", () => {
  const c = code();
  // Mirror's load branch reads these three keys; /generate-3d must write all
  // three so the redirect to /mirror?garment=local actually works.
  for (const key of [
    "virtualfit-glb-data",
    "virtualfit-glb-provider",
    "virtualfit-glb-ts",
  ]) {
    assert.match(
      c,
      new RegExp(`localStorage\\.setItem\\(["']${key}["']`),
      `/generate-3d must persist ${key} to localStorage so /mirror's load-from-storage branch finds the GLB after redirect.`,
    );
  }
});

test(".env.local no longer ships a localhost NEXT_PUBLIC_TRIPOSR_URL", () => {
  const env = resolve(ROOT, ".env.local");
  if (!existsSync(env)) return; // optional
  const src = readFileSync(env, "utf8");
  // Strip comment lines so a "removed in Phase 7.43" note doesn't trip us.
  const live = src
    .split("\n")
    .filter((l) => !l.trim().startsWith("#"))
    .join("\n");
  assert.doesNotMatch(
    live,
    /^\s*NEXT_PUBLIC_TRIPOSR_URL\s*=/m,
    "NEXT_PUBLIC_TRIPOSR_URL was removed from .env.local in Phase 7.43.",
  );
});
