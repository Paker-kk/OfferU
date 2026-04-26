// =============================================
// ProfilePreview — 左侧档案预览面板
// =============================================
// 展示已有 Profile 数据（分段折叠）
// 每条 bullet 显示确认状态 + 来源 + 展开/折叠
// 支持手动新增条目（跳转到右侧对话或弹窗编辑）
// =============================================

"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card,
  CardBody,
  CardHeader,
  Chip,
  Button,
  Tooltip,
} from "@nextui-org/react";
import {
  CheckCircle2,
  AlertCircle,
  FileEdit,
  ChevronDown,
  ChevronRight,
  GraduationCap,
  Briefcase,
  FolderGit2,
  Users,
  Wrench,
  Trash2,
  User,
} from "lucide-react";
import type { ProfileData, ProfileSection } from "@/lib/hooks";
import { profileApi } from "@/lib/api";

type Topic = "education" | "internship" | "project" | "activity" | "skill";

interface ProfilePreviewProps {
  profile: ProfileData;
  currentTopic: Topic;
  onRefresh: () => void;
}

const TOPIC_ICONS: Record<string, React.ElementType> = {
  education: GraduationCap,
  internship: Briefcase,
  project: FolderGit2,
  activity: Users,
  skill: Wrench,
};

const TOPIC_ORDER = ["education", "internship", "project", "activity", "skill"];

const SOURCE_LABELS: Record<string, { label: string; color: "primary" | "success" | "warning" }> = {
  manual: { label: "手动", color: "primary" },
  ai_chat: { label: "AI对话", color: "success" },
  ai_import: { label: "AI导入", color: "warning" },
};

