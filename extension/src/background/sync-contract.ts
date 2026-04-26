import type { ExtractedJob } from "../types.js";

export interface SyncPlan {
  jobsToSync: ExtractedJob[];
  skippedDraft: number;
}

export function isJobReadyToSync(job: ExtractedJob): boolean {
  return Boolean(job.title?.trim() && job.company?.trim() && job.raw_description?.trim());
}

export function buildSyncPlan(jobs: ExtractedJob[]): SyncPlan {
  const jobsToSync = jobs.filter((job) => isJobReadyToSync(job));
  const skippedDraft = jobs.length - jobsToSync.length;
  return { jobsToSync, skippedDraft };
}

export function retainUnsyncedJobs(allJobs: ExtractedJob[], syncedJobs: ExtractedJob[]): ExtractedJob[] {
  return retainUnsyncedJobsByHashKeys(allJobs, syncedJobs.map((job) => job.hash_key));
}

export function retainUnsyncedJobsByHashKeys(allJobs: ExtractedJob[], syncedHashKeys: string[]): ExtractedJob[] {
  if (syncedHashKeys.length === 0) return [...allJobs];

  const syncedKeys = new Set(syncedHashKeys.filter(Boolean));
  return allJobs.filter((job) => !syncedKeys.has(job.hash_key));
}
