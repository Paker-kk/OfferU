// =============================================
// 岗位列表页 — 卡片式展示 + 多维度筛选 + 批量选择
// =============================================
// 筛选：关键词搜索 / 数据源 / 时间范围 / 岗位类型 / 学历 / 校招
// 布局：响应式网格 + 动画列表
// 批量模式：多选岗位 → AI 简历定制
// =============================================

"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Tabs,
  Tab,
  Pagination,
  Spinner,
  Input,
  Select,
  SelectItem,
  Switch,
  Button,
  Checkbox,
  Card,
  CardBody,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure,
} from "@nextui-org/react";
import { Search, Sparkles, X, CheckSquare, FolderPlus, Trash2, PencilLine } from "lucide-react";
import { JobCard } from "@/components/jobs/JobCard";
import { jobsApi } from "@/lib/api";
import {
  useJobs,
  useScraperTasks,
  usePools,
  patchJobsBatch,
  deleteJobsBatch,
  createPool,
  updatePoolName,
  deletePoolById,
  type Job,
  type Pool,
} from "@/lib/hooks";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, x: -20 },
  show: { opacity: 1, x: 0, transition: { type: "spring", damping: 15 } },
};

const SOURCE_OPTIONS = [
  { value: "", label: "全部来源" },
  { value: "boss", label: "BOSS直聘" },
  { value: "zhilian", label: "智联招聘" },
  { value: "linkedin", label: "领英" },
  { value: "shixiseng", label: "实习僧" },
  { value: "maimai", label: "脉脉" },
  { value: "corporate", label: "大厂官网" },
];

const JOB_TYPE_OPTIONS = [
  { value: "", label: "全部类型" },
  { value: "全职", label: "全职" },
  { value: "实习", label: "实习" },
  { value: "校招", label: "校招" },
  { value: "兼职", label: "兼职" },
];

const EDUCATION_OPTIONS = [
  { value: "", label: "全部学历" },
  { value: "不限", label: "不限" },
  { value: "本科", label: "本科" },
  { value: "硕士", label: "硕士" },
  { value: "博士", label: "博士" },
];

function resolveTriageTab(raw: string | null): "inbox" | "picked" | "ignored" {
  if (!raw) return "inbox";
  const value = raw.toLowerCase();
  if (value === "inbox" || value === "unscreened") return "inbox";
  if (value === "picked" || value === "screened") return "picked";
  if (value === "ignored") return "ignored";
  return "inbox";
}

