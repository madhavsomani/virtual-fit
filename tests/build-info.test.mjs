import assert from "node:assert/strict";
import test from "node:test";

const ENV_KEYS = [
  "NEXT_PUBLIC_BUILD_NUMBER",
  "NEXT_PUBLIC_COMMIT_SHA",
  "NEXT_PUBLIC_BUILD_TIME",
  "NEXT_PUBLIC_BRANCH"
];

function resetEnv(overrides = {}) {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }

  Object.assign(process.env, overrides);
}

async function loadBuildInfo(caseName, overrides = {}) {
  resetEnv(overrides);

  const moduleUrl = new URL(`../lib/build-info.mjs?case=${caseName}-${Date.now()}-${Math.random()}`, import.meta.url);
  const { getBuildInfo } = await import(moduleUrl.href);
  return getBuildInfo();
}

test("getBuildInfo returns documented defaults when env is unset", async () => {
  const buildInfo = await loadBuildInfo("defaults");

  assert.deepEqual(buildInfo, {
    buildNumber: 0,
    commitSha: "0000000000000000000000000000000000000000",
    commitShaShort: "0000000",
    builtAt: "1970-01-01T00:00:00.000Z",
    branch: "unknown"
  });
});

test('getBuildInfo parses NEXT_PUBLIC_BUILD_NUMBER="42"', async () => {
  const buildInfo = await loadBuildInfo("build-number", {
    NEXT_PUBLIC_BUILD_NUMBER: "42"
  });

  assert.equal(buildInfo.buildNumber, 42);
});

test('getBuildInfo falls back to 0 for NEXT_PUBLIC_BUILD_NUMBER="abc"', async () => {
  const buildInfo = await loadBuildInfo("build-number-nan", {
    NEXT_PUBLIC_BUILD_NUMBER: "abc"
  });

  assert.equal(buildInfo.buildNumber, 0);
});

test("getBuildInfo wires commitSha through and derives commitShaShort", async () => {
  const buildInfo = await loadBuildInfo("commit-sha", {
    NEXT_PUBLIC_COMMIT_SHA: "1234567890abcdef1234567890abcdef12345678"
  });

  assert.equal(buildInfo.commitSha, "1234567890abcdef1234567890abcdef12345678");
  assert.equal(buildInfo.commitShaShort, "1234567");
});

test("getBuildInfo wires build time through", async () => {
  const buildInfo = await loadBuildInfo("build-time", {
    NEXT_PUBLIC_BUILD_TIME: "2026-04-28T12:34:56.789Z"
  });

  assert.equal(buildInfo.builtAt, "2026-04-28T12:34:56.789Z");
});

test("getBuildInfo wires branch through", async () => {
  const buildInfo = await loadBuildInfo("branch", {
    NEXT_PUBLIC_BRANCH: "ca1/VF-10-build-deploy-pipeline"
  });

  assert.equal(buildInfo.branch, "ca1/VF-10-build-deploy-pipeline");
});
