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
  Textarea, Select, SelectItem, Chip,
  useDisclosure,
} from "@nextui-org/react";
import {
  Save, FileDown, ArrowLeft, Plus, ChevronDown, ChevronUp,
  Eye, EyeOff, Trash2, Image as ImageIcon,
  GraduationCap, Briefcase, Wrench, FolderKanban, LayoutList,
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
import { jobsApi, resumeApi } from "@/lib/api";
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
import { buildProfileSectionsForResumeImport } from "@/lib/personalArchive";
import {
  RESUME_SECTION_DEFINITIONS,
  getResumeSectionLabel,
  normalizeResumeSectionsForEditor,
} from "../utils/sectionNormalization";
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
  { key: "education", label: "教育经历", icon: GraduationCap, color: "text-[#1040C0]" },
  { key: "experience", label: "工作经历", icon: Briefcase, color: "text-[#D02020]" },
  { key: "skill", label: "技能与证书", icon: Wrench, color: "text-[#F0C020]" },
  { key: "project", label: "项目经历", icon: FolderKanban, color: "text-[#1040C0]" },
  { key: "custom", label: "个人经历", icon: LayoutList, color: "text-[#121212]" },
];

const bauhausFieldClassNames = {
  inputWrapper:
    "border-2 border-black bg-white shadow-[2px_2px_0_0_rgba(18,18,18,0.3)] group-data-[focus=true]:border-black",
  input: "font-medium text-black placeholder:text-black/45",
  label: "font-semibold tracking-[0.06em] text-[11px] text-black/65",
  description: "text-black/55",
  errorMessage: "font-medium text-[#D02020]",
};

const bauhausToolbarButtonClassName =
  "bauhaus-button bauhaus-button-outline !min-h-10 !px-4 !py-3 !text-[11px]";

const bauhausToolbarIconButtonClassName =
  "min-h-10 min-w-10 border-2 border-black bg-white text-black shadow-[2px_2px_0_0_rgba(18,18,18,0.3)] transition-transform hover:-translate-y-[1px]";

const bauhausModalContentClassName =
  "border-2 border-black bg-[#F0F0F0] text-black shadow-[4px_4px_0_0_rgba(18,18,18,0.45)]";

const bauhausSelectClassNames = {
  trigger:
    "border-2 border-black bg-white shadow-[2px_2px_0_0_rgba(18,18,18,0.3)] data-[hover=true]:border-black",
  value: "font-medium text-black",
  label: "font-semibold tracking-[0.06em] text-[11px] text-black/65",
  selectorIcon: "text-black/70",
  popoverContent:
    "border-2 border-black bg-[#F0F0F0] text-black shadow-[4px_4px_0_0_rgba(18,18,18,0.45)]",
  listboxWrapper: "max-h-64 bg-[#F0F0F0] p-1",
};

