export function isJobReadyToSync(job) {
    return Boolean(job.title?.trim() && job.company?.trim() && job.raw_description?.trim());
}
export function buildSyncPlan(jobs) {
    const jobsToSync = jobs.filter((job) => isJobReadyToSync(job));
    const skippedDraft = jobs.length - jobsToSync.length;
    return { jobsToSync, skippedDraft };
}
export function retainUnsyncedJobs(allJobs, syncedJobs) {
    if (syncedJobs.length === 0)
        return [...allJobs];
    const syncedKeys = new Set(syncedJobs.map((job) => job.hash_key));
    return allJobs.filter((job) => !syncedKeys.has(job.hash_key));
}
