// Phase 8.11 — Build-time generator for the static style index.
//
// Reads the catalog JSONL, embeds every garment, and writes
// `public/data/style-index.json` so the static `/style-me` page can
// fetch + serve neighbours entirely client-side. Runs as part of
// `prebuild` so the sidecar is always fresh when next build runs.

import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { readCatalog } from "./catalog-persistence.mjs";
import { embedGarment, EMBEDDING_VERSION } from "./style-embeddings.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, "../../public/data/style-index.json");

export function buildStyleIndex({ outPath = OUT_PATH } = {}) {
  const { garments } = readCatalog();
  const dim = EMBEDDING_VERSION.dim;
  const entries = garments.map((g) => ({
    id: g.id,
    name: g.name,
    category: g.category,
    fabric: g.fabric,
    imageUrl: g.imageUrl,
    glbUrl: g.glbUrl,
    palette: g.palette,
    // Vector encoded as plain-array so JSON-friendly. Float32Array on the
    // client side reconstructs zero-copy.
    vector: Array.from(embedGarment(g, dim)),
  }));
  const payload = {
    embeddingVersion: EMBEDDING_VERSION,
    generatedAt: new Date().toISOString(),
    count: entries.length,
    entries,
  };
  if (!existsSync(dirname(outPath))) mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(payload), "utf8");
  return { ok: true, count: entries.length, outPath };
}

// Allow `node app/lib/build-style-index.mjs` directly (used by prebuild).
if (import.meta.url === `file://${process.argv[1]}`) {
  const r = buildStyleIndex();
  console.log(`[style-index] wrote ${r.count} embeddings → ${r.outPath}`);
}
