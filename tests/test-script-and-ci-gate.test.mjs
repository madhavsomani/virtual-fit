// Phase 7.45 — guard: the safety net is only real if it runs. Pre-7.45,
// `package.json` shipped 10 per-file `test:*` shortcuts but no canonical
// `npm test`, and `.github/workflows/deploy.yml` ran only `pnpm install`
// + `pnpm run build` before deploying to Azure SWA. Zero of our 292 unit
// tests gated production. Every guard added in Phases 7.32–7.44 was a
// tripwire that did not actually fire in CI.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = resolve(__dirname, "..");
const PKG = resolve(APP_ROOT, "package.json");
const WORKFLOW = resolve(APP_ROOT, ".github/workflows/deploy.yml");

test("package.json scripts.test runs every tests/*.test.mjs", () => {
  const pkg = JSON.parse(readFileSync(PKG, "utf8"));
  const scripts = pkg.scripts || {};
  assert.ok(
    typeof scripts.test === "string" && scripts.test.length > 0,
    "scripts.test is missing — there must be a canonical `npm test` that runs the whole tests/ suite, not just per-file shortcuts.",
  );
  assert.match(
    scripts.test,
    /node\s+--test\s+tests\/\*\.test\.mjs/,
    `scripts.test must be \`node --test tests/*.test.mjs\` (got: ${scripts.test}). The CI gate (Phase 7.45) depends on this exact invocation.`,
  );
});

test("CI workflow gates the build/deploy on the test suite", () => {
  if (!existsSync(WORKFLOW)) {
    assert.fail(
      `${WORKFLOW} is missing — the GitHub Actions deploy workflow is what enforces the test gate added in Phase 7.45.`,
    );
  }
  const yml = readFileSync(WORKFLOW, "utf8");
  // Must invoke the test suite somewhere in the build job.
  assert.match(
    yml,
    /\b(pnpm|npm|yarn)\s+(run\s+)?test\b/,
    "deploy.yml must invoke `pnpm test` (or equivalent) so test failures block deploys. Without this, every guard test in tests/ is decorative.",
  );
});

test("Tests step runs BEFORE the Build step in deploy.yml (fail fast)", () => {
  const yml = readFileSync(WORKFLOW, "utf8");
  // Find the first occurrence of a test invocation and the first build invocation.
  const testIdx = yml.search(/\b(pnpm|npm|yarn)\s+(run\s+)?test\b/);
  // Match a real build invocation: `pnpm run build` or `pnpm build` or `npm run build`.
  // We avoid matching the `Install & Build` step name from older history by
  // requiring the package-manager prefix.
  const buildIdx = yml.search(/\b(pnpm|npm|yarn)\s+(run\s+)?build\b/);
  assert.ok(testIdx >= 0, "no test invocation found in deploy.yml");
  assert.ok(buildIdx >= 0, "no build invocation found in deploy.yml");
  assert.ok(
    testIdx < buildIdx,
    `Tests must run BEFORE the Next build to fail fast. testIdx=${testIdx}, buildIdx=${buildIdx} in deploy.yml.`,
  );
});
