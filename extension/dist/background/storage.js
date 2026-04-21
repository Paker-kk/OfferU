export const JOBS_STORAGE_KEY = "collectedJobs";
export const JOBS_SCHEMA_VERSION = 1;
export function sanitizeVersionedJobsStore(input) {
    if (!input || typeof input !== "object") {
        return {
            version: JOBS_SCHEMA_VERSION,
            jobs: [],
        };
    }
    const record = input;
    const jobs = Array.isArray(record.jobs) ? record.jobs : [];
    const version = typeof record.version === "number" ? record.version : JOBS_SCHEMA_VERSION;
    return {
        version,
        jobs,
    };
}
