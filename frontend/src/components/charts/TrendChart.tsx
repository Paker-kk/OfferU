// =============================================
// 岗位采集趋势图组件 — 每日新增岗位数折线图
// =============================================
// 使用 Recharts AreaChart
// 渐变填充 + 平滑曲线
// 接受外部 data prop；无数据时显示 fallback
// =============================================

"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export interface TrendPoint {
  date: string;
  count: number;
}

const fallback: TrendPoint[] = [
  { date: "Mon", count: 0 },
  { date: "Tue", count: 0 },
  { date: "Wed", count: 0 },
];

export function TrendChart({ data }: { data?: TrendPoint[] }) {
  const chartData = data && data.length > 0 ? data : fallback;

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
        <XAxis
          dataKey="date"
          tick={{ fill: "#ffffff60", fontSize: 12 }}
          axisLine={{ stroke: "#ffffff15" }}
        />
        <YAxis
          tick={{ fill: "#ffffff60", fontSize: 12 }}
          axisLine={{ stroke: "#ffffff15" }}
        />
        <Tooltip
          contentStyle={{
            background: "#1a1a2e",
            border: "1px solid #ffffff15",
            borderRadius: "8px",
            color: "#fff",
          }}
        />
        <Area
          type="monotone"
          dataKey="count"
          stroke="#3b82f6"
          strokeWidth={2}
          fill="url(#colorCount)"
          name="新增岗位"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
