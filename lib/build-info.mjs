const DEFAULT_BUILD_NUMBER = 0;
const DEFAULT_COMMIT_SHA = "0000000000000000000000000000000000000000";
const DEFAULT_BUILD_TIME = "1970-01-01T00:00:00.000Z";
const DEFAULT_BRANCH = "unknown";

const buildNumber = Number.parseInt(process.env.NEXT_PUBLIC_BUILD_NUMBER ?? "", 10);
const commitSha = process.env.NEXT_PUBLIC_COMMIT_SHA ?? DEFAULT_COMMIT_SHA;
const builtAt = process.env.NEXT_PUBLIC_BUILD_TIME ?? DEFAULT_BUILD_TIME;
const branch = process.env.NEXT_PUBLIC_BRANCH ?? DEFAULT_BRANCH;

const buildInfo = {
  buildNumber: Number.isFinite(buildNumber) ? buildNumber : DEFAULT_BUILD_NUMBER,
  commitSha,
  commitShaShort: commitSha.slice(0, 7),
  builtAt,
  branch
};

/**
 * Reads build metadata that was captured from environment variables at module load time.
 */
export function getBuildInfo() {
  return buildInfo;
}
