// =============================================
// 简历编辑器页 — Canva 风格布局
// =============================================
// 布局结构：
//   顶部：紧凑工具栏（返回、标题、样式控制、保存/导出）
//   左侧：固定宽度编辑面板（360px，可滚动）
//   右侧：居中 A4 实时预览（占满剩余空间，灰色画布背景）
// =============================================
// 数据流：
//   useResume(id) → 本地 state → 编辑 → 自动保存/手动保存 → 后端
//   styleConfig 变更 → CSS 变量更新 → 预览区实时刷新
// =============================================

"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Card, CardBody, Input, Button, Divider, Checkbox,
  Dropdown, DropdownTrigger, DropdownMenu, DropdownItem,
  Modal, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Textarea, Select, SelectItem, Chip, Progress,
  useDisclosure,
} from "@nextui-org/react";
import {
  Save, FileDown, ArrowLeft, Plus, ChevronDown, ChevronUp,
  Eye, EyeOff, Trash2, Image as ImageIcon,
  GraduationCap, Briefcase, Wrench, FolderKanban, Award, LayoutList,
  Wand2, Check, X, AlertTriangle, Sparkles, ArrowDownToLine, AlertCircle,
  Undo2, Redo2, GripVertical, Palette,
} from "lucide-react";
import {
  useResume, updateResume, updateSection, createSection,
  deleteSection, uploadResumePhoto, useConfig,
  aiOptimizeResume, aiApplySuggestion,
  AiSuggestion, AiOptimizeResult,
  useResumeTemplates, applyTemplate,
  useProfile,
  usePools,
  type ProfileSection,
  type Job,
} from "@/lib/hooks";
import { jobsApi } from "@/lib/api";
import SectionEditor, { createEmptySectionItem } from "../components/SectionEditor";
import ResumePreview from "../components/ResumePreview";
import StyleToolbar, { DEFAULT_STYLE_CONFIG, MIN_STYLE_CONFIG } from "../components/StyleToolbar";
import RichTextEditor from "../components/RichTextEditor";
import { useHistory } from "../hooks/useHistory";
import {
  getProfileBulletText,
  mapProfileSectionToResumeItem,
  mapProfileSectionToResumeType,
  normalizeProfileCategoryKey,
  resolveProfileCategoryLabel,
} from "@/lib/profileSchema";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

/** 段落类型选项（包含图标和主题色） */
const SECTION_TYPES = [
  { key: "education", label: "教育经历", icon: GraduationCap, color: "text-blue-400" },
  { key: "experience", label: "工作经历", icon: Briefcase, color: "text-emerald-400" },
  { key: "skill", label: "技能", icon: Wrench, color: "text-amber-400" },
  { key: "project", label: "项目经历", icon: FolderKanban, color: "text-purple-400" },
  { key: "certificate", label: "证书", icon: Award, color: "text-rose-400" },
  { key: "custom", label: "自定义段落", icon: LayoutList, color: "text-cyan-400" },
];

/** 根据 section_type 获取图标和颜色 */
function getSectionMeta(type: string) {
  return SECTION_TYPES.find((t) => t.key === type) || SECTION_TYPES[5];
}

