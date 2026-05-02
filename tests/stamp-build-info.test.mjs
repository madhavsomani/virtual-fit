import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const scriptPath = path.resolve("scripts/stamp-build-info.mjs");

test("stamp-build-info writes .env.production.local and logs a debuggable one-liner", () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "vf10-stamp-"));

  try {
    const stdout = execFileSync("node", [scriptPath], {
      cwd: tempDir,
      encoding: "utf8",
      env: {
        ...process.env,
        GITHUB_RUN_NUMBER: "99",
        GITHUB_SHA: "abcdef1234567890abcdef1234567890abcdef12",
        GITHUB_REF_NAME: "ca1/VF-10-build-deploy-pipeline"
      }
    });

    const stampedEnv = readFileSync(path.join(tempDir, ".env.production.local"), "utf8");

    assert.match(stampedEnv, /^NEXT_PUBLIC_BUILD_NUMBER=99$/m);
    assert.match(stampedEnv, /^NEXT_PUBLIC_COMMIT_SHA=abcdef1234567890abcdef1234567890abcdef12$/m);
    assert.match(stampedEnv, /^NEXT_PUBLIC_BUILD_TIME=\d{4}-\d{2}-\d{2}T.*Z$/m);
    assert.match(stampedEnv, /^NEXT_PUBLIC_BRANCH=ca1\/VF-10-build-deploy-pipeline$/m);
    assert.match(
      stdout,
      /^Stamped build #99 at \d{4}-\d{2}-\d{2}T.*Z on ca1\/VF-10-build-deploy-pipeline @ abcdef1\n$/
    );
  } finally {
    rmSync(tempDir, { force: true, recursive: true });
  }
});
