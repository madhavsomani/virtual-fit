// Phase 7.69 — guard: /build-in-public build-progress snapshot must not
// drift more than 50 commits behind the actual repo (keeps the public
// stats credible). Pre-7.69 the hardcoded commits: 495 was stale vs. the
// real 542 — undermines the build-in-public narrative.

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUILD_IN_PUBLIC_PATH = resolve(__dirname, "..", "app/build-in-public/page.tsx");
const REPO_ROOT = resolve(__dirname, "..");

test("/build-in-public publicMetrics.commits is within 50 of the real git log count", () => {
  const src = readFileSync(BUILD_IN_PUBLIC_PATH, "utf8");
  const m = src.match(/commits:\s*(\d+)/);
  assert.ok(m, "/build-in-public must declare publicMetrics.commits");
  const declared = parseInt(m[1], 10);

  // Count actual commits in the repo.
  let actual = 0;
  try {
    const gitDir = resolve(REPO_ROOT, ".git");
    if (existsSync(gitDir)) {
      // Detect shallow clone (CI checkout@v4 default fetch-depth=1).
      // A shallow clone reports 1 commit while local repos report
      // hundreds — forcing a hardcoded mismatch into CI failure for
      // the entire pipeline. Skip the assertion when shallow.
      let isShallow = false;
      try {
        isShallow = execSync("git rev-parse --is-shallow-repository", {
          cwd: REPO_ROOT,
          encoding: "utf8",
        }).trim() === "true";
      } catch { /* old git without the flag; treat as not-shallow */ }
      if (isShallow) {
        // CI environment with fetch-depth: 1 (the default for
        // actions/checkout@v4). Real commit count is unknowable here;
        // the local-dev assertion is the authoritative one. Skip.
        return;
      }
      actual = parseInt(
        execSync("git log --oneline | wc -l", {
          cwd: REPO_ROOT,
          encoding: "utf8",
        }).trim(),
        10,
      );
    }
  } catch {
    // Not a git repo or git unavailable; skip the real check (CI/sandbox).
    // Just validate the field exists.
    return;
  }

  const drift = Math.abs(actual - declared);
  assert.ok(
    drift <= 50,
    `publicMetrics.commits (${declared}) drifted ${drift} commits from real (${actual}); keep within 50 so the build-in-public stats stay credible`,
  );
});

test("/build-in-public publicMetrics.tests is within 50 of the real test count", () => {
  const src = readFileSync(BUILD_IN_PUBLIC_PATH, "utf8");
  const m = src.match(/tests:\s*(\d+)/);
  assert.ok(m, "/build-in-public must declare publicMetrics.tests");
  const declared = parseInt(m[1], 10);

  // Count test() calls in tests/*.mjs
  let actual = 0;
  try {
    actual = parseInt(
      execSync("grep -rE '^\\s*test\\(' tests/*.mjs | wc -l", {
        cwd: REPO_ROOT,
        encoding: "utf8",
        shell: "/bin/bash",
      }).trim(),
      10,
    );
  } catch {
    // Not available or shell issue; skip.
    return;
  }

  const drift = Math.abs(actual - declared);
  assert.ok(
    drift <= 50,
    `publicMetrics.tests (${declared}) drifted ${drift} from real (${actual}); keep within 50`,
  );
});

test("/build-in-public publicMetrics.linesOfCode matches order-of-magnitude", () => {
  const src = readFileSync(BUILD_IN_PUBLIC_PATH, "utf8");
  const m = src.match(/linesOfCode:\s*["'](\d+)K\+["']/);
  assert.ok(m, "/build-in-public must declare linesOfCode in the form '18K+'");
  const declaredK = parseInt(m[1], 10);

  // Count lines in app/**/*.{ts,tsx} + public/**/*.{js,mjs} + tests/**/*.mjs
  let totalLines = 0;
  try {
    const appLines = parseInt(
      execSync("find app -name '*.tsx' -o -name '*.ts' | xargs cat | wc -l", {
        cwd: REPO_ROOT,
        encoding: "utf8",
        shell: "/bin/bash",
      }).trim(),
      10,
    );
    const publicTestLines = parseInt(
      execSync("find public tests -name '*.js' -o -name '*.mjs' | xargs cat | wc -l", {
        cwd: REPO_ROOT,
        encoding: "utf8",
        shell: "/bin/bash",
      }).trim(),
      10,
    );
    totalLines = appLines + publicTestLines;
  } catch {
    // Shell unavailable; skip.
    return;
  }

  const actualK = Math.floor(totalLines / 1000);
  // Within 10K to allow for normal growth without constant bumps.
  const driftK = Math.abs(actualK - declaredK);
  assert.ok(
    driftK <= 10,
    `linesOfCode ${declaredK}K+ drifted ${driftK}K from real ${actualK}K; keep within 10K`,
  );
});