// =============================================
// SortableSectionItem — 可拖拽排序的段落容器
// =============================================
// 使用 @dnd-kit/sortable 的 useSortable hook
// 左侧提供拖拽手柄（GripVertical 图标），
// 拖拽时整个卡片浮起并带半透明效果
// =============================================
function SortableSectionItem({ id, children }: { id: number; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 50 : "auto" as any,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <div className="relative group">
        {/* 拖拽手柄 — 悬浮时左侧显示 */}
        <div
          {...listeners}
          data-testid={`resume-section-drag-handle-${id}`}
          className="absolute left-0 top-0 bottom-0 w-6 flex items-center justify-center cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity z-10"
        >
          <GripVertical size={14} className="text-white/25" />
        </div>
        <div className="pl-2">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function ResumeEditorPage() {
  const params = useParams();
  const router = useRouter();
  const resumeId = Number(params.id);
  const { data: resume, mutate } = useResume(resumeId);
  const { data: profileData } = useProfile();

  // ---- 本地编辑状态 ----
  const [userName, setUserName] = useState("");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [contactJson, setContactJson] = useState<Record<string, string>>({});
  const [photoUrl, setPhotoUrl] = useState("");
  const [styleConfig, setStyleConfig] = useState<Record<string, string>>(DEFAULT_STYLE_CONFIG);
  const [sections, setSections] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const initializedRef = useRef(false);
  const [fitting, setFitting] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set());
  const previewRef = useRef<HTMLDivElement>(null);

  // ---- Undo/Redo 历史管理 ----
  // 快照结构：用户名、标题、简介、联系方式、sections 内容
  // 每次「有意义的编辑」推入快照栈，Ctrl+Z/Ctrl+Shift+Z 触发回退/前进
  interface EditorSnapshot {
    userName: string;
    title: string;
    summary: string;
    contactJson: Record<string, string>;
    sections: any[];
  }
  const emptySnapshot: EditorSnapshot = { userName: "", title: "", summary: "", contactJson: {}, sections: [] };
  const {
    state: _historyState,
    set: pushSnapshot,
    undo,
    redo,
    canUndo,
    canRedo,
    reset: resetHistory,
  } = useHistory<EditorSnapshot>(emptySnapshot, 50);

  // 标记是否正在 undo/redo（避免触发 pushSnapshot 循环）
  const isRestoringRef = useRef(false);

  // 当 undo/redo 改变 _historyState 时，恢复到各 state
  useEffect(() => {
    if (!isRestoringRef.current) return;
    setUserName(_historyState.userName);
    setTitle(_historyState.title);
    setSummary(_historyState.summary);
    setContactJson(_historyState.contactJson);
    setSections(_historyState.sections);
    isRestoringRef.current = false;
  }, [_historyState]);

  // 包装 undo/redo 设置标记
  const handleUndo = useCallback(() => { isRestoringRef.current = true; undo(); }, [undo]);
  const handleRedo = useCallback(() => { isRestoringRef.current = true; redo(); }, [redo]);

  // 键盘快捷键：Ctrl+Z = undo, Ctrl+Shift+Z / Ctrl+Y = redo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleUndo, handleRedo]);

  // ---- 拖拽排序 ----
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  );

  /**
   * 拖拽结束处理 — 重新计算 sort_order
   * arrayMove 交换数组位置后，按新索引重新赋值 sort_order
   */
  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSections((prev) => {
      const sorted = [...prev].sort((a, b) => a.sort_order - b.sort_order);
      const oldIndex = sorted.findIndex((s) => s.id === active.id);
      const newIndex = sorted.findIndex((s) => s.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return prev;
      const moved = arrayMove(sorted, oldIndex, newIndex);
      return moved.map((s, i) => ({ ...s, sort_order: i }));
    });
  }, []);

  // ---- AI 优化状态 ----
  const { isOpen: isAiModalOpen, onOpen: onAiModalOpen, onClose: onAiModalClose } = useDisclosure();
  const {
    isOpen: isProfileImportOpen,
    onOpen: onProfileImportOpen,
    onClose: onProfileImportClose,
  } = useDisclosure();
  const [jdText, setJdText] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [aiResult, setAiResult] = useState<AiOptimizeResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState("");
  const [profileImportError, setProfileImportError] = useState("");
  const [appliedSuggestions, setAppliedSuggestions] = useState<Set<number>>(new Set());
  const [importingProfileSections, setImportingProfileSections] = useState(false);
  const [selectedProfileSectionIds, setSelectedProfileSectionIds] = useState<Set<number>>(new Set());
  const [profileImportTargetSectionId, setProfileImportTargetSectionId] = useState<number | null>(null);
  const [syncingProfileSources, setSyncingProfileSources] = useState(false);
  const [ignoredSourceTokens, setIgnoredSourceTokens] = useState<Set<string>>(new Set());
  const [aiPoolFilter, setAiPoolFilter] = useState<string>("all");
  const [aiJobKeyword, setAiJobKeyword] = useState("");
  const [aiJobs, setAiJobs] = useState<Job[]>([]);
  const [aiJobsLoading, setAiJobsLoading] = useState(false);
  const { data: pickedPools } = usePools("picked");
  const [deleteSectionTarget, setDeleteSectionTarget] = useState<{ id: number; title: string } | null>(null);
  const [deletingSection, setDeletingSection] = useState(false);

  const { data: templates } = useResumeTemplates();
  const { data: config } = useConfig();
  const profileSourceSyncEnabled = Boolean((config as any)?.profile_source_sync_enabled);

  const profileSections = useMemo(() => {
    return (profileData?.sections || []).slice().sort((a, b) => a.sort_order - b.sort_order);
  }, [profileData?.sections]);

  const profileSectionMap = useMemo(() => {
    return new Map<number, ProfileSection>(profileSections.map((item) => [item.id, item]));
  }, [profileSections]);

  const aiPoolOptions = useMemo(
    () => [
      { key: "all", label: "全部已筛选" },
      { key: "ungrouped", label: "未分组" },
      ...((pickedPools || []).map((pool) => ({ key: String(pool.id), label: pool.name }))),
    ],
    [pickedPools]
  );

  const profileImportTargetSection = useMemo(() => {
    if (profileImportTargetSectionId == null) return null;
    return sections.find((item) => item.id === profileImportTargetSectionId) || null;
  }, [profileImportTargetSectionId, sections]);

  const visibleProfileSections = useMemo(() => {
    if (profileImportTargetSectionId == null) {
      return profileSections;
    }
    const targetSection = profileImportTargetSection;
    if (!targetSection) {
      return profileSections;
    }
    return profileSections.filter(
      (item) => mapProfileSectionToResumeType(item.section_type) === targetSection.section_type
    );
  }, [profileImportTargetSection, profileImportTargetSectionId, profileSections]);

  const staleImportedItems = useMemo(() => {
    if (!profileSourceSyncEnabled) {
      return [];
    }

    const stale: Array<{
      token: string;
      sectionId: number;
      itemIndex: number;
      sourceSection: ProfileSection;
    }> = [];

    for (const section of sections) {
      const content = Array.isArray(section.content_json) ? section.content_json : [];
      content.forEach((item: any, index: number) => {
        const sourceSectionId = Number(item?._source_profile_section_id || 0);
        const sourceUpdatedAt = String(item?._source_profile_updated_at || "").trim();
        if (!sourceSectionId || !sourceUpdatedAt) return;

        const sourceSection = profileSectionMap.get(sourceSectionId);
        if (!sourceSection) return;

        const latestUpdatedAt = String(sourceSection.updated_at || "").trim();
        if (!latestUpdatedAt || latestUpdatedAt === sourceUpdatedAt) return;

        const token = `${section.id}:${index}:${sourceSectionId}:${sourceUpdatedAt}`;
        if (ignoredSourceTokens.has(token)) return;

        stale.push({
          token,
          sectionId: section.id,
          itemIndex: index,
          sourceSection,
        });
      });
    }

    return stale;
  }, [sections, profileSectionMap, ignoredSourceTokens, profileSourceSyncEnabled]);
  const isApiKeyConfigured = (() => {
    if (!config) return true;
    const apiConfigs = Array.isArray((config as any).llm_api_configs)
      ? ((config as any).llm_api_configs as any[])
      : [];
    const activeByList = apiConfigs.find((item) => item?.is_active)
      || apiConfigs.find((item) => item?.id === (config as any).active_llm_config_id);
    if (activeByList) {
      const providerId = String(activeByList.provider_id || "").toLowerCase();
      if (providerId === "ollama") return true;
      return !!activeByList.api_key;
    }
    const provider = config.llm_provider || "deepseek";
    if (provider === "deepseek") return !!config.deepseek_api_key;
    if (provider === "openai") return !!config.openai_api_key;
    if (provider === "qwen") return !!(config as any).qwen_api_key;
    if (provider === "siliconflow") return !!(config as any).siliconflow_api_key;
    if (provider === "gemini") return !!(config as any).gemini_api_key;
    if (provider === "zhipu") return !!(config as any).zhipu_api_key;
    if (provider === "ollama") return true;
    if ((config as any).active_llm_api_key) return true;
    return true;
  })();

  useEffect(() => {
    if (!isAiModalOpen) return;
    let cancelled = false;

    const keywordText = aiJobKeyword.trim();
    const selectedPool =
      aiPoolFilter === "all"
        ? undefined
        : aiPoolFilter === "ungrouped"
          ? "ungrouped"
          : Number(aiPoolFilter);

    const loadAiJobs = async () => {
      setAiJobsLoading(true);
      try {
        const pageSize = 100;
        let page = 1;
        let total = 0;
        const all: Job[] = [];

        while (true) {
          const result: any = await jobsApi.list({
            page,
            page_size: pageSize,
            triage_status: "picked",
            pool_id: selectedPool,
            keyword: keywordText || undefined,
          });

          const items = Array.isArray(result?.items) ? (result.items as Job[]) : [];
          total = Number(result?.total || 0);
          all.push(...items);

          if (all.length >= total || items.length === 0) {
            break;
          }
          page += 1;
        }

        if (!cancelled) {
          const deduped = Array.from(new Map(all.map((job) => [job.id, job])).values());
          setAiJobs(deduped);
        }
      } catch {
        if (!cancelled) {
          setAiJobs([]);
        }
      } finally {
        if (!cancelled) {
          setAiJobsLoading(false);
        }
      }
    };

    void loadAiJobs();

    return () => {
      cancelled = true;
    };
  }, [aiJobKeyword, aiPoolFilter, isAiModalOpen]);

  useEffect(() => {
    if (!selectedJobId) return;
    const stillVisible = aiJobs.some((job) => String(job.id) === selectedJobId);
    if (!stillVisible) {
      setSelectedJobId("");
    }
  }, [aiJobs, selectedJobId]);

  /** 应用模板 — 覆盖当前样式配置 */
  const handleApplyTemplate = async (templateId: number) => {
    try {
      const result = await applyTemplate(resumeId, templateId);
      if (result.style_config) {
        setStyleConfig(result.style_config);
      }
      await mutate();
    } catch (err) {
      console.error("Apply template failed:", err);
    }
  };

  /** 从服务端数据初始化本地状态 */
  useEffect(() => {
    if (!resume) return;
    setUserName(resume.user_name || "");
    setTitle(resume.title || "");
    setSummary(resume.summary || "");
    setContactJson(resume.contact_json || {});
    setPhotoUrl(resume.photo_url || "");
    setStyleConfig({ ...DEFAULT_STYLE_CONFIG, ...(resume.style_config || {}) });
    setSections(resume.sections || []);
    setExpandedSections(new Set((resume.sections || []).map((s: any) => s.id)));
    setIgnoredSourceTokens(new Set());
    // 重置 undo/redo 历史到服务端初始状态
    resetHistory({
      userName: resume.user_name || "",
      title: resume.title || "",
      summary: resume.summary || "",
      contactJson: resume.contact_json || {},
      sections: resume.sections || [],
    });
  }, [resume, resetHistory]);

  // ── 编辑时推入历史快照（debounce 500ms，避免每个按键都记录） ──
  const snapshotTimerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (isRestoringRef.current) return;
    if (!initializedRef.current) return;
    clearTimeout(snapshotTimerRef.current);
    snapshotTimerRef.current = setTimeout(() => {
      pushSnapshot({ userName, title, summary, contactJson, sections });
    }, 500);
    return () => clearTimeout(snapshotTimerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userName, title, summary, contactJson, sections]);

  /**
   * 智能合并一页 — 核心算法
   * ─────────────────────────────────────────────
   * 1. 测量 A4 容器的实际内容高度 (scrollHeight) vs 可视高度 (clientHeight)
   * 2. 如果内容溢出，依次按比例缩减以下参数（有先后优先级）：
   *    sectionGap → lineHeight → bodySize → headingSize → pageMargin
   *    每轮缩减一小步，等待 DOM 重排后重新测量
   * 3. 当内容不再溢出或所有参数已达最小值时停止
   * 4. 使用 requestAnimationFrame 等待 React 重渲染 + 浏览器布局
   */
  const handleFitOnePage = useCallback(async () => {
    if (!previewRef.current) return;
    setFitting(true);

    const cfg = { ...styleConfig };
    const steps: Array<{ key: string; step: number; min: number }> = [
      { key: "sectionGap", step: 1, min: MIN_STYLE_CONFIG.sectionGap },
      { key: "lineHeight", step: 0.05, min: MIN_STYLE_CONFIG.lineHeight },
      { key: "bodySize", step: 0.5, min: MIN_STYLE_CONFIG.bodySize },
      { key: "headingSize", step: 0.5, min: MIN_STYLE_CONFIG.headingSize },
      { key: "pageMargin", step: 0.1, min: MIN_STYLE_CONFIG.pageMargin },
    ];

    const waitFrame = () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

    let maxIter = 60;
    while (maxIter-- > 0) {
      await waitFrame();
      const el = previewRef.current;
      if (!el) break;
      if (el.scrollHeight <= el.clientHeight + 2) break;

      let adjusted = false;
      for (const s of steps) {
        const cur = parseFloat(cfg[s.key]);
        if (cur > s.min + s.step * 0.5) {
          cfg[s.key] = String(Math.max(s.min, +(cur - s.step).toFixed(2)));
          adjusted = true;
          break;
        }
      }
      if (!adjusted) break;
      setStyleConfig({ ...cfg });
    }

    setFitting(false);
  }, [styleConfig]);

  /** 更新联系方式单个字段 */
  const updateContact = (key: string, value: string) => {
    setContactJson((prev) => ({ ...prev, [key]: value }));
  };

  /** 保存简历主信息到后端 */
  const handleSave = useCallback(async () => {
    try {
      setSaving(true);
      await updateResume(resumeId, {
        user_name: userName,
        title,
        summary,
        contact_json: contactJson,
        style_config: styleConfig,
      });
      for (const sec of sections) {
        await updateSection(resumeId, sec.id, {
          title: sec.title,
          content_json: sec.content_json,
          visible: sec.visible,
          sort_order: sec.sort_order,
        });
      }
      await mutate();
    } finally {
      setSaving(false);
    }
  }, [resumeId, userName, title, summary, contactJson, styleConfig, sections, mutate]);

  // =============================================
  // 自动保存 — debounce 3 秒
  // ─────────────────────────────────────────────
  // 监听所有可编辑字段的变化，用户停止编辑 3 秒后自动保存
  // 使用 ref 持有最新的 handleSave 避免 useEffect 依赖循环
  // 初始化完成前（resume 数据还没加载到 state）不触发
  // =============================================
  const saveRef = useRef(handleSave);
  saveRef.current = handleSave;

  useEffect(() => {
    if (!resume) return;
    // 首次加载数据时标记初始化，但不触发自动保存
    if (!initializedRef.current) {
      initializedRef.current = true;
      return;
    }
    const timer = setTimeout(() => {
      saveRef.current();
    }, 3000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userName, title, summary, contactJson, styleConfig, sections]);

  /** 添加新段落 */
  const handleAddSection = async (type: string) => {
    const label = SECTION_TYPES.find((t) => t.key === type)?.label || type;
    const maxOrder = sections.length > 0 ? Math.max(...sections.map((s) => s.sort_order)) : -1;
    const res = await createSection(resumeId, {
      section_type: type,
      title: label,
      sort_order: maxOrder + 1,
      content_json: [],
    });
    if (res?.id) {
      const newSections = [...sections, res];
      setSections(newSections);
      setExpandedSections((prev) => new Set(Array.from(prev).concat(res.id)));
    }
  };

  const openProfileImportModal = useCallback((targetSectionId: number | null = null) => {
    setProfileImportError("");
    setProfileImportTargetSectionId(targetSectionId);

    let candidates = profileSections;
    if (targetSectionId != null) {
      const targetSection = sections.find((item) => item.id === targetSectionId);
      if (targetSection) {
        candidates = profileSections.filter(
          (item) => mapProfileSectionToResumeType(item.section_type) === targetSection.section_type
        );
      }
    }

    setSelectedProfileSectionIds(new Set(candidates.map((item) => item.id)));
    onProfileImportOpen();
  }, [onProfileImportOpen, profileSections, sections]);

  const closeProfileImportModal = useCallback(() => {
    setProfileImportError("");
    setSelectedProfileSectionIds(new Set());
    setProfileImportTargetSectionId(null);
    onProfileImportClose();
  }, [onProfileImportClose]);

  const toggleProfileSectionSelection = useCallback((sectionId: number) => {
    setSelectedProfileSectionIds((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  }, []);

  const addBlankItemToSection = useCallback((sectionId: number) => {
    setSections((prev) =>
      prev.map((item) => {
        if (item.id !== sectionId) return item;
        const current = Array.isArray(item.content_json) ? item.content_json : [];
        return {
          ...item,
          content_json: [...current, createEmptySectionItem(item.section_type)],
        };
      })
    );
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.add(sectionId);
      return next;
    });
  }, []);

  const syncProfileSourceUpdates = useCallback(() => {
    if (staleImportedItems.length === 0) return;
    setSyncingProfileSources(true);

    const staleMap = new Map<string, ProfileSection>();
    for (const item of staleImportedItems) {
      staleMap.set(`${item.sectionId}:${item.itemIndex}`, item.sourceSection);
    }

    setSections((prev) =>
      prev.map((section) => {
        const current = Array.isArray(section.content_json) ? section.content_json : [];
        const nextContent = current.map((entry: any, index: number) => {
          const matched = staleMap.get(`${section.id}:${index}`);
          if (!matched) return entry;
          return mapProfileSectionToResumeItem(matched as any);
        });
        return {
          ...section,
          content_json: nextContent,
        };
      })
    );

    setIgnoredSourceTokens(new Set());
    setSyncingProfileSources(false);
  }, [staleImportedItems]);

  const keepCurrentImportedContent = useCallback(() => {
    if (staleImportedItems.length === 0) return;
    setIgnoredSourceTokens((prev) => {
      const next = new Set(prev);
      for (const item of staleImportedItems) {
        next.add(item.token);
      }
      return next;
    });
  }, [staleImportedItems]);

  const importFromProfile = useCallback(async () => {
    if (selectedProfileSectionIds.size === 0) return;

    const sourcePool = profileImportTargetSectionId == null ? profileSections : visibleProfileSections;
    const sourceSections = sourcePool.filter((item) => selectedProfileSectionIds.has(item.id));
    if (sourceSections.length === 0) return;

    try {
      setProfileImportError("");
      setImportingProfileSections(true);

      // 定向导入：把所选档案条目追加到当前模块
      if (profileImportTargetSectionId != null) {
        const importedItems = sourceSections.map((item) => mapProfileSectionToResumeItem(item as any));
        setSections((prev) =>
          prev.map((section) => {
            if (section.id !== profileImportTargetSectionId) return section;
            const current = Array.isArray(section.content_json) ? section.content_json : [];
            return {
              ...section,
              content_json: [...current, ...importedItems],
            };
          })
        );
        setExpandedSections((prev) => {
          const next = new Set(prev);
          next.add(profileImportTargetSectionId);
          return next;
        });
      } else {
        // 全量导入：按模块聚合追加，缺少模块时新建
        let nextSections = [...sections];
        let nextSort = sections.length > 0 ? Math.max(...sections.map((item) => item.sort_order)) + 1 : 0;

        for (const profileSection of sourceSections) {
          const resumeSectionType = mapProfileSectionToResumeType(profileSection.section_type);
          const importedItem = mapProfileSectionToResumeItem(profileSection as any);
          const existingIndex = nextSections.findIndex((item) => item.section_type === resumeSectionType);
          const normalizedCategoryKey = normalizeProfileCategoryKey(
            profileSection.category_key || profileSection.section_type
          );
          const moduleTitle = resolveProfileCategoryLabel(
            normalizedCategoryKey,
            profileSection.category_label
          );

          if (existingIndex >= 0) {
            const current = Array.isArray(nextSections[existingIndex].content_json)
              ? nextSections[existingIndex].content_json
              : [];
            const shouldUpdateTitle =
              nextSections[existingIndex].section_type !== "custom" || !nextSections[existingIndex].title;
            nextSections[existingIndex] = {
              ...nextSections[existingIndex],
              title: shouldUpdateTitle ? moduleTitle : nextSections[existingIndex].title,
              content_json: [...current, importedItem],
            };
            continue;
          }

          const created = await createSection(resumeId, {
            section_type: resumeSectionType,
            title: moduleTitle,
            sort_order: nextSort,
            content_json: [importedItem],
          });

          if (created?.id) {
            nextSections.push(created);
            nextSort += 1;
          }
        }

        setSections(nextSections);
        setExpandedSections((prev) => {
          const next = new Set(prev);
          for (const section of nextSections) {
            next.add(section.id);
          }
          return next;
        });
      }

      closeProfileImportModal();
    } catch (err: any) {
      setProfileImportError(err?.message || "导入失败，请稍后重试。");
    } finally {
      setImportingProfileSections(false);
    }
  }, [
    closeProfileImportModal,
    profileImportTargetSectionId,
    profileSections,
    resumeId,
    sections,
    selectedProfileSectionIds,
    visibleProfileSections,
  ]);

  /** 删除段落 */
  const handleDeleteSection = (sectionId: number) => {
    const target = sections.find((section) => section.id === sectionId);
    if (!target) return;
    setDeleteSectionTarget({
      id: sectionId,
      title: target.title || getSectionMeta(target.section_type).label,
    });
  };

  const confirmDeleteSection = useCallback(async () => {
    if (!deleteSectionTarget) return;
    try {
      setDeletingSection(true);
      await deleteSection(resumeId, deleteSectionTarget.id);
      setSections((prev) => prev.filter((section) => section.id !== deleteSectionTarget.id));
      setDeleteSectionTarget(null);
    } finally {
      setDeletingSection(false);
    }
  }, [deleteSectionTarget, resumeId]);

  /** 更新段落内容 */
  const updateSectionContent = (sectionId: number, contentJson: any[]) => {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, content_json: contentJson } : s))
    );
  };

  /** 切换段落可见性 */
  const toggleSectionVisibility = (sectionId: number) => {
    setSections((prev) =>
      prev.map((s) => (s.id === sectionId ? { ...s, visible: !s.visible } : s))
    );
  };

  /** 切换段落展开/折叠 */
  const toggleExpanded = (sectionId: number) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      next.has(sectionId) ? next.delete(sectionId) : next.add(sectionId);
      return next;
    });
  };

  /** 上传头像 */
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await uploadResumePhoto(resumeId, file);
    if (res?.photo_url) {
      setPhotoUrl(res.photo_url);
    }
  };

  /** 导出 PDF — html2canvas 截取 A4 预览 → jsPDF 生成 */
  const handleExportPdf = async () => {
    if (!previewRef.current) return;
    setExporting(true);
    await handleSave();
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const el = previewRef.current;
      const prevOverflow = el.style.overflow;
      const prevMaxHeight = el.style.maxHeight;
      el.style.overflow = "visible";
      el.style.maxHeight = "none";
      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
      });
      el.style.overflow = prevOverflow;
      el.style.maxHeight = prevMaxHeight;
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfW = pdf.internal.pageSize.getWidth();
      const pdfH = pdf.internal.pageSize.getHeight();
      pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);
      pdf.save(`${title || "resume"}.pdf`);
    } catch (err) {
      console.error("PDF export failed:", err);
    } finally {
      setExporting(false);
    }
  };

  // =============================================
  // AI 优化：发送简历 + JD → 获取 ATS 评分和优化建议
  // 流程：用户点击🪄按钮 → 弹出 JD 输入框 → 调用后端
  //       → 展示 Diff 面板 → 逐条采纳/拒绝建议
  // =============================================
  const handleAiOptimize = async () => {
    if (!jdText.trim() && !selectedJobId) return;
    setAiLoading(true);
    setAiError("");
    setAiResult(null);
    setAppliedSuggestions(new Set());
    onAiModalClose();
    try {
      const result = await aiOptimizeResume(resumeId, {
        jd_text: jdText.trim() || undefined,
        job_id: selectedJobId ? Number(selectedJobId) : undefined,
      });
      setAiResult(result);
    } catch (err: any) {
      setAiError(err.message || "AI 优化请求失败");
    } finally {
      setAiLoading(false);
    }
  };

  /** 采纳单条 AI 建议：调用后端 apply 接口，更新本地 section 数据 */
  const handleApplySuggestion = async (index: number, suggestion: AiSuggestion) => {
    try {
      await aiApplySuggestion(resumeId, suggestion);
      setAppliedSuggestions((prev) => new Set(prev).add(index));
      // 刷新简历数据以同步最新内容
      mutate();
    } catch (err: any) {
      console.error("Apply suggestion failed:", err);
    }
  };

  /** 关闭 AI 结果面板 */
  const handleCloseAiPanel = () => {
    setAiResult(null);
    setAiError("");
  };

  if (!resume) {
    return (
      <div className="flex items-center justify-center h-screen text-white/40">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-white/20 border-t-blue-500 rounded-full animate-spin" />
          <span className="text-sm">加载中...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] -m-6 md:-m-8">
      {/* ========== 顶部工具栏 ========== */}
      <div className="flex-shrink-0 bg-background/95 backdrop-blur-xl border-b border-white/8 z-20">
        {/* 第一行：返回 + 标题 + 操作按钮 */}
        <div className="flex items-center justify-between px-4 h-12">
          <div className="flex items-center gap-2">
            <Button
              variant="light"
              isIconOnly
              size="sm"
              onPress={() => router.push("/resume")}
              className="text-white/50 hover:text-white"
            >
              <ArrowLeft size={18} />
            </Button>
            <div className="w-px h-5 bg-white/10" />
            <Input
              variant="underlined"
              value={title}
              onValueChange={setTitle}
              classNames={{
                base: "max-w-[200px]",
                input: "text-sm font-semibold text-white/90",
                innerWrapper: "pb-0",
              }}
              placeholder="简历标题"
            />
          </div>
          <div className="flex items-center gap-2">
            {/* 模板选择器 */}
            <Dropdown>
              <DropdownTrigger>
                <Button
                  variant="flat"
                  size="sm"
                  startContent={<Palette size={14} />}
                  className="bg-white/5 hover:bg-white/10 text-white/60"
                >
                  模板
                </Button>
              </DropdownTrigger>
              <DropdownMenu onAction={(key: any) => handleApplyTemplate(Number(key))}>
                {(templates || []).map((tpl) => (
                  <DropdownItem
                    key={String(tpl.id)}
                    startContent={
                      <div
                        className="w-3 h-3 rounded-full border border-white/20"
                        style={{ backgroundColor: tpl.css_variables?.primaryColor || "#666" }}
                      />
                    }
                    description={tpl.is_builtin ? "内置模板" : "自定义"}
                  >
                    {tpl.name}
                  </DropdownItem>
                ))}
              </DropdownMenu>
            </Dropdown>
            <StyleToolbar config={styleConfig} onChange={setStyleConfig} onFitOnePage={handleFitOnePage} fitting={fitting} />
            <div className="w-px h-5 bg-white/10 mx-1" />
            <Button
              variant="light"
              isIconOnly
              size="sm"
              isDisabled={!canUndo}
              onPress={handleUndo}
              className="text-white/40 hover:text-white disabled:opacity-20"
              title="撤销 (Ctrl+Z)"
            >
              <Undo2 size={15} />
            </Button>
            <Button
              variant="light"
              isIconOnly
              size="sm"
              isDisabled={!canRedo}
              onPress={handleRedo}
              className="text-white/40 hover:text-white disabled:opacity-20"
              title="重做 (Ctrl+Shift+Z)"
            >
              <Redo2 size={15} />
            </Button>
            <div className="w-px h-5 bg-white/10 mx-1" />
            <Button
              startContent={<Wand2 size={14} />}
              variant="flat"
              size="sm"
              isLoading={aiLoading}
              onPress={onAiModalOpen}
              className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 hover:from-purple-500/20 hover:to-blue-500/20 text-purple-300 border border-purple-500/20"
            >
              AI 优化
            </Button>
            <Button
              startContent={<ArrowDownToLine size={14} />}
              variant="flat"
              size="sm"
              onPress={() => openProfileImportModal(null)}
              data-testid="resume-import-all-button"
              className="bg-white/5 hover:bg-white/10 text-white/70"
            >
              从档案导入
            </Button>
            <div className="w-px h-5 bg-white/10 mx-1" />
            <Button
              startContent={<FileDown size={14} />}
              variant="flat"
              size="sm"
              isLoading={exporting}
              onPress={handleExportPdf}
              className="bg-white/5 hover:bg-white/10 text-white/70"
            >
              导出
            </Button>
            <Button
              startContent={<Save size={14} />}
              color="primary"
              size="sm"
              isLoading={saving}
              onPress={handleSave}
              data-testid="resume-save-button"
            >
              {saving ? "保存中" : "保存"}
            </Button>
            <span className="text-[10px] text-white/25 hidden sm:inline">自动保存</span>
          </div>
        </div>
      </div>

      {/* ========== 主体区域：编辑面板 + 预览画布 ========== */}
      <div className="flex flex-1 min-h-0">
        {/* ---- 左侧编辑面板（固定360px宽度，可滚动） ---- */}
        <div className="w-[360px] flex-shrink-0 border-r border-white/8 bg-background/50 overflow-y-auto custom-scrollbar">
          <div className="p-4 space-y-4">
            {staleImportedItems.length > 0 && (
              <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-3 py-2.5" data-testid="resume-source-sync-banner">
                <div className="flex items-start gap-2">
                  <AlertCircle size={14} className="mt-0.5 text-amber-300" />
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-xs text-amber-100/90">
                      有 {staleImportedItems.length} 条从档案导入的内容已检测到源数据更新。
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        color="warning"
                        variant="flat"
                        isLoading={syncingProfileSources}
                        className="h-7 px-2 text-[11px]"
                        onPress={syncProfileSourceUpdates}
                        data-testid="resume-sync-source-button"
                      >
                        同步更新
                      </Button>
                      <Button
                        size="sm"
                        variant="light"
                        className="h-7 px-2 text-[11px] text-white/65"
                        onPress={keepCurrentImportedContent}
                        data-testid="resume-keep-current-button"
                      >
                        保留当前内容
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 基本信息区块 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2 px-1">
                <div className="w-1 h-4 rounded-full bg-blue-500" />
                <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider">基本信息</h3>
              </div>

              {/* 头像上传 — 更精致的设计 */}
              <div className="flex items-center gap-4 p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                <div className="relative group">
                  {photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoUrl.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}${photoUrl}` : photoUrl}
                      alt="头像"
                      className="w-14 h-14 rounded-xl object-cover border border-white/15"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-white/[0.06] border border-dashed border-white/15 flex items-center justify-center">
                      <ImageIcon size={18} className="text-white/25" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <label className="cursor-pointer">
                    <Button size="sm" variant="flat" as="span" className="bg-white/5 hover:bg-white/10 text-xs">
                      {photoUrl ? "更换头像" : "上传头像"}
                    </Button>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                  </label>
                  <p className="text-[10px] text-white/25 mt-1">JPG/PNG/WebP · 5MB</p>
                </div>
              </div>

              {/* 联系信息网格 — 更宽松的间距 */}
              <div className="space-y-2.5">
                <Input label="姓名" variant="bordered" size="sm" value={userName} onValueChange={setUserName}
                  classNames={{ inputWrapper: "bg-white/[0.03] border-white/[0.08] hover:border-white/15 group-data-[focus=true]:border-blue-500/50" }}
                />
                <div className="grid grid-cols-2 gap-2.5">
                  <Input label="电话" variant="bordered" size="sm" value={contactJson.phone || ""} onValueChange={(v) => updateContact("phone", v)}
                    classNames={{ inputWrapper: "bg-white/[0.03] border-white/[0.08] hover:border-white/15" }}
                  />
                  <Input label="邮箱" variant="bordered" size="sm" value={contactJson.email || ""} onValueChange={(v) => updateContact("email", v)}
                    classNames={{ inputWrapper: "bg-white/[0.03] border-white/[0.08] hover:border-white/15" }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <Input label="LinkedIn" variant="bordered" size="sm" value={contactJson.linkedin || ""} onValueChange={(v) => updateContact("linkedin", v)}
                    classNames={{ inputWrapper: "bg-white/[0.03] border-white/[0.08] hover:border-white/15" }}
                  />
                  <Input label="GitHub" variant="bordered" size="sm" value={contactJson.github || ""} onValueChange={(v) => updateContact("github", v)}
                    classNames={{ inputWrapper: "bg-white/[0.03] border-white/[0.08] hover:border-white/15" }}
                  />
                </div>
                <Input label="个人网站" variant="bordered" size="sm" value={contactJson.website || ""} onValueChange={(v) => updateContact("website", v)}
                  classNames={{ inputWrapper: "bg-white/[0.03] border-white/[0.08] hover:border-white/15" }}
                />
              </div>

              {/* 个人简介 */}
              <div>
                <label className="text-[11px] text-white/40 mb-1.5 block font-medium">个人简介</label>
                <RichTextEditor
                  content={summary}
                  onChange={setSummary}
                  placeholder="简要描述你自己..."
                  minHeight={72}
                />
              </div>
            </div>

            <div className="h-px bg-white/[0.06]" />

            {/* ---- 各段落编辑 ---- */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 px-1">
                <div className="w-1 h-4 rounded-full bg-purple-500" />
                <h3 className="text-xs font-semibold text-white/60 uppercase tracking-wider">段落内容</h3>
              </div>

              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext
                  items={[...sections].sort((a, b) => a.sort_order - b.sort_order).map((s) => s.id)}
                  strategy={verticalListSortingStrategy}
                >
              {sections
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((sec) => {
                  const meta = getSectionMeta(sec.section_type);
                  const SectionIcon = meta.icon;
                  const isExpanded = expandedSections.has(sec.id);
                  const sourceCategoryKey = Array.isArray(sec.content_json)
                    ? sec.content_json.find((item: any) => item?._source_profile_category_key)?._source_profile_category_key
                    : "";
                  const sectionDisplayTitle = sourceCategoryKey
                    ? resolveProfileCategoryLabel(sourceCategoryKey)
                    : (SECTION_TYPES.find((item) => item.key === sec.section_type)?.label || sec.title || "未命名模块");
                  return (
                    <SortableSectionItem key={sec.id} id={sec.id}>
                    <div
                      data-testid={`resume-section-card-${sec.id}`}
                      className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden transition-colors hover:border-white/10"
                    >
                      {/* 段落头部 — 带类型图标和颜色标识 */}
                      <div className="px-3 py-2.5 select-none space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2 min-w-[124px] flex-1 overflow-hidden">
                            <SectionIcon size={15} className={`${meta.color} flex-shrink-0 opacity-70`} />
                            <span className="text-xs font-semibold text-white/80 truncate whitespace-nowrap">{sectionDisplayTitle}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              size="sm"
                              variant="light"
                              isIconOnly
                              onPress={() => toggleSectionVisibility(sec.id)}
                              aria-label="切换模块显示"
                              className="w-7 h-7 min-w-7"
                            >
                              {sec.visible ? <Eye size={12} className="text-white/40" /> : <EyeOff size={12} className="text-white/20" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="flat"
                              isIconOnly
                              onPress={() => handleDeleteSection(sec.id)}
                              aria-label="删除模块"
                              data-testid={`resume-section-delete-${sec.id}`}
                              className="w-7 h-7 min-w-7 text-red-300 bg-red-500/10 hover:bg-red-500/20"
                            >
                              <Trash2 size={11} />
                            </Button>
                            <Button
                              size="sm"
                              variant="light"
                              className="h-7 px-2 text-[10px] text-white/45"
                              onPress={() => toggleExpanded(sec.id)}
                              data-testid={`resume-section-toggle-${sec.id}`}
                            >
                              <span className="flex items-center gap-1">
                                {isExpanded ? "折叠" : "展开"}
                                <ChevronDown
                                  size={12}
                                  className={`text-white/30 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                                />
                              </span>
                            </Button>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="flat"
                            className="h-7 px-2 text-[10px] text-white/70 bg-white/[0.03]"
                            onPress={() => openProfileImportModal(sec.id)}
                            data-testid={`resume-section-import-${sec.id}`}
                          >
                            档案
                          </Button>
                          <Button
                            size="sm"
                            variant="flat"
                            className="h-7 px-2 text-[10px] text-white/70 bg-white/[0.03]"
                            onPress={() => addBlankItemToSection(sec.id)}
                            data-testid={`resume-section-add-item-${sec.id}`}
                          >
                            手动
                          </Button>
                        </div>
                      </div>

                      {/* 段落内容（可折叠，带动画） */}
                      <AnimatePresence initial={false}>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2, ease: "easeInOut" }}
                            className="overflow-hidden"
                          >
                            <div className="px-3 pb-3 pt-1 border-t border-white/[0.04]">
                              <SectionEditor
                                sectionType={sec.section_type}
                                contentJson={sec.content_json || []}
                                onChange={(content) => updateSectionContent(sec.id, content)}
                              />
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    </SortableSectionItem>
                  );
                })}
                </SortableContext>
              </DndContext>

              {/* 添加段落按钮 */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="flat"
                  size="sm"
                  className="border border-white/10 bg-white/[0.03] hover:bg-white/[0.06] text-white/70 h-10"
                  onPress={() => openProfileImportModal(null)}
                  data-testid="resume-import-all-button-bottom"
                >
                  从档案导入
                </Button>

                <Dropdown>
                  <DropdownTrigger>
                    <Button
                      variant="flat"
                      size="sm"
                      startContent={<Plus size={14} />}
                      className="border border-dashed border-white/10 bg-transparent hover:bg-white/[0.03] text-white/40 hover:text-white/60 h-10"
                    >
                      添加段落
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu onAction={(key) => handleAddSection(key as string)}>
                    {SECTION_TYPES.map((t) => {
                      const Icon = t.icon;
                      return (
                        <DropdownItem key={t.key} startContent={<Icon size={14} className={t.color} />}>
                          {t.label}
                        </DropdownItem>
                      );
                    })}
                  </DropdownMenu>
                </Dropdown>
              </div>
            </div>
          </div>
        </div>

        {/* ---- 右侧 A4 预览画布（居中展示，深色画布背景） ---- */}
        <div className={`flex-1 bg-[#1a1a1f] overflow-auto flex items-start justify-center p-8 transition-all ${aiResult ? "mr-[380px]" : ""}`}>
          <div className="sticky top-0">
            <ResumePreview
              ref={previewRef}
              userName={userName}
              photoUrl={
                photoUrl.startsWith("/")
                  ? `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}${photoUrl}`
                  : photoUrl
              }
              summary={summary}
              contactJson={contactJson}
              sections={sections}
              styleConfig={styleConfig}
            />
          </div>
        </div>

        {/* ---- AI 优化结果面板（右侧抽屉，展示 ATS 评分 + 建议列表） ---- */}
        <AnimatePresence>
          {(aiResult || aiLoading || aiError) && (
            <motion.div
              initial={{ x: 380, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: 380, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="fixed right-0 top-0 bottom-0 w-[380px] bg-background/95 backdrop-blur-xl border-l border-white/8 z-30 flex flex-col"
            >
              {/* 面板头部 */}
              <div className="flex items-center justify-between px-4 h-12 border-b border-white/8 flex-shrink-0">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-purple-400" />
                  <span className="text-sm font-semibold text-white/80">AI 优化建议</span>
                </div>
                <Button
                  variant="light"
                  isIconOnly
                  size="sm"
                  onPress={handleCloseAiPanel}
                  className="text-white/40 hover:text-white"
                >
                  <X size={16} />
                </Button>
              </div>

              {/* 面板内容（可滚动） */}
              <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
                {/* 加载中 */}
                {aiLoading && (
                  <div className="flex flex-col items-center justify-center py-12 gap-3">
                    <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
                    <span className="text-sm text-white/40">AI 正在分析简历...</span>
                    <span className="text-xs text-white/25">通常需要 10-30 秒</span>
                  </div>
                )}

                {/* 错误提示 */}
                {aiError && (
                  <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                    <AlertTriangle size={16} className="text-red-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm text-red-300 font-medium">优化失败</p>
                      <p className="text-xs text-red-300/60 mt-1">{aiError}</p>
                    </div>
                  </div>
                )}

                {/* AI 结果展示 */}
                {aiResult && (
                  <>
                    {/* ATS 关键词匹配度 */}
                    {aiResult.keyword_match && (
                      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-3">
                        <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider">关键词匹配度</h4>
                        <div className="flex items-end gap-3">
                          <div className="text-3xl font-bold text-white/90">{aiResult.keyword_match.score}</div>
                          <span className="text-sm text-white/40 mb-1">/ 100</span>
                        </div>
                        <Progress
                          value={aiResult.keyword_match.score}
                          maxValue={100}
                          color={aiResult.keyword_match.score >= 70 ? "success" : aiResult.keyword_match.score >= 40 ? "warning" : "danger"}
                          size="sm"
                          className="mt-1"
                        />
                        {/* 已匹配关键词 */}
                        {aiResult.keyword_match.matched.length > 0 && (
                          <div className="space-y-1">
                            <span className="text-[10px] text-emerald-400/60 uppercase font-semibold">已匹配</span>
                            <div className="flex flex-wrap gap-1">
                              {aiResult.keyword_match.matched.map((kw, i) => (
                                <Chip key={i} size="sm" variant="flat" className="bg-emerald-500/10 text-emerald-300 text-[10px] h-5">
                                  {kw}
                                </Chip>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 缺失关键词 */}
                    {aiResult.keyword_match?.missing && aiResult.keyword_match.missing.length > 0 && (
                      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4 space-y-2">
                        <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider">缺失关键词</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {aiResult.keyword_match.missing.map((kw, i) => (
                            <Chip key={i} size="sm" variant="flat" className="bg-orange-500/10 text-orange-300 text-xs">
                              {kw}
                            </Chip>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 总结 */}
                    {aiResult.summary && (
                      <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] p-4">
                        <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider mb-2">优化总结</h4>
                        <p className="text-xs text-white/60 leading-relaxed">{aiResult.summary}</p>
                      </div>
                    )}

                    {/* 建议列表 — 逐条展示 Diff，支持采纳/拒绝 */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-white/50 uppercase tracking-wider px-1">
                        优化建议 ({aiResult.suggestions.length})
                      </h4>
                      {aiResult.suggestions.map((sug, idx) => {
                        const isApplied = appliedSuggestions.has(idx);
                        return (
                          <div
                            key={idx}
                            className={`rounded-xl border p-3 space-y-2 transition-colors ${
                              isApplied
                                ? "bg-emerald-500/5 border-emerald-500/20"
                                : "bg-white/[0.02] border-white/[0.06] hover:border-white/10"
                            }`}
                          >
                            {/* 建议类型标签 */}
                            <div className="flex items-center justify-between">
                              <Chip
                                size="sm"
                                variant="flat"
                                className={
                                  sug.type === "bullet_rewrite"
                                    ? "bg-blue-500/10 text-blue-300"
                                    : sug.type === "keyword_add"
                                    ? "bg-purple-500/10 text-purple-300"
                                    : "bg-amber-500/10 text-amber-300"
                                }
                              >
                                {sug.type === "bullet_rewrite"
                                  ? "经历改写"
                                  : sug.type === "keyword_add"
                                  ? "关键词补充"
                                  : "模块排序"}
                              </Chip>
                              {isApplied && (
                                <Chip size="sm" color="success" variant="flat" startContent={<Check size={10} />}>
                                  已采纳
                                </Chip>
                              )}
                            </div>

                            {/* 条目标识 */}
                            {sug.item_label && (
                              <p className="text-[11px] text-white/40 font-medium">{sug.section_title} · {sug.item_label}</p>
                            )}

                            {/* 原文 → 建议 Diff 展示 */}
                            {sug.original && (
                              <div className="rounded-lg bg-red-500/5 border border-red-500/10 p-2">
                                <span className="text-[10px] text-red-400/60 uppercase font-semibold">原文</span>
                                <p className="text-xs text-white/50 mt-0.5 line-clamp-4">
                                  {typeof sug.original === "string" ? sug.original : JSON.stringify(sug.original)}
                                </p>
                              </div>
                            )}
                            {sug.suggested && (
                              <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/10 p-2">
                                <span className="text-[10px] text-emerald-400/60 uppercase font-semibold">建议</span>
                                <p className="text-xs text-white/70 mt-0.5 line-clamp-4">
                                  {typeof sug.suggested === "string" ? sug.suggested : JSON.stringify(sug.suggested)}
                                </p>
                              </div>
                            )}

                            {/* 原因说明 */}
                            {sug.reason && (
                              <p className="text-[11px] text-white/35 italic">{sug.reason}</p>
                            )}

                            {/* 操作按钮 */}
                            {!isApplied && (
                              <div className="flex justify-end gap-2 pt-1">
                                <Button
                                  size="sm"
                                  variant="flat"
                                  startContent={<Check size={12} />}
                                  onPress={() => handleApplySuggestion(idx, sug)}
                                  className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs h-7"
                                >
                                  采纳
                                </Button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ========== JD 输入弹窗 — 粘贴岗位描述或选择已有职位 ========== */}
      <Modal
        isOpen={isAiModalOpen}
        onClose={onAiModalClose}
        size="lg"
        classNames={{
          base: "bg-background border border-white/10",
          header: "border-b border-white/8",
          footer: "border-t border-white/8",
        }}
      >
        <ModalContent>
          <ModalHeader className="flex items-center gap-2">
            <Wand2 size={18} className="text-purple-400" />
            <span>AI 简历优化</span>
          </ModalHeader>
          <ModalBody className="py-4 space-y-4">
            <p className="text-sm text-white/50">
              粘贴目标岗位的 JD（职位描述），AI 将分析 ATS 匹配度并生成优化建议。
            </p>

            {!isApiKeyConfigured && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <AlertTriangle size={14} className="text-amber-400 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-300/80">
                  未配置 AI 服务。请先前往 <a href="/settings" className="underline">设置页面</a> 配置 LLM API Key。
                </p>
              </div>
            )}

            {/* 从已筛选岗位选择 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Select
                label="目标池选择"
                variant="bordered"
                size="sm"
                selectedKeys={[aiPoolFilter]}
                onSelectionChange={(keys) => {
                  const val = Array.from(keys)[0] as string;
                  setAiPoolFilter(val || "all");
                }}
                items={aiPoolOptions}
                classNames={{
                  trigger: "bg-white/[0.03] border-white/[0.08]",
                }}
              >
                {(item) => <SelectItem key={item.key}>{item.label}</SelectItem>}
              </Select>

              <Input
                label="岗位检索"
                variant="bordered"
                size="sm"
                placeholder="输入岗位名或公司名"
                value={aiJobKeyword}
                onValueChange={setAiJobKeyword}
                classNames={{
                  inputWrapper: "bg-white/[0.03] border-white/[0.08]",
                }}
              />
            </div>

            <Select
              label="从已筛选岗位选择（可选）"
              variant="bordered"
              size="sm"
              selectedKeys={selectedJobId ? [selectedJobId] : []}
              onSelectionChange={(keys: any) => {
                const val = Array.from(keys)[0] as string;
                setSelectedJobId(val || "");
                if (val) setJdText("");
              }}
              isLoading={aiJobsLoading}
              disabledKeys={aiJobsLoading ? [] : undefined}
              classNames={{
                trigger: "bg-white/[0.03] border-white/[0.08]",
              }}
            >
              {aiJobs.map((job) => (
                <SelectItem key={String(job.id)} textValue={`${job.title} ${job.company}`}>
                  <div className="flex flex-col">
                    <span className="text-xs">{job.title}</span>
                    <span className="text-[10px] text-white/40">{job.company}</span>
                  </div>
                </SelectItem>
              ))}
            </Select>

            {!aiJobsLoading && aiJobs.length === 0 && (
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/45">
                当前筛选条件下暂无可选岗位，可直接切换为手动输入 JD。
              </div>
            )}

            {/* 手动粘贴 JD */}
            {!selectedJobId && (
              <Textarea
                label="职位描述 (JD)"
                variant="bordered"
                placeholder="粘贴完整的职位描述文本..."
                minRows={6}
                maxRows={12}
                value={jdText}
                onValueChange={setJdText}
                classNames={{
                  inputWrapper: "bg-white/[0.03] border-white/[0.08]",
                }}
              />
            )}

            {selectedJobId && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
                <Briefcase size={14} className="text-blue-400" />
                <span className="text-xs text-white/60">将使用所选职位的描述进行分析</span>
                <Button
                  size="sm"
                  variant="light"
                  className="text-xs text-white/40 ml-auto"
                  onPress={() => setSelectedJobId("")}
                >
                  改为手动输入
                </Button>
              </div>
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" size="sm" onPress={onAiModalClose} className="text-white/50">
              取消
            </Button>
            <Button
              color="secondary"
              size="sm"
              startContent={<Sparkles size={14} />}
              isLoading={aiLoading}
              isDisabled={(!jdText.trim() && !selectedJobId) || !isApiKeyConfigured}
              onPress={handleAiOptimize}
            >
              开始优化
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal
        isOpen={isProfileImportOpen}
        onClose={closeProfileImportModal}
        size="3xl"
        scrollBehavior="inside"
        data-testid="resume-profile-import-modal"
        classNames={{
          base: "bg-background border border-white/10",
          header: "border-b border-white/8",
          footer: "border-t border-white/8",
        }}
      >
        <ModalContent>
          <ModalHeader>
            {profileImportTargetSection
              ? `从档案导入到「${profileImportTargetSection.title || "当前模块"}」`
              : "从档案导入"}
          </ModalHeader>
          <ModalBody className="space-y-3">
            {profileImportError && (
              <div className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                {profileImportError}
              </div>
            )}
            {profileImportTargetSection && (
              <div className="rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-100/85">
                仅显示可映射到该模块类型的档案条目，确保导入后结构与字段保持一致。
              </div>
            )}
            {visibleProfileSections.length === 0 ? (
              <div className="text-sm text-white/45">
                {profileImportTargetSection
                  ? "当前档案中没有与该模块类型兼容的条目，请切换模块或先到档案页补充对应分类。"
                  : "当前档案没有可导入条目，请先在档案页面补充内容。"}
              </div>
            ) : (
              visibleProfileSections.map((section) => {
                const checked = selectedProfileSectionIds.has(section.id);
                const mappedType = mapProfileSectionToResumeType(section.section_type);
                return (
                  <button
                    key={section.id}
                    onClick={() => toggleProfileSectionSelection(section.id)}
                    className={`w-full rounded-lg border p-3 text-left transition-all ${
                      checked
                        ? "border-cyan-400/40 bg-cyan-500/10"
                        : "border-white/[0.08] bg-white/[0.02] hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="text-sm text-white/85 truncate">{section.title || "未命名条目"}</div>
                        <div className="text-[11px] text-white/45">
                          档案类型 {section.section_type} {"->"} 简历模块 {mappedType}
                        </div>
                        <div className="text-xs text-white/60 line-clamp-2">{getProfileBulletText(section)}</div>
                      </div>
                      <Checkbox
                        isSelected={checked}
                        onClick={(event) => event.stopPropagation()}
                        onValueChange={() => toggleProfileSectionSelection(section.id)}
                      />
                    </div>
                  </button>
                );
              })
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={closeProfileImportModal}>
              取消
            </Button>
            <Button
              color="primary"
              isLoading={importingProfileSections}
              isDisabled={selectedProfileSectionIds.size === 0}
              onPress={importFromProfile}
            >
              导入 {selectedProfileSectionIds.size} 条
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal
        isOpen={!!deleteSectionTarget}
        onClose={() => {
          if (!deletingSection) setDeleteSectionTarget(null);
        }}
      >
        <ModalContent>
          <ModalHeader>确认删除模块</ModalHeader>
          <ModalBody>
            <p className="text-sm text-white/70">
              确认删除「{deleteSectionTarget?.title || "未命名模块"}」吗？删除后该模块下的内容将被移除。
            </p>
          </ModalBody>
          <ModalFooter>
            <Button
              variant="flat"
              isDisabled={deletingSection}
              onPress={() => setDeleteSectionTarget(null)}
            >
              取消
            </Button>
            <Button color="danger" isLoading={deletingSection} onPress={confirmDeleteSection}>
              确认删除
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
