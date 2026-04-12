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
import type { Topic } from "../page";

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
    <Card className="h-full bg-white/5 border border-white/10">
      <CardHeader className="flex items-center gap-3 border-b border-white/10 pb-3">
        <User size={20} className="text-blue-400" />
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white">
            {profile.name || "未命名"}
          </h3>
          <p className="text-xs text-white/40">
            {profile.school} · {profile.major}
            {profile.gpa ? ` · GPA ${profile.gpa}` : ""}
          </p>
        </div>
        <Chip size="sm" variant="flat" color="primary">
          {(profile.sections ?? []).length} 条目
        </Chip>
      </CardHeader>

      <CardBody className="overflow-auto p-0">
        {/* Narrative (Headline / Exit Story) */}
        {profile.headline && (
          <div className="px-4 py-3 border-b border-white/5">
            <p className="text-sm text-white/70 italic">
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
          const confirmedCount = sections.filter((s) => s.is_confirmed).length;

          return (
            <div
              key={topic}
              className={`border-b border-white/5 ${
                isActive ? "bg-blue-500/5" : ""
              }`}
            >
              {/* Topic Header */}
              <button
                onClick={() => toggleTopic(topic)}
                className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-white/5 transition-colors"
              >
                <Icon size={16} className={isActive ? "text-blue-400" : "text-white/40"} />
                <span
                  className={`text-sm font-medium flex-1 ${
                    isActive ? "text-blue-400" : "text-white/70"
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
                <span className="text-xs text-white/30">
                  {confirmedCount}/{sections.length}
                </span>
                {isExpanded ? (
                  <ChevronDown size={14} className="text-white/30" />
                ) : (
                  <ChevronRight size={14} className="text-white/30" />
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
                      <p className="px-6 py-2 text-xs text-white/20">
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

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="group px-6 py-2 border-t border-white/5 hover:bg-white/5 transition-colors"
    >
      <div className="flex items-start gap-2">
        {/* 确认状态 */}
        {section.is_confirmed ? (
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
              className="text-sm font-medium text-white/80 hover:text-white truncate text-left"
            >
              {section.title || "未命名条目"}
            </button>
            <Chip size="sm" variant="flat" color={src.color} className="text-[10px] h-4">
              {src.label}
            </Chip>
          </div>

          {/* 组织 + 时间 */}
          {(section.organization || section.date_range) && (
            <p className="text-xs text-white/30 mt-0.5">
              {section.organization}
              {section.organization && section.date_range ? " · " : ""}
              {section.date_range}
            </p>
          )}

          {/* 展开描述 */}
          <AnimatePresence>
            {expanded && section.description && (
              <motion.p
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="text-xs text-white/50 mt-1 overflow-hidden"
              >
                {section.description}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* 操作按钮（hover 显示） */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Tooltip content="删除">
            <button
              onClick={onDelete}
              className="p-1 rounded hover:bg-red-500/20 text-white/30 hover:text-red-400"
            >
              <Trash2 size={12} />
            </button>
          </Tooltip>
        </div>
      </div>
    </motion.div>
  );
}
