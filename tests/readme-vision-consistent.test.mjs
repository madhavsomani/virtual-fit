// Phase 7.18 — guard: README must not advertise a "2D Mirror Mode"
// feature (contradicts HARD RULE: no 2D garment rendering) and the
// test-count badge must not lie about how many unit tests exist.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const README = readFileSync(resolve(ROOT, "README.md"), "utf8");

test("README does not advertise a '2D Mirror Mode' feature", () => {
  // Allow prose that explains the absence of 2D (e.g. "No 2D fallback"), but
  // ban the old bullet title itself which framed 2D as a distinct product.
  assert.doesNotMatch(README, /\*\*2D Mirror Mode\*\*/);
  assert.doesNotMatch(README, /2D\/3D try-on/);
});

test("README test-count badge matches the actual unit-test count", () => {
  // Parse the "tests-<N>%20unit" fragment from the shields.io badge URL.
  const m = README.match(/tests-(\d+)%20unit/);
  assert.ok(m, "tests-<N>%20unit badge missing from README");
  const claimed = Number(m[1]);

  // Count `test(...)` calls across the tests/ tree as a proxy for total
  // unit-test count. Not perfect (won't catch sub-tests inside describe)
  // but close enough and doesn't require running the suite.
  let actual = 0;
  for (const f of readdirSync(resolve(ROOT, "tests")).filter((f) =>
    /\.test\.mjs$/.test(f),
  )) {
    const src = readFileSync(resolve(ROOT, "tests", f), "utf8");
    // Strip comments so prose mentions of test( don't count.
    const stripped = src
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .map((l) => l.replace(/\/\/.*$/, ""))
      .join("\n");
    actual += (stripped.match(/^\s*test\(/gm) || []).length;
  }

  // Allow the badge to trail by up to 10 tests (small bursts shouldn't
  // break CI immediately), but never exceed the real count.
  assert.ok(
    claimed <= actual,
    `Badge claims ${claimed} unit tests but only ${actual} test() calls exist`,
  );
  assert.ok(
    actual - claimed <= 10,
    `Badge says ${claimed}; repo has ${actual} test() calls. Bump the badge.`,
  );
});
