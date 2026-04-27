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
    panel: "bg-[var(--surface)]",
    iconBox: "bg-[#f6ecea] text-black",
    shape: "rounded-full bg-[#d8e2da]",
  },
  {
    panel: "bg-[var(--surface-muted)]",
    iconBox: "bg-[#e4ece6] text-black",
    shape: "bg-[#efe3bc]",
  },
  {
    panel: "bg-[var(--surface)]",
    iconBox: "bg-[#efe3bc] text-black",
    shape: "bauhaus-triangle bg-[#e8d2cd]",
  },
  {
    panel: "bg-[var(--surface-muted)]",
    iconBox: "bg-[#efe3bc] text-black",
    shape: "rotate-45 bg-[#d8e2da]",
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
      note: "所有已同步职位",
    },
    {
      label: "活跃来源",
      value: sourceCount,
      icon: Target,
      note: "当前参与抓取的平台数",
    },
    {
      label: "本期新增",
      value: jobsData?.items?.length ?? 0,
      icon: TrendingUp,
      note: "当前时间窗口新增岗位",
    },
    {
      label: "关键词命中",
      value: keywordCount,
      icon: Layers,
      note: "首页岗位卡片关键词总和",
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
        <div className="bauhaus-panel overflow-hidden bg-[var(--surface)]">
          <div className="grid gap-8 p-6 md:p-8 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-6">
              <span className="bauhaus-chip bg-[#f3ead2]">岗位进展总览</span>

              <div>
                <p className="bauhaus-label text-black/60">求职工作台</p>
                <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl xl:text-6xl">
                  把求职节奏
                  <br />
                  握在手里
                </h1>
                <p className="mt-4 max-w-2xl text-base font-medium leading-relaxed text-black/72 md:text-lg">
                  在一个页面里看清抓取、筛选、简历与投递状态。重点信息优先展示，
                  让你更快判断下一步动作。
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link href="/jobs" className="bauhaus-button bauhaus-button-red">
                  <Briefcase size={18} strokeWidth={2.4} />
                  浏览岗位
                </Link>
                <Link
                  href="/settings"
                  className="bauhaus-button bauhaus-button-outline"
                >
                  <Settings size={18} strokeWidth={2.4} />
                  配置来源
                </Link>
                <OnboardingTriggerButton />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <div className="bauhaus-panel-sm bauhaus-lift bg-[#f3ead2] p-4">
                <p className="bauhaus-label text-black/65">活跃公司数</p>
                <p className="mt-3 text-3xl font-bold">{companyCount}</p>
                <p className="mt-2 text-sm font-medium text-black/70">
                  当前时间范围内涉及的公司数量。
                </p>
              </div>

              <div className="bauhaus-panel-sm bauhaus-lift bg-[var(--surface)] p-4">
                <p className="bauhaus-label text-black/65">统计窗口</p>
                <p className="mt-3 text-3xl font-bold">
                  {period === "today" ? "24 小时" : period === "week" ? "近 7 天" : "近 30 天"}
                </p>
                <p className="mt-2 text-sm font-medium text-black/70">
                  图表、统计与岗位列表使用同一时间维度。
                </p>
              </div>

              <div className="bauhaus-panel-sm bauhaus-lift bg-[var(--surface-muted)] p-4 text-black sm:col-span-2 xl:col-span-1">
                <p className="bauhaus-label text-black/55">快捷入口</p>
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
            <div className="absolute left-6 top-6 h-14 w-14 rounded-full border border-black/20 bg-[#efe3bc]/45" />
            <div className="absolute right-8 top-14 h-16 w-16 rotate-45 border border-black/15 bg-[#e8d2cd]/35" />

            <div className="relative z-10 flex min-h-[300px] flex-col justify-between">
              <div className="max-w-sm space-y-3">
                <p className="bauhaus-label text-black/55">本周概览</p>
                <h2 className="text-3xl font-bold leading-tight md:text-4xl">
                  数据有序
                  <br />
                  推进中
                </h2>
                <p className="text-base font-medium leading-relaxed text-black/72">
                  用简洁卡片呈现关键进展，帮助你快速确认“现在到哪一步、接下来做什么”。
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="bauhaus-panel-sm bg-[var(--surface)] p-4 text-black">
                  <p className="bauhaus-label text-black/60">新增岗位</p>
                  <p className="mt-2 text-3xl font-bold">{jobsData?.items?.length ?? 0}</p>
                </div>
                <div className="bauhaus-panel-sm bg-[#f7ece9] p-4 text-black">
                  <p className="bauhaus-label text-black/60">关键词命中</p>
                  <p className="mt-2 text-3xl font-bold">{keywordCount}</p>
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
        className="bauhaus-panel overflow-hidden bg-[var(--surface-muted)]"
      >
        <div className="grid grid-cols-1 divide-y divide-black/15 sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
          {statCards.map((stat, index) => {
            const palette = statColors[index % statColors.length];
            const Icon = stat.icon;

            return (
              <div
                key={stat.label}
                className={`relative p-5 md:p-6 ${palette.panel}`}
              >
                <span
                  className={`absolute right-4 top-4 h-3 w-3 border border-black/30 ${palette.shape}`}
                />
                <div
                  className={`flex h-10 w-10 items-center justify-center border border-black/25 ${palette.iconBox}`}
                >
                  <Icon size={20} strokeWidth={2.2} />
                </div>
                <p className="mt-4 text-3xl font-bold md:text-4xl">{stat.value}</p>
                <p className="mt-2 text-sm font-semibold">{stat.label}</p>
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
        <div className="bauhaus-panel overflow-hidden bg-[var(--surface)]">
          <div className="flex flex-col gap-4 border-b border-black/15 p-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="bauhaus-label text-black/60">趋势监测</p>
              <h2 className="mt-2 text-2xl font-bold md:text-3xl">抓取趋势</h2>
              <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-black/70 md:text-base">
                统一时间窗口后，你可以更快判断抓取频率是否稳定、是否需要补充渠道。
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

        <div className="bauhaus-panel overflow-hidden bg-[var(--surface)] text-black">
          <div className="border-b border-black/15 p-6">
            <p className="bauhaus-label text-black/55">来源结构</p>
            <h2 className="mt-2 text-2xl font-bold">平台分布</h2>
            <p className="mt-2 text-sm font-medium leading-relaxed text-black/70">
              主动观察来源分布，有助于避免渠道单一导致的岗位样本偏差。
            </p>
          </div>

          <div className="grid">
            {topSources.length > 0 ? (
              topSources.map(([source, count], index) => (
                <div
                  key={source}
                  className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-black/10 bg-[var(--surface)] px-5 py-4 text-black last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`h-3 w-3 border border-black/30 ${
                        index % 3 === 0
                          ? "rounded-full bg-[#e8d2cd]"
                          : index % 3 === 1
                            ? "bg-[#d8e2da]"
                            : "bauhaus-triangle bg-[#efe3bc]"
                      }`}
                    />
                    <div>
                      <p className="text-sm font-semibold">{source}</p>
                      <p className="text-xs font-medium text-black/55">已同步岗位</p>
                    </div>
                  </div>
                  <div className="bauhaus-panel-sm min-w-[60px] bg-[#f3ead2] px-3 py-2 text-center">
                    <p className="text-xl font-bold">{count}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="p-6">
                <div className="bauhaus-panel-sm bg-[#f3ead2] p-5 text-black">
                  <p className="bauhaus-label text-black/65">暂无来源数据</p>
                  <p className="mt-2 text-sm font-medium leading-relaxed">
                    先在设置页补齐平台配置，再去抓取器发起任务，这里会自动形成来源分布。
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
            <p className="bauhaus-label text-black/60">最新岗位</p>
            <h2 className="mt-2 text-2xl font-bold md:text-3xl">近期机会</h2>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-black/70 md:text-base">
              这里展示当前窗口下最值得优先处理的一批岗位，方便你直接进入下一步。
            </p>
          </div>

          <Link href="/jobs" className="bauhaus-button bauhaus-button-outline">
            查看全部
            <ArrowRight size={18} strokeWidth={2.4} />
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
          <div className="bauhaus-panel overflow-hidden bg-[var(--surface)]">
            <div className="grid gap-6 p-6 md:grid-cols-[auto_1fr] md:p-8">
              <div className="flex h-24 w-24 items-center justify-center border border-black/20 bg-[#f3ead2]">
                <Building2 size={40} strokeWidth={2.2} />
              </div>
              <div>
                <p className="bauhaus-label text-black/60">暂无岗位</p>
                <h3 className="mt-2 text-3xl font-bold">先开始一次抓取</h3>
                <p className="mt-3 max-w-2xl text-sm font-medium leading-relaxed text-black/70 md:text-base">
                  当前还没有可展示的岗位。先去设置页补齐来源与关键词，再到抓取器启动任务，
                  首页就会自动出现趋势与岗位卡片。
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href="/settings"
                    className="bauhaus-button bauhaus-button-outline"
                  >
                    去配置
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
