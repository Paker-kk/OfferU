"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Briefcase,
  Building2,
  Layers,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { TrendChart } from "@/components/charts/TrendChart";
import { JobCard } from "@/components/jobs/JobCard";
import {
  OnboardingChecklist,
  OnboardingTriggerButton,
} from "@/components/onboarding/OnboardingChecklist";
import { useJobs, useJobStats, useJobTrend } from "@/lib/hooks";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 24 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: "easeOut" },
  },
};

const periodOptions = [
  { key: "today", label: "今日" },
  { key: "week", label: "本周" },
  { key: "month", label: "本月" },
];

const statColors = [
  {
    panel: "bg-white",
    iconBox: "bg-[#D02020] text-white",
    shape: "rounded-full bg-[var(--primary-blue)]",
  },
  {
    panel: "bg-[var(--surface-muted)]",
    iconBox: "bg-[var(--primary-blue)] text-white",
    shape: "bg-[#F0C020]",
  },
  {
    panel: "bg-white",
    iconBox: "bg-[#F0C020] text-black",
    shape: "bauhaus-triangle bg-[#D02020]",
  },
  {
    panel: "bg-[var(--surface-muted)]",
    iconBox: "bg-[#D02020] text-white",
    shape: "rotate-45 bg-[var(--primary-blue)]",
  },
];

