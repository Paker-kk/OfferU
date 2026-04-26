"use client";

import { useRouter } from "next/navigation";
import {
  Briefcase,
  Building2,
  Check,
  DollarSign,
  GraduationCap,
  MapPin,
} from "lucide-react";
import type { Job } from "@/lib/hooks";

const sourceAccentMap: Record<
  string,
  { badge: string; marker: string; meta: string }
> = {
  boss: {
    badge: "bg-[#D02020] text-white",
    marker: "rounded-full bg-[#F0C020]",
    meta: "Boss",
  },
  zhilian: {
    badge: "bg-[#1040C0] text-white",
    marker: "bg-[#D02020]",
    meta: "Zhilian",
  },
  linkedin: {
    badge: "bg-[#F0C020] text-black",
    marker: "bauhaus-triangle bg-[#1040C0]",
    meta: "LinkedIn",
  },
  shixiseng: {
    badge: "bg-[#121212] text-white",
    marker: "rounded-full bg-[#D02020]",
    meta: "Shixi",
  },
  maimai: {
    badge: "bg-[#D02020] text-white",
    marker: "bg-[#1040C0]",
    meta: "Maimai",
  },
  corporate: {
    badge: "bg-[#1040C0] text-white",
    marker: "bauhaus-triangle bg-[#F0C020]",
    meta: "Career",
  },
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
  const accent = sourceAccentMap[job.source] || {
    badge: "bg-white text-black",
    marker: "rounded-full bg-[#D02020]",
    meta: "Source",
  };

  const openDetail = () => {
    router.push(`/jobs/${job.id}`);
  };

  return (
    <article
      className={`group relative flex h-full min-h-[280px] max-w-full flex-col overflow-hidden border-2 border-black/80 bg-white transition-all duration-200 ease-out ${
        selected
          ? "bg-[#F0C020] shadow-[3px_3px_0_0_rgba(18,18,18,0.5)]"
          : "shadow-[2px_2px_0_0_rgba(18,18,18,0.35)] hover:-translate-y-1 hover:shadow-[3px_3px_0_0_rgba(18,18,18,0.45)]"
      }`}
      onMouseEnter={() => onSelectPointerEnter?.(job.id)}
    >
      <button
        type="button"
        aria-label={`查看岗位详情 ${job.title}`}
        className="absolute inset-0 z-10"
        onClick={openDetail}
      />

      <span
        className={`absolute right-4 top-4 z-[1] h-3 w-3 border border-black/50 ${accent.marker}`}
      />

      <div className="relative z-[1] flex h-full flex-col gap-4 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden border-2 border-black bg-[#F0F0F0]">
            {job.company_logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={job.company_logo}
                alt={`${job.company} logo`}
                className="h-full w-full object-cover grayscale"
                loading="lazy"
                referrerPolicy="no-referrer"
              />
            ) : (
              <span className="text-lg font-black uppercase tracking-[-0.08em]">
                {(job.company || "?").slice(0, 1)}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="bauhaus-label text-black/55">{accent.meta}</p>
            <h3 className="mt-1 line-clamp-2 text-xl font-black uppercase leading-tight tracking-[-0.05em] text-black">
              {job.title}
            </h3>
            <p className="mt-2 line-clamp-1 text-sm font-semibold tracking-[0.04em] text-black/65">
              {job.company}
            </p>
          </div>

          <span className={`bauhaus-chip ${accent.badge}`}>{job.source}</span>
        </div>

        <div className="flex flex-wrap gap-1.5 text-xs font-medium text-black/70">
          {job.salary_text && (
            <span className="bauhaus-chip bg-[#F0C020]">
              <DollarSign size={12} strokeWidth={2.4} />
              {job.salary_text}
            </span>
          )}
          {job.location && (
            <span className="bauhaus-chip">
              <MapPin size={12} strokeWidth={2.4} />
              {job.location}
            </span>
          )}
          {job.education && (
            <span className="bauhaus-chip">
              <GraduationCap size={12} strokeWidth={2.4} />
              {job.education}
            </span>
          )}
          {job.experience && (
            <span className="bauhaus-chip">
              <Briefcase size={12} strokeWidth={2.4} />
              {job.experience}
            </span>
          )}
          {job.company_size && (
            <span className="bauhaus-chip">
              <Building2 size={12} strokeWidth={2.4} />
              {job.company_size}
            </span>
          )}
        </div>

        <p className="line-clamp-3 flex-1 text-sm font-medium leading-relaxed text-black/72">
          {job.summary || "这条岗位暂时还没有摘要，点击卡片可查看完整详情。"}
        </p>

        <div className="flex flex-wrap gap-2">
          {job.is_campus && (
            <span className="bauhaus-chip bg-[#1040C0] text-white">校招</span>
          )}
          {job.job_type && (
            <span className="bauhaus-chip bg-[#D02020] text-white">
              {job.job_type}
            </span>
          )}
          {job.keywords?.slice(0, 2).map((keyword, index) => (
            <span
              key={`${keyword}-${index}`}
              className={`bauhaus-chip ${
                index % 3 === 0
                  ? "bg-white text-black"
                  : index % 3 === 1
                    ? "bg-[#F0C020] text-black"
                    : "bg-[#1040C0] text-white"
              }`}
            >
              {keyword}
            </span>
          ))}
        </div>
      </div>

      {showCheckbox && (
        <button
          type="button"
          aria-label={selected ? "取消选择岗位" : "选择岗位"}
          aria-pressed={selected}
          className={`absolute bottom-4 right-4 z-20 flex h-11 w-11 items-center justify-center border-2 border-black transition-all duration-200 ease-out ${
            selected
              ? "bg-[#1040C0] text-white shadow-[2px_2px_0_0_rgba(18,18,18,0.3)]"
              : "bg-white text-black shadow-[2px_2px_0_0_rgba(18,18,18,0.3)] hover:bg-[#F0C020]"
          }`}
          onClick={(event) => {
            event.stopPropagation();
            onToggle?.(job.id, { shiftKey: event.shiftKey });
          }}
          onMouseDown={(event) => {
            if (event.button !== 0) return;
            event.stopPropagation();
            onSelectPointerDown?.(job.id, { shiftKey: event.shiftKey });
          }}
        >
          <Check
            size={18}
            strokeWidth={2.8}
            className={selected ? "opacity-100" : "opacity-0"}
          />
        </button>
      )}
    </article>
  );
}
