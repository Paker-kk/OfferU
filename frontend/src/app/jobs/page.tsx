// =============================================
// 岗位列表页 — 全部匹配岗位展示
// =============================================
// 筛选：数据源 / 时间范围 / 排序
// 布局：响应式网格 + 滑动动画列表
// API 联调：通过 SWR hooks 获取后端数据
// =============================================

"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardBody, Tabs, Tab, Pagination, Spinner } from "@nextui-org/react";
import { JobCard } from "@/components/jobs/JobCard";
import { useJobs } from "@/lib/hooks";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, x: -20 },
  show: { opacity: 1, x: 0, transition: { type: "spring", damping: 15 } },
};

export default function JobsPage() {
  const [period, setPeriod] = useState<string>("week");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useJobs(page, period);

  const jobs = data?.items ?? [];
  const totalPages = Math.ceil((data?.total ?? 0) / (data?.page_size ?? 20));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      <h1 className="text-3xl font-bold">岗位匹配</h1>

      {/* 筛选栏 */}
      <div className="flex flex-wrap items-center gap-4">
        <Tabs
          aria-label="时间范围"
          variant="underlined"
          classNames={{ tabList: "gap-4" }}
          selectedKey={period}
          onSelectionChange={(key) => {
            setPeriod(key as string);
            setPage(1);
          }}
        >
          <Tab key="today" title="今日" />
          <Tab key="week" title="本周" />
          <Tab key="month" title="本月" />
        </Tabs>
        {data && (
          <span className="text-sm text-white/40">
            共 {data.total} 个岗位
          </span>
        )}
      </div>

      {/* 岗位列表 */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Spinner size="lg" />
        </div>
      ) : jobs.length > 0 ? (
        <>
          <motion.div
            variants={container}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4"
          >
            {jobs.map((job) => (
              <motion.div
                key={job.id}
                variants={item}
                whileHover={{ y: -4 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <JobCard job={job} />
              </motion.div>
            ))}
          </motion.div>

          {/* 分页 */}
          {totalPages > 1 && (
            <div className="flex justify-center pt-4">
              <Pagination
                total={totalPages}
                page={page}
                onChange={setPage}
                showControls
                classNames={{
                  cursor: "bg-blue-500",
                }}
              />
            </div>
          )}
        </>
      ) : (
        <Card className="bg-white/5 border border-white/10">
          <CardBody className="p-8 text-center text-white/40">
            <p className="text-lg mb-2">暂无岗位数据</p>
            <p className="text-sm">尝试切换时间范围，或在设置页配置数据源</p>
          </CardBody>
        </Card>
      )}
    </motion.div>
  );
}
