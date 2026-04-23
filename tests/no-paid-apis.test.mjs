// Phase 7.10 — guard: HARD RULE "NO paid APIs". Ban Meshy/Replicate/OpenAI
// from app/** and from the dev api-server.ts.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP = resolve(__dirname, "../app");
const ROOT = resolve(__dirname, "..");

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

const APP_FILES = walk(APP).filter((p) =>
  /\.(ts|tsx|mjs|js)$/.test(p) && !p.includes("/node_modules/"),
);

const PAID_PATTERNS = [
  /\bMESHY_API_KEY\b/,
  /api\.meshy\.ai/,
  /\bmeshyCreateTask\b/,
  /\bmeshyPollTask\b/,
  /api\.replicate\.com/,
  /\bREPLICATE_API_TOKEN\b/,
  /api\.openai\.com/,
];

function scan(files, label) {
  const offenders = [];
  for (const p of files) {
    let txt = readFileSync(p, "utf8");
    // Strip block + line comments so prose mentioning the dead names is fine.
    txt = txt.replace(/\/\*[\s\S]*?\*\//g, "");
    txt = txt
      .split("\n")
      .map((l) => l.replace(/\/\/.*$/, ""))
      .join("\n");
    for (const re of PAID_PATTERNS) {
      if (re.test(txt)) {
        offenders.push(`${p} :: matches ${re}`);
        break;
      }
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `Paid-API references in ${label}:\n  ${offenders.join("\n  ")}`,
  );
}

test("app/** source is free of paid-API references", () => {
  scan(APP_FILES, "app/**");
});

test("api-server.ts (dev tool) is free of paid-API references", () => {
  scan([resolve(ROOT, "api-server.ts")], "api-server.ts");
});

test("root lib/ (server-only modules) is free of paid-API references", () => {
  // Phase 7.13: `generate-3d.ts` lives at root `lib/` now (see file move).
  // Scan it (and any future siblings) for the same paid-API patterns.
  const ROOT_LIB = resolve(ROOT, "lib");
  let files = [];
  try {
    files = walk(ROOT_LIB).filter((p) => /\.(ts|tsx|mjs|js)$/.test(p));
  } catch {
    // dir may not exist if nothing has been moved yet — skip silently.
    return;
  }
  scan(files, "lib/**");
});