/** 根据 section_type 获取图标和颜色 */
function getSectionMeta(type: string) {
  return SECTION_TYPES.find((t) => t.key === type) || SECTION_TYPES[4];
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
          <GripVertical size={14} className="text-black/30" aria-hidden="true" />
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
  const [exportError, setExportError] = useState("");
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
  const serverSnapshotRef = useRef("");
  const mergedLegacySectionIdsRef = useRef<number[]>([]);

  const getProfileSectionResumeType = useCallback((section: ProfileSection) => {
    return mapProfileSectionToResumeType(section.category_key || section.section_type);
  }, []);

  const profileSections = useMemo(() => {
    return buildProfileSectionsForResumeImport(profileData).slice().sort((a, b) => a.sort_order - b.sort_order);
  }, [profileData]);

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
      (item) => getProfileSectionResumeType(item) === targetSection.section_type
    );
  }, [getProfileSectionResumeType, profileImportTargetSection, profileImportTargetSectionId, profileSections]);

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
    const normalizedSections = normalizeResumeSectionsForEditor(resume.sections || []);
    const normalizedIds = new Set(normalizedSections.map((section) => section.id));
    mergedLegacySectionIdsRef.current = (resume.sections || [])
      .filter((section: any) =>
        (section.section_type === "skill" || section.section_type === "certificate")
        && !normalizedIds.has(section.id)
      )
      .map((section: any) => section.id);
    const serverSnapshot = JSON.stringify({
      userName: resume.user_name || "",
      title: resume.title || "",
      summary: resume.summary || "",
      contactJson: resume.contact_json || {},
      styleConfig: resume.style_config || {},
      sections: normalizedSections,
    });
    if (serverSnapshotRef.current === serverSnapshot) {
      return;
    }
    serverSnapshotRef.current = serverSnapshot;
    setUserName(resume.user_name || "");
    setTitle(resume.title || "");
    setSummary(resume.summary || "");
    setContactJson(resume.contact_json || {});
    setPhotoUrl(resume.photo_url || "");
    setStyleConfig({ ...DEFAULT_STYLE_CONFIG, ...(resume.style_config || {}) });
    setSections(normalizedSections);
    setExpandedSections(new Set(normalizedSections.map((s: any) => s.id)));
    setIgnoredSourceTokens(new Set());
    // 重置 undo/redo 历史到服务端初始状态
    resetHistory({
      userName: resume.user_name || "",
      title: resume.title || "",
      summary: resume.summary || "",
      contactJson: resume.contact_json || {},
      sections: normalizedSections,
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
      if (mergedLegacySectionIdsRef.current.length > 0) {
        const failedIds: number[] = [];
        for (const legacySectionId of mergedLegacySectionIdsRef.current) {
          try {
            await deleteSection(resumeId, legacySectionId);
          } catch (err) {
            console.error(`Delete legacy section failed: ${legacySectionId}`, err);
            failedIds.push(legacySectionId);
          }
        }
        mergedLegacySectionIdsRef.current = failedIds;
      }
      serverSnapshotRef.current = JSON.stringify({
        userName,
        title,
        summary,
        contactJson,
        styleConfig,
        sections,
      });
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
    const label = getResumeSectionLabel(type);
    const sectionType = RESUME_SECTION_DEFINITIONS.some((item) => item.key === type)
      ? type
      : "custom";
    if (sectionType === "skill") {
      const existingSkillSection = sections.find((item) => item.section_type === "skill");
      if (existingSkillSection) {
        setSections((prev) =>
          prev.map((item) => {
            if (item.id !== existingSkillSection.id) return item;
            const current = Array.isArray(item.content_json) ? item.content_json : [];
            return {
              ...item,
              content_json: [
                ...current,
                { _entryType: "skill", ...createEmptySectionItem("skill") },
              ],
            };
          })
        );
        setExpandedSections((prev) => {
          const next = new Set(prev);
          next.add(existingSkillSection.id);
          return next;
        });
        return;
      }
    }
    const maxOrder = sections.length > 0 ? Math.max(...sections.map((s) => s.sort_order)) : -1;
    const res = await createSection(resumeId, {
      section_type: sectionType,
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
          (item) => getProfileSectionResumeType(item) === targetSection.section_type
        );
      }
    }

    setSelectedProfileSectionIds(new Set(candidates.map((item) => item.id)));
    onProfileImportOpen();
  }, [getProfileSectionResumeType, onProfileImportOpen, profileSections, sections]);

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
          content_json: [
            ...current,
            item.section_type === "skill"
              ? { _entryType: "skill", ...createEmptySectionItem(item.section_type) }
              : createEmptySectionItem(item.section_type),
          ],
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
          normalizeResumeSectionsForEditor(prev.map((section) => {
            if (section.id !== profileImportTargetSectionId) return section;
            const current = Array.isArray(section.content_json) ? section.content_json : [];
            return {
              ...section,
              content_json: [...current, ...importedItems],
            };
          }))
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
          const resumeSectionType = getProfileSectionResumeType(profileSection);
          const importedItem = mapProfileSectionToResumeItem(profileSection as any);
          const existingIndex = nextSections.findIndex((item) => item.section_type === resumeSectionType);
          const normalizedCategoryKey = normalizeProfileCategoryKey(
            profileSection.category_key || profileSection.section_type
          );
          const moduleTitle =
            resumeSectionType === "skill"
              ? getResumeSectionLabel("skill")
              : resolveProfileCategoryLabel(
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

        const normalizedSections = normalizeResumeSectionsForEditor(nextSections as any[]);
        setSections(normalizedSections);
        setExpandedSections((prev) => {
          const next = new Set(prev);
          for (const section of normalizedSections) {
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
    getProfileSectionResumeType,
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

  /** 导出 PDF — 使用后端 WeasyPrint/ReportLab 兜底链路 */
  const handleExportPdf = async () => {
    setExporting(true);
    setExportError("");
    try {
      await handleSave();
      const response = await resumeApi.exportPdf(resumeId);
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(detail || `PDF export failed with ${response.status}`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title || "resume"}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF export failed:", err);
      const reason = err instanceof Error ? err.message : "请稍后重试或检查后端 PDF 服务。";
      setExportError(`PDF 导出失败：${reason}`);
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
      <div className="flex h-screen items-center justify-center bg-[#F0F0F0]">
        <div className="bauhaus-panel flex items-center gap-3 bg-white px-6 py-5 text-sm font-medium text-black/70">
          <div className="h-7 w-7 animate-spin rounded-full border-4 border-black/15 border-t-[#D02020]" />
          <span>正在载入简历编辑器...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-2rem)] flex-col overflow-hidden bg-[#F0F0F0] -m-6 md:-m-8">
      {/* ========== 顶部工具栏 ========== */}
      <div className="z-20 flex-shrink-0 border-b-2 border-black bg-[#F0F0F0]">
        {/* 第一行：返回 + 标题 + 操作按钮 */}
        <div className="flex min-h-[88px] flex-wrap items-center justify-between gap-3 px-4 py-4 md:px-6">
          <div className="flex items-center gap-2">
            <Button
              variant="light"
              isIconOnly
              size="sm"
              onPress={() => router.push("/resume")}
              aria-label="返回简历列表"
              className={bauhausToolbarIconButtonClassName}
            >
              <ArrowLeft size={18} />
            </Button>
            <div className="h-7 w-px bg-black/15" />
            <Input
              variant="bordered"
              value={title}
              onValueChange={setTitle}
              classNames={{
                ...bauhausFieldClassNames,
                base: "w-[220px] max-w-[220px] md:w-[280px] md:max-w-[280px]",
                input: "text-sm font-black uppercase tracking-[-0.04em] text-black",
              }}
              placeholder="简历标题"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* 模板选择器 */}
            <Dropdown>
              <DropdownTrigger>
                <Button
                  size="sm"
                  startContent={<Palette size={14} />}
                  className="bauhaus-button bauhaus-button-yellow !px-4 !py-3 !text-[11px]"
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
                        className="h-3 w-3 rounded-full border-2 border-black"
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
            <div className="mx-1 h-7 w-px bg-black/15" />
            <Button
              variant="light"
              isIconOnly
              size="sm"
              isDisabled={!canUndo}
              onPress={handleUndo}
              aria-label="撤销"
              className={bauhausToolbarIconButtonClassName}
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
              aria-label="重做"
              className={bauhausToolbarIconButtonClassName}
              title="重做 (Ctrl+Shift+Z)"
            >
              <Redo2 size={15} />
            </Button>
            <div className="mx-1 h-7 w-px bg-black/15" />
            <Button
              startContent={<Wand2 size={14} />}
              size="sm"
              isLoading={aiLoading}
              onPress={onAiModalOpen}
              className="bauhaus-button bauhaus-button-red !px-4 !py-3 !text-[11px]"
            >
              AI 优化
            </Button>
            <Button
              startContent={<ArrowDownToLine size={14} />}
              size="sm"
              onPress={() => openProfileImportModal(null)}
              data-testid="resume-import-all-button"
              className="bauhaus-button bauhaus-button-outline !px-4 !py-3 !text-[11px]"
            >
              从档案导入
            </Button>
            <div className="mx-1 h-7 w-px bg-black/15" />
            <Button
              startContent={<FileDown size={14} />}
              size="sm"
              isLoading={exporting}
              onPress={handleExportPdf}
              className="bauhaus-button bauhaus-button-yellow !px-4 !py-3 !text-[11px]"
            >
              导出
            </Button>
            <Button
              startContent={<Save size={14} />}
              size="sm"
              isLoading={saving}
              onPress={handleSave}
              data-testid="resume-save-button"
              className="bauhaus-button bauhaus-button-blue !px-4 !py-3 !text-[11px]"
            >
              {saving ? "保存中" : "保存"}
            </Button>
            <span className="hidden text-[10px] font-semibold tracking-[0.06em] text-black/35 sm:inline">
              自动保存
            </span>
          </div>
        </div>
      </div>

      {/* ========== 主体区域：编辑面板 + 预览画布 ========== */}
      <div className="flex flex-1 min-h-0">
        {/* ---- 左侧编辑面板（固定360px宽度，可滚动） ---- */}
        <div className="custom-scrollbar w-[480px] flex-shrink-0 overflow-y-auto border-r-2 border-black bg-[#E7E7E2]">
          <div className="p-4 space-y-4">
            {exportError && (
              <div className="bauhaus-panel-sm bg-[#f7ece9] px-3 py-3 text-xs font-medium leading-relaxed text-[#8a1e1e]">
                {exportError}
              </div>
            )}

            {staleImportedItems.length > 0 && (
              <div className="bauhaus-panel-sm bg-[#F0C020] px-3 py-3 text-black" data-testid="resume-source-sync-banner">
                <div className="flex items-start gap-2">
                  <AlertCircle size={14} className="mt-0.5 text-black" />
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="text-xs font-medium text-black/80">
                      有 {staleImportedItems.length} 条从档案导入的内容已检测到源数据更新。
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        isLoading={syncingProfileSources}
                        className="bauhaus-button bauhaus-button-red !h-8 !px-3 !py-2 !text-[11px]"
                        onPress={syncProfileSourceUpdates}
                        data-testid="resume-sync-source-button"
                      >
                        同步更新
                      </Button>
                      <Button
                        size="sm"
                        variant="light"
                        className="bauhaus-button bauhaus-button-outline !h-8 !px-3 !py-2 !text-[11px]"
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
            <div className="bauhaus-panel space-y-4 bg-white p-4">
              <div className="flex items-center gap-2 px-1">
                <div className="h-4 w-4 rounded-full bg-[#D02020]" />
                <h3 className="text-xs font-black tracking-[0.04em] text-black/60">基本信息</h3>
              </div>

              {/* 头像上传 — 更精致的设计 */}
              <div className="bauhaus-panel-sm flex items-center gap-4 bg-[#F0F0F0] p-3">
                <div className="relative group">
                  {photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoUrl.startsWith("/") ? `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}${photoUrl}` : photoUrl}
                      alt="头像"
                      className="h-14 w-14 object-cover border-2 border-black"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center border-2 border-black bg-white">
                      <ImageIcon size={18} className="text-black/35" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <label className="cursor-pointer">
                    <Button size="sm" variant="light" as="span" className="bauhaus-button bauhaus-button-outline !px-3 !py-2 !text-[11px]">
                      {photoUrl ? "更换头像" : "上传头像"}
                    </Button>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                  </label>
                  <p className="mt-1 text-[10px] font-medium text-black/35">JPG/PNG/WebP · 5MB</p>
                </div>
              </div>

              {/* 联系信息网格 — 更宽松的间距 */}
              <div className="space-y-2.5">
                <Input label="姓名" variant="bordered" size="sm" value={userName} onValueChange={setUserName} classNames={bauhausFieldClassNames} />
                <div className="grid grid-cols-2 gap-2.5">
                  <Input label="电话" variant="bordered" size="sm" value={contactJson.phone || ""} onValueChange={(v) => updateContact("phone", v)} classNames={bauhausFieldClassNames} />
                  <Input label="邮箱" variant="bordered" size="sm" value={contactJson.email || ""} onValueChange={(v) => updateContact("email", v)} classNames={bauhausFieldClassNames} />
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <Input label="LinkedIn" variant="bordered" size="sm" value={contactJson.linkedin || ""} onValueChange={(v) => updateContact("linkedin", v)} classNames={bauhausFieldClassNames} />
                  <Input label="GitHub" variant="bordered" size="sm" value={contactJson.github || ""} onValueChange={(v) => updateContact("github", v)} classNames={bauhausFieldClassNames} />
                </div>
                <Input label="个人网站" variant="bordered" size="sm" value={contactJson.website || ""} onValueChange={(v) => updateContact("website", v)} classNames={bauhausFieldClassNames} />
              </div>

              {/* 个人简介 */}
              <div>
                <label className="mb-1.5 block text-[11px] font-semibold tracking-[0.06em] text-black/55">个人简介</label>
                <RichTextEditor
                  content={summary}
                  onChange={setSummary}
                  placeholder="简要描述你自己..."
                  minHeight={72}
                />
              </div>
            </div>

            {/* ---- 各段落编辑 ---- */}
            <div className="bauhaus-panel space-y-3 bg-white p-4">
              <div className="flex items-center gap-2 px-1">
                <div className="h-4 w-4 rotate-45 bg-[#1040C0]" />
                <h3 className="text-xs font-black tracking-[0.04em] text-black/60">段落内容</h3>
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
                  const sectionDisplayTitle =
                    sec.section_type === "custom" && sourceCategoryKey
                      ? resolveProfileCategoryLabel(sourceCategoryKey)
                      : (getResumeSectionLabel(sec.section_type) || sec.title || "未命名模块");
                  return (
                    <SortableSectionItem key={sec.id} id={sec.id}>
                    <div
                      data-testid={`resume-section-card-${sec.id}`}
                      className="bauhaus-panel-sm overflow-hidden bg-[#F0F0F0] transition-transform hover:-translate-y-[1px]"
                    >
                      {/* 段落头部 — 带类型图标和颜色标识 */}
                      <div className="px-3 py-2.5 select-none space-y-2">
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-2 min-w-[124px] flex-1 overflow-hidden">
                            <SectionIcon size={15} className={`${meta.color} flex-shrink-0 opacity-70`} />
                            <span className="truncate whitespace-nowrap text-xs font-semibold tracking-[0.06em] text-black/70">{sectionDisplayTitle}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              size="sm"
                              variant="light"
                              isIconOnly
                              onPress={() => toggleSectionVisibility(sec.id)}
                              aria-label="切换模块显示"
                              className="min-h-8 min-w-8 border-2 border-black bg-white text-black shadow-[2px_2px_0_0_rgba(18,18,18,0.3)]"
                            >
                              {sec.visible ? <Eye size={12} className="text-black/70" /> : <EyeOff size={12} className="text-black/35" />}
                            </Button>
                            <Button
                              size="sm"
                              variant="flat"
                              isIconOnly
                              onPress={() => handleDeleteSection(sec.id)}
                              aria-label="删除模块"
                              data-testid={`resume-section-delete-${sec.id}`}
                              className="min-h-8 min-w-8 border-2 border-black bg-[#D02020] text-white shadow-[2px_2px_0_0_rgba(18,18,18,0.3)]"
                            >
                              <Trash2 size={11} />
                            </Button>
                            <Button
                              size="sm"
                              variant="light"
                              className="bauhaus-button bauhaus-button-outline !h-8 !px-3 !py-2 !text-[10px]"
                              onPress={() => toggleExpanded(sec.id)}
                              data-testid={`resume-section-toggle-${sec.id}`}
                            >
                              <span className="flex items-center gap-1">
                                {isExpanded ? "折叠" : "展开"}
                                <ChevronDown
                                  size={12}
                                  className={`text-black/45 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                                />
                              </span>
                            </Button>
                          </div>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="light"
                            className="bauhaus-button bauhaus-button-outline !h-8 !px-3 !py-2 !text-[10px]"
                            onPress={() => openProfileImportModal(sec.id)}
                            data-testid={`resume-section-import-${sec.id}`}
                          >
                            档案
                          </Button>
                          <Button
                            size="sm"
                            variant="light"
                            className="bauhaus-button bauhaus-button-yellow !h-8 !px-3 !py-2 !text-[10px]"
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
                            <div className="border-t-2 border-black/10 px-3 pb-3 pt-2">
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
                  size="sm"
                  className="bauhaus-button bauhaus-button-blue !h-10 !justify-center !px-4 !py-3 !text-[11px]"
                  onPress={() => openProfileImportModal(null)}
                  data-testid="resume-import-all-button-bottom"
                >
                  从档案导入
                </Button>

                <Dropdown>
                  <DropdownTrigger>
                    <Button
                      size="sm"
                      startContent={<Plus size={14} />}
                      className="bauhaus-button bauhaus-button-outline !h-10 !justify-center !px-4 !py-3 !text-[11px]"
                    >
                      添加段落
                    </Button>
                  </DropdownTrigger>
                  <DropdownMenu onAction={(key) => handleAddSection(key as string)}>
                    {RESUME_SECTION_DEFINITIONS.map((t) => {
                      const meta = getSectionMeta(t.key);
                      const Icon = meta.icon;
                      return (
                        <DropdownItem key={t.key} startContent={<Icon size={14} className={meta.color} />}>
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
        <div className={`flex flex-1 items-start justify-center overflow-auto bg-[#EFEDE6] p-8 transition-all [background-image:radial-gradient(#121212_1.2px,transparent_1.2px)] [background-size:26px_26px] ${aiResult ? "mr-[380px]" : ""}`}>
          <div className="bauhaus-panel sticky top-0 bg-white p-4 md:p-5">
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
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="fixed bottom-0 right-0 top-0 z-30 flex w-[380px] flex-col border-l-2 border-black bg-[#E8E4DA] text-black shadow-[-4px_0_0_0_rgba(18,18,18,0.35)]"
            >
              {/* 面板头部 */}
              <div className="flex h-16 flex-shrink-0 items-center justify-between border-b-2 border-black bg-[#F0C020] px-5">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-[#121212]" aria-hidden="true" />
                  <span className="text-sm font-black tracking-[0.06em] text-black">AI 优化建议</span>
                </div>
                <Button
                  variant="light"
                  isIconOnly
                  size="sm"
                  onPress={handleCloseAiPanel}
                  aria-label="关闭 AI 建议面板"
                  className="min-h-10 min-w-10 border-2 border-black bg-white text-black shadow-[2px_2px_0_0_rgba(18,18,18,0.3)] transition-transform hover:-translate-y-[1px]"
                >
                  <X size={16} />
                </Button>
              </div>

              {/* 面板内容（可滚动） */}
              <div className="flex-1 space-y-4 overflow-y-auto p-4">
                {/* 加载中 */}
                {aiLoading && (
                  <div className="bauhaus-panel-sm flex flex-col items-center justify-center gap-3 bg-white px-5 py-12 text-center">
                    <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-black border-t-[#1040C0]" />
                    <span className="text-sm font-semibold tracking-[0.04em] text-black/75">AI 正在分析简历...</span>
                    <span className="text-xs font-medium text-black/55">通常需要 10-30 秒</span>
                  </div>
                )}

                {/* 错误提示 */}
                {aiError && (
                  <div className="bauhaus-panel-sm flex items-start gap-3 bg-[#D02020] p-4 text-white">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0 text-white" />
                    <div>
                      <p className="text-sm font-black tracking-[0.04em]">优化失败</p>
                      <p className="mt-1 text-xs font-medium text-white/80">{aiError}</p>
                    </div>
                  </div>
                )}

                {/* AI 结果展示 */}
                {aiResult && (
                  <>
                    {/* ATS 关键词匹配度 */}
                    {aiResult.keyword_match && (
                      <div className="bauhaus-panel-sm space-y-3 bg-white p-4">
                        <h4 className="bauhaus-label text-black/55">关键词匹配度</h4>
                        <div className="flex items-end gap-3">
                          <div className="text-4xl font-black uppercase tracking-[-0.08em] text-black">{aiResult.keyword_match.score}</div>
                          <span className="mb-1 text-sm font-bold text-black/45">/ 100</span>
                        </div>
                        <div className="border-2 border-black bg-[#F0F0F0] p-1 shadow-[2px_2px_0_0_rgba(18,18,18,0.3)]">
                          <div
                            className={`h-4 ${
                              aiResult.keyword_match.score >= 70
                                ? "bg-[#1040C0]"
                                : aiResult.keyword_match.score >= 40
                                  ? "bg-[#F0C020]"
                                  : "bg-[#D02020]"
                            }`}
                            style={{ width: `${Math.max(0, Math.min(aiResult.keyword_match.score, 100))}%` }}
                          />
                        </div>
                        {/* 已匹配关键词 */}
                        {aiResult.keyword_match.matched.length > 0 && (
                          <div className="space-y-1">
                            <span className="bauhaus-label text-black/45">已匹配</span>
                            <div className="flex flex-wrap gap-1">
                              {aiResult.keyword_match.matched.map((kw, i) => (
                                <Chip key={i} size="sm" variant="flat" className="border-2 border-black bg-[#1040C0] px-2 text-[10px] font-semibold text-white">
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
                      <div className="bauhaus-panel-sm space-y-2 bg-white p-4">
                        <h4 className="bauhaus-label text-black/55">缺失关键词</h4>
                        <div className="flex flex-wrap gap-1.5">
                          {aiResult.keyword_match.missing.map((kw, i) => (
                            <Chip key={i} size="sm" variant="flat" className="border-2 border-black bg-[#F0C020] px-2 text-xs font-semibold text-black">
                              {kw}
                            </Chip>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 总结 */}
                    {aiResult.summary && (
                      <div className="bauhaus-panel-sm bg-white p-4">
                        <h4 className="bauhaus-label mb-2 text-black/55">优化总结</h4>
                        <p className="text-sm font-medium leading-relaxed text-black/72">{aiResult.summary}</p>
                      </div>
                    )}

                    {/* 建议列表 — 逐条展示 Diff，支持采纳/拒绝 */}
                    <div className="space-y-2">
                      <h4 className="bauhaus-label px-1 text-black/55">
                        优化建议 ({aiResult.suggestions.length})
                      </h4>
                      {aiResult.suggestions.map((sug, idx) => {
                        const isApplied = appliedSuggestions.has(idx);
                        return (
                          <div
                            key={idx}
                            className={`space-y-2 border-2 border-black p-3 shadow-[2px_2px_0_0_rgba(18,18,18,0.3)] transition-transform hover:-translate-y-[1px] ${
                              isApplied
                                ? "bg-[#F0C020]"
                                : "bg-white"
                            }`}
                          >
                            {/* 建议类型标签 */}
                            <div className="flex items-center justify-between">
                              <Chip
                                size="sm"
                                variant="flat"
                                className={
                                  sug.type === "bullet_rewrite"
                                    ? "border-2 border-black bg-[#1040C0] font-semibold text-white"
                                    : sug.type === "keyword_add"
                                      ? "border-2 border-black bg-[#D02020] font-semibold text-white"
                                      : "border-2 border-black bg-[#F0C020] font-semibold text-black"
                                }
                              >
                                {sug.type === "bullet_rewrite"
                                  ? "经历改写"
                                  : sug.type === "keyword_add"
                                  ? "关键词补充"
                                  : "模块排序"}
                              </Chip>
                              {isApplied && (
                                <Chip size="sm" variant="flat" startContent={<Check size={10} />} className="border-2 border-black bg-white font-semibold text-black">
                                  已采纳
                                </Chip>
                              )}
                            </div>

                            {/* 条目标识 */}
                            {sug.item_label && (
                              <p className="text-[11px] font-semibold tracking-[0.04em] text-black/55">{sug.section_title} · {sug.item_label}</p>
                            )}

                            {/* 原文 → 建议 Diff 展示 */}
                            {sug.original && (
                              <div className="border-2 border-black bg-[#F6D7D7] p-2">
                                <span className="text-[10px] font-semibold tracking-[0.04em] text-black/55">原文</span>
                                <p className="mt-0.5 text-xs font-medium text-black/65 line-clamp-4">
                                  {typeof sug.original === "string" ? sug.original : JSON.stringify(sug.original)}
                                </p>
                              </div>
                            )}
                            {sug.suggested && (
                              <div className="border-2 border-black bg-[#DCE7FF] p-2">
                                <span className="text-[10px] font-semibold tracking-[0.04em] text-black/55">建议</span>
                                <p className="mt-0.5 text-xs font-medium text-black/78 line-clamp-4">
                                  {typeof sug.suggested === "string" ? sug.suggested : JSON.stringify(sug.suggested)}
                                </p>
                              </div>
                            )}

                            {/* 原因说明 */}
                            {sug.reason && (
                              <p className="text-[11px] font-medium italic text-black/55">{sug.reason}</p>
                            )}

                            {/* 操作按钮 */}
                            {!isApplied && (
                              <div className="flex justify-end gap-2 pt-1">
                                <Button
                                  size="sm"
                                  startContent={<Check size={12} />}
                                  onPress={() => handleApplySuggestion(idx, sug)}
                                  className="bauhaus-button bauhaus-button-yellow !min-h-8 !px-3 !py-2 !text-[11px]"
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
      >
        <ModalContent className={bauhausModalContentClassName}>
          <ModalHeader className="flex items-center gap-2 border-b-2 border-black bg-[#F0C020] px-6 py-5 text-xl font-black tracking-[-0.06em]">
            <Wand2 size={18} className="text-black" />
            <span>AI 简历优化</span>
          </ModalHeader>
          <ModalBody className="space-y-4 px-6 py-6">
            <p className="text-sm font-medium leading-relaxed text-black/70">
              粘贴目标岗位的 JD（职位描述），AI 将分析 ATS 匹配度并生成优化建议。
            </p>

            {!isApiKeyConfigured && (
              <div className="bauhaus-panel-sm flex items-start gap-3 bg-[#F0C020] p-4">
                <AlertTriangle size={14} className="mt-0.5 shrink-0 text-black" />
                <p className="text-xs font-medium leading-relaxed text-black/78">
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
                classNames={bauhausSelectClassNames}
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
                classNames={bauhausFieldClassNames}
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
              classNames={bauhausSelectClassNames}
            >
              {aiJobs.map((job) => (
                <SelectItem key={String(job.id)} textValue={`${job.title} ${job.company}`}>
                  <div className="flex flex-col">
                    <span className="text-xs font-medium text-black">{job.title}</span>
                    <span className="text-[10px] text-black/45">{job.company}</span>
                  </div>
                </SelectItem>
              ))}
            </Select>

            {!aiJobsLoading && aiJobs.length === 0 && (
              <div className="bauhaus-panel-sm bg-white px-3 py-3 text-xs font-medium text-black/60">
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
                classNames={bauhausFieldClassNames}
              />
            )}

            {selectedJobId && (
              <div className="bauhaus-panel-sm flex items-center gap-2 bg-white px-4 py-3">
                <Briefcase size={14} className="text-[#1040C0]" />
                <span className="text-xs font-medium text-black/65">将使用所选职位的描述进行分析</span>
                <Button
                  size="sm"
                  variant="light"
                  className="bauhaus-button bauhaus-button-outline !ml-auto !min-h-8 !px-3 !py-2 !text-[11px]"
                  onPress={() => setSelectedJobId("")}
                >
                  改为手动输入
                </Button>
              </div>
            )}
          </ModalBody>
          <ModalFooter className="border-t-2 border-black px-6 py-5">
            <Button variant="light" size="sm" onPress={onAiModalClose} className="bauhaus-button bauhaus-button-outline !px-4 !py-3 !text-[11px]">
              取消
            </Button>
            <Button
              size="sm"
              startContent={<Sparkles size={14} />}
              isLoading={aiLoading}
              isDisabled={(!jdText.trim() && !selectedJobId) || !isApiKeyConfigured}
              onPress={handleAiOptimize}
              className="bauhaus-button bauhaus-button-red !px-4 !py-3 !text-[11px]"
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
      >
        <ModalContent className={bauhausModalContentClassName}>
          <ModalHeader className="border-b-2 border-black bg-[#1040C0] px-6 py-5 text-xl font-black tracking-[-0.06em] text-white">
            {profileImportTargetSection
              ? `从档案导入到「${profileImportTargetSection.title || "当前模块"}」`
              : "从档案导入"}
          </ModalHeader>
          <ModalBody className="space-y-3 px-6 py-6">
            {profileImportError && (
              <div className="bauhaus-panel-sm bg-[#D02020] px-3 py-3 text-xs font-medium text-white">
                {profileImportError}
              </div>
            )}
            {profileImportTargetSection && (
              <div className="bauhaus-panel-sm bg-[#F0C020] px-3 py-3 text-xs font-medium text-black/75">
                仅显示可映射到该模块类型的档案条目，确保导入后结构与字段保持一致。
              </div>
            )}
            {visibleProfileSections.length === 0 ? (
              <div className="text-sm font-medium text-black/55">
                {profileImportTargetSection
                  ? "当前档案中没有与该模块类型兼容的条目，请切换模块或先到档案页补充对应分类。"
                  : "当前档案没有可导入条目，请先在档案页面补充内容。"}
              </div>
            ) : (
              visibleProfileSections.map((section) => {
                const checked = selectedProfileSectionIds.has(section.id);
                const mappedType = getProfileSectionResumeType(section);
                return (
                  <button
                    key={section.id}
                    onClick={() => toggleProfileSectionSelection(section.id)}
                    className={`w-full border-2 border-black p-3 text-left shadow-[2px_2px_0_0_rgba(18,18,18,0.3)] transition-transform hover:-translate-y-[1px] ${
                      checked
                        ? "bg-[#F0C020]"
                        : "bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="truncate text-sm font-bold text-black">{section.title || "未命名条目"}</div>
                        <div className="text-[11px] font-semibold tracking-[0.04em] text-black/55">
                          档案类型 {section.section_type} {"->"} 简历模块 {mappedType}
                        </div>
                        <div className="line-clamp-2 text-xs font-medium text-black/68">{getProfileBulletText(section)}</div>
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
          <ModalFooter className="border-t-2 border-black px-6 py-5">
            <Button variant="light" onPress={closeProfileImportModal} className="bauhaus-button bauhaus-button-outline !px-4 !py-3 !text-[11px]">
              取消
            </Button>
            <Button
              isLoading={importingProfileSections}
              isDisabled={selectedProfileSectionIds.size === 0}
              onPress={importFromProfile}
              className="bauhaus-button bauhaus-button-blue !px-4 !py-3 !text-[11px]"
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
        <ModalContent className={bauhausModalContentClassName}>
          <ModalHeader className="border-b-2 border-black bg-[#D02020] px-6 py-5 text-xl font-black tracking-[-0.06em] text-white">确认删除模块</ModalHeader>
          <ModalBody className="px-6 py-6">
            <p className="text-sm font-medium leading-relaxed text-black/72">
              确认删除「{deleteSectionTarget?.title || "未命名模块"}」吗？删除后该模块下的内容将被移除。
            </p>
          </ModalBody>
          <ModalFooter className="border-t-2 border-black px-6 py-5">
            <Button
              variant="light"
              isDisabled={deletingSection}
              onPress={() => setDeleteSectionTarget(null)}
              className="bauhaus-button bauhaus-button-outline !px-4 !py-3 !text-[11px]"
            >
              取消
            </Button>
            <Button isLoading={deletingSection} onPress={confirmDeleteSection} className="bauhaus-button bauhaus-button-red !px-4 !py-3 !text-[11px]">
              确认删除
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
