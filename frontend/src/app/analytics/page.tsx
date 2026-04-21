"use client";

import { motion } from "framer-motion";
import { Card, CardBody, CardHeader, Chip } from "@nextui-org/react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Hash, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { useWeeklyReport, useJobTrend } from "@/lib/hooks";
import { TrendChart } from "@/components/charts/TrendChart";

const COLORS = ["#D02020", "#1040C0", "#F0C020", "#121212", "#2E6B4A", "#C84D16", "#7C3EBD"];

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
      label: "This Week",
      title: "本周新增",
      value: `${thisWeek?.total ?? 0} 条`,
      note: "最近 7 天采集到的新岗位总量。",
      surface: "bg-[#D02020] text-white",
      accent: "bg-white text-black",
      change: totalChange,
    },
    {
      label: "Last Week",
      title: "上周新增",
      value: `${lastWeek?.total ?? 0} 条`,
      note: "上一时间窗口的对照数据。",
      surface: "bg-[#1040C0] text-white",
      accent: "bg-[#F0C020] text-black",
      change: 0,
    },
    {
      label: "Sources",
      title: "来源数量",
      value: `${report?.source_distribution?.length ?? 0} 个`,
      note: "当前参与周报统计的数据源。",
      surface: "bg-[#F0C020] text-black",
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
            <span className="bauhaus-chip bg-[#F0C020]">Weekly Signal Report</span>
            <div>
              <p className="bauhaus-label text-black/55">Analytics Board</p>
              <h1 className="mt-3 text-5xl font-black uppercase leading-[0.88] tracking-[-0.08em] sm:text-6xl">
                Measure
                <br />
                Track
                <br />
                Adjust
              </h1>
              <p className="mt-4 max-w-2xl text-base font-medium leading-relaxed text-black/72">
                把采集趋势、来源结构和关键词热度整理成一张几何海报，方便我们快速判断本周岗位池是否足够活跃，
                以及接下来该把精力投入到哪些方向。
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
                    <p className="mt-3 text-3xl font-black uppercase tracking-[-0.08em]">{stat.value}</p>
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
          <CardHeader className="border-b-2 border-black bg-[#1040C0] px-6 py-5 text-white">
            <div>
              <p className="bauhaus-label text-white/70">Trend Report</p>
              <h2 className="mt-2 text-3xl font-black uppercase tracking-[-0.06em]">采集趋势</h2>
            </div>
          </CardHeader>
          <CardBody className="p-5">
            <TrendChart data={trendData} />
          </CardBody>
        </Card>

        <Card className="bauhaus-panel overflow-hidden rounded-none bg-white shadow-none">
          <CardHeader className="border-b-2 border-black bg-[#F0C020] px-6 py-5 text-black">
            <div>
              <p className="bauhaus-label text-black/60">Source Mix</p>
              <h2 className="mt-2 text-3xl font-black uppercase tracking-[-0.06em]">来源分布</h2>
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
          <CardHeader className="border-b-2 border-black bg-[#D02020] px-6 py-5 text-white">
            <div>
              <p className="bauhaus-label text-white/70">Top Terms</p>
              <h2 className="mt-2 text-3xl font-black uppercase tracking-[-0.06em]">热门关键词</h2>
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
                      ? "bg-[#1040C0] text-white"
                      : index % 3 === 1
                        ? "bg-[#F0C020] text-black"
                        : "bg-white text-black"
                  }`}
                >
                  {kw.keyword} ({kw.count})
                </Chip>
              ))}
              {(!report?.top_keywords || report.top_keywords.length === 0) && (
                <div className="bauhaus-panel-sm bg-[#F0F0F0] px-4 py-4 text-sm font-medium text-black/60">
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
