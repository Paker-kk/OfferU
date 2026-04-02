// =============================================
// 周报分析页 — 数据统计可视化
// =============================================
// 展示本周 vs 上周对比、来源分布饼图、
// 岗位采集趋势、热门关键词
// =============================================

"use client";

import { motion } from "framer-motion";
import { Card, CardBody, CardHeader, Chip } from "@nextui-org/react";
import {
  PieChart, Pie, Cell, ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, Hash } from "lucide-react";
import { useWeeklyReport, useJobTrend } from "@/lib/hooks";
import { TrendChart } from "@/components/charts/TrendChart";

const COLORS = ["#3b82f6", "#8b5cf6", "#06b6d4", "#f59e0b", "#ef4444", "#10b981", "#ec4899"];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.1 } },
};
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", damping: 15 } },
};

export default function AnalyticsPage() {
  const { data: report } = useWeeklyReport();
  const { data: trendData } = useJobTrend("week");

  const tw = report?.this_week;
  const lw = report?.last_week;

  /** 环比变化率 */
  const totalChange = tw && lw && lw.total > 0
    ? Math.round(((tw.total - lw.total) / lw.total) * 100)
    : 0;

  const ChangeIcon = ({ val }: { val: number }) =>
    val > 0 ? <TrendingUp size={14} className="text-green-400" /> :
    val < 0 ? <TrendingDown size={14} className="text-red-400" /> :
    <Minus size={14} className="text-white/40" />;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      <h1 className="text-3xl font-bold">周报分析</h1>

      {/* 核心指标卡片 */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: "本周新增", value: tw?.total ?? 0, change: totalChange, suffix: "条" },
          { label: "上周新增", value: lw?.total ?? 0, change: 0, suffix: "条" },
          { label: "数据源数量", value: (report?.source_distribution || []).length, change: 0, suffix: "个" },
        ].map((stat) => (
          <motion.div key={stat.label} variants={item}>
            <Card className="bg-white/5 border border-white/10">
              <CardBody className="p-4">
                <p className="text-sm text-white/50">{stat.label}</p>
                <div className="flex items-end gap-2 mt-1">
                  <span className="text-2xl font-bold">{stat.value}{stat.suffix}</span>
                  {stat.change !== 0 && (
                    <span className={`flex items-center gap-1 text-xs ${stat.change > 0 ? "text-green-400" : "text-red-400"}`}>
                      <ChangeIcon val={stat.change} />
                      {Math.abs(stat.change)}%
                    </span>
                  )}
                </div>
              </CardBody>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* 趋势图 + 来源分布 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div variants={item}>
          <Card className="bg-white/5 border border-white/10">
            <CardHeader className="pb-0">
              <h3 className="text-lg font-semibold">采集趋势</h3>
            </CardHeader>
            <CardBody>
              <TrendChart data={trendData} />
            </CardBody>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card className="bg-white/5 border border-white/10">
            <CardHeader className="pb-0">
              <h3 className="text-lg font-semibold">来源分布</h3>
            </CardHeader>
            <CardBody>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={report?.source_distribution || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {(report?.source_distribution || []).map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </CardBody>
          </Card>
        </motion.div>
      </div>

      {/* 热门关键词 */}
      <motion.div variants={item}>
        <Card className="bg-white/5 border border-white/10">
          <CardHeader className="pb-0">
            <h3 className="text-lg font-semibold">热门关键词 Top 20</h3>
          </CardHeader>
          <CardBody>
            <div className="flex flex-wrap gap-2">
              {(report?.top_keywords || []).map((kw, i) => (
                <Chip
                  key={kw.keyword}
                  variant="flat"
                  size="sm"
                  startContent={<Hash size={10} />}
                  className="bg-white/5"
                  style={{ opacity: 1 - i * 0.03 }}
                >
                  {kw.keyword} ({kw.count})
                </Chip>
              ))}
              {(!report?.top_keywords || report.top_keywords.length === 0) && (
                <p className="text-white/40 text-sm">暂无数据</p>
              )}
            </div>
          </CardBody>
        </Card>
      </motion.div>
    </motion.div>
  );
}
