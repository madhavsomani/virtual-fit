// Phase 7.44 — guard: the dead dev HTTP server + its only consumer stay
// deleted.
//
// Pre-7.44 `api-server.ts` (121 lines) was a Node http.createServer shim
// exposing `POST /api/generate-3d` + `GET /api/generate-3d/status`, both
// delegating to `hfGenerate3D` from `lib/generate-3d.ts` (94 lines, HF
// Inference TripoSR). Neither was registered in package.json scripts;
// nothing ran the server. The package didn't even declare `tsx` (which
// the file's own usage comment told you to invoke). The only consumer of
// hfGenerate3D was the dev server itself. Both files were misleading —
// they suggested VirtualFit ships an /api/generate-3d HTTP endpoint when
// in reality the SWA function with that path was deleted in Phase 7.41
// and the live page (Phase 7.43) calls TRELLIS HF Space client-side via
// app/lib/image-to-glb.ts.

import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    let s;
    try {
      s = statSync(full);
    } catch {
      continue;
    }
    if (s.isDirectory()) {
      if (name === "node_modules" || name === ".next" || name === "dist") continue;
      walk(full, out);
    } else if (/\.(ts|tsx|js|mjs|cjs|jsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

test("api-server.ts is deleted (Phase 7.44)", () => {
  assert.ok(
    !existsSync(resolve(ROOT, "api-server.ts")),
    "api-server.ts was deleted in Phase 7.44 (zero callers, not in package.json scripts, no `tsx` dep). Do not resurrect.",
  );
});

test("lib/generate-3d.ts and the root lib/ directory are deleted", () => {
  assert.ok(
    !existsSync(resolve(ROOT, "lib/generate-3d.ts")),
    "lib/generate-3d.ts was deleted in Phase 7.44 (only consumer was api-server.ts, which is also gone).",
  );
  assert.ok(
    !existsSync(resolve(ROOT, "lib")),
    "The empty lib/ directory was removed in Phase 7.44 — the app/lib vs root-lib split was a smell. The single canonical pipeline lives in app/lib/.",
  );
});

test("no source references hfGenerate3D (the only export of the deleted module)", () => {
  // We exclude this test file itself (which mentions the symbol in this
  // very comment).
  const self = fileURLToPath(import.meta.url);
  const dirs = ["app", "api", "tests"]
    .map((d) => resolve(ROOT, d))
    .filter((d) => existsSync(d));
  const files = dirs.flatMap((d) => walk(d)).filter((f) => f !== self);
  const hits = [];
  for (const f of files) {
    let src;
    try {
      src = readFileSync(f, "utf8");
    } catch {
      continue;
    }
    // Strip /* */ block comments and // line comments so historical
    // migration notes don't false-positive.
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((l) => l.replace(/\/\/.*$/, ""))
      .join("\n");
    if (/\bhfGenerate3D\b/.test(code)) hits.push(f);
  }
  assert.deepEqual(
    hits,
    [],
    `hfGenerate3D references found in:\n${hits.join("\n")}\nThe symbol was deleted in Phase 7.44.`,
  );
});
