import { getBuildInfo as getBuildInfoBase } from "./build-info.mjs";

export type BuildInfo = {
  buildNumber: number;
  commitSha: string;
  commitShaShort: string;
  builtAt: string;
  branch: string;
};

/**
 * Returns build metadata captured at module load time from `process.env`.
 *
 * `NEXT_PUBLIC_BUILD_NUMBER` defaults to `0` when it is missing or not numeric.
 *
 * Why `NEXT_PUBLIC_*`: Next.js inlines these at build time so they are available
 * in both Server and Client components without runtime env lookup.
 */
export function getBuildInfo(): BuildInfo {
  return getBuildInfoBase();
}
