// Phase 8.13 — emit canonical OpenAPI doc to public/ at prebuild time.
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildOpenApiSpec } from "./tryon-api-spec.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "../../public/api/v1/openapi.json");

export function emitOpenApi({ outPath = OUT } = {}) {
  const spec = buildOpenApiSpec();
  if (!existsSync(dirname(outPath))) mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(spec, null, 2), "utf8");
  return { ok: true, outPath, paths: Object.keys(spec.paths) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const r = emitOpenApi();
  console.log(`[openapi] wrote ${r.paths.length} paths → ${r.outPath}`);
}
