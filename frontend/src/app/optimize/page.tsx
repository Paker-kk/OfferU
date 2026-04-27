"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, UserRound } from "lucide-react";
import { OptimizeWorkspace } from "./components/OptimizeWorkspace";

export default function OptimizePage() {
  const searchParams = useSearchParams();
  const workspaceSeedJobIds = useMemo(() => {
    const raw = searchParams.get("job_ids");
    if (!raw) return [];
    return Array.from(
      new Set(
        raw
          .split(",")
          .map((part) => Number(part.trim()))
          .filter((id) => Number.isFinite(id) && id > 0)
      )
    );
  }, [searchParams]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      className="mx-auto max-w-7xl space-y-8"
    >
      <section className="bauhaus-panel overflow-hidden bg-[var(--surface)]">
        <div className="grid gap-6 p-6 md:p-8 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <span className="bauhaus-chip bg-[#f3ead2]">简历定制工作区</span>
            <div>
              <p className="bauhaus-label text-black/55">岗位匹配与生成</p>
              <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">
                选岗位
                <br />
                生简历
                <br />
                再打磨
              </h1>
              <p className="mt-4 max-w-2xl text-base font-medium leading-relaxed text-black/72">
                从档案中提取已确认事实，按岗位 JD 批量拼装定制简历。这里强调稳定、可追溯、可复用，
                让高频操作更顺手。
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
            <div className="bauhaus-panel-sm bg-[#e4ece6] p-4 text-black">
              <p className="bauhaus-label text-black/60">生成模式</p>
              <p className="mt-3 text-2xl font-bold">逐岗位 / 综合</p>
            </div>
            <div className="bauhaus-panel-sm bg-[#f3ead2] p-4 text-black">
              <p className="bauhaus-label text-black/60">事实规则</p>
              <p className="mt-3 text-2xl font-bold">仅使用已确认信息</p>
            </div>
            <div className="bauhaus-panel-sm bg-[#f7ece9] p-4 text-black">
              <p className="bauhaus-label text-black/60">流程</p>
              <p className="mt-3 text-lg font-semibold">筛选 → 生成 → 编辑</p>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-wrap gap-3">
        <Link href="/jobs" className="bauhaus-button bauhaus-button-outline">
          去岗位库继续选岗
          <ArrowRight size={14} />
        </Link>
        <Link href="/profile" className="bauhaus-button bauhaus-button-yellow">
          <UserRound size={14} />
          编辑个人档案
        </Link>
      </section>

      <div className="bauhaus-panel-sm bg-[var(--surface-muted)] px-4 py-4 text-sm font-medium leading-relaxed text-black/68">
        生成规则：仅允许使用档案中已确认事实；每次生成都会新增一份简历，不覆盖已有版本。
      </div>

      <OptimizeWorkspace seedJobIds={workspaceSeedJobIds} />
    </motion.div>
  );
}
