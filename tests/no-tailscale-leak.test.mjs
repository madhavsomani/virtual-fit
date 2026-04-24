// Phase 7.8 — guard: HARD RULE "no Tailscale backend URLs in client code"
// must hold across the entire app source tree, not just /mirror.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP = resolve(__dirname, "../app");

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const s = statSync(p);
    if (s.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const SOURCE_FILES = walk(APP).filter((p) =>
  /\.(ts|tsx|mjs|js)$/.test(p) && !p.includes("/node_modules/"),
);

test("no Tailscale URL anywhere in app/* source", () => {
  const offenders = [];
  for (const p of SOURCE_FILES) {
    const txt = readFileSync(p, "utf8");
    if (/tail367e9e|\.ts\.net|tail[a-z0-9]+\./.test(txt)) offenders.push(p);
  }
  assert.deepEqual(
    offenders,
    [],
    `Tailscale URLs leaked into client code: ${offenders.join(", ")}`,
  );
});

test("no localhost/127.0.0.1 URL in shipped app/* source", () => {
  // The spirit of the HARD RULE is "no personal-machine URLs reach the
  // client." Hardcoded http://localhost or 127.0.0.1 is exactly that. Comments
  // (// or /* */) and string-literal docs are stripped before scanning.
  const offenders = [];
  for (const p of SOURCE_FILES) {
    let txt = readFileSync(p, "utf8");
    // Strip /* ... */ block comments and // line comments.
    txt = txt.replace(/\/\*[\s\S]*?\*\//g, "");
    txt = txt
      .split("\n")
      .map((l) => l.replace(/\/\/.*$/, ""))
      .join("\n");
    if (/https?:\/\/(localhost|127\.0\.0\.1)(:[0-9]+)?\b/.test(txt)) {
      offenders.push(p);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `Personal-machine URLs (localhost/127.0.0.1) hardcoded in app/: ${offenders.join(", ")}`,
  );
});

test("/generate-3d page no longer reads NEXT_PUBLIC_TRIPOSR_URL (Phase 7.43)", () => {
  const src = readFileSync(resolve(APP, "generate-3d/page.tsx"), "utf8");
  // Strip line + block comments — our 7.43 migration note documents the
  // removed env var by name on purpose.
  const code = src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
  // No Tailscale fallback (still belongs to the original Phase 7.8 guarantee).
  assert.doesNotMatch(code, /\|\|[\s\S]{0,80}\.ts\.net/);
  // Phase 7.43: the env var is gone from live code; keep this guard so a
  // future agent can't accidentally reintroduce the broken self-hosted path.
  assert.doesNotMatch(
    code,
    /process\.env\.NEXT_PUBLIC_TRIPOSR_URL/,
    "NEXT_PUBLIC_TRIPOSR_URL was removed in Phase 7.43 in favor of the canonical imageToGlbPipeline",
  );
  // Page must use the canonical pipeline.
  assert.match(
    code,
    /imageToGlbPipeline/,
    "/generate-3d must use imageToGlbPipeline (TRELLIS HF Space) like /mirror",
  );
});

test("/generate-3d no longer links to ?garmentTexture= (dead since Phase 7.2)", () => {
  const src = readFileSync(resolve(APP, "generate-3d/page.tsx"), "utf8");
  // Strip line comments so our own Phase 7.2 / 7.8 prose doesn't trip the regex.
  const code = src
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, ""))
    .join("\n");
  assert.doesNotMatch(code, /\?garmentTexture=/);
  // The "isMock flat-overlay" success branch is gone; only the throw remains.
  assert.doesNotMatch(code, /Image Ready \(Flat Overlay\)/);
});
