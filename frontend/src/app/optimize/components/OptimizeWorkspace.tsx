"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button, Chip, Input, Select, SelectItem, Spinner } from "@nextui-org/react";
import {
  CheckCircle2,
  FolderOpen,
  Layers3,
  ListChecks,
  Play,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import { jobsApi } from "@/lib/api";
import { bauhausFieldClassNames, bauhausSelectClassNames } from "@/lib/bauhaus";
import {
  Job,
  OptimizeDoneEvent,
  OptimizeGenerateResult,
  OptimizeProgressEvent,
  ResumeBrief,
  streamOptimizeGenerate,
  useProfile,
  usePools,
  useResumes,
} from "@/lib/hooks";

type PoolFilter = "all" | "ungrouped" | number;

interface OptimizeWorkspaceProps {
  seedJobIds?: number[];
}

const MAX_GENERATE_JOB_COUNT = 20;

const SECTION_TYPE_LABELS: Record<string, string> = {
  education: "Education",
  internship: "Internship",
  experience: "Experience",
  project: "Project",
  activity: "Activity",
  competition: "Competition",
  skill: "Skill",
  certificate: "Certificate",
  honor: "Honor",
  language: "Language",
};

function formatSectionTypeLabel(sectionType: string) {
  return SECTION_TYPE_LABELS[sectionType] || sectionType;
}

function getPoolButtonClassName(active: boolean, tone: "yellow" | "red" | "white" = "white") {
  if (active) {
    const activeMap = {
      yellow: "bg-[#F0C020] text-black",
      red: "bg-[#D02020] text-white",
      white: "bg-white text-black",
    };
    return `border-2 border-black px-3 py-2 text-xs font-semibold tracking-[0.06em] shadow-[2px_2px_0_0_rgba(18,18,18,0.3)] transition-transform hover:-translate-y-[1px] ${activeMap[tone]}`;
  }

  return "border-2 border-black bg-transparent px-3 py-2 text-xs font-semibold tracking-[0.06em] shadow-[2px_2px_0_0_rgba(18,18,18,0.3)] transition-transform hover:-translate-y-[1px] hover:bg-white hover:text-black";
}

function getLocationLabel(job: Job) {
  return job.location || "Unknown";
}

export function OptimizeWorkspace({ seedJobIds = [] }: OptimizeWorkspaceProps) {
  const normalizedSeedJobIds = useMemo(
    () => Array.from(new Set(seedJobIds.filter((id) => Number.isFinite(id) && id > 0))),
    [seedJobIds]
  );
  const lastAppliedSeedRef = useRef("");
  const [poolFilter, setPoolFilter] = useState<PoolFilter>("all");
  const [keyword, setKeyword] = useState("");
  const [mode, setMode] = useState<"per_job" | "combined">("per_job");
  const [selectedJobIds, setSelectedJobIds] = useState<number[]>(normalizedSeedJobIds);
  const [referenceResumeId, setReferenceResumeId] = useState<number | null>(null);

  const [generating, setGenerating] = useState(false);
  const [progressEvents, setProgressEvents] = useState<OptimizeProgressEvent[]>([]);
  const [results, setResults] = useState<OptimizeGenerateResult[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [doneSummary, setDoneSummary] = useState<OptimizeDoneEvent | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const { data: profileData, isLoading: loadingProfile } = useProfile();

  useEffect(() => {
    const seedSignature = normalizedSeedJobIds.join(",");
    if (!seedSignature) {
      lastAppliedSeedRef.current = "";
      return;
    }
    if (seedSignature === lastAppliedSeedRef.current) return;
    setSelectedJobIds(normalizedSeedJobIds);
    lastAppliedSeedRef.current = seedSignature;
  }, [normalizedSeedJobIds]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const poolIdForQuery = poolFilter === "all" ? undefined : poolFilter;
  const { data: pools } = usePools("picked");
  const { data: resumeListData } = useResumes();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [jobsTotal, setJobsTotal] = useState(0);
  const profileSectionCount = profileData?.sections?.length || 0;
  const referenceResumes: ResumeBrief[] = Array.isArray(resumeListData) ? resumeListData : [];
  const overSelectionLimit = selectedJobIds.length > MAX_GENERATE_JOB_COUNT;
  const canGenerate =
    selectedJobIds.length > 0 &&
    !generating &&
    profileSectionCount > 0 &&
    !overSelectionLimit;

  useEffect(() => {
    let cancelled = false;
    const keywordText = keyword.trim();

    const loadJobs = async () => {
      setLoadingJobs(true);
      try {
        const pageSize = 100;
        let page = 1;
        let total = 0;
        const all: Job[] = [];

        while (true) {
          const result = await jobsApi.list({
            page,
            page_size: pageSize,
            triage_status: "picked",
            pool_id: poolIdForQuery,
            keyword: keywordText || undefined,
          });

          const items = Array.isArray((result as any)?.items) ? ((result as any).items as Job[]) : [];
          total = Number((result as any)?.total || 0);
          all.push(...items);

          if (all.length >= total || items.length === 0) {
            break;
          }
          page += 1;
        }

        if (!cancelled) {
          const deduped = Array.from(new Map(all.map((job) => [job.id, job])).values());
          setJobs(deduped);
          setJobsTotal(total || deduped.length);
        }
      } catch {
        if (!cancelled) {
          setJobs([]);
          setJobsTotal(0);
        }
      } finally {
        if (!cancelled) {
          setLoadingJobs(false);
        }
      }
    };

    void loadJobs();

    return () => {
      cancelled = true;
    };
  }, [poolIdForQuery, keyword]);

  useEffect(() => {
    if (loadingJobs) return;
    const visibleIds = new Set(jobs.map((job) => job.id));
    setSelectedJobIds((prev) => prev.filter((id) => visibleIds.has(id)));
  }, [jobs, loadingJobs]);

  const selectedCountInCurrentList = useMemo(
    () => jobs.filter((job) => selectedJobIds.includes(job.id)).length,
    [jobs, selectedJobIds]
  );
  const allSelectedInCurrent = jobs.length > 0 && selectedCountInCurrentList === jobs.length;
  const totalJobsInCurrentPool = useMemo(
    () => Math.max(jobsTotal, jobs.length),
    [jobsTotal, jobs.length]
  );

  const progressRatio = useMemo(() => {
    if (!doneSummary && progressEvents.length === 0) return 0;
    const total = doneSummary?.total || selectedJobIds.length || 1;
    const done = doneSummary ? doneSummary.created + doneSummary.failed : progressEvents.length;
    return Math.min(100, Math.round((done / total) * 100));
  }, [doneSummary, progressEvents.length, selectedJobIds.length]);

  const toggleJob = (jobId: number) => {
    setSelectedJobIds((prev) =>
      prev.includes(jobId) ? prev.filter((id) => id !== jobId) : [...prev, jobId]
    );
  };

  const toggleSelectAllInCurrentList = () => {
    if (allSelectedInCurrent) {
      setSelectedJobIds([]);
      return;
    }

    setSelectedJobIds((prev) => {
      const next = new Set(prev);
      for (const job of jobs) {
        next.add(job.id);
      }
      return Array.from(next);
    });
  };

  const startGenerate = async () => {
    if (!canGenerate) return;

    const effectiveJobIds = Array.from(new Set(selectedJobIds));
    if (effectiveJobIds.length > MAX_GENERATE_JOB_COUNT) {
      setErrors([
        `本次最多支持 ${MAX_GENERATE_JOB_COUNT} 个岗位，当前已选择 ${effectiveJobIds.length} 个，请先缩小范围后再生成。`,
      ]);
      return;
    }

    setGenerating(true);
    setProgressEvents([]);
    setResults([]);
    setErrors([]);
    setDoneSummary(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamOptimizeGenerate(
        {
          job_ids: effectiveJobIds,
          mode,
          ...(referenceResumeId ? { reference_resume_id: referenceResumeId } : {}),
        },
        {
          signal: controller.signal,
          onEvent: ({ event, data }) => {
            if (event === "progress") {
              setProgressEvents((prev) => {
                if (typeof data?.job_id !== "number") return [...prev, data as OptimizeProgressEvent];
                const rest = prev.filter((item) => item.job_id !== data.job_id);
                return [...rest, data as OptimizeProgressEvent];
              });
              return;
            }

            if (event === "result") {
              setResults((prev) => [...prev, data as OptimizeGenerateResult]);
              return;
            }

            if (event === "error") {
              const line = `${data?.job_title || "任务"}: ${data?.message || "生成失败"}`;
              setErrors((prev) => [...prev, line]);
              return;
            }

            if (event === "done") {
              setDoneSummary(data as OptimizeDoneEvent);
            }
          },
        }
      );
    } catch (err: any) {
      if (err?.name !== "AbortError") {
        setErrors((prev) => [...prev, err.message || "生成失败"]);
      }
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1fr_1.05fr]">
      <section className="bauhaus-panel overflow-hidden bg-[#F0C020] text-black">
        <div className="border-b-2 border-black p-5 md:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <span className="bauhaus-chip bg-white text-black">Scope Builder</span>
              <div>
                <p className="bauhaus-label text-black/55">Step One</p>
                <h2 className="mt-2 text-3xl font-black uppercase leading-[0.9] tracking-[-0.07em] md:text-4xl">
                  Filter
                  <br />
                  Pick
                  <br />
                  Direct
                </h2>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              <div className="bauhaus-panel-sm bg-white p-3">
                <p className="bauhaus-label text-black/55">Profile</p>
                <p className="mt-2 text-2xl font-black uppercase tracking-[-0.05em]">
                  {loadingProfile ? "--" : profileSectionCount}
                </p>
              </div>
              <div className="bauhaus-panel-sm !bg-[#1040C0] p-3 text-white">
                <p className="bauhaus-label text-white/65">Selected</p>
                <p className="mt-2 text-2xl font-black uppercase tracking-[-0.05em]">
                  {selectedJobIds.length}
                </p>
              </div>
              <div className="bauhaus-panel-sm !bg-[#D02020] p-3 text-white">
                <p className="bauhaus-label text-white/65">Mode</p>
                <p className="mt-2 text-xl font-black uppercase tracking-[-0.05em]">
                  {mode === "per_job" ? "Per Job" : "Combined"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-5 md:p-6">
          {!loadingProfile && profileSectionCount === 0 && (
            <div className="bauhaus-panel-sm bg-white px-4 py-4 text-sm font-medium leading-relaxed text-black/72">
              当前还没有可复用的档案条目。先去
              <Link href="/profile" className="mx-1 font-bold underline">
                个人档案
              </Link>
              完成确认，再回来批量生成简历。
            </div>
          )}

          {overSelectionLimit && (
            <div className="bauhaus-panel-sm bg-[#D02020] px-4 py-4 text-sm font-medium leading-relaxed text-white">
              当前已选择 {selectedJobIds.length} 个岗位，超过单次上限 {MAX_GENERATE_JOB_COUNT}。
            </div>
          )}

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <FolderOpen size={18} strokeWidth={2.6} />
              <p className="bauhaus-label text-black/65">Pool Filter</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={getPoolButtonClassName(poolFilter === "all", "white")}
                onClick={() => setPoolFilter("all")}
              >
                All Picked
              </button>
              <button
                type="button"
                className={getPoolButtonClassName(poolFilter === "ungrouped", "red")}
                onClick={() => setPoolFilter("ungrouped")}
              >
                Ungrouped
              </button>
              {(pools || []).map((pool) => (
                <button
                  key={pool.id}
                  type="button"
                  className={getPoolButtonClassName(poolFilter === pool.id, "yellow")}
                  onClick={() => setPoolFilter(pool.id)}
                >
                  {pool.name}
                </button>
              ))}
            </div>
          </div>

          <Input
            size="sm"
            label="Keyword"
            placeholder="搜索岗位标题、公司或关键词"
            value={keyword}
            onValueChange={setKeyword}
            startContent={<Search size={15} className="text-black/55" />}
            classNames={bauhausFieldClassNames}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles size={18} strokeWidth={2.6} />
                <p className="bauhaus-label text-black/65">Generate Mode</p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  aria-pressed={mode === "per_job"}
                  className={getPoolButtonClassName(mode === "per_job", "red")}
                  onClick={() => setMode("per_job")}
                >
                  Per Job
                </button>
                <button
                  type="button"
                  aria-pressed={mode === "combined"}
                  className={getPoolButtonClassName(mode === "combined", "white")}
                  onClick={() => setMode("combined")}
                >
                  Combined
                </button>
              </div>
            </div>

            <Select
              aria-label="Reference resume"
              label="Reference Resume"
              placeholder="可选：指定参考简历"
              selectedKeys={referenceResumeId ? [String(referenceResumeId)] : []}
              onSelectionChange={(keys) => {
                const raw = Array.from(keys)[0] as string | undefined;
                setReferenceResumeId(raw ? Number(raw) : null);
              }}
              classNames={{ ...bauhausSelectClassNames, base: "w-full" }}
            >
              {referenceResumes.map((resume) => (
                <SelectItem key={String(resume.id)}>
                  {resume.title || `简历 #${resume.id}`}
                </SelectItem>
              ))}
            </Select>
          </div>

          <div className="bauhaus-panel-sm bg-white px-4 py-4 text-sm font-medium leading-relaxed text-black/72">
            参考简历只会影响表达方式和版面倾向，事实来源仍然限定为档案中已确认的内容。
          </div>

          <Button
            className="bauhaus-button bauhaus-button-red w-full !justify-center"
            startContent={<Play size={16} />}
            onPress={startGenerate}
            isDisabled={!canGenerate}
            isLoading={generating}
          >
            Start Generate
          </Button>
        </div>
      </section>

      <section className="bauhaus-panel overflow-hidden bg-[#1040C0] text-white">
        <div className="border-b-2 border-black p-5 md:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="bauhaus-label text-white/68">Step Two</p>
              <h2 className="mt-2 text-3xl font-black uppercase leading-[0.92] tracking-[-0.07em] md:text-4xl">
                Select
                <br />
                Queue
              </h2>
            </div>
            <div className="bauhaus-panel-sm bg-[#F0C020] px-4 py-3 text-black">
              <p className="bauhaus-label text-black/55">Visible Jobs</p>
              <p className="mt-2 text-2xl font-black uppercase tracking-[-0.05em]">{jobs.length}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ListChecks size={18} strokeWidth={2.6} />
              <p className="bauhaus-label text-white/70">Current Queue</p>
            </div>
            <Chip className="bauhaus-chip bg-white text-black">
              {selectedCountInCurrentList} / {totalJobsInCurrentPool}
            </Chip>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              className="bauhaus-button bauhaus-button-yellow !min-h-11 !px-4 !py-3"
              onPress={toggleSelectAllInCurrentList}
              isDisabled={jobs.length === 0}
            >
              {allSelectedInCurrent ? "Clear Visible" : "Select Visible"}
            </Button>
          </div>

          <div className="bauhaus-panel-sm max-h-[32rem] space-y-3 overflow-y-auto bg-white p-3 text-black custom-scrollbar">
            {loadingJobs ? (
              <div className="flex min-h-48 items-center justify-center gap-3 text-sm font-medium text-black/70">
                <Spinner size="sm" color="warning" />
                <span>正在加载岗位列表…</span>
              </div>
            ) : jobs.length === 0 ? (
              <div className="flex min-h-48 items-center justify-center text-center text-sm font-medium text-black/60">
                当前筛选范围内没有岗位。
              </div>
            ) : (
              jobs.map((job, index) => {
                const checked = selectedJobIds.includes(job.id);
                return (
                  <button
                    key={job.id}
                    type="button"
                    onClick={() => toggleJob(job.id)}
                    className={`w-full border-2 border-black p-4 text-left shadow-[2px_2px_0_0_rgba(18,18,18,0.3)] transition-transform hover:-translate-y-[1px] ${
                      checked ? "bg-[#F0C020]" : "bg-[#F0F0F0]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="bauhaus-label text-black/55">#{String(index + 1).padStart(2, "0")}</p>
                        <h3 className="mt-1 line-clamp-2 text-lg font-black uppercase tracking-[-0.05em]">
                          {job.title}
                        </h3>
                        <p className="mt-2 text-sm font-semibold tracking-[0.04em] text-black/68">
                          {job.company}
                        </p>
                        <p className="mt-2 text-sm font-medium leading-relaxed text-black/72">
                          {getLocationLabel(job)}
                        </p>
                      </div>

                      <span
                        className={`flex h-11 w-11 items-center justify-center border-2 border-black ${
                          checked ? "bg-[#1040C0] text-white" : "bg-white text-black"
                        }`}
                      >
                        <CheckCircle2 size={18} strokeWidth={2.6} />
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          <div className="bauhaus-panel-sm bg-[#F0C020] px-4 py-4 text-sm font-medium leading-relaxed text-black/75">
            当前池内共 {totalJobsInCurrentPool} 个岗位，本轮已选择 {selectedCountInCurrentList} 个。
          </div>
        </div>
      </section>

      <section className="bauhaus-panel overflow-hidden bg-[#D02020] text-white">
        <div className="border-b-2 border-black p-5 md:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="bauhaus-label text-white/68">Step Three</p>
              <h2 className="mt-2 text-3xl font-black uppercase leading-[0.92] tracking-[-0.07em] md:text-4xl">
                Build
                <br />
                Output
              </h2>
            </div>
            <div className="bauhaus-panel-sm bg-white px-4 py-3 text-black">
              <p className="bauhaus-label text-black/55">Progress</p>
              <p className="mt-2 text-2xl font-black uppercase tracking-[-0.05em]">{progressRatio}%</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-5 md:p-6">
          <div className="flex items-center gap-2">
            <Layers3 size={18} strokeWidth={2.6} />
            <p className="bauhaus-label text-white/70">Result Stack</p>
          </div>

          <div className="bauhaus-panel-sm overflow-hidden bg-white text-black">
            <div
              className="h-4 bg-[#F0F0F0]"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressRatio}
            >
              <div
                className="h-full border-r-2 border-black bg-[#F0C020] transition-all duration-300 ease-out"
                style={{ width: `${progressRatio}%` }}
              />
            </div>
            <div className="flex items-center justify-between px-4 py-3 text-sm font-semibold tracking-[0.04em]">
              <span>Generated {results.length}</span>
              <span>{doneSummary ? `${doneSummary.created} success / ${doneSummary.failed} failed` : "waiting"}</span>
            </div>
          </div>

          {doneSummary && (
            <div className="bauhaus-panel-sm bg-[#F0C020] px-4 py-4 text-sm font-medium leading-relaxed text-black">
              本轮已完成，共生成 {doneSummary.created} 份简历，失败 {doneSummary.failed} 份。
            </div>
          )}

          {errors.length > 0 && (
            <div className="space-y-3">
              {errors.map((line, idx) => (
                <div
                  key={`${line}-${idx}`}
                  className="bauhaus-panel-sm bg-white px-4 py-4 text-sm font-medium leading-relaxed text-[#D02020]"
                >
                  {line}
                </div>
              ))}
            </div>
          )}

          <div className="bauhaus-panel-sm max-h-[32rem] space-y-3 overflow-y-auto bg-[#F0F0F0] p-3 text-black custom-scrollbar">
            {results.length === 0 ? (
              <div className="flex min-h-48 items-center justify-center text-center text-sm font-medium leading-relaxed text-black/60">
                生成后的简历、命中条目和缺失关键词会出现在这里。
              </div>
            ) : (
              results.map((item, index) => (
                <article
                  key={`${item.resume_id}-${item.mode}-${item.job_id || "combined"}`}
                  className="border-2 border-black bg-white p-4 shadow-[2px_2px_0_0_rgba(18,18,18,0.3)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="bauhaus-label text-black/55">{item.mode === "combined" ? "Combined" : "Per Job"}</p>
                      <h3 className="mt-1 line-clamp-2 text-xl font-black uppercase tracking-[-0.05em]">
                        {item.resume_title}
                      </h3>
                      <p className="mt-2 text-sm font-medium leading-relaxed text-black/72">
                        {item.job_title || "多岗位综合版本"}
                      </p>
                    </div>

                    <span
                      className={`bauhaus-chip ${
                        index % 3 === 0
                          ? "bg-[#1040C0] text-white"
                          : index % 3 === 1
                            ? "bg-[#F0C020] text-black"
                            : "bg-[#D02020] text-white"
                      }`}
                    >
                      Hit {item.profile_hit_ratio}
                    </span>
                  </div>

                  {(item.used_bullets || []).length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="bauhaus-label text-black/55">Used Profile Blocks</p>
                      <div className="flex flex-wrap gap-2">
                        {(item.used_bullets || []).slice(0, 6).map((bullet) => (
                          <span
                            key={`${item.resume_id}-${bullet.id}`}
                            className="bauhaus-chip bg-[#F0F0F0] text-black"
                          >
                            {formatSectionTypeLabel(bullet.section_type)}
                            {bullet.title}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {(item.missing_keywords || []).length > 0 && (
                    <div className="mt-4 space-y-2">
                      <p className="bauhaus-label text-black/55">Missing Keywords</p>
                      <div className="flex flex-wrap gap-2">
                        {(item.missing_keywords || []).slice(0, 8).map((kw, keywordIndex) => (
                          <span
                            key={`${item.resume_id}-${kw}`}
                            className={`bauhaus-chip ${
                              keywordIndex % 2 === 0
                                ? "bg-[#D02020] text-white"
                                : "bg-[#F0C020] text-black"
                            }`}
                          >
                            {kw}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/resume/${item.resume_id}`} className="bauhaus-button bauhaus-button-blue">
                      Open Resume
                    </Link>
                  </div>
                </article>
              ))
            )}
          </div>

          <Button
            className="bauhaus-button bauhaus-button-outline w-full !justify-center"
            startContent={<RefreshCw size={15} />}
            onPress={() => {
              setProgressEvents([]);
              setResults([]);
              setErrors([]);
              setDoneSummary(null);
            }}
            isDisabled={generating}
          >
            Clear Output
          </Button>
        </div>
      </section>
    </div>
  );
}
