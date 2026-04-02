// =============================================
// 岗位详情页 — 单岗位完整信息
// =============================================
// 路由: /jobs/[id]
// 展示岗位全部信息：标题、公司、AI摘要、关键词
// =============================================

"use client";

import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Card,
  CardBody,
  Chip,
  Button,
  Spinner,
  Link,
} from "@nextui-org/react";
import {
  ArrowLeft,
  ExternalLink,
  MapPin,
  Building2,
  Calendar,
  Send,
} from "lucide-react";
import { useJob } from "@/lib/hooks";
import { createApplication } from "@/lib/hooks";

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id ? Number(params.id) : null;
  const { data: job, isLoading, error } = useJob(jobId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <p className="text-white/50">岗位不存在或加载失败</p>
        <Button variant="bordered" onPress={() => router.push("/jobs")}>
          返回列表
        </Button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", damping: 15 }}
      className="space-y-6 max-w-4xl"
    >
      {/* 顶栏：返回 + 标题 */}
      <div className="flex items-center gap-3">
        <Button
          isIconOnly
          variant="light"
          onPress={() => router.push("/jobs")}
        >
          <ArrowLeft size={20} />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{job.title}</h1>
          <div className="flex items-center gap-3 mt-1 text-white/60 text-sm">
            <span className="flex items-center gap-1">
              <Building2 size={14} /> {job.company}
            </span>
            <span className="flex items-center gap-1">
              <MapPin size={14} /> {job.location}
            </span>
            {job.posted_at && (
              <span className="flex items-center gap-1">
                <Calendar size={14} /> {job.posted_at}
              </span>
            )}
            <Chip size="sm" variant="flat">
              {job.source}
            </Chip>
          </div>
        </div>
      </div>

      {/* AI 摘要 */}
      {job.summary && (
        <Card className="bg-white/5 border border-white/10">
          <CardBody>
            <h3 className="text-lg font-semibold mb-2">AI 摘要</h3>
            <p className="text-white/70 leading-relaxed">{job.summary}</p>
          </CardBody>
        </Card>
      )}

      {/* 关键词 */}
      {job.keywords?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {job.keywords.map((kw) => (
            <Chip key={kw} size="sm" variant="flat" className="bg-white/10">
              {kw}
            </Chip>
          ))}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-3">
        {job.url && (
          <Button
            as={Link}
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            color="primary"
            variant="ghost"
            endContent={<ExternalLink size={16} />}
            className="flex-1"
          >
            查看原文
          </Button>
        )}
        <Button
          color="success"
          endContent={<Send size={16} />}
          className="flex-1"
          onPress={async () => {
            await createApplication(job.id);
            router.push("/applications");
          }}
        >
          一键投递
        </Button>
      </div>
    </motion.div>
  );
}