export default function JobsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromScraper = searchParams.get("from_scraper") === "1";
  const scraperTaskId = (searchParams.get("task_id") || "").trim();
  const { isOpen: poolOpen, onOpen: openPoolModal, onClose: closePoolModal } = useDisclosure();
  const {
    isOpen: moveToPickedOpen,
    onOpen: openMoveToPickedModal,
    onClose: closeMoveToPickedModal,
  } = useDisclosure();
  const {
    isOpen: moveToTrashOpen,
    onOpen: openMoveToTrashModal,
    onClose: closeMoveToTrashModal,
  } = useDisclosure();
  const [trashActionSource, setTrashActionSource] = useState<"inbox" | "picked">("inbox");

  const [triageStatus, setTriageStatus] = useState<"inbox" | "picked" | "ignored">(() =>
    resolveTriageTab(searchParams.get("tab"))
  );
  const [period, setPeriod] = useState<string>("week");
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [debouncedKeyword, setDebouncedKeyword] = useState("");
  const [source, setSource] = useState("");
  const [jobType, setJobType] = useState("");
  const [education, setEducation] = useState("");
  const [isCampus, setIsCampus] = useState(false);
  const [selectedPoolFilter, setSelectedPoolFilter] = useState<string>(() => {
    const poolFromQuery = (searchParams.get("pool_id") || "").trim();
    if (!poolFromQuery) return "all";
    if (poolFromQuery === "ungrouped") return "ungrouped";
    if (/^\d+$/.test(poolFromQuery)) return poolFromQuery;
    return "all";
  });
  const [targetPoolForInbox, setTargetPoolForInbox] = useState<string>("ungrouped");
  const [targetPoolForBatch, setTargetPoolForBatch] = useState<string>("ungrouped");
  const [actionLoading, setActionLoading] = useState(false);
  const [selectAllLoading, setSelectAllLoading] = useState(false);

  const [newPoolName, setNewPoolName] = useState("");
  const [editingPoolId, setEditingPoolId] = useState<number | null>(null);
  const [editingPoolName, setEditingPoolName] = useState("");
  const [poolError, setPoolError] = useState("");
  const [poolBusy, setPoolBusy] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [lastSelectedAnchorId, setLastSelectedAnchorId] = useState<number | null>(null);
  const [pointerSelectionActive, setPointerSelectionActive] = useState(false);
  const [pointerSelectionMode, setPointerSelectionMode] = useState<"select" | "deselect">("select");
  const [isScraperSyncing, setIsScraperSyncing] = useState(fromScraper && !!scraperTaskId);

  // 搜索关键词 debounce（300ms）
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedKeyword(keyword);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [keyword]);

  const scopedPoolFilter =
    (triageStatus === "inbox" || triageStatus === "picked") && selectedPoolFilter !== "all"
      ? (selectedPoolFilter === "ungrouped" ? "ungrouped" : Number(selectedPoolFilter))
      : undefined;

  const { data, isLoading, isValidating, mutate: mutateJobs } = useJobs({
    page,
    page_size: 21,
    period,
    source: source || undefined,
    keyword: debouncedKeyword || undefined,
    job_type: jobType || undefined,
    education: education || undefined,
    is_campus: isCampus || undefined,
    triage_status: triageStatus,
    pool_id: scopedPoolFilter,
  });

  const { data: pools, mutate: mutatePools } = usePools(triageStatus);
  const { data: pickedPools, mutate: mutatePickedPools } = usePools("picked");
  const { data: scraperTasks } = useScraperTasks();
  const jobs = useMemo(() => data?.items ?? [], [data?.items]);
  const poolList = useMemo(() => pools ?? [], [pools]);
  const pickedPoolList = useMemo(() => pickedPools ?? [], [pickedPools]);
  const totalMatchingJobs = data?.total ?? 0;
  const poolFilterOptions = useMemo(
    () => [
      { key: "all", label: "全部池" },
      { key: "ungrouped", label: "未分组" },
      ...poolList.map((pool) => ({ key: String(pool.id), label: pool.name })),
    ],
    [poolList]
  );
  const poolAssignOptions = useMemo(
    () => [
      { key: "ungrouped", label: "移到未分组" },
      ...pickedPoolList.map((pool) => ({ key: String(pool.id), label: pool.name })),
    ],
    [pickedPoolList]
  );
  const totalPages = Math.ceil((data?.total ?? 0) / (data?.page_size ?? 20));
  const isAllSelected = totalMatchingJobs > 0 && selectedIds.size === totalMatchingJobs;

  const visibleJobOrder = useMemo(() => jobs, [jobs]);

  const visibleJobIndexMap = useMemo(() => {
    return new Map(visibleJobOrder.map((job, index) => [job.id, index]));
  }, [visibleJobOrder]);

  // 批量选择辅助
  const toggleJobSelect = useCallback((id: number, options?: { shiftKey?: boolean }) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);

      const shiftRangeSelectable =
        !!options?.shiftKey &&
        lastSelectedAnchorId !== null &&
        visibleJobIndexMap.has(lastSelectedAnchorId) &&
        visibleJobIndexMap.has(id);

      if (shiftRangeSelectable) {
        const start = visibleJobIndexMap.get(lastSelectedAnchorId)!;
        const end = visibleJobIndexMap.get(id)!;
        const from = Math.min(start, end);
        const to = Math.max(start, end);
        for (let i = from; i <= to; i += 1) {
          next.add(visibleJobOrder[i].id);
        }
      } else if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }

      return next;
    });
    setLastSelectedAnchorId(id);
  }, [lastSelectedAnchorId, visibleJobIndexMap, visibleJobOrder]);

  const handleSelectionPointerDown = useCallback(
    (id: number, options?: { shiftKey?: boolean }) => {
      if (!options?.shiftKey) {
        setPointerSelectionMode(selectedIds.has(id) ? "deselect" : "select");
        setPointerSelectionActive(true);
      }
    },
    [selectedIds]
  );

  const handleSelectionPointerEnter = useCallback(
    (id: number) => {
      if (!pointerSelectionActive) return;
      setSelectedIds((prev) => {
        const next = new Set(prev);
        if (pointerSelectionMode === "select") next.add(id);
        else next.delete(id);
        return next;
      });
    },
    [pointerSelectionActive, pointerSelectionMode]
  );

  const fetchAllFilteredJobIds = useCallback(async () => {
    const pageSize = 100;
    let nextPage = 1;
    let total = 0;
    const ids: number[] = [];

    do {
      const result = await jobsApi.list({
        page: nextPage,
        page_size: pageSize,
        period,
        source: source || undefined,
        keyword: debouncedKeyword || undefined,
        job_type: jobType || undefined,
        education: education || undefined,
        is_campus: isCampus || undefined,
        triage_status: triageStatus,
        pool_id: scopedPoolFilter,
      });

      const items = Array.isArray((result as any)?.items) ? (result as any).items : [];
      total = Number((result as any)?.total || 0);
      ids.push(...items.map((job: Job) => job.id));

      if (items.length === 0) break;
      nextPage += 1;
    } while (ids.length < total);

    return Array.from(new Set(ids));
  }, [
    period,
    source,
    debouncedKeyword,
    jobType,
    education,
    isCampus,
    triageStatus,
    scopedPoolFilter,
  ]);

  const toggleSelectAll = useCallback(async () => {
    if (!totalMatchingJobs) {
      setSelectedIds(new Set());
      return;
    }

    if (selectedIds.size === totalMatchingJobs) {
      setSelectedIds(new Set());
      setLastSelectedAnchorId(null);
      return;
    }

    setSelectAllLoading(true);
    try {
      const allIds = await fetchAllFilteredJobIds();
      setSelectedIds(new Set(allIds));
      setLastSelectedAnchorId(allIds.length > 0 ? allIds[allIds.length - 1] : null);
    } catch (err: any) {
      alert(err?.message || "全选失败，请重试");
    } finally {
      setSelectAllLoading(false);
    }
  }, [fetchAllFilteredJobIds, selectedIds.size, totalMatchingJobs]);

  const goOptimizeWithSelection = useCallback(() => {
    if (selectedIds.size === 0) return;
    const jobIds = Array.from(selectedIds).sort((a, b) => a - b);
    router.push(`/optimize?job_ids=${jobIds.join(",")}`);
  }, [router, selectedIds]);

  const refreshAfterMutation = useCallback(async () => {
    await Promise.all([mutateJobs(), mutatePools(), mutatePickedPools()]);
  }, [mutateJobs, mutatePools, mutatePickedPools]);

  const runBatchAction = useCallback(
    async (payload: { triage_status?: "inbox" | "picked" | "ignored"; pool_id?: number; clear_pool?: boolean }) => {
      if (selectedIds.size === 0) return;
      setActionLoading(true);
      try {
        const ids = Array.from(selectedIds);
        const chunkSize = 500;
        for (let i = 0; i < ids.length; i += chunkSize) {
          await patchJobsBatch({ job_ids: ids.slice(i, i + chunkSize), ...payload });
        }
        setSelectedIds(new Set());
        await refreshAfterMutation();
      } catch (err: any) {
        alert(err.message || "批量操作失败");
      } finally {
        setActionLoading(false);
      }
    },
    [refreshAfterMutation, selectedIds]
  );

  const runPermanentDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    const ok = confirm(`确认彻底删除选中的 ${selectedIds.size} 个岗位吗？该操作会从本地数据库永久移除，无法恢复。`);
    if (!ok) return;

    setActionLoading(true);
    try {
      await deleteJobsBatch({ job_ids: Array.from(selectedIds) });
      setSelectedIds(new Set());
      setLastSelectedAnchorId(null);
      await refreshAfterMutation();
    } catch (err: any) {
      alert(err.message || "彻底删除失败");
    } finally {
      setActionLoading(false);
    }
  }, [refreshAfterMutation, selectedIds]);

  const handleCreatePool = useCallback(async () => {
    if (!newPoolName.trim()) return;
    if (triageStatus !== "picked") {
      setPoolError("未筛选池仅支持爬虫自动生成，不能手动新建");
      return;
    }
    setPoolBusy(true);
    setPoolError("");
    try {
      await createPool(newPoolName.trim(), "picked");
      setNewPoolName("");
      await refreshAfterMutation();
    } catch (err: any) {
      setPoolError(err.message || "创建池失败");
    } finally {
      setPoolBusy(false);
    }
  }, [newPoolName, refreshAfterMutation, triageStatus]);

  const handleRenamePool = useCallback(
    async (poolId: number) => {
      if (!editingPoolName.trim()) return;
      setPoolBusy(true);
      setPoolError("");
      try {
        await updatePoolName(poolId, editingPoolName.trim(), triageStatus);
        setEditingPoolId(null);
        setEditingPoolName("");
        await refreshAfterMutation();
      } catch (err: any) {
        setPoolError(err.message || "重命名失败");
      } finally {
        setPoolBusy(false);
      }
    },
    [editingPoolName, refreshAfterMutation]
  );

  const handleDeletePool = useCallback(
    async (pool: Pool) => {
      const ok = confirm(`确认删除池“${pool.name}”吗？池内岗位将变为未分组。`);
      if (!ok) return;
      setPoolBusy(true);
      setPoolError("");
      try {
        await deletePoolById(pool.id, triageStatus);
        await refreshAfterMutation();
      } catch (err: any) {
        setPoolError(err.message || "删除池失败");
      } finally {
        setPoolBusy(false);
      }
    },
    [refreshAfterMutation, triageStatus]
  );

  useEffect(() => {
    if (!fromScraper || !scraperTaskId) {
      setIsScraperSyncing(false);
      return;
    }

    const targetTask = (scraperTasks || []).find((task) => task.id === scraperTaskId);
    if (!targetTask || targetTask.status === "running") {
      setIsScraperSyncing(true);
      return;
    }

    setIsScraperSyncing(false);
    void refreshAfterMutation();

    const params = new URLSearchParams(searchParams.toString());
    params.delete("from_scraper");
    params.delete("task_id");
    router.replace(`/jobs?${params.toString()}`);
  }, [fromScraper, refreshAfterMutation, router, scraperTaskId, scraperTasks, searchParams]);

  useEffect(() => {
    setSelectedIds(new Set());
    setLastSelectedAnchorId(null);
  }, [triageStatus, selectedPoolFilter, period, source, debouncedKeyword, jobType, education, isCampus]);

  useEffect(() => {
    if (!pointerSelectionActive) return;
    const stopPointerSelection = () => setPointerSelectionActive(false);
    window.addEventListener("mouseup", stopPointerSelection);
    return () => window.removeEventListener("mouseup", stopPointerSelection);
  }, [pointerSelectionActive]);

  const resetFilters = useCallback(() => {
    setPage(1);
    setKeyword("");
    setDebouncedKeyword("");
    setSource("");
    setJobType("");
    setEducation("");
    setIsCampus(false);
    setSelectedPoolFilter("all");
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">岗位</h1>
        <div className="flex items-center gap-3">
          {data && (
            <span className="text-sm text-white/40">
              共 {data.total} 个岗位
            </span>
          )}
          <Button
            size="sm"
            variant={isAllSelected ? "solid" : "flat"}
            color={isAllSelected ? "primary" : "default"}
            startContent={<CheckSquare size={14} />}
            onPress={() => {
              void toggleSelectAll();
            }}
            isLoading={selectAllLoading}
            isDisabled={totalMatchingJobs === 0}
          >
            {isAllSelected ? "取消全选" : "全选"}
          </Button>
        </div>
      </div>

      {isScraperSyncing && (
        <div className="rounded-lg border border-primary-400/30 bg-primary-500/10 px-3 py-2 text-xs text-primary-200">
          正在同步最新爬取结果，岗位数据会自动刷新，无需手动操作。
        </div>
      )}

      <Tabs
        selectedKey={triageStatus}
        onSelectionChange={(key) => {
          const nextStatus = key as "inbox" | "picked" | "ignored";
          setTriageStatus(nextStatus);
          setPage(1);

          const params = new URLSearchParams(searchParams.toString());
          params.set("tab", nextStatus);
          if (nextStatus === "ignored") {
            params.delete("pool_id");
          } else if (selectedPoolFilter !== "all") {
            params.set("pool_id", selectedPoolFilter);
          } else {
            params.delete("pool_id");
          }
          router.push(`/jobs?${params.toString()}`);
        }}
        variant="solid"
        color="primary"
        classNames={{
          tabList: "bg-white/5",
        }}
      >
        <Tab key="inbox" title="未筛选" />
        <Tab key="picked" title="已筛选" />
        <Tab key="ignored" title="回收站" />
      </Tabs>

      {/* 筛选栏 */}
      <div className="space-y-4">
        {/* 第一行：搜索 + 时间 */}
        <div className="flex flex-wrap items-center gap-4">
          <Input
            placeholder="搜索岗位或公司..."
            value={keyword}
            onValueChange={setKeyword}
            startContent={<Search size={16} className="text-white/40" />}
            classNames={{
              base: "max-w-xs",
              inputWrapper: "bg-white/5 border border-white/10",
            }}
            size="sm"
          />
          <Select
            aria-label="时间范围"
            size="sm"
            selectedKeys={[period]}
            onSelectionChange={(keys) => {
              setPeriod(Array.from(keys)[0] as string);
              setPage(1);
            }}
            classNames={{ base: "w-28", trigger: "bg-white/5 border border-white/10" }}
          >
            <SelectItem key="today">今日</SelectItem>
            <SelectItem key="week">本周</SelectItem>
            <SelectItem key="month">本月</SelectItem>
          </Select>

          {triageStatus !== "ignored" && (
            <>
              <Select
                aria-label="池过滤"
                size="sm"
                selectedKeys={[selectedPoolFilter]}
                onSelectionChange={(keys) => {
                  const value = Array.from(keys)[0] as string;
                  setSelectedPoolFilter(value);
                  setPage(1);
                  const params = new URLSearchParams(searchParams.toString());
                  params.set("tab", triageStatus);
                  if (value === "all") {
                    params.delete("pool_id");
                  } else {
                    params.set("pool_id", value);
                  }
                  router.push(`/jobs?${params.toString()}`);
                }}
                classNames={{ base: "w-48", trigger: "bg-white/5 border border-white/10" }}
                items={poolFilterOptions}
              >
                {(item) => <SelectItem key={item.key}>{item.label}</SelectItem>}
              </Select>

              <Button
                size="sm"
                variant="flat"
                startContent={<FolderPlus size={14} />}
                onPress={openPoolModal}
              >
                管理池
              </Button>
            </>
          )}
        </div>

        {/* 第二行：下拉筛选 + 校招开关 */}
        <div className="flex flex-wrap items-center gap-3">
          <Select
            aria-label="数据来源"
            size="sm"
            selectedKeys={source ? [source] : [""]}
            onSelectionChange={(keys) => {
              const val = Array.from(keys)[0] as string;
              setSource(val);
              setPage(1);
            }}
            classNames={{
              base: "w-32",
              trigger: "bg-white/5 border border-white/10",
            }}
          >
            {SOURCE_OPTIONS.map((o) => (
              <SelectItem key={o.value}>{o.label}</SelectItem>
            ))}
          </Select>

          <Select
            aria-label="岗位类型"
            size="sm"
            selectedKeys={jobType ? [jobType] : [""]}
            onSelectionChange={(keys) => {
              const val = Array.from(keys)[0] as string;
              setJobType(val);
              setPage(1);
            }}
            classNames={{
              base: "w-32",
              trigger: "bg-white/5 border border-white/10",
            }}
          >
            {JOB_TYPE_OPTIONS.map((o) => (
              <SelectItem key={o.value}>{o.label}</SelectItem>
            ))}
          </Select>

          <Select
            aria-label="学历要求"
            size="sm"
            selectedKeys={education ? [education] : [""]}
            onSelectionChange={(keys) => {
              const val = Array.from(keys)[0] as string;
              setEducation(val);
              setPage(1);
            }}
            classNames={{
              base: "w-32",
              trigger: "bg-white/5 border border-white/10",
            }}
          >
            {EDUCATION_OPTIONS.map((o) => (
              <SelectItem key={o.value}>{o.label}</SelectItem>
            ))}
          </Select>

          <Switch
            size="sm"
            isSelected={isCampus}
            onValueChange={(val) => {
              setIsCampus(val);
              setPage(1);
            }}
            classNames={{ wrapper: "bg-white/10" }}
          >
            <span className="text-sm text-white/60">仅校招</span>
          </Switch>

          {(keyword || source || jobType || education || isCampus) && (
            <button
              onClick={resetFilters}
              className="text-xs text-blue-400 hover:underline"
            >
              清除筛选
            </button>
          )}
        </div>
      </div>

      {/* 岗位列表 */}
      {isLoading || (isValidating && jobs.length === 0) ? (
        <div className="flex justify-center py-20">
          <div className="flex items-center gap-2 text-sm text-white/60">
            <Spinner size="lg" />
            <span>岗位数据加载中...</span>
          </div>
        </div>
      ) : jobs.length > 0 ? (
        <>
          {/* 批量模式：全选栏 */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <Checkbox
                isSelected={totalMatchingJobs > 0 && selectedIds.size === totalMatchingJobs}
                isIndeterminate={selectedIds.size > 0 && totalMatchingJobs > 0 && selectedIds.size < totalMatchingJobs}
                isDisabled={selectAllLoading || totalMatchingJobs === 0}
                onValueChange={() => {
                  void toggleSelectAll();
                }}
                size="sm"
                color="primary"
              />
              <span className="text-sm text-white/60">
                {selectAllLoading
                  ? "正在汇总当前筛选下全部岗位..."
                  : selectedIds.size > 0
                    ? `已选 ${selectedIds.size} / 总 ${totalMatchingJobs} 个岗位`
                    : `点击卡片或勾选框选择岗位（当前筛选共 ${totalMatchingJobs} 个）`}
              </span>
            </div>
          )}

          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch [grid-auto-flow:row_dense]"
          >
            {jobs.map((job) => (
              <div
                key={job.id}
                className="h-full min-w-0"
              >
                <JobCard
                  job={job}
                  showCheckbox
                  selected={selectedIds.has(job.id)}
                  onToggle={toggleJobSelect}
                  onSelectPointerDown={handleSelectionPointerDown}
                  onSelectPointerEnter={handleSelectionPointerEnter}
                />
              </div>
            ))}
          </motion.div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex justify-center pt-4">
              <Pagination
                total={totalPages}
                page={page}
                onChange={setPage}
                showControls
                classNames={{
                  cursor: "bg-blue-500",
                }}
              />
            </div>
          )}

          {/* 浮动操作栏 — 选中岗位后出现 */}
          <AnimatePresence>
            {selectedIds.size > 0 && (
              <motion.div
                initial={{ y: 80, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 80, opacity: 0 }}
                transition={{ type: "spring", damping: 20 }}
                className="fixed bottom-6 left-0 right-0 md:left-64 md:right-auto md:w-[calc(100vw-16rem)] z-50 flex justify-center pointer-events-none"
              >
                <div className="flex items-center gap-3 px-6 py-3 rounded-2xl bg-zinc-800/95 border border-white/15 shadow-xl backdrop-blur-sm pointer-events-auto">
                  <span className="text-sm text-white/70">
                    已选 <span className="text-blue-400 font-bold">{selectedIds.size}</span> 个岗位
                  </span>

                  {triageStatus === "inbox" && (
                    <>
                      <Button
                        color="primary"
                        size="sm"
                        isDisabled={actionLoading}
                        onPress={() => {
                          setTargetPoolForInbox("ungrouped");
                          openMoveToPickedModal();
                        }}
                      >
                        加入已筛选
                      </Button>
                      <Button
                        color="warning"
                        size="sm"
                        isLoading={actionLoading}
                        isDisabled={actionLoading}
                        onPress={() => {
                          setTrashActionSource("inbox");
                          openMoveToTrashModal();
                        }}
                      >
                        移入回收站
                      </Button>
                    </>
                  )}

                  {triageStatus === "ignored" && (
                    <>
                      <Button
                        color="primary"
                        size="sm"
                        isLoading={actionLoading}
                        onPress={() => runBatchAction({ triage_status: "inbox" })}
                      >
                        恢复到未筛选
                      </Button>
                      <Button
                        color="danger"
                        size="sm"
                        isLoading={actionLoading}
                        onPress={runPermanentDelete}
                      >
                        彻底删除
                      </Button>
                    </>
                  )}

                  {triageStatus === "picked" && (
                    <>
                      <Select
                        aria-label="分配池"
                        size="sm"
                        selectedKeys={[targetPoolForBatch]}
                        onSelectionChange={(keys) => setTargetPoolForBatch(Array.from(keys)[0] as string)}
                        classNames={{ base: "w-44", trigger: "bg-white/5 border border-white/10" }}
                        items={poolAssignOptions}
                      >
                        {(item) => <SelectItem key={item.key}>{item.label}</SelectItem>}
                      </Select>
                      <Button
                        color="primary"
                        size="sm"
                        isLoading={actionLoading}
                        onPress={() =>
                          targetPoolForBatch === "ungrouped"
                            ? runBatchAction({ triage_status: "picked", clear_pool: true })
                            : runBatchAction({ pool_id: Number(targetPoolForBatch), triage_status: "picked" })
                        }
                      >
                        应用分组
                      </Button>
                      <Button
                        color="secondary"
                        size="sm"
                        startContent={<Sparkles size={14} />}
                        onPress={goOptimizeWithSelection}
                      >
                        去 AI 简历定制
                      </Button>
                      <Button
                        color="warning"
                        size="sm"
                        isLoading={actionLoading}
                        isDisabled={actionLoading}
                        onPress={() => {
                          setTrashActionSource("picked");
                          openMoveToTrashModal();
                        }}
                      >
                        移入回收站
                      </Button>
                    </>
                  )}

                  <Button
                    isIconOnly
                    size="sm"
                    variant="flat"
                    onPress={() => setSelectedIds(new Set())}
                  >
                    <X size={14} />
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      ) : (
        <Card className="bg-white/5 border border-white/10">
          <CardBody className="p-8 text-center text-white/40">
            <p className="text-lg mb-2">暂无岗位数据</p>
            <p className="text-sm">尝试调整筛选条件，或前往爬虫控制台抓取岗位</p>
          </CardBody>
        </Card>
      )}

      <Modal isOpen={moveToPickedOpen} onClose={closeMoveToPickedModal} size="md">
        <ModalContent>
          <ModalHeader>加入已筛选池</ModalHeader>
          <ModalBody className="space-y-3">
            <p className="text-sm text-white/60">
              选择目标已筛选池，确认后将从当前未筛选池中移除并流转到对应已筛选池。
            </p>
            <Select
              aria-label="加入已筛选池"
              size="sm"
              selectedKeys={[targetPoolForInbox]}
              onSelectionChange={(keys) => setTargetPoolForInbox(Array.from(keys)[0] as string)}
              items={poolAssignOptions}
              classNames={{ trigger: "bg-white/5 border border-white/10" }}
            >
              {(item) => <SelectItem key={item.key}>{item.label}</SelectItem>}
            </Select>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={closeMoveToPickedModal}>取消</Button>
            <Button
              color="primary"
              isLoading={actionLoading}
              onPress={async () => {
                await runBatchAction(
                  targetPoolForInbox === "ungrouped"
                    ? { triage_status: "picked", clear_pool: true }
                    : { triage_status: "picked", pool_id: Number(targetPoolForInbox) }
                );
                closeMoveToPickedModal();
              }}
            >
              确认加入
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={moveToTrashOpen} onClose={closeMoveToTrashModal} size="md">
        <ModalContent>
          <ModalHeader>移入回收站</ModalHeader>
          <ModalBody className="space-y-2">
            <p className="text-sm text-white/70">
              确认将选中的 {selectedIds.size} 个岗位移入回收站吗？移入后可在回收站页面恢复或永久删除。
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={closeMoveToTrashModal}>取消</Button>
            <Button
              color="warning"
              isLoading={actionLoading}
              onPress={async () => {
                await runBatchAction({ triage_status: "ignored" });
                closeMoveToTrashModal();
              }}
            >
              {trashActionSource === "picked" ? "确认移入" : "确认移入"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={poolOpen} onClose={closePoolModal} size="lg">
        <ModalContent>
          <ModalHeader>岗位池管理</ModalHeader>
          <ModalBody className="space-y-4">
            {triageStatus === "picked" ? (
              <div className="flex items-center gap-2">
                <Input
                  size="sm"
                  placeholder="输入新池名称"
                  value={newPoolName}
                  onValueChange={setNewPoolName}
                />
                <Button
                  size="sm"
                  color="primary"
                  isLoading={poolBusy}
                  onPress={handleCreatePool}
                >
                  创建
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/60">
                未筛选池仅由爬虫任务自动生成，当前仅支持重命名与删除管理。
              </div>
            )}

            {poolError && <p className="text-sm text-red-400">{poolError}</p>}

            <div className="space-y-2 max-h-72 overflow-auto pr-1">
              {poolList.length === 0 ? (
                <p className="text-sm text-white/40">
                  {triageStatus === "picked" ? "暂无岗位池，先创建一个文件夹。" : "暂无自动生成的爬取池。"}
                </p>
              ) : (
                poolList.map((pool) => (
                  <div
                    key={pool.id}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3"
                  >
                    {editingPoolId === pool.id ? (
                      <div className="flex flex-1 items-center gap-2">
                        <Input
                          size="sm"
                          value={editingPoolName}
                          onValueChange={setEditingPoolName}
                        />
                        <Button size="sm" color="primary" isLoading={poolBusy} onPress={() => handleRenamePool(pool.id)}>
                          保存
                        </Button>
                        <Button
                          size="sm"
                          variant="flat"
                          onPress={() => {
                            setEditingPoolId(null);
                            setEditingPoolName("");
                          }}
                        >
                          取消
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div>
                          <p className="text-sm font-medium">{pool.name}</p>
                          <p className="text-xs text-white/40">岗位数 {pool.job_count}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            onPress={() => {
                              setEditingPoolId(pool.id);
                              setEditingPoolName(pool.name);
                            }}
                          >
                            <PencilLine size={14} />
                          </Button>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="light"
                            className="text-red-400"
                            onPress={() => handleDeletePool(pool)}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={closePoolModal}>
              关闭
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </motion.div>
  );
}
