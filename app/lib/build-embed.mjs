// Phase 8.14 — copy the <virtualfit-mirror> source into /public/embed/
// at prebuild time so it is served as a stable, cacheable URL.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(__dirname, "./virtualfit-mirror-embed.mjs");
const OUT = resolve(__dirname, "../../public/embed/virtualfit-mirror.js");
const HEADER = `/* virtualfit-mirror web component\n * Drop into any storefront:\n *   <script type="module" src="https://virtualfit.app/embed/virtualfit-mirror.js"></script>\n *   <virtualfit-mirror garment="https://.../tee.glb" fabric="cotton"></virtualfit-mirror>\n * Apache-2.0 \u00b7 https://virtualfit.app/api-docs\n */\n`;

export function emitEmbed({ srcPath = SRC, outPath = OUT } = {}) {
  const src = readFileSync(srcPath, "utf8");
  if (!existsSync(dirname(outPath))) mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, HEADER + src, "utf8");
  return { ok: true, outPath, bytes: src.length + HEADER.length };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = emitEmbed();
  console.log(`[embed] wrote ${r.bytes}B → ${r.outPath}`);
}
