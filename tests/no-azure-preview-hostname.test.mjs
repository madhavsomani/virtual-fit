// Phase 7.52 — guard: the throwaway Azure SWA preview hostname
// (wonderful-sky-0513a3610.7.azurestaticapps.net) must NEVER appear in
// any user-facing file. virtualfit.app is canonical.
//
// Pre-7.52 it was hardcoded in: public/embed.js (BASE_URL the widget
// fetches from), public/virtualfit-button.js (loader fallback),
// app/retailer/signup/page.tsx + app/retailer/page.tsx (SSR fallback for
// the embed snippet retailers copy), README.md (deploy badge + CTA).
// Same brand-trust class as Phases 7.46/7.47/7.48.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join, relative } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const NEEDLE = /azurestaticapps\.net|wonderful-sky-0513a3610/;

// Files allowed to mention the bad hostname (this guard test itself, the
// sitemap.xml migration note in an XML comment, the plan.md historical
// log, and the commit-message body baked into git history of course
// can't be policed here).
const ALLOW = new Set([
  resolve(ROOT, "tests/no-azure-preview-hostname.test.mjs"),
  resolve(ROOT, "tests/sitemap-and-robots.test.mjs"),
  resolve(ROOT, "tests/prod-deploy-divergence.test.mjs"),
  resolve(ROOT, "public/sitemap.xml"), // <!-- migration note inside XML comment -->
]);

const TEXT_EXT = new Set([
  ".ts", ".tsx", ".js", ".mjs", ".cjs", ".json", ".md", ".html", ".xml", ".txt", ".yml", ".yaml", ".css",
]);

function* walk(dir, skipDirs) {
  for (const entry of readdirSync(dir)) {
    if (skipDirs.has(entry)) continue;
    const full = join(dir, entry);
    let s;
    try { s = statSync(full); } catch { continue; }
    if (s.isDirectory()) yield* walk(full, skipDirs);
    else yield full;
  }
}

function scan(dir, skipDirs = new Set([
  "node_modules", ".next", "out", ".git", "dist", "build",
])) {
  const offenders = [];
  for (const file of walk(dir, skipDirs)) {
    if (ALLOW.has(file)) continue;
    const ext = file.slice(file.lastIndexOf("."));
    if (!TEXT_EXT.has(ext)) continue;
    let content;
    try { content = readFileSync(file, "utf8"); } catch { continue; }
    if (NEEDLE.test(content)) offenders.push(relative(ROOT, file));
  }
  return offenders;
}

test("public/ contains no reference to the Azure SWA preview hostname", () => {
  const offenders = scan(resolve(ROOT, "public"));
  assert.deepEqual(
    offenders,
    [],
    `Files under public/ leak the throwaway Azure preview hostname (use https://virtualfit.app):\n  - ${offenders.join("\n  - ")}`,
  );
});

test("app/ contains no reference to the Azure SWA preview hostname", () => {
  const offenders = scan(resolve(ROOT, "app"));
  assert.deepEqual(
    offenders,
    [],
    `Files under app/ leak the throwaway Azure preview hostname (use https://virtualfit.app):\n  - ${offenders.join("\n  - ")}`,
  );
});

test("README.md contains no reference to the Azure SWA preview hostname", () => {
  const txt = readFileSync(resolve(ROOT, "README.md"), "utf8");
  assert.doesNotMatch(
    txt,
    NEEDLE,
    "README.md still references the throwaway Azure preview hostname — replace with https://virtualfit.app.",
  );
});
