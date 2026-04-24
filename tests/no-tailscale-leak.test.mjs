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
  // Tighten the regex from Phase 7.8: the original `tail[a-z0-9]+\.`
  // false-matched any English word containing 'tail' followed by
  // alphanumerics and a period — e.g. 'retailers.' in JSDoc. Phase 7.59
  // worked around this by rewording 2 comments in app/retailer/signup;
  // this guard tightens the pattern itself.
  //
  // Tailscale magic-DNS hostnames always end in `.ts.net` (or rarely
  // `.tsnet`). Tailnet device names are arbitrary so we can't enumerate
  // them, but we CAN require the `.ts.net` suffix in any URL we'd care
  // about leaking. The `tail367e9e` literal stays as a belt-and-suspenders
  // catch for the specific tailnet that was leaking pre-7.8.
  const offenders = [];
  for (const p of SOURCE_FILES) {
    const txt = readFileSync(p, "utf8");
    if (/\btail367e9e\b|\.ts\.net\b/.test(txt)) offenders.push(p);
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

test("Phase 7.60: tightened tailscale regex catches real leaks AND ignores 'retailers.' in prose", () => {
  // Synthetic fixtures — the regex itself, not the file walk.
  const RE = /\btail367e9e\b|\.ts\.net\b/;
  // Real leaks must still trip:
  assert.match("https://my-mac.tail367e9e.ts.net/api", RE, "must catch a literal Tailscale magic-DNS URL");
  assert.match("const URL = 'https://x.ts.net'", RE, "must catch a bare .ts.net hostname");
  assert.match("see tail367e9e for context", RE, "must catch the legacy tailnet literal");
  // Prose must NOT trip:
  assert.doesNotMatch(
    "the most valuable embed knobs are invisible to retailers.",
    RE,
    "must NOT false-match plain English 'retailers.' (the bug Phase 7.59 worked around)",
  );
  assert.doesNotMatch("// detail.com is fine", RE, "must NOT false-match 'detail.com'");
  assert.doesNotMatch("the cocktail.bar example", RE, "must NOT false-match 'cocktail.bar'");
});
