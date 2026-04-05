// =============================================
// Dashboard 首页 — 数据可视化总览
// =============================================
// 展示：岗位统计摘要、采集趋势、最新岗位卡片
// 动画：卡片交错入场 + 数字计数动画
// =============================================

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Briefcase, TrendingUp, Zap, Layers } from "lucide-react";
import { Card, CardBody, CardHeader, Button, Tabs, Tab } from "@nextui-org/react";
import { TrendChart } from "@/components/charts/TrendChart";
import { JobCard } from "@/components/jobs/JobCard";
import { OnboardingChecklist, OnboardingTriggerButton } from "@/components/onboarding/OnboardingChecklist";
import { useJobs, useJobStats, useJobTrend } from "@/lib/hooks";
import Link from "next/link";

// 动画变体：卡片交错入场
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", damping: 15 } },
};

export default function DashboardPage() {
  const [period, setPeriod] = useState<string>("week");
  const { data: stats } = useJobStats(period);
  const { data: jobsData } = useJobs({ page: 1, period });
  const { data: trendData } = useJobTrend(period);

  const totalJobs = stats?.total_jobs ?? 0;
  const sourceCount = Object.keys(stats?.source_distribution ?? {}).length;
  const topJobs = (jobsData?.items ?? []).slice(0, 6);

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Onboarding 引导卡片 */}
      <OnboardingChecklist />

      {/* 页面标题 */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-white/50 mt-1">OfferU 岗位采集概览</p>
        </div>
        <div className="flex items-center gap-3">
          <OnboardingTriggerButton />
          <Tabs
            selectedKey={period}
            onSelectionChange={(key) => setPeriod(key as string)}
            variant="underlined"
            size="sm"
          >
            <Tab key="today" title="今日" />
            <Tab key="week" title="本周" />
            <Tab key="month" title="本月" />
          </Tabs>
        </div>
      </motion.div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "岗位总数", value: totalJobs, icon: Briefcase, color: "text-purple-400" },
          { label: "数据源", value: sourceCount, icon: Zap, color: "text-blue-400" },
          { label: "今日新增", value: jobsData?.items?.length ?? 0, icon: TrendingUp, color: "text-green-400" },
          { label: "关键词", value: topJobs.reduce((acc, j) => acc + (j.keywords?.length ?? 0), 0), icon: Layers, color: "text-yellow-400" },
        ].map((stat) => (
          <motion.div key={stat.label} variants={item}>
            <Card className="bg-white/5 border border-white/10">
              <CardBody className="flex flex-row items-center gap-4 p-4">
                <div className={`p-3 rounded-xl bg-white/5 ${stat.color}`}>
                  <stat.icon size={24} />
                </div>
                <div>
                  <p className="text-white/50 text-sm">{stat.label}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
              </CardBody>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* 趋势图 */}
      <motion.div variants={item}>
        <Card className="bg-white/5 border border-white/10">
          <CardHeader className="pb-0">
            <h3 className="text-lg font-semibold">岗位采集趋势</h3>
          </CardHeader>
          <CardBody>
            <TrendChart data={trendData} />
          </CardBody>
        </Card>
      </motion.div>

      {/* 最新岗位 */}
      <motion.div variants={item}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">最新岗位</h2>
          <Link href="/jobs">
            <Button size="sm" variant="flat" className="text-blue-400">
              查看全部
            </Button>
          </Link>
        </div>
        {topJobs.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {topJobs.map((job) => (
              <motion.div
                key={job.id}
                variants={item}
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <JobCard job={job} />
              </motion.div>
            ))}
          </div>
        ) : (
          <Card className="bg-white/5 border border-white/10">
            <CardBody className="p-8 text-center text-white/40">
              <p>暂无岗位数据</p>
              <p className="text-sm mt-1">请在设置页配置数据源和关键词后开始采集</p>
            </CardBody>
          </Card>
        )}
      </motion.div>
    </motion.div>
  );
}