export default function DashboardPage() {
  const [period, setPeriod] = useState<"today" | "week" | "month">("week");
  const { data: stats } = useJobStats(period);
  const { data: jobsData } = useJobs({ page: 1, period });
  const { data: trendData } = useJobTrend(period);

  const totalJobs = stats?.total_jobs ?? 0;
  const topJobs = (jobsData?.items ?? []).slice(0, 6);
  const sourceCount = Object.keys(stats?.source_distribution ?? {}).length;
  const keywordCount = topJobs.reduce(
    (sum, job) => sum + (job.keywords?.length ?? 0),
    0
  );
  const companyCount = new Set(
    (jobsData?.items ?? []).map((job) => job.company).filter(Boolean)
  ).size;

  const topSources = useMemo(
    () =>
      Object.entries(stats?.source_distribution ?? {})
        .sort(([, left], [, right]) => Number(right) - Number(left))
        .slice(0, 4),
    [stats?.source_distribution]
  );

  const statCards = [
    {
      label: "岗位总量",
      value: totalJobs,
      icon: Briefcase,
      note: "所有已同步的职位",
    },
    {
      label: "活跃来源",
      value: sourceCount,
      icon: Target,
      note: "当前参与抓取的平台",
    },
    {
      label: "本期新增",
      value: jobsData?.items?.length ?? 0,
      icon: TrendingUp,
      note: "当前时间视图中的新增",
    },
    {
      label: "关键词命中",
      value: keywordCount,
      icon: Layers,
      note: "首页岗位卡片聚合结果",
    },
  ];

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      <motion.section
        variants={item}
        className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]"
      >
        <div className="bauhaus-panel overflow-hidden bg-white">
          <div className="grid gap-8 p-6 md:p-8 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <span className="bauhaus-chip bg-[#F0C020]">
                Daily Job Match Engine
              </span>

              <div>
                <p className="bauhaus-label text-black/60">
                  Constructivist Career Workspace
                </p>
                <h1 className="mt-3 text-4xl font-black uppercase leading-[0.88] tracking-[-0.06em] sm:text-5xl xl:text-6xl">
                  Build
                  <br />
                  Your
                  <br />
                  Offer
                </h1>
                <p className="mt-4 max-w-2xl text-base font-medium leading-relaxed text-black/72 md:text-lg">
                  把抓取、筛选、简历优化和投递跟踪压缩进一个几何感很强的工作台。
                  这版首页不再做玻璃风装饰，而是用明确的色块、边界和结构把工作流立起来。
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link href="/jobs" className="bauhaus-button bauhaus-button-red">
                  <Briefcase size={18} strokeWidth={2.6} />
                  浏览岗位
                </Link>
                <Link
                  href="/settings"
                  className="bauhaus-button bauhaus-button-outline"
                >
                  <Settings size={18} strokeWidth={2.6} />
                  配置来源
                </Link>
                <OnboardingTriggerButton />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <div className="bauhaus-panel-sm bauhaus-lift bg-[#F0C020] p-4">
                <p className="bauhaus-label text-black/65">Active Companies</p>
                <p className="mt-3 text-3xl font-black uppercase tracking-[-0.06em]">
                  {companyCount}
                </p>
                <p className="mt-2 text-sm font-medium text-black/70">
                  本期岗位涉及的公司数量。
                </p>
              </div>

              <div className="bauhaus-panel-sm bauhaus-lift bg-white p-4">
                <p className="bauhaus-label text-black/65">Current Window</p>
                <p className="mt-3 text-3xl font-black uppercase tracking-[-0.06em]">
                  {period === "today" ? "24H" : period === "week" ? "7D" : "30D"}
                </p>
                <p className="mt-2 text-sm font-medium text-black/70">
                  图表、统计与岗位列表保持同一个时间维度。
                </p>
              </div>

              <div className="bauhaus-panel-sm bauhaus-lift bg-[var(--surface-muted)] p-4 text-black sm:col-span-2 xl:col-span-1">
                <p className="bauhaus-label text-black/55">Command Strip</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href="/optimize" className="bauhaus-button bauhaus-button-yellow !px-3 !py-2 !text-[11px]">
                    <Sparkles size={14} />
                    简历优化
                  </Link>
                  <Link href="/applications" className="bauhaus-button bauhaus-button-blue !px-3 !py-2 !text-[11px]">
                    <ArrowRight size={14} />
                    投递跟进
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bauhaus-panel overflow-hidden bg-[var(--surface-muted)] text-black">
          <div className="relative min-h-[360px] p-6 md:p-8">
            <div className="absolute left-6 top-6 h-14 w-14 rounded-full border-2 border-black/30 bg-[#F0C020]/35" />
            <div className="absolute right-8 top-14 h-16 w-16 rotate-45 border-2 border-black/20 bg-[#D02020]/12" />

            <div className="relative z-10 flex min-h-[300px] flex-col justify-between">
              <div className="max-w-sm space-y-3">
                <p className="bauhaus-label text-black/55">Poster View</p>
                <h2 className="text-3xl font-black leading-[0.92] tracking-[-0.06em] md:text-4xl">
                  Data
                  <br />
                  In
                  <br />
                  Motion
                </h2>
                <p className="text-base font-medium leading-relaxed text-black/72">
                  右侧不放插画，直接用几何结构表达数据流和筛选节奏，让首页更像一张 Bauhaus 海报。
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="bauhaus-panel-sm bg-white p-4 text-black">
                  <p className="bauhaus-label text-black/60">Fresh Jobs</p>
                  <p className="mt-2 text-3xl font-black uppercase tracking-[-0.06em]">
                    {jobsData?.items?.length ?? 0}
                  </p>
                </div>
                <div className="bauhaus-panel-sm bg-[#F7E4E1] p-4 text-black">
                  <p className="bauhaus-label text-black/60">Tracked Keywords</p>
                  <p className="mt-2 text-3xl font-black uppercase tracking-[-0.06em]">
                    {keywordCount}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.section>

      <motion.div variants={item}>
        <OnboardingChecklist />
      </motion.div>

      <motion.section
        variants={item}
        className="bauhaus-panel overflow-hidden bg-[#F0C020]"
      >
          <div className="grid grid-cols-1 divide-y-2 divide-black sm:grid-cols-2 sm:divide-x-2 sm:divide-y-0 lg:grid-cols-4">
          {statCards.map((stat, index) => {
            const palette = statColors[index % statColors.length];
            const Icon = stat.icon;

            return (
              <div
                key={stat.label}
                className={`relative p-5 md:p-6 ${palette.panel}`}
              >
                <span
                  className={`absolute right-4 top-4 h-3 w-3 border border-black/50 ${palette.shape}`}
                />
                <div
                  className={`flex h-10 w-10 items-center justify-center border-2 border-black ${palette.iconBox}`}
                >
                  <Icon size={20} strokeWidth={2.4} />
                </div>
                <p className="mt-4 text-3xl font-black uppercase tracking-[-0.06em] md:text-4xl">
                  {stat.value}
                </p>
                <p className="mt-2 text-sm font-semibold tracking-[0.06em]">
                  {stat.label}
                </p>
                <p className="mt-2 text-sm font-medium leading-relaxed opacity-80">
                  {stat.note}
                </p>
              </div>
            );
          })}
        </div>
      </motion.section>

      <motion.section
        variants={item}
        className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]"
      >
        <div className="bauhaus-panel overflow-hidden bg-white">
          <div className="flex flex-col gap-4 border-b-2 border-black p-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="bauhaus-label text-black/60">Trend Monitor</p>
              <h2 className="mt-2 text-2xl font-black uppercase tracking-[-0.06em] md:text-3xl">
                Collection Trend
              </h2>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-black/70 md:text-base">
                用硬边柱状图替代柔和面积图，让时间变化读起来更直接，也更贴合整套几何视觉语言。
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {periodOptions.map((option) => {
                const active = period === option.key;

                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setPeriod(option.key as typeof period)}
                    aria-pressed={active}
                    className={`bauhaus-button !min-h-0 !px-4 !py-2 !text-[11px] ${
                      active
                        ? option.key === "today"
                          ? "bauhaus-button-red"
                          : option.key === "week"
                            ? "bauhaus-button-blue"
                            : "bauhaus-button-yellow"
                        : "bauhaus-button-outline"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-4 md:p-6">
            <TrendChart data={trendData} />
          </div>
        </div>

        <div className="bauhaus-panel overflow-hidden bg-white text-black">
          <div className="border-b-2 border-black p-6">
            <p className="bauhaus-label text-black/55">Source Split</p>
            <h2 className="mt-2 text-2xl font-black tracking-[-0.06em]">
              Platform Mix
            </h2>
            <p className="mt-2 text-sm font-medium leading-relaxed text-black/70">
              数据源不再藏在次级信息里，而是作为首页右侧的一个主视觉模块直接展示。
            </p>
          </div>

          <div className="grid">
            {topSources.length > 0 ? (
              topSources.map(([source, count], index) => (
                <div
                  key={source}
                  className="grid grid-cols-[1fr_auto] items-center gap-4 border-b-2 border-black/60 bg-white px-5 py-4 text-black last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`h-3 w-3 border border-black/60 ${
                        index % 3 === 0
                          ? "rounded-full bg-[#D02020]"
                          : index % 3 === 1
                            ? "bg-[var(--primary-blue)]"
                            : "bauhaus-triangle bg-[#F0C020]"
                      }`}
                    />
                    <div>
                      <p className="text-sm font-semibold tracking-[0.04em]">
                        {source}
                      </p>
                      <p className="text-xs font-medium text-black/55">
                        synced positions
                      </p>
                    </div>
                  </div>
                  <div className="bauhaus-panel-sm min-w-[60px] bg-[#F0C020] px-3 py-2 text-center">
                    <p className="text-xl font-bold tracking-[-0.04em]">
                      {count}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6">
                <div className="bauhaus-panel-sm bg-[#F0C020] p-5 text-black">
                  <p className="bauhaus-label text-black/65">No Source Data</p>
                  <p className="mt-2 text-sm font-medium leading-relaxed">
                    先去设置页配置平台，再到抓取器启动任务，这里就会自动形成来源分布。
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.section>

      <motion.section variants={item} className="space-y-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="bauhaus-label text-black/60">Latest Board</p>
            <h2 className="mt-2 text-2xl font-black uppercase tracking-[-0.06em] md:text-3xl">
              Recent Jobs
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-black/70 md:text-base">
              岗位卡片也统一切到硬边和色块系统，避免首页和岗位列表出现两套完全不同的视觉语法。
            </p>
          </div>

          <Link href="/jobs" className="bauhaus-button bauhaus-button-outline">
            查看全部
            <ArrowRight size={18} strokeWidth={2.6} />
          </Link>
        </div>

        {topJobs.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {topJobs.map((job) => (
              <motion.div key={job.id} variants={item} className="h-full">
                <JobCard job={job} />
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="bauhaus-panel overflow-hidden bg-white">
            <div className="grid gap-6 p-6 md:grid-cols-[auto_1fr] md:p-8">
              <div className="flex h-24 w-24 items-center justify-center border-4 border-black bg-[#F0C020]">
                <Building2 size={40} strokeWidth={2.4} />
              </div>
              <div>
                <p className="bauhaus-label text-black/60">No Jobs Yet</p>
                <h3 className="mt-2 text-3xl font-black uppercase tracking-[-0.08em]">
                  Start The Collection
                </h3>
                <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-black/70 md:text-base">
                  当前还没有可展示的岗位。先去设置页补齐来源与关键词，再到抓取器启动任务，
                  首页就会自动长出趋势图和职位卡片。
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href="/settings"
                    className="bauhaus-button bauhaus-button-outline"
                  >
                    先配设置
                  </Link>
                  <Link
                    href="/scraper"
                    className="bauhaus-button bauhaus-button-red"
                  >
                    启动抓取
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}
      </motion.section>
    </motion.div>
  );
}
