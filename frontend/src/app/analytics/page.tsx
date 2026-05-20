"use client";

import { motion } from "framer-motion";
import { Card, CardBody, CardHeader, Chip } from "@nextui-org/react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Hash, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { useWeeklyReport, useJobTrend } from "@/lib/hooks";
import { TrendChart } from "@/components/charts/TrendChart";

const COLORS = ["#c95548", "#6f8396", "#e4c46a", "#121212", "#7a8f7e", "#C84D16", "#7C3EBD"];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.28, ease: "easeOut" } },
};

function ChangeIcon({ value }: { value: number }) {
  if (value > 0) return <TrendingUp size={15} className="text-white" />;
  if (value < 0) return <TrendingDown size={15} className="text-white" />;
  return <Minus size={15} className="text-black" />;
}

export default function AnalyticsPage() {
  const { data: report } = useWeeklyReport();
  const { data: trendData } = useJobTrend("week");

  const thisWeek = report?.this_week;
  const lastWeek = report?.last_week;
  const totalChange =
    thisWeek && lastWeek && lastWeek.total > 0
      ? Math.round(((thisWeek.total - lastWeek.total) / lastWeek.total) * 100)
      : 0;

  const statCards = [
    {
      label: "本周",
      title: "本周新增",
      value: `${thisWeek?.total ?? 0} 条`,
      note: "最近 7 天采集到的新岗位总量。",
      surface: "bg-[#e4ece6] text-black",
      accent: "bg-white text-black",
      change: totalChange,
    },
    {
      label: "上周",
      title: "上周新增",
      value: `${lastWeek?.total ?? 0} 条`,
      note: "上一时间窗口的对照数据。",
      surface: "bg-[#f3ead2] text-black",
      accent: "bg-white text-black",
      change: 0,
    },
    {
      label: "来源",
      title: "来源数量",
      value: `${report?.source_distribution?.length ?? 0} 个`,
      note: "当前参与周报统计的数据源。",
      surface: "bg-[#f7ece9] text-black",
      accent: "bg-white text-black",
      change: 0,
    },
  ];

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-8"
    >
      <motion.section variants={item} className="bauhaus-panel overflow-hidden bg-white">
        <div className="grid gap-6 p-6 md:p-8 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <span className="bauhaus-chip bg-[#f3ead2] text-black">渠道周报</span>
            <div>
              <p className="bauhaus-label text-black/55">分析中心</p>
              <h1 className="mt-3 text-4xl font-black leading-tight text-black sm:text-5xl">
                趋势
                <br />
                来源
                <br />
                关键词
              </h1>
              <p className="mt-4 max-w-2xl text-base font-medium leading-relaxed text-black/72">
                仪表盘负责下一步行动，分析页负责复盘渠道质量。这里集中看采集趋势、来源结构和关键词热度，
                判断本周岗位池是否足够活跃，以及下一轮该把精力投到哪些方向。
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
            {statCards.map((stat) => (
              <div key={stat.title} className={`bauhaus-panel-sm p-4 ${stat.surface}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className={`bauhaus-label ${stat.surface.includes("text-white") ? "text-white/70" : "text-black/55"}`}>
                      {stat.label}
                    </p>
                    <p className="mt-3 text-3xl font-black">{stat.value}</p>
                  </div>
                  <div className={`flex h-11 w-11 items-center justify-center border-2 border-black ${stat.accent}`}>
                    <ChangeIcon value={stat.change} />
                  </div>
                </div>
                <p className={`mt-3 text-sm font-medium ${stat.surface.includes("text-white") ? "text-white/80" : "text-black/70"}`}>
                  {stat.note}
                </p>
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      <motion.section variants={item} className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="bauhaus-panel overflow-hidden rounded-none bg-white shadow-none">
          <CardHeader className="border-b border-black/12 bg-[var(--surface-muted)] px-6 py-5 text-black">
            <div>
              <p className="bauhaus-label text-black/55">趋势报告</p>
              <h2 className="mt-2 text-3xl font-black">采集趋势</h2>
            </div>
          </CardHeader>
          <CardBody className="p-5">
            <TrendChart data={trendData} />
          </CardBody>
        </Card>

        <Card className="bauhaus-panel overflow-hidden rounded-none bg-white shadow-none">
          <CardHeader className="border-b border-black/12 bg-[var(--surface-muted)] px-6 py-5 text-black">
            <div>
              <p className="bauhaus-label text-black/55">来源结构</p>
              <h2 className="mt-2 text-3xl font-black">来源分布</h2>
            </div>
          </CardHeader>
          <CardBody className="p-5">
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={report?.source_distribution || []}
                  cx="50%"
                  cy="50%"
                  innerRadius={62}
                  outerRadius={112}
                  paddingAngle={4}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {(report?.source_distribution || []).map((_, index) => (
                    <Cell key={index} fill={COLORS[index % COLORS.length]} stroke="#121212" strokeWidth={2} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </CardBody>
        </Card>
      </motion.section>

      <motion.section variants={item}>
        <Card className="bauhaus-panel overflow-hidden rounded-none bg-white shadow-none">
          <CardHeader className="border-b border-black/12 bg-[var(--surface-muted)] px-6 py-5 text-black">
            <div>
              <p className="bauhaus-label text-black/55">高频词</p>
              <h2 className="mt-2 text-3xl font-black">热门关键词</h2>
            </div>
          </CardHeader>
          <CardBody className="p-5">
            <div className="flex flex-wrap gap-2">
              {(report?.top_keywords || []).map((kw, index) => (
                <Chip
                  key={kw.keyword}
                  variant="flat"
                  size="sm"
                  startContent={<Hash size={10} />}
                  className={`border-2 border-black text-[11px] font-semibold ${
                    index % 3 === 0
                      ? "bg-[#6f8396] text-white"
                      : index % 3 === 1
                        ? "bg-[#e4c46a] text-black"
                        : "bg-white text-black"
                  }`}
                >
                  {kw.keyword} ({kw.count})
                </Chip>
              ))}
              {(!report?.top_keywords || report.top_keywords.length === 0) && (
                <div className="bauhaus-panel-sm bg-[var(--surface-muted)] px-4 py-4 text-sm font-medium text-black/60">
                  暂无数据，等周报聚合后这里会出现关键词热度。
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      </motion.section>
    </motion.div>
  );
}
