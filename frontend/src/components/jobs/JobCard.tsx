// =============================================
// 岗位卡片组件 — 单个岗位展示
// =============================================
// 展示：标题、公司、来源标签、关键词 Chips
// hover 提升动画
// =============================================

"use client";

import { useRouter } from "next/navigation";
import { Card, CardBody, Chip } from "@nextui-org/react";
import { MapPin, ExternalLink } from "lucide-react";

interface JobData {
  id: number;
  title: string;
  company: string;
  location: string;
  source: string;
  keywords: string[];
  summary: string;
}

export function JobCard({ job }: { job: JobData }) {
  const router = useRouter();

  return (
    <Card
      isPressable
      onPress={() => router.push(`/jobs/${job.id}`)}
      className="bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
    >
      <CardBody className="p-5 space-y-3">
        {/* 标题 */}
        <h3 className="text-base font-bold text-blue-300 leading-tight">
          {job.title}
        </h3>

        {/* 公司 + 地点 */}
        <div className="flex items-center gap-2 text-sm text-white/50">
          <span>{job.company}</span>
          <span>·</span>
          <MapPin size={12} />
          <span>{job.location}</span>
        </div>

        {/* 摘要 */}
        <p className="text-sm text-white/60 line-clamp-2">{job.summary}</p>

        {/* 关键词 */}
        <div className="flex flex-wrap gap-1.5">
          {job.keywords?.slice(0, 5).map((kw) => (
            <Chip
              key={kw}
              size="sm"
              variant="flat"
              className="bg-white/5 text-white/60 text-xs"
            >
              {kw}
            </Chip>
          ))}
        </div>

        {/* 来源标签 */}
        <div className="flex items-center justify-between pt-1">
          <Chip size="sm" variant="dot" color="primary" className="text-xs">
            {job.source}
          </Chip>
          <ExternalLink size={14} className="text-white/30" />
        </div>
      </CardBody>
    </Card>
  );
}
