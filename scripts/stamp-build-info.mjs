import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const DEFAULT_BUILD_NUMBER = 0;
const DEFAULT_COMMIT_SHA = "0000000000000000000000000000000000000000";
const DEFAULT_BRANCH = "unknown";

function runGit(args) {
  try {
    return execFileSync("git", args, {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim();
  } catch {
    return "";
  }
}

function resolveBuildNumber() {
  const ciValue = Number.parseInt(process.env.GITHUB_RUN_NUMBER ?? "", 10);

  if (Number.isFinite(ciValue)) {
    return ciValue;
  }

  const gitCount = Number.parseInt(runGit(["rev-list", "--count", "HEAD"]), 10);
  return Number.isFinite(gitCount) ? gitCount : DEFAULT_BUILD_NUMBER;
}

function resolveCommitSha() {
  return process.env.GITHUB_SHA || runGit(["rev-parse", "HEAD"]) || DEFAULT_COMMIT_SHA;
}

function resolveBranch() {
  return process.env.GITHUB_REF_NAME || runGit(["rev-parse", "--abbrev-ref", "HEAD"]) || DEFAULT_BRANCH;
}

const buildNumber = resolveBuildNumber();
const commitSha = resolveCommitSha();
const builtAt = new Date().toISOString();
const branch = resolveBranch();
const commitShaShort = commitSha.slice(0, 7);

const envContents = [
  `NEXT_PUBLIC_BUILD_NUMBER=${buildNumber}`,
  `NEXT_PUBLIC_COMMIT_SHA=${commitSha}`,
  `NEXT_PUBLIC_BUILD_TIME=${builtAt}`,
  `NEXT_PUBLIC_BRANCH=${branch}`,
  ""
].join("\n");

writeFileSync(".env.production.local", envContents, "utf8");

console.log(`Stamped build #${buildNumber} at ${builtAt} on ${branch} @ ${commitShaShort}`);
