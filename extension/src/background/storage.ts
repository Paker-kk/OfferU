import type { ExtractedJob } from "../types.js";

export const JOBS_STORAGE_KEY = "collectedJobs";
export const JOBS_SCHEMA_VERSION = 1;

export interface VersionedJobsStore {
  version: number;
  jobs: ExtractedJob[];
}

export function sanitizeVersionedJobsStore(input: unknown): VersionedJobsStore {
  if (!input || typeof input !== "object") {
    return {
      version: JOBS_SCHEMA_VERSION,
      jobs: [],
    };
  }

  const record = input as {
    version?: unknown;
    jobs?: unknown;
  };

  const jobs = Array.isArray(record.jobs) ? (record.jobs as ExtractedJob[]) : [];
  const version = typeof record.version === "number" ? record.version : JOBS_SCHEMA_VERSION;

  return {
    version,
    jobs,
  };
}