export function ProfilePreview({
  profile,
  currentTopic,
  onRefresh,
}: ProfilePreviewProps) {
  const baseInfo = profile.base_info_json || {};
  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(
    new Set([currentTopic])
  );

  // 按 section_type 分组
  const grouped = useMemo(() => {
    const map: Record<string, ProfileSection[]> = {};
    for (const t of TOPIC_ORDER) map[t] = [];
    for (const s of profile.sections ?? []) {
      if (!map[s.section_type]) map[s.section_type] = [];
      map[s.section_type].push(s);
    }
    return map;
  }, [profile.sections]);

  const toggleTopic = (topic: string) => {
    setExpandedTopics((prev) => {
      const next = new Set(prev);
      next.has(topic) ? next.delete(topic) : next.add(topic);
      return next;
    });
  };

  const handleDelete = async (sectionId: number) => {
    try {
      await profileApi.deleteSection(sectionId);
      onRefresh();
    } catch {
      // ignore
    }
  };

  return (
    <Card className="h-full border-2 border-black/80 bg-white shadow-[2px_2px_0_0_rgba(18,18,18,0.3)] rounded-none">
      <CardHeader className="flex items-center gap-3 border-b-2 border-black pb-3">
        <User size={20} className="text-[#1040C0]" />
        <div className="flex-1">
          <h3 className="text-lg font-bold text-black">
            {profile.name || "未命名"}
          </h3>
          <p className="text-xs text-black/45">
            {String(baseInfo.school || "")} · {String(baseInfo.major || "")}
            {baseInfo.gpa ? ` · GPA ${String(baseInfo.gpa)}` : ""}
          </p>
        </div>
        <Chip size="sm" variant="flat" color="primary" className="border border-black/60 bg-[#ECE6DC] text-black text-[10px]">
          {(profile.sections ?? []).length} 条目
        </Chip>
      </CardHeader>

      <CardBody className="overflow-auto p-0">
        {/* Narrative (Headline / Exit Story) */}
        {profile.headline && (
          <div className="px-4 py-3 border-b border-black/10">
            <p className="text-sm text-black/60 italic">
              &ldquo;{profile.headline}&rdquo;
            </p>
          </div>
        )}

        {/* 按主题分组 */}
        {TOPIC_ORDER.map((topic) => {
          const Icon = TOPIC_ICONS[topic] || Wrench;
          const sections = grouped[topic] || [];
          const isExpanded = expandedTopics.has(topic);
          const isActive = topic === currentTopic;
          const confirmedCount = sections.length;

          return (
            <div
              key={topic}
              className={`border-b border-black/10 ${
                isActive ? "bg-[#ECE6DC]" : ""
              }`}
            >
              {/* Topic Header */}
              <button
                onClick={() => toggleTopic(topic)}
                className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-[#ECE6DC] transition-colors"
              >
                <Icon size={16} className={isActive ? "text-[#1040C0]" : "text-black/40"} />
                <span
                  className={`text-sm font-medium flex-1 ${
                    isActive ? "text-[#1040C0] font-semibold" : "text-black/65"
                  }`}
                >
                  {topic === "education"
                    ? "教育"
                    : topic === "internship"
                    ? "实习"
                    : topic === "project"
                    ? "项目"
                    : topic === "activity"
                    ? "社团"
                    : "技能"}
                </span>
                <span className="text-xs text-black/35">
                  {confirmedCount}/{sections.length}
                </span>
                {isExpanded ? (
                  <ChevronDown size={14} className="text-black/30" />
                ) : (
                  <ChevronRight size={14} className="text-black/30" />
                )}
              </button>

              {/* Section Items */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    {sections.length === 0 ? (
                      <p className="px-6 py-2 text-xs text-black/30">
                        暂无条目，请通过右侧对话添加
                      </p>
                    ) : (
                      sections.map((section) => (
                        <BulletItem
                          key={section.id}
                          section={section}
                          onDelete={() => handleDelete(section.id)}
                        />
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}

// ---- 单条 Bullet 展示 ----

function BulletItem({
  section,
  onDelete,
}: {
  section: ProfileSection;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const src = SOURCE_LABELS[section.source] || SOURCE_LABELS.manual;
  const content = (section.content_json || {}) as Record<string, any>;
  const norm = (content.normalized || {}) as Record<string, any>;
  const fv = (content.field_values || {}) as Record<string, any>;
  const organization =
    String(norm.company || norm.school || norm.issuer || content.organization || content.company || content.school || "").trim();
  const dateRange = String(
    content.date_range ||
      [norm.start_date || content.startDate || content.start_date, norm.end_date || content.endDate || content.end_date]
        .filter(Boolean)
        .join(" - ")
  ).trim();
  // Build rich description from normalized/field_values, fallback to bullet
  const richDesc = (() => {
    const desc = String(norm.description || "").trim();
    if (desc) return desc;
    // Collect all field_values that contain "description"
    for (const key of Object.keys(fv)) {
      if (key.endsWith(".description") && fv[key]) return String(fv[key]).trim();
    }
    // For skills, join items
    if (norm.items && Array.isArray(norm.items)) return norm.items.join("、");
    return "";
  })();
  const description = richDesc || String(content.bullet || "").trim() || section.title || "";
  const isConfirmed = Number(section.confidence || 0) >= 0.8;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="group px-6 py-2 border-t border-black/10 hover:bg-[#ECE6DC] transition-colors"
    >
      <div className="flex items-start gap-2">
        {/* 确认状态 */}
        {isConfirmed ? (
          <CheckCircle2 size={14} className="text-green-400 mt-0.5 flex-shrink-0" />
        ) : (
          <Tooltip content={`置信度 ${Math.round(section.confidence * 100)}%`}>
            <AlertCircle
              size={14}
              className={`mt-0.5 flex-shrink-0 ${
                section.confidence > 0.7
                  ? "text-yellow-400"
                  : "text-orange-400"
              }`}
            />
          </Tooltip>
        )}

        <div className="flex-1 min-w-0">
          {/* 标题行 */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-sm font-medium text-black/75 hover:text-black truncate text-left"
            >
              {section.title || "未命名条目"}
            </button>
            <Chip size="sm" variant="flat" color={src.color} className="text-[10px] h-4">
              {src.label}
            </Chip>
          </div>

          {/* 组织 + 时间 */}
          {(organization || dateRange) && (
            <p className="text-xs text-black/40 mt-0.5">
              {organization}
              {organization && dateRange ? " · " : ""}
              {dateRange}
            </p>
          )}

          {/* 展开描述 */}
          <AnimatePresence>
            {expanded && description && (
              <motion.p
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="text-xs text-black/50 mt-1 overflow-hidden"
              >
                {description}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* 操作按钮（hover 显示） */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Tooltip content="删除">
            <button
              onClick={onDelete}
              className="p-1 rounded hover:bg-red-500/10 text-black/30 hover:text-[#D02020]"
            >
              <Trash2 size={12} />
            </button>
          </Tooltip>
        </div>
      </div>
    </motion.div>
  );
}
