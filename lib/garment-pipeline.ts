export type MeshGenJobStatus = "queued" | "running" | "succeeded" | "failed";

export type MeshGenJob = {
  id: string;
  garmentId: string;
  sourceImageUrl: string;
  adapter: string;
  status: MeshGenJobStatus;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  outputAssetUrl?: string;
  error?: string;
};

export type MeshGenAdapter = {
  name: string;
  generate(input: { garmentId: string; sourceImageUrl: string; outputAbsPath: string }): Promise<{ outputAssetUrl: string }>;
};

/**
 * Creates a queued mesh-generation job record.
 *
 * @param input Job identity and source payload.
 * @returns A new queued job with a generated id and ISO timestamp.
 */
export function createJob(input: { garmentId: string; sourceImageUrl: string; adapter: string }): MeshGenJob {
  return {
    id: createJobId(),
    garmentId: input.garmentId,
    sourceImageUrl: input.sourceImageUrl,
    adapter: input.adapter,
    status: "queued",
    createdAt: new Date().toISOString()
  };
}

/**
 * Returns a new job object transitioned to the next status.
 *
 * `running` jobs receive `startedAt` when missing. Terminal jobs receive
 * `finishedAt` when missing. The original job object is never mutated.
 *
 * @param job Existing job snapshot.
 * @param next Next status.
 * @param patch Optional field overrides to merge into the next snapshot.
 * @returns A fresh job object.
 */
export function transitionJob(job: MeshGenJob, next: MeshGenJobStatus, patch: Partial<MeshGenJob> = {}): MeshGenJob {
  const timestamp = new Date().toISOString();
  const nextJob: MeshGenJob = {
    ...job,
    ...patch,
    status: next
  };

  if (next === "running" && !nextJob.startedAt) {
    nextJob.startedAt = timestamp;
  }

  if (isTerminal(next) && !nextJob.finishedAt) {
    nextJob.finishedAt = timestamp;
  }

  return nextJob;
}

/**
 * Checks whether a job status is terminal.
 *
 * @param status Status to inspect.
 * @returns True for `succeeded` and `failed`.
 */
export function isTerminal(status: MeshGenJobStatus): boolean {
  return status === "succeeded" || status === "failed";
}

/**
 * Summarizes job counts by status.
 *
 * @param jobs Immutable job list.
 * @returns Aggregate totals for each status bucket.
 */
export function summarize(jobs: readonly MeshGenJob[]): {
  total: number;
  queued: number;
  running: number;
  succeeded: number;
  failed: number;
} {
  return jobs.reduce(
    (summary, job) => {
      summary.total += 1;
      summary[job.status] += 1;
      return summary;
    },
    { total: 0, queued: 0, running: 0, succeeded: 0, failed: 0 }
  );
}

function createJobId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
