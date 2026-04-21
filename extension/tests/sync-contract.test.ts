import { describe, expect, it } from "vitest";

import {
  buildSyncPlan,
  isJobReadyToSync,
  retainUnsyncedJobs,
} from "../src/background/sync-contract";
import type { ExtractedJob } from "../src/types";

function makeJob(overrides: Partial<ExtractedJob>): ExtractedJob {
  return {
    hash_key: overrides.hash_key ?? "hk-default",
    title: overrides.title ?? "Software Engineer",
    company: overrides.company ?? "OfferU",
    location: overrides.location ?? "Shanghai",
    url: overrides.url ?? "https://example.com/job/1",
    apply_url: overrides.apply_url ?? overrides.url ?? "https://example.com/job/1",
    source: overrides.source ?? "boss",
    raw_description: overrides.raw_description ?? "job description",
    source_page_meta: overrides.source_page_meta ?? "",
    salary_min: overrides.salary_min ?? null,
    salary_max: overrides.salary_max ?? null,
    salary_text: overrides.salary_text ?? "",
    posted_at: overrides.posted_at ?? null,
    education: overrides.education ?? "",
    experience: overrides.experience ?? "",
    job_type: overrides.job_type ?? "",
    company_size: overrides.company_size ?? "",
    company_industry: overrides.company_industry ?? "",
    status: overrides.status ?? "ready_to_sync",
    created_at: overrides.created_at ?? "2026-01-01T00:00:00.000Z",
  };
}

describe("sync contract", () => {
  it("should block draft_pending_jd jobs from sync plan", () => {
    const ready = makeJob({ hash_key: "hk-ready", raw_description: "full jd" });
    const draft = makeJob({
      hash_key: "hk-draft",
      raw_description: "",
      status: "draft_pending_jd",
    });

    const plan = buildSyncPlan([ready, draft]);

    expect(plan.jobsToSync.map((job) => job.hash_key)).toEqual(["hk-ready"]);
    expect(plan.skippedDraft).toBe(1);
  });

  it("should keep unsynced jobs when only part of jobs are confirmed synced", () => {
    const syncedReady = makeJob({ hash_key: "hk-synced" });
    const failedReady = makeJob({ hash_key: "hk-failed" });
    const draft = makeJob({
      hash_key: "hk-draft",
      raw_description: "",
      status: "draft_pending_jd",
    });

    const remaining = retainUnsyncedJobs([syncedReady, failedReady, draft], [syncedReady]);

    expect(remaining.map((job) => job.hash_key)).toEqual(["hk-failed", "hk-draft"]);
  });

  it("should require title, company and jd content before syncing", () => {
    expect(
      isJobReadyToSync(
        makeJob({
          hash_key: "hk-missing-company",
          company: "",
          raw_description: "jd",
        }),
      ),
    ).toBe(false);

    expect(
      isJobReadyToSync(
        makeJob({
          hash_key: "hk-ready",
          title: "Frontend Engineer",
          company: "OfferU",
          raw_description: "jd",
        }),
      ),
    ).toBe(true);
  });
});
