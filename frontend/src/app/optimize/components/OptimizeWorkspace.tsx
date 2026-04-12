"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button, Card, CardBody, Chip, Input, Progress, Spinner } from "@nextui-org/react";
import { CheckCircle2, FolderOpen, Layers3, ListChecks, Play, RefreshCw, Search } from "lucide-react";
import { jobsApi } from "@/lib/api";
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
  education: "教育",
  internship: "实习",
  experience: "经历",
  project: "项目",
  activity: "活动",
  competition: "竞赛",
  skill: "技能",
  certificate: "证书",
  honor: "荣誉",
  language: "语言",
};

function formatSectionTypeLabel(sectionType: string) {
  return SECTION_TYPE_LABELS[sectionType] || sectionType;
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
        `当前选中 ${effectiveJobIds.length} 个岗位，单次最多支持 ${MAX_GENERATE_JOB_COUNT} 个，请分批生成。`,
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
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white/90">AI 简历定制工作区</h2>
          <p className="text-xs text-white/45 mt-1">① 选范围 ② 勾岗位 ③ 流式生成，生成结果可直接进入简历编辑。</p>
        </div>
        <Button
          color="secondary"
          startContent={<Play size={14} />}
          onPress={startGenerate}
          isDisabled={!canGenerate}
          isLoading={generating}
        >
          开始生成
        </Button>
      </div>

      {!loadingProfile && profileSectionCount === 0 && (
        <div className="rounded-lg border border-warning-400/40 bg-warning-500/10 px-3 py-2 text-xs text-warning-200">
          当前还没有已确认的档案条目。请先去
          <Link href="/profile" className="ml-1 underline hover:text-warning-100">个人档案</Link>
          完成条目确认，再回到这里生成简历。
        </div>
      )}

      {overSelectionLimit && (
        <div className="rounded-lg border border-danger-400/40 bg-danger-500/10 px-3 py-2 text-xs text-danger-200">
          当前已选 {selectedJobIds.length} 个岗位，超出单次上限 {MAX_GENERATE_JOB_COUNT}。请先缩小本轮范围再生成。
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="bg-white/[0.02] border border-white/[0.08]">
          <CardBody className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-white/80 text-sm font-semibold">
              <FolderOpen size={15} className="text-cyan-300" />
              ① 池/范围选择
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={poolFilter === "all" ? "solid" : "flat"}
                color={poolFilter === "all" ? "primary" : "default"}
                className={poolFilter === "all" ? "" : "bg-white/5 text-white/65"}
                onPress={() => setPoolFilter("all")}
              >
                全部已筛选
              </Button>
              <Button
                size="sm"
                variant={poolFilter === "ungrouped" ? "solid" : "flat"}
                color={poolFilter === "ungrouped" ? "primary" : "default"}
                className={poolFilter === "ungrouped" ? "" : "bg-white/5 text-white/65"}
                onPress={() => setPoolFilter("ungrouped")}
              >
                未分组
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 max-h-[180px] overflow-auto pr-1">
              {(pools || []).map((pool) => (
                <Button
                  key={pool.id}
                  size="sm"
                  variant={poolFilter === pool.id ? "solid" : "flat"}
                  color={poolFilter === pool.id ? "primary" : "default"}
                  className={poolFilter === pool.id ? "" : "bg-white/5 text-white/65"}
                  onPress={() => setPoolFilter(pool.id)}
                >
                  {pool.name}
                </Button>
              ))}
            </div>

            <Input
              size="sm"
              variant="bordered"
              placeholder="筛选岗位关键词"
              value={keyword}
              onValueChange={setKeyword}
              startContent={<Search size={14} className="text-white/35" />}
              classNames={{ inputWrapper: "bg-white/[0.02] border-white/[0.08]" }}
            />

            <div className="pt-1 space-y-2">
              <div className="text-xs text-white/45">生成模式</div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={mode === "per_job" ? "solid" : "flat"}
                  color={mode === "per_job" ? "secondary" : "default"}
                  className={mode === "per_job" ? "" : "bg-white/5 text-white/65"}
                  onPress={() => setMode("per_job")}
                >
                  逐岗位
                </Button>
                <Button
                  size="sm"
                  variant={mode === "combined" ? "solid" : "flat"}
                  color={mode === "combined" ? "secondary" : "default"}
                  className={mode === "combined" ? "" : "bg-white/5 text-white/65"}
                  onPress={() => setMode("combined")}
                >
                  综合版
                </Button>
              </div>
            </div>

            <div className="pt-1 space-y-2">
              <div className="text-xs text-white/45">参考简历（可选）</div>
              <select
                value={referenceResumeId ?? ""}
                onChange={(event) => {
                  const raw = event.target.value;
                  setReferenceResumeId(raw ? Number(raw) : null);
                }}
                className="w-full h-9 rounded-md bg-white/[0.03] border border-white/[0.1] text-sm text-white/80 px-2 outline-none"
              >
                <option value="" className="bg-zinc-900">不使用参考简历</option>
                {referenceResumes.map((resume) => (
                  <option key={resume.id} value={resume.id} className="bg-zinc-900">
                    {resume.title || `简历 #${resume.id}`}
                  </option>
                ))}
              </select>
              <div className="text-[11px] text-white/35">
                仅参考版式与表达风格，事实来源仍限定为档案已确认条目。
              </div>
            </div>
          </CardBody>
        </Card>

        <Card className="bg-white/[0.02] border border-white/[0.08]">
          <CardBody className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white/80 text-sm font-semibold">
                <ListChecks size={15} className="text-amber-300" />
                ② 本轮岗位勾选
              </div>
              <Chip size="sm" variant="flat" className="bg-white/10 text-white/70">
                已选 {selectedCountInCurrentList} / 总 {totalJobsInCurrentPool}
              </Chip>
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                variant="flat"
                className="bg-white/10 text-white/70"
                onPress={toggleSelectAllInCurrentList}
                isDisabled={jobs.length === 0}
              >
                {allSelectedInCurrent ? "取消全选" : "全选当前"}
              </Button>
            </div>

            <div className="max-h-[420px] overflow-y-auto space-y-2 pr-1">
              {loadingJobs ? (
                <div className="text-xs text-white/45 flex items-center gap-2">
                  <Spinner size="sm" /> 加载岗位中...
                </div>
              ) : jobs.length === 0 ? (
                <div className="text-xs text-white/35 py-6 text-center">当前筛选范围暂无岗位</div>
              ) : (
                jobs.map((job) => {
                  const checked = selectedJobIds.includes(job.id);
                  return (
                    <button
                      key={job.id}
                      onClick={() => toggleJob(job.id)}
                      className={`w-full text-left rounded-lg border p-3 transition-all ${
                        checked
                          ? "border-secondary-400/50 bg-secondary-500/10"
                          : "border-white/[0.08] bg-white/[0.02] hover:border-white/20"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm text-white/85 line-clamp-1">{job.title}</div>
                          <div className="text-[11px] text-white/40 mt-1 line-clamp-1">{job.company} · {job.location || "未知地点"}</div>
                        </div>
                        {checked && <CheckCircle2 size={14} className="text-secondary-300 mt-1" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="text-[11px] text-white/35">
              当前池内共 {totalJobsInCurrentPool} 个岗位，本轮已勾选 {selectedCountInCurrentList} 个。
            </div>
          </CardBody>
        </Card>

        <Card className="bg-white/[0.02] border border-white/[0.08]">
          <CardBody className="p-4 space-y-3">
            <div className="flex items-center gap-2 text-white/80 text-sm font-semibold">
              <Layers3 size={15} className="text-emerald-300" />
              ③ 输出简历区
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-white/45">
                <span>生成进度</span>
                <span>{progressRatio}%</span>
              </div>
              <Progress value={progressRatio} color="success" size="sm" />
            </div>

            {doneSummary && (
              <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-200">
                已完成：成功 {doneSummary.created} / 失败 {doneSummary.failed}
              </div>
            )}

            {errors.length > 0 && (
              <div className="space-y-2">
                {errors.map((line, idx) => (
                  <div key={`${line}-${idx}`} className="rounded-lg border border-danger-400/30 bg-danger-500/10 px-3 py-2 text-xs text-danger-200">
                    {line}
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {results.length === 0 ? (
                <div className="text-xs text-white/35 py-6 text-center">生成后这里会显示结果、命中条目和缺失能力。</div>
              ) : (
                results.map((item) => (
                  <div key={`${item.resume_id}-${item.mode}-${item.job_id || "combined"}`} className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm text-white/80 line-clamp-1">
                        {item.job_title ? `${item.job_title} · ` : ""}{item.resume_title}
                      </div>
                      <Link href={`/resume/${item.resume_id}`} className="text-[11px] text-cyan-300 hover:text-cyan-200">
                        打开
                      </Link>
                    </div>
                    <div className="text-[11px] text-white/45">档案命中率 {item.profile_hit_ratio}</div>

                    {(item.used_bullets || []).length > 0 && (
                      <div className="space-y-1">
                        <div className="text-[11px] text-white/45">已使用档案条目</div>
                        <div className="flex flex-wrap gap-1">
                          {(item.used_bullets || []).slice(0, 6).map((bullet) => (
                            <Chip
                              key={`${item.resume_id}-${bullet.id}`}
                              size="sm"
                              variant="flat"
                              className="bg-emerald-500/10 text-emerald-200 text-[10px]"
                            >
                              {formatSectionTypeLabel(bullet.section_type)} · {bullet.title}
                            </Chip>
                          ))}
                          {(item.used_bullets || []).length > 6 && (
                            <Chip size="sm" variant="flat" className="bg-white/10 text-white/60 text-[10px]">
                              +{(item.used_bullets || []).length - 6}
                            </Chip>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap gap-1">
                      {(item.missing_keywords || []).slice(0, 6).map((kw) => (
                        <Chip key={`${item.resume_id}-${kw}`} size="sm" variant="flat" className="bg-warning-500/10 text-warning-200 text-[10px]">
                          {kw}
                        </Chip>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>

            <Button
              size="sm"
              variant="flat"
              className="bg-white/10 text-white/70"
              startContent={<RefreshCw size={13} />}
              onPress={() => {
                setProgressEvents([]);
                setResults([]);
                setErrors([]);
                setDoneSummary(null);
              }}
              isDisabled={generating}
            >
              清空输出
            </Button>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
