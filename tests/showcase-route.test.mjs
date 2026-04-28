// Phase 8.5 — Showcase route contract tests.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  SHOWCASE_GARMENTS,
  mirrorUrlFor,
  findShowcaseGarment,
} from "../app/showcase/showcase-data.mjs";
import { KNOWN_FABRIC_KINDS } from "../app/lib/pbr-fabric.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

test("SHOWCASE_GARMENTS has at least 5 entries (per P8.5 spec)", () => {
  assert.ok(SHOWCASE_GARMENTS.length >= 5, `got ${SHOWCASE_GARMENTS.length}`);
});

test("every showcase garment has the required fields populated", () => {
  for (const g of SHOWCASE_GARMENTS) {
    assert.ok(g.id && /^[a-z0-9-]+$/.test(g.id), `bad id: ${g.id}`);
    assert.ok(g.name && g.name.length > 2);
    assert.ok(g.imageUrl && g.imageUrl.startsWith("/"));
    assert.ok(g.glbUrl && g.glbUrl.endsWith(".glb"));
    assert.ok(g.palette && /^#[0-9a-f]{6}$/i.test(g.palette.primary));
  }
});

test("VISION GUARD: every showcase garment has a real GLB (no 2D fallback)", () => {
  for (const g of SHOWCASE_GARMENTS) {
    assert.ok(
      g.glbUrl && g.glbUrl.endsWith(".glb"),
      `${g.id}: missing glbUrl — VISION says no 2D rendering`,
    );
    // The GLB file (or its referenced relative public asset) must exist
    // in /public so the Mirror loader can fetch it.
    const localPath = resolve(ROOT, "public", g.glbUrl.replace(/^\//, ""));
    assert.ok(
      existsSync(localPath),
      `${g.id}: GLB file missing on disk: ${localPath}`,
    );
  }
});

test("every fabric kind referenced is a KNOWN_FABRIC_KIND (PBR presets exist)", () => {
  for (const g of SHOWCASE_GARMENTS) {
    assert.ok(
      KNOWN_FABRIC_KINDS.includes(g.fabric),
      `${g.id}: fabric '${g.fabric}' not in PBR preset table`,
    );
  }
});

test("showcase covers AT LEAST 5 distinct fabric kinds (visual-fidelity goal)", () => {
  const kinds = new Set(SHOWCASE_GARMENTS.map((g) => g.fabric));
  assert.ok(
    kinds.size >= 5,
    `only ${kinds.size} distinct fabrics: ${[...kinds].join(", ")}`,
  );
});

test("ids are unique across the showcase", () => {
  const ids = SHOWCASE_GARMENTS.map((g) => g.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate ids");
});

test("mirrorUrlFor builds /mirror?garment=<glb>&showcaseId=<id>&fabric=<kind>", () => {
  const g = SHOWCASE_GARMENTS[0];
  const url = mirrorUrlFor(g);
  assert.ok(url.startsWith("/mirror?"));
  assert.ok(url.includes(`garment=${encodeURIComponent(g.glbUrl)}`));
  assert.ok(url.includes(`showcaseId=${g.id}`));
  assert.ok(url.includes(`fabric=${g.fabric}`));
});

test("mirrorUrlFor degrades gracefully on missing input", () => {
  assert.equal(mirrorUrlFor(null), "/mirror");
  assert.equal(mirrorUrlFor({}), "/mirror");
  assert.equal(mirrorUrlFor({ glbUrl: 42 }), "/mirror");
});

test("findShowcaseGarment lookup", () => {
  const first = SHOWCASE_GARMENTS[0];
  assert.equal(findShowcaseGarment(first.id)?.name, first.name);
  assert.equal(findShowcaseGarment("ghost-garment-9000"), null);
  assert.equal(findShowcaseGarment(undefined), null);
  assert.equal(findShowcaseGarment(42), null);
});

test("VISION GUARD: page.tsx never imports a 2D-fallback renderer", () => {
  const src = readFileSync(resolve(ROOT, "app/showcase/page.tsx"), "utf8");
  // Real markers of a 2D fallback in this codebase:
  //   "2d-overlay", "garmentTexture", "<img" (raw img tag for garment)
  // (next/image for thumbnails is fine — they're catalog cards, not the try-on.)
  assert.ok(!src.includes("2d-overlay"), "2d-overlay imported");
  assert.ok(
    !src.includes("garmentTexture"),
    "garmentTexture (deprecated 2D path) referenced",
  );
});

test("page.tsx is server-rendered (no 'use client') for SEO + first paint", () => {
  const src = readFileSync(resolve(ROOT, "app/showcase/page.tsx"), "utf8");
  assert.ok(
    !/^['"]use client['"]/m.test(src.split("\n").slice(0, 3).join("\n")),
    "/showcase must be server-rendered",
  );
});

test("layout.tsx exposes per-route SEO metadata", () => {
  const src = readFileSync(resolve(ROOT, "app/showcase/layout.tsx"), "utf8");
  assert.ok(src.includes("export const metadata"), "metadata export missing");
  assert.ok(src.includes("openGraph"), "OG missing");
  assert.ok(src.includes("twitter"), "twitter card missing");
});
