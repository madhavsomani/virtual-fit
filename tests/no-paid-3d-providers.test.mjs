// Phase 7.41 — guard: HARD RULE compliance.
// "NO paid APIs. Use HF Spaces (TRELLIS), HF Inference (segformer),
//  free GLBs only."
//
// Phase 7.41 deleted `api/generate-3d/` (311 lines wiring Meshy +
// HuggingFace + Replicate as fallbacks). Meshy and Replicate are paid;
// no client code called the endpoint. This test ensures the dead paid-API
// code stays dead — and that no future agent reintroduces a Meshy /
// Replicate dependency in real code paths under app/, api/, or lib/.

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

test("the deleted api/generate-3d directory does not come back", () => {
  const dead = resolve(ROOT, "api/generate-3d");
  assert.ok(
    !existsSync(dead),
    "api/generate-3d/ was deleted in Phase 7.41 (paid Meshy + Replicate). Do not resurrect it.",
  );
});

test("no source under app/, api/, lib/ references a paid 3D provider", () => {
  const targets = ["app", "api", "lib"]
    .map((d) => resolve(ROOT, d))
    .filter((d) => existsSync(d));
  const files = targets.flatMap((d) => walk(d));
  // Hits = the canonical paid-provider tokens we forbid in live code paths.
  // We use the env var names + the meshy.ai hostname to catch both
  // `process.env.MESHY_API_KEY` and `https://api.meshy.ai/...` style refs.
  const banned = [
    /\bMESHY_API_KEY\b/,
    /\bREPLICATE_API_TOKEN\b/,
    /\bmeshy\.ai\b/,
    /\bapi\.replicate\.com\b/,
  ];
  const hits = [];
  for (const f of files) {
    let src;
    try {
      src = readFileSync(f, "utf8");
    } catch {
      continue;
    }
    for (const pat of banned) {
      if (pat.test(src)) {
        hits.push(`${f}: ${pat}`);
        break;
      }
    }
  }
  assert.deepEqual(
    hits,
    [],
    `paid 3D provider references found in live code paths — HARD RULE violation:\n${hits.join("\n")}`,
  );
});

test("docs/3D_SETUP.md no longer instructs users to add MESHY_API_KEY", () => {
  const doc = resolve(ROOT, "docs/3D_SETUP.md");
  if (!existsSync(doc)) return; // doc is optional; if removed, nothing to lie about.
  const src = readFileSync(doc, "utf8");
  assert.doesNotMatch(
    src,
    /Add[^.\n]*MESHY_API_KEY/i,
    "docs/3D_SETUP.md still tells users to set MESHY_API_KEY — that path was deleted in Phase 7.41.",
  );
});
