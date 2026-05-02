export type BuildInfo = {
  buildNumber: number;
  commitSha: string;
  commitShaShort: string;
  builtAt: string;
  branch: string;
};

export function getBuildInfo(): BuildInfo;
