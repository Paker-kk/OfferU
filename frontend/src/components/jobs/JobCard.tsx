// =============================================
// 岗位卡片组件 — 单个岗位展示
// =============================================
// 展示：标题、公司、来源标签、关键词 Chips
// hover 提升动画
// 支持批量选择模式（checkbox）
// =============================================

"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, Chip, Avatar, Checkbox } from "@nextui-org/react";
import { MapPin, Briefcase, GraduationCap, DollarSign, Building2 } from "lucide-react";
import type { Job } from "@/lib/hooks";

// 来源平台颜色映射
const sourceColorMap: Record<string, "primary" | "success" | "warning" | "danger" | "secondary"> = {
  boss: "warning",
  zhilian: "primary",
  linkedin: "secondary",
  shixiseng: "success",
  maimai: "danger",
  corporate: "primary",
};

interface JobCardProps {
  job: Job;
  showCheckbox?: boolean;
  selected?: boolean;
  onToggle?: (id: number, options?: { shiftKey?: boolean }) => void;
  onSelectPointerDown?: (id: number, options?: { shiftKey?: boolean }) => void;
  onSelectPointerEnter?: (id: number) => void;
}

export function JobCard({
  job,
  showCheckbox,
  selected,
  onToggle,
  onSelectPointerDown,
  onSelectPointerEnter,
}: JobCardProps) {
  const router = useRouter();
  const sourceColor = sourceColorMap[job.source] || "primary";
  const shiftKeyRef = useRef(false);
  const openDetail = () => {
    router.push(`/jobs/${job.id}`);
  };

  return (
    <Card
      className={`relative w-full max-w-full bg-white/5 border transition-colors cursor-pointer h-[248px] min-h-[248px] max-h-[248px] ${
        selected
          ? "border-blue-500 ring-2 ring-blue-500/30"
          : "border-white/10 hover:border-white/20"
      }`}
      onMouseEnter={() => onSelectPointerEnter?.(job.id)}
    >
      <button
        type="button"
        aria-label={`查看岗位详情-${job.title}`}
        className="absolute inset-0 z-10"
        onClick={openDetail}
      />

      <CardBody className="p-5 flex flex-col gap-2.5 overflow-hidden">
        {/* 头部：公司Logo + 标题 + 来源 */}
        <div className="flex items-start gap-3 shrink-0">
          <Avatar
            src={job.company_logo || undefined}
            name={job.company?.[0] || "?"}
            size="sm"
            className="shrink-0 bg-white/10"
          />
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold text-blue-300 leading-tight break-words line-clamp-2 min-h-[2.5rem]">
              {job.title}
            </h3>
            <div className="flex items-center gap-2 text-sm text-white/50 mt-0.5">
              <span className="truncate">{job.company}</span>
              {job.company_industry && (
                <>
                  <span>·</span>
                  <span className="truncate">{job.company_industry}</span>
                </>
              )}
            </div>
          </div>
          <Chip size="sm" variant="dot" color={sourceColor} className="text-xs shrink-0">
            {job.source}
          </Chip>
        </div>

        {/* 薪资 + 标签行 */}
        <div className="flex items-center gap-2 text-xs text-white/50 shrink-0 overflow-hidden whitespace-nowrap">
          {job.salary_text && (
            <span className="flex items-center gap-0.5 text-green-400 font-semibold text-sm truncate max-w-[8.5rem]">
              <DollarSign size={14} />{job.salary_text}
            </span>
          )}
          {job.location && (
            <span className="flex items-center gap-0.5 truncate max-w-[7rem]">
              <MapPin size={12} />{job.location}
            </span>
          )}
          {job.education && (
            <span className="flex items-center gap-0.5 truncate max-w-[5rem]">
              <GraduationCap size={12} />{job.education}
            </span>
          )}
          {job.experience && (
            <span className="flex items-center gap-0.5 truncate max-w-[6rem]">
              <Briefcase size={12} />{job.experience}
            </span>
          )}
          {job.company_size && (
            <span className="flex items-center gap-0.5 truncate max-w-[6rem]">
              <Building2 size={12} />{job.company_size}
            </span>
          )}
        </div>

        {/* 摘要 — 固定空间，不足留白 */}
        <p className="text-sm text-white/60 line-clamp-2 flex-1 min-h-0">
          {job.summary || "\u00A0"}
        </p>

        {/* 关键词 + 岗位类型/校招标签 — 始终在底部 */}
        <div className="flex flex-wrap gap-1.5 shrink-0 max-h-[28px] overflow-hidden">
          {job.is_campus && (
            <Chip size="sm" variant="flat" color="success" className="text-xs">
              校招
            </Chip>
          )}
          {job.job_type && (
            <Chip size="sm" variant="flat" color="warning" className="text-xs">
              {job.job_type}
            </Chip>
          )}
          {job.keywords?.slice(0, 3).map((kw) => (
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
      </CardBody>

      {showCheckbox && (
        <div
          data-role="selection-control"
          className="absolute right-3 bottom-3 z-30 rounded-md bg-black/35 p-0.5 backdrop-blur-sm"
          onClick={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <Checkbox
            isSelected={selected}
            onClick={(event) => {
              event.stopPropagation();
              shiftKeyRef.current = event.shiftKey;
            }}
            onMouseDown={(event) => {
              if (event.button !== 0) return;
              event.stopPropagation();
              shiftKeyRef.current = event.shiftKey;
              onSelectPointerDown?.(job.id, { shiftKey: event.shiftKey });
            }}
            onValueChange={() => {
              onToggle?.(job.id, { shiftKey: shiftKeyRef.current });
              shiftKeyRef.current = false;
            }}
            size="sm"
            color="primary"
          />
        </div>
      )}
    </Card>
  );
}
