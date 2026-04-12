// =============================================
// 批次分组折叠 — 未筛选 Tab 内按 batch 分组
// =============================================
// 每个 Batch: 可折叠头部 + 内部卡片网格
// 头部: 来源 + 关键词 + 岗位数 + 一键操作
// 空 batch 自动隐藏
// =============================================

"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button, Chip } from "@nextui-org/react";
import {
  ChevronDown,
  ChevronRight,
  Star,
  EyeOff,
  Undo2,
  Clock,
} from "lucide-react";
import { JobCard } from "@/components/jobs/JobCard";
import type { Job, Batch, Pool } from "@/lib/hooks";

const cardContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const cardItem = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { type: "spring", damping: 15 } },
};

interface BatchGroupProps {
  batch: Batch | null;
  jobs: Job[];
  batchMode: boolean;
  selectedIds: Set<number>;
  onToggleJob: (id: number) => void;
  onTriage: (jobId: number, status: string, poolId?: number | null) => void;
  onBatchTriage: (jobIds: number[], status: string, poolId?: number | null) => void;
  pools: Pool[];
  triageStatus: string;
}

export function BatchGroup({
  batch,
  jobs,
  batchMode,
  selectedIds,
  onToggleJob,
  onTriage,
  onBatchTriage,
  pools,
  triageStatus,
}: BatchGroupProps) {
  const [expanded, setExpanded] = useState(true);

  if (jobs.length === 0) return null;

  const batchJobIds = jobs.map((j) => j.id);
  const dateStr = batch?.created_at
    ? new Date(batch.created_at).toLocaleDateString("zh-CN", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";

  return (
    <div className="rounded-xl border border-white/10 overflow-hidden bg-white/[0.02]">
      {/* ── 批次头部 ── */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors text-left"
      >
        {expanded ? (
          <ChevronDown size={16} className="text-white/40 shrink-0" />
        ) : (
          <ChevronRight size={16} className="text-white/40 shrink-0" />
        )}

        {batch ? (
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <Chip size="sm" variant="flat" color="primary">
              {batch.source}
            </Chip>
            {batch.keywords && (
              <span className="text-sm text-white/70 truncate">
                {batch.keywords}
              </span>
            )}
            {batch.location && (
              <span className="text-xs text-white/40">· {batch.location}</span>
            )}
          </div>
        ) : (
          <span className="text-sm text-white/50 flex-1">无批次</span>
        )}

        <div className="flex items-center gap-2 shrink-0">
          {dateStr && (
            <span className="flex items-center gap-1 text-xs text-white/30">
              <Clock size={12} />
              {dateStr}
            </span>
          )}
          <Chip size="sm" variant="flat" className="bg-white/5 text-white/50">
            {jobs.length} 个岗位
          </Chip>
        </div>
      </button>

      {/* ── 批次一键操作栏 ── */}
      {expanded && (
        <div className="flex items-center gap-2 px-4 py-2 border-t border-white/5 bg-white/[0.02]">
          {triageStatus === "unscreened" && (
            <>
              <Button
                size="sm"
                variant="flat"
                color="primary"
                startContent={<Star size={12} />}
                onPress={() => onBatchTriage(batchJobIds, "screened")}
              >
                全部筛入
              </Button>
              <Button
                size="sm"
                variant="flat"
                color="warning"
                startContent={<EyeOff size={12} />}
                onPress={() => onBatchTriage(batchJobIds, "ignored")}
              >
                全部忽略
              </Button>
            </>
          )}
          {triageStatus === "screened" && (
            <Button
              size="sm"
              variant="flat"
              startContent={<Undo2 size={12} />}
              onPress={() => onBatchTriage(batchJobIds, "unscreened")}
            >
              全部退回
            </Button>
          )}
          {triageStatus === "ignored" && (
            <Button
              size="sm"
              variant="flat"
              startContent={<Undo2 size={12} />}
              onPress={() => onBatchTriage(batchJobIds, "unscreened")}
            >
              全部恢复
            </Button>
          )}
        </div>
      )}

      {/* ── 卡片网格 ── */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 200 }}
            className="overflow-hidden"
          >
            <motion.div
              variants={cardContainer}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-4"
            >
              {jobs.map((job) => (
                <motion.div
                  key={job.id}
                  variants={cardItem}
                  whileHover={{ y: -4 }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className="h-full"
                >
                  <JobCard
                    job={job}
                    selectable={batchMode}
                    selected={selectedIds.has(job.id)}
                    onToggle={onToggleJob}
                    triageStatus={triageStatus}
                    onTriage={onTriage}
                    pools={pools}
                  />
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
