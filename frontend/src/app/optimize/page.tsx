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
      <section className="bauhaus-panel overflow-hidden bg-white">
        <div className="grid gap-6 p-6 md:p-8 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4">
            <span className="bauhaus-chip bg-[#F0C020]">Optimize Studio</span>
            <div>
              <p className="bauhaus-label text-black/55">Resume Factory</p>
              <h1 className="mt-3 text-5xl font-black uppercase leading-[0.88] tracking-[-0.08em] sm:text-6xl">
                Select
                <br />
                Build
                <br />
                Clone
              </h1>
              <p className="mt-4 max-w-2xl text-base font-medium leading-relaxed text-black/72">
                从档案里抽取已确认事实，按岗位 JD 批量拼装定制简历。这里是整套求职流的“生产车间”，
                目标是高密度筛选、高速生成、低风险复用。
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
            <div className="bauhaus-panel-sm !bg-[#1040C0] p-4 text-white">
              <p className="bauhaus-label text-white/70">Mode</p>
              <p className="mt-3 text-2xl font-black uppercase tracking-[-0.05em]">Per Job / Combined</p>
            </div>
            <div className="bauhaus-panel-sm !bg-[#F0C020] p-4 text-black">
              <p className="bauhaus-label text-black/60">Rule</p>
              <p className="mt-3 text-2xl font-black uppercase tracking-[-0.05em]">Fact Only</p>
            </div>
            <div className="bauhaus-panel-sm !bg-[#D02020] p-4 text-white">
              <p className="bauhaus-label text-white/70">Flow</p>
              <p className="mt-3 text-lg font-black uppercase tracking-[-0.05em]">筛选 → 生成 → 编辑</p>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-wrap gap-3">
        <Link href="/jobs" className="bauhaus-button bauhaus-button-outline">
          去岗位池继续选岗
          <ArrowRight size={14} />
        </Link>
        <Link href="/profile" className="bauhaus-button bauhaus-button-yellow">
          <UserRound size={14} />
          编辑个人档案
        </Link>
      </section>

      <div className="bauhaus-panel-sm bg-[#F0F0F0] px-4 py-4 text-sm font-medium leading-relaxed text-black/68">
        生成规则：仅允许使用档案中已确认事实；每次生成都会新增一份简历，不会覆盖已有版本。
      </div>

      <OptimizeWorkspace seedJobIds={workspaceSeedJobIds} />
    </motion.div>
  );
}
