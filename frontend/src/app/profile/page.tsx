"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Button,
  Card,
  CardBody,
  Checkbox,
  Chip,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
  Textarea,
} from "@nextui-org/react";
import { CheckCircle2, PencilLine, Plus, Save, Trash2, Upload } from "lucide-react";
import {
  createProfileSection,
  deleteProfileSectionData,
  importProfileResume,
  type ProfileCategoryList,
  type ProfileSection,
  updateProfileData,
  updateProfileSectionData,
  useProfile,
  useProfileCategories,
} from "@/lib/hooks";
import {
  buildCustomCategoryKey,
  buildProfileSectionContent,
  getBuiltinCategoryOptions,
  getProfileBulletText,
  getProfileSectionEndDate,
  normalizeBaseInfoPayload,
  normalizeProfileCategoryKey,
  parseProfileSectionDraft,
  resolveProfileCategoryLabel,
} from "@/lib/profileSchema";

const FILTER_ALL = "__all__";
const FILTER_NEW_CUSTOM = "__new_custom__";
const LOW_CONFIDENCE_THRESHOLD = 0.65;

type DraftValues = Record<string, string>;

interface ImportCandidateDraft {
  localId: string;
  selected: boolean;
  sectionType: string;
  categoryLabel: string;
  title: string;
  confidence: number;
  contentJson: Record<string, any>;
}

function createEmptyDraft(categoryKey: string): DraftValues {
  const key = normalizeProfileCategoryKey(categoryKey);
  if (key === "education") {
    return {
      school: "",
      degree: "",
      major: "",
      startDate: "",
      endDate: "",
      gpa: "",
      description: "",
    };
  }
  if (key === "experience") {
    return {
      company: "",
      position: "",
      startDate: "",
      endDate: "",
      description: "",
    };
  }
  if (key === "project") {
    return {
      name: "",
      role: "",
      url: "",
      startDate: "",
      endDate: "",
      description: "",
    };
  }
  if (key === "skill") {
    return {
      category: "",
      itemsText: "",
    };
  }
  if (key === "certificate") {
    return {
      name: "",
      issuer: "",
      date: "",
      url: "",
    };
  }
  return {
    subtitle: "",
    description: "",
    highlightsText: "",
  };
}

function isDraftValid(categoryKey: string, draft: DraftValues): boolean {
  const key = normalizeProfileCategoryKey(categoryKey);
  if (key === "education") {
    return !!(draft.school?.trim() || draft.description?.trim());
  }
  if (key === "experience") {
    return !!(draft.company?.trim() || draft.position?.trim() || draft.description?.trim());
  }
  if (key === "project") {
    return !!(draft.name?.trim() || draft.description?.trim());
  }
  if (key === "skill") {
    return !!draft.itemsText?.trim();
  }
  if (key === "certificate") {
    return !!draft.name?.trim();
  }
  return !!(draft.subtitle?.trim() || draft.description?.trim());
}

function normalizeDateValue(raw: string): number {
  const text = String(raw || "").trim();
  if (!text) return 0;
  const asDate = Date.parse(text.replace(/\./g, "-").replace(/年|月/g, "-").replace(/日/g, ""));
  if (!Number.isNaN(asDate)) return asDate;
  const digits = text.replace(/[^0-9]/g, "");
  return digits ? Number(digits) : 0;
}

function isLowConfidence(value: number): boolean {
  return Number(value || 0) < LOW_CONFIDENCE_THRESHOLD;
}

export default function ProfilePage() {
  const { data: profile, mutate, isLoading } = useProfile();
  const { data: categoryList } = useProfileCategories();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [github, setGithub] = useState("");
  const [website, setWebsite] = useState("");
  const [summary, setSummary] = useState("");

  const [activeCategory, setActiveCategory] = useState<string>(FILTER_ALL);
  const [entryTitle, setEntryTitle] = useState("");
  const [draftByCategory, setDraftByCategory] = useState<Record<string, DraftValues>>({
    education: createEmptyDraft("education"),
    experience: createEmptyDraft("experience"),
    project: createEmptyDraft("project"),
    skill: createEmptyDraft("skill"),
    certificate: createEmptyDraft("certificate"),
    "custom:c_generic": createEmptyDraft("custom:c_generic"),
  });

  const [editingSectionId, setEditingSectionId] = useState<number | null>(null);
  const [editingCategoryKey, setEditingCategoryKey] = useState("");
  const [editingCategoryLabel, setEditingCategoryLabel] = useState("");
  const [editingTitle, setEditingTitle] = useState("");
  const [editingDraft, setEditingDraft] = useState<DraftValues>(createEmptyDraft("custom:c_generic"));

  const [localCustomCategories, setLocalCustomCategories] = useState<Record<string, string>>({});
  const [customCategoryModalOpen, setCustomCategoryModalOpen] = useState(false);
  const [newCustomCategoryName, setNewCustomCategoryName] = useState("");

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importingToDb, setImportingToDb] = useState(false);
  const [importCandidates, setImportCandidates] = useState<ImportCandidateDraft[]>([]);

  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [savingSection, setSavingSection] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<ProfileSection | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!profile) return;
    const base = normalizeBaseInfoPayload(profile.base_info_json || {});
    setName(String(base.name || profile.name || ""));
    setPhone(String(base.phone || ""));
    setEmail(String(base.email || ""));
    setLinkedin(String(base.linkedin || ""));
    setGithub(String(base.github || ""));
    setWebsite(String(base.website || ""));
    setSummary(String(base.summary || ""));
  }, [profile]);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 2500);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    const nextCustom: Record<string, string> = {};

    for (const item of (categoryList as ProfileCategoryList | undefined)?.custom || []) {
      nextCustom[item.key] = item.label;
    }

    for (const section of profile?.sections || []) {
      const key = normalizeProfileCategoryKey(section.category_key || section.section_type);
      if (!key.startsWith("custom:")) continue;
      nextCustom[key] = resolveProfileCategoryLabel(key, section.category_label);
    }

    setLocalCustomCategories((prev) => ({ ...prev, ...nextCustom }));
  }, [categoryList, profile?.sections]);

  const categoryOptions = useMemo(() => {
    const builtin = getBuiltinCategoryOptions();
    const custom = Object.entries(localCustomCategories)
      .map(([key, label]) => ({ key, label, isCustom: true }))
      .sort((a, b) => a.label.localeCompare(b.label, "zh-CN"));
    return [...builtin, ...custom];
  }, [localCustomCategories]);

  const groupedSections = useMemo(() => {
    const groups: Record<string, ProfileSection[]> = {};
    for (const section of profile?.sections || []) {
      const key = normalizeProfileCategoryKey(section.category_key || section.section_type);
      if (activeCategory !== FILTER_ALL && key !== activeCategory) continue;
      if (!groups[key]) groups[key] = [];
      groups[key].push(section);
    }

    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => {
        const aDate = normalizeDateValue(getProfileSectionEndDate(a as any));
        const bDate = normalizeDateValue(getProfileSectionEndDate(b as any));
        if (aDate !== bDate) return bDate - aDate;
        return Number(b.id) - Number(a.id);
      });
    }

    return groups;
  }, [activeCategory, profile?.sections]);

  const groupedKeys = useMemo(() => {
    if (activeCategory !== FILTER_ALL) {
      return [activeCategory];
    }
    const order = categoryOptions.map((item) => item.key);
    const keys = Object.keys(groupedSections);
    return order.filter((key) => keys.includes(key));
  }, [activeCategory, categoryOptions, groupedSections]);

  const selectedImportCount = useMemo(
    () => importCandidates.filter((item) => item.selected).length,
    [importCandidates]
  );

  const getDraft = (categoryKey: string): DraftValues => {
    const key = normalizeProfileCategoryKey(categoryKey);
    return draftByCategory[key] || createEmptyDraft(key);
  };

  const updateDraftField = (categoryKey: string, field: string, value: string) => {
    const key = normalizeProfileCategoryKey(categoryKey);
    setDraftByCategory((prev) => ({
      ...prev,
      [key]: {
        ...(prev[key] || createEmptyDraft(key)),
        [field]: value,
      },
    }));
  };

  const resetDraft = (categoryKey: string) => {
    const key = normalizeProfileCategoryKey(categoryKey);
    setDraftByCategory((prev) => ({
      ...prev,
      [key]: createEmptyDraft(key),
    }));
  };

  const saveProfile = async () => {
    try {
      setSaving(true);
      setError("");

      const current = normalizeBaseInfoPayload(profile?.base_info_json || {});
      const nextBaseInfo = normalizeBaseInfoPayload({
        ...current,
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim(),
        linkedin: linkedin.trim(),
        github: github.trim(),
        website: website.trim(),
        summary: summary.trim(),
      });

      await updateProfileData({
        name: name.trim() || "默认档案",
        headline: profile?.headline || "",
        exit_story: profile?.exit_story || "",
        cross_cutting_advantage: profile?.cross_cutting_advantage || "",
        base_info_json: nextBaseInfo,
      });

      await mutate();
      setNotice("基础信息已保存");
    } catch (err: any) {
      setError(err.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const addEntry = async () => {
    if (activeCategory === FILTER_ALL) {
      setError("请选择具体分类后再新增条目");
      return;
    }

    const categoryKey = normalizeProfileCategoryKey(activeCategory);
    const categoryLabel = resolveProfileCategoryLabel(
      categoryKey,
      localCustomCategories[categoryKey]
    );
    const draft = getDraft(categoryKey);

    if (!isDraftValid(categoryKey, draft)) {
      setError("请先填写至少一项核心字段");
      return;
    }

    try {
      setAdding(true);
      setError("");

      const title = entryTitle.trim() || categoryLabel;
      const contentJson = buildProfileSectionContent(categoryKey, title, draft as any, categoryLabel);

      await createProfileSection({
        section_type: categoryKey,
        category_label: categoryLabel,
        title,
        content_json: contentJson,
        source: "manual",
        confidence: 1,
      });

      await mutate();
      setEntryTitle("");
      resetDraft(categoryKey);
      setNotice("条目已新增");
    } catch (err: any) {
      setError(err.message || "新增条目失败");
    } finally {
      setAdding(false);
    }
  };

  const beginEditSection = (section: ProfileSection) => {
    const categoryKey = normalizeProfileCategoryKey(section.category_key || section.section_type);
    setEditingSectionId(section.id);
    setEditingCategoryKey(categoryKey);
    setEditingCategoryLabel(resolveProfileCategoryLabel(categoryKey, section.category_label));
    setEditingTitle(section.title || resolveProfileCategoryLabel(categoryKey, section.category_label));
    setEditingDraft(parseProfileSectionDraft(section as any) as Record<string, string>);
  };

  const cancelEdit = () => {
    setEditingSectionId(null);
    setEditingCategoryKey("");
    setEditingCategoryLabel("");
    setEditingTitle("");
    setEditingDraft(createEmptyDraft("custom:c_generic"));
  };

  const saveEditSection = async (section: ProfileSection) => {
    const categoryKey = normalizeProfileCategoryKey(
      editingCategoryKey || section.category_key || section.section_type
    );

    if (!isDraftValid(categoryKey, editingDraft)) {
      setError("编辑内容不能为空");
      return;
    }

    try {
      setSavingSection(true);
      setError("");

      const title = editingTitle.trim() || resolveProfileCategoryLabel(categoryKey, editingCategoryLabel);
      const contentJson = buildProfileSectionContent(
        categoryKey,
        title,
        editingDraft as any,
        editingCategoryLabel
      );

      await updateProfileSectionData(section.id, {
        section_type: categoryKey,
        category_label: editingCategoryLabel,
        title,
        content_json: contentJson,
      });

      await mutate();
      cancelEdit();
      setNotice("条目已保存");
    } catch (err: any) {
      setError(err.message || "条目保存失败");
    } finally {
      setSavingSection(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setError("");
      await deleteProfileSectionData(deleteTarget.id);
      await mutate();
      setDeleteTarget(null);
      setNotice("条目已删除");
    } catch (err: any) {
      setError(err.message || "删除失败");
    }
  };

  const handleCreateCustomCategory = () => {
    const label = newCustomCategoryName.trim();
    if (!label) {
      setError("请填写自定义分类名称");
      return;
    }

    const key = buildCustomCategoryKey(label);
    setLocalCustomCategories((prev) => ({ ...prev, [key]: label }));
    setDraftByCategory((prev) => ({
      ...prev,
      [key]: prev[key] || createEmptyDraft(key),
    }));
    setActiveCategory(key);
    setCustomCategoryModalOpen(false);
    setNewCustomCategoryName("");
    setNotice(`已创建分类：${label}`);
  };

  const handleImportResume = async (file: File) => {
    if (!file) return;

    try {
      setImporting(true);
      setError("");

      const result = await importProfileResume(file);
      const candidates = (result.bullets || []).map((item, index) => {
        const sectionType = normalizeProfileCategoryKey(item.section_type || "custom");
        const contentJson =
          item.content_json && typeof item.content_json === "object"
            ? { ...item.content_json }
            : {};

        const previewBullet =
          String(contentJson.bullet || "").trim() ||
          getProfileBulletText({
            id: index,
            section_type: sectionType,
            title: String(item.title || ""),
            content_json: contentJson,
          } as any);

        return {
          localId: `${item.session_id}-${item.index}-${index}`,
          selected: true,
          sectionType,
          categoryLabel: resolveProfileCategoryLabel(sectionType),
          title: String(item.title || resolveProfileCategoryLabel(sectionType)),
          confidence: Number(item.confidence ?? 0.7),
          contentJson: {
            ...contentJson,
            bullet: previewBullet,
          },
        } as ImportCandidateDraft;
      });

      setImportCandidates(candidates);
      setImportModalOpen(true);
      setNotice(`已解析 ${file.name}，请审核后导入`);
    } catch (err: any) {
      setError(err.message || "AI 导入失败");
    } finally {
      setImporting(false);
    }
  };

  const confirmImportCandidates = async () => {
    const selected = importCandidates.filter((item) => item.selected);
    if (selected.length === 0) {
      setError("请至少选择一条候选内容");
      return;
    }

    try {
      setImportingToDb(true);
      setError("");

      for (const item of selected) {
        const bullet = String(item.contentJson?.bullet || "").trim();
        if (!bullet) continue;

        await createProfileSection({
          section_type: normalizeProfileCategoryKey(item.sectionType),
          category_label: item.categoryLabel,
          title: item.title.trim() || item.categoryLabel,
          content_json: {
            ...item.contentJson,
            bullet,
          },
          source: "ai_import",
          confidence: Math.max(0, Math.min(1, Number(item.confidence || 0))),
        });
      }

      await mutate();
      setImportCandidates([]);
      setImportModalOpen(false);
      setNotice(`已导入 ${selected.length} 条候选`);
    } catch (err: any) {
      setError(err.message || "候选导入失败");
    } finally {
      setImportingToDb(false);
    }
  };

  const renderDraftFields = (
    categoryKey: string,
    draft: DraftValues,
    setField: (field: string, value: string) => void
  ) => {
    const key = normalizeProfileCategoryKey(categoryKey);
    const inputCls = { inputWrapper: "bg-white/[0.02] border-white/[0.08]" };

    if (key === "education") {
      return (
        <>
          <Input size="sm" variant="bordered" label="学校名称" value={draft.school || ""} onValueChange={(v) => setField("school", v)} classNames={inputCls} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Input size="sm" variant="bordered" label="学位" value={draft.degree || ""} onValueChange={(v) => setField("degree", v)} classNames={inputCls} />
            <Input size="sm" variant="bordered" label="专业" value={draft.major || ""} onValueChange={(v) => setField("major", v)} classNames={inputCls} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Input size="sm" variant="bordered" label="开始时间" value={draft.startDate || ""} onValueChange={(v) => setField("startDate", v)} classNames={inputCls} />
            <Input size="sm" variant="bordered" label="结束时间" value={draft.endDate || ""} onValueChange={(v) => setField("endDate", v)} classNames={inputCls} />
            <Input size="sm" variant="bordered" label="GPA" value={draft.gpa || ""} onValueChange={(v) => setField("gpa", v)} classNames={inputCls} />
          </div>
          <Textarea size="sm" variant="bordered" label="描述" minRows={2} value={draft.description || ""} onValueChange={(v) => setField("description", v)} classNames={inputCls} />
        </>
      );
    }

    if (key === "experience") {
      return (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Input size="sm" variant="bordered" label="公司" value={draft.company || ""} onValueChange={(v) => setField("company", v)} classNames={inputCls} />
            <Input size="sm" variant="bordered" label="职位" value={draft.position || ""} onValueChange={(v) => setField("position", v)} classNames={inputCls} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Input size="sm" variant="bordered" label="开始时间" value={draft.startDate || ""} onValueChange={(v) => setField("startDate", v)} classNames={inputCls} />
            <Input size="sm" variant="bordered" label="结束时间" value={draft.endDate || ""} onValueChange={(v) => setField("endDate", v)} classNames={inputCls} />
          </div>
          <Textarea size="sm" variant="bordered" label="工作描述" minRows={2} value={draft.description || ""} onValueChange={(v) => setField("description", v)} classNames={inputCls} />
        </>
      );
    }

    if (key === "project") {
      return (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Input size="sm" variant="bordered" label="项目名称" value={draft.name || ""} onValueChange={(v) => setField("name", v)} classNames={inputCls} />
            <Input size="sm" variant="bordered" label="角色" value={draft.role || ""} onValueChange={(v) => setField("role", v)} classNames={inputCls} />
          </div>
          <Input size="sm" variant="bordered" label="项目链接" value={draft.url || ""} onValueChange={(v) => setField("url", v)} classNames={inputCls} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Input size="sm" variant="bordered" label="开始时间" value={draft.startDate || ""} onValueChange={(v) => setField("startDate", v)} classNames={inputCls} />
            <Input size="sm" variant="bordered" label="结束时间" value={draft.endDate || ""} onValueChange={(v) => setField("endDate", v)} classNames={inputCls} />
          </div>
          <Textarea size="sm" variant="bordered" label="项目描述" minRows={2} value={draft.description || ""} onValueChange={(v) => setField("description", v)} classNames={inputCls} />
        </>
      );
    }

    if (key === "skill") {
      return (
        <>
          <Input size="sm" variant="bordered" label="技能分类" value={draft.category || ""} onValueChange={(v) => setField("category", v)} classNames={inputCls} />
          <Textarea size="sm" variant="bordered" label="技能项（逗号/换行分隔）" minRows={2} value={draft.itemsText || ""} onValueChange={(v) => setField("itemsText", v)} classNames={inputCls} />
        </>
      );
    }

    if (key === "certificate") {
      return (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Input size="sm" variant="bordered" label="证书名称" value={draft.name || ""} onValueChange={(v) => setField("name", v)} classNames={inputCls} />
            <Input size="sm" variant="bordered" label="颁发机构" value={draft.issuer || ""} onValueChange={(v) => setField("issuer", v)} classNames={inputCls} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Input size="sm" variant="bordered" label="获得日期" value={draft.date || ""} onValueChange={(v) => setField("date", v)} classNames={inputCls} />
            <Input size="sm" variant="bordered" label="证书链接" value={draft.url || ""} onValueChange={(v) => setField("url", v)} classNames={inputCls} />
          </div>
        </>
      );
    }

    return (
      <>
        <Input size="sm" variant="bordered" label="小标题" value={draft.subtitle || ""} onValueChange={(v) => setField("subtitle", v)} classNames={inputCls} />
        <Textarea size="sm" variant="bordered" label="描述" minRows={2} value={draft.description || ""} onValueChange={(v) => setField("description", v)} classNames={inputCls} />
        <Textarea size="sm" variant="bordered" label="补充要点（可选）" minRows={2} value={draft.highlightsText || ""} onValueChange={(v) => setField("highlightsText", v)} classNames={inputCls} />
      </>
    );
  };

  if (isLoading && !profile) {
    return (
      <div className="h-[70vh] grid place-items-center">
        <Spinner label="正在加载档案..." color="primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", damping: 18 }}
      className="max-w-6xl mx-auto space-y-5"
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold">档案管理</h1>
          <p className="text-sm text-white/45 mt-1">档案库是唯一事实源，简历页只读取和同步，不会反向覆盖档案数据。</p>
        </div>

        <div className="flex items-center gap-2">
          <label>
            <input
              type="file"
              accept=".pdf,.docx"
              className="hidden"
              data-testid="profile-import-file"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = "";
                if (!file) return;
                void handleImportResume(file);
              }}
              disabled={importing || importingToDb}
            />
            <Button as="span" variant="flat" startContent={<Upload size={14} />} isLoading={importing} className="bg-white/10 text-white/80">
              AI 导入
            </Button>
          </label>

          <Button color="primary" startContent={<Save size={14} />} isLoading={saving} onPress={saveProfile} data-testid="profile-save-button">
            保存
          </Button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-danger-400/40 bg-danger-500/10 px-4 py-3 text-sm text-danger-200" data-testid="profile-error-banner">{error}</div>}
      {notice && <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200" data-testid="profile-notice-banner">{notice}</div>}

      <Card className="bg-white/[0.03] border border-white/[0.08]">
        <CardBody className="p-4 space-y-3">
          <div className="text-sm font-semibold text-white/85">基础信息</div>
          <Input label="姓名" variant="bordered" value={name} onValueChange={setName} classNames={{ inputWrapper: "bg-white/[0.02] border-white/[0.08]" }} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <Input label="手机号" variant="bordered" value={phone} onValueChange={setPhone} classNames={{ inputWrapper: "bg-white/[0.02] border-white/[0.08]" }} />
            <Input label="邮箱" variant="bordered" value={email} onValueChange={setEmail} classNames={{ inputWrapper: "bg-white/[0.02] border-white/[0.08]" }} />
            <Input label="领英" variant="bordered" value={linkedin} onValueChange={setLinkedin} classNames={{ inputWrapper: "bg-white/[0.02] border-white/[0.08]" }} />
            <Input label="GitHub" variant="bordered" value={github} onValueChange={setGithub} classNames={{ inputWrapper: "bg-white/[0.02] border-white/[0.08]" }} />
          </div>
          <Input label="个人网站" variant="bordered" value={website} onValueChange={setWebsite} classNames={{ inputWrapper: "bg-white/[0.02] border-white/[0.08]" }} />
          <Textarea label="个人简介" variant="bordered" minRows={3} value={summary} onValueChange={setSummary} classNames={{ inputWrapper: "bg-white/[0.02] border-white/[0.08]" }} />
        </CardBody>
      </Card>

      <Card className="bg-white/[0.03] border border-white/[0.08]">
        <CardBody className="p-4 space-y-4">
          <div className="text-sm font-semibold text-white/85">档案经历库</div>

          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr_auto] gap-2">
            <select
              value={activeCategory}
              data-testid="profile-category-select"
              onChange={(event) => {
                const value = event.target.value;
                if (value === FILTER_NEW_CUSTOM) {
                  setCustomCategoryModalOpen(true);
                  return;
                }
                setActiveCategory(value);
              }}
              className="h-10 rounded-md bg-white/[0.03] border border-white/[0.1] px-3 text-sm text-white/85"
            >
              <option value={FILTER_ALL} className="text-black">全部</option>
              {categoryOptions.map((item) => (
                <option key={item.key} value={item.key} className="text-black">{item.label}</option>
              ))}
              <option value={FILTER_NEW_CUSTOM} className="text-black">+ 新建自定义分类</option>
            </select>

            <Input
              size="sm"
              variant="bordered"
              placeholder="标题（可选）"
              data-testid="profile-entry-title"
              value={entryTitle}
              onValueChange={setEntryTitle}
              isDisabled={activeCategory === FILTER_ALL}
              classNames={{ inputWrapper: "bg-white/[0.02] border-white/[0.08]" }}
            />

            <Button color="warning" size="sm" startContent={<Plus size={14} />} isLoading={adding} isDisabled={activeCategory === FILTER_ALL} onPress={addEntry} data-testid="profile-add-entry-button">
              新增条目
            </Button>
          </div>

          {activeCategory !== FILTER_ALL ? (
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 space-y-2">
              <div className="text-xs text-white/45">当前新增分类：{resolveProfileCategoryLabel(activeCategory, localCustomCategories[activeCategory])}</div>
              {renderDraftFields(activeCategory, getDraft(activeCategory), (field, value) => updateDraftField(activeCategory, field, value))}
              <div className="flex justify-end">
                <Button size="sm" variant="flat" onPress={() => resetDraft(activeCategory)}>重置当前草稿</Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-sm text-white/45">
              当前为全部视图，选择具体分类后可新增结构化条目。
            </div>
          )}

          <div className="space-y-4">
            {groupedKeys.length === 0 && (
              <div className="text-sm text-white/35 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2">当前分类暂无条目</div>
            )}

            {groupedKeys.map((groupKey) => {
              const sections = groupedSections[groupKey] || [];
              const groupLabel = categoryOptions.find((item) => item.key === groupKey)?.label || resolveProfileCategoryLabel(groupKey);
              return (
                <div key={groupKey} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Chip size="sm" variant="flat" className="bg-white/10 text-white/80" data-testid={`profile-group-chip-${groupKey}`}>{groupLabel}</Chip>
                    <span className="text-xs text-white/40">{sections.length} 条</span>
                  </div>

                  <div className="space-y-2">
                    {sections.map((section) => {
                      const sectionKey = normalizeProfileCategoryKey(section.category_key || section.section_type);
                      const isEditing = editingSectionId === section.id;

                      return (
                        <div key={section.id} className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3 space-y-2" data-testid={`profile-section-card-${section.id}`}>
                          {isEditing ? (
                            <>
                              <Input size="sm" variant="bordered" label="条目标题" value={editingTitle} onValueChange={setEditingTitle} classNames={{ inputWrapper: "bg-white/[0.02] border-white/[0.08]" }} />
                              {renderDraftFields(sectionKey, editingDraft, (field, value) => setEditingDraft((prev) => ({ ...prev, [field]: value })))}
                              <div className="flex justify-end gap-2">
                                <Button size="sm" variant="flat" onPress={cancelEdit}>取消</Button>
                                <Button size="sm" color="primary" isLoading={savingSection} onPress={() => void saveEditSection(section)}>保存</Button>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="text-sm text-white/85 font-medium">{section.title || resolveProfileCategoryLabel(sectionKey, section.category_label)}</div>
                                  <div className="text-xs text-white/35 mt-1">来源 {section.source} · 置信度 {Math.round(section.confidence * 100)}%</div>
                                  {isLowConfidence(section.confidence) && (
                                    <div className="mt-1 text-[11px] text-amber-300/90" data-testid={`profile-low-confidence-${section.id}`}>
                                      低置信度条目，请优先核实
                                    </div>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <Button isIconOnly size="sm" variant="light" aria-label="编辑条目" onPress={() => beginEditSection(section)}><PencilLine size={14} /></Button>
                                  <Button isIconOnly size="sm" variant="light" aria-label="删除条目" className="text-red-400" onPress={() => setDeleteTarget(section)}><Trash2 size={14} /></Button>
                                </div>
                              </div>
                              <p className="text-sm text-white/70 leading-relaxed break-words">{getProfileBulletText(section as any)}</p>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </CardBody>
      </Card>

      <Modal isOpen={customCategoryModalOpen} onClose={() => setCustomCategoryModalOpen(false)} data-testid="profile-custom-category-modal">
        <ModalContent>
          <ModalHeader>新建自定义分类</ModalHeader>
          <ModalBody>
            <Input autoFocus label="分类名称" variant="bordered" placeholder="例如：校园实践、出版作品" value={newCustomCategoryName} onValueChange={setNewCustomCategoryName} data-testid="profile-custom-category-input" />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setCustomCategoryModalOpen(false)}>取消</Button>
            <Button color="primary" onPress={handleCreateCustomCategory} data-testid="profile-custom-category-confirm">确认创建</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)}>
        <ModalContent>
          <ModalHeader>确认删除条目</ModalHeader>
          <ModalBody>
            <p className="text-sm text-white/70">删除后该条目将从档案库永久移除，但不会直接删除已有简历中的已导入内容。</p>
            <p className="text-xs text-white/45">条目：{deleteTarget?.title || "未命名条目"}</p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setDeleteTarget(null)}>取消</Button>
            <Button color="danger" onPress={() => void confirmDelete()}>确认删除</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <Modal isOpen={importModalOpen} onClose={() => setImportModalOpen(false)} size="4xl" scrollBehavior="inside" data-testid="profile-import-review-modal">
        <ModalContent>
          <ModalHeader>AI 导入审核</ModalHeader>
          <ModalBody className="space-y-3">
            {importCandidates.length === 0 ? (
              <div className="text-sm text-white/45">暂无候选条目。</div>
            ) : (
              importCandidates.map((candidate) => (
                <div
                  key={candidate.localId}
                  className={`rounded-lg border p-3 space-y-2 ${
                    isLowConfidence(candidate.confidence)
                      ? "border-amber-400/35 bg-amber-500/10"
                      : "border-white/[0.08] bg-white/[0.02]"
                  }`}
                  data-testid={`profile-import-candidate-${candidate.localId}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <Checkbox
                      isSelected={candidate.selected}
                      onValueChange={(next) => {
                        setImportCandidates((prev) =>
                          prev.map((item) => (item.localId === candidate.localId ? { ...item, selected: next } : item))
                        );
                      }}
                    >
                      导入此条
                    </Checkbox>
                    <Chip
                      size="sm"
                      variant="flat"
                      className={isLowConfidence(candidate.confidence) ? "bg-amber-500/20 text-amber-100" : "bg-white/10 text-white/70"}
                    >
                      置信度 {Math.round(candidate.confidence * 100)}%
                    </Chip>
                  </div>

                  {isLowConfidence(candidate.confidence) && (
                    <div className="text-[11px] text-amber-200/95">
                      该候选条目置信度偏低，建议逐项核对后再导入。
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-2">
                    <select
                      value={candidate.sectionType}
                      onChange={(event) => {
                        const nextType = normalizeProfileCategoryKey(event.target.value);
                        setImportCandidates((prev) =>
                          prev.map((item) =>
                            item.localId === candidate.localId
                              ? { ...item, sectionType: nextType, categoryLabel: resolveProfileCategoryLabel(nextType, localCustomCategories[nextType]) }
                              : item
                          )
                        );
                      }}
                      className="h-10 rounded-md bg-white/[0.03] border border-white/[0.1] px-3 text-sm text-white/85"
                    >
                      {categoryOptions.map((item) => (
                        <option key={item.key} value={item.key} className="text-black">{item.label}</option>
                      ))}
                    </select>

                    <Input
                      size="sm"
                      variant="bordered"
                      value={candidate.title}
                      onValueChange={(nextTitle) => {
                        setImportCandidates((prev) =>
                          prev.map((item) => (item.localId === candidate.localId ? { ...item, title: nextTitle } : item))
                        );
                      }}
                      classNames={{ inputWrapper: "bg-white/[0.02] border-white/[0.08]" }}
                    />
                  </div>

                  <Textarea
                    size="sm"
                    variant="bordered"
                    minRows={2}
                    value={String(candidate.contentJson?.bullet || "")}
                    onValueChange={(nextBullet) => {
                      setImportCandidates((prev) =>
                        prev.map((item) =>
                          item.localId === candidate.localId
                            ? { ...item, contentJson: { ...(item.contentJson || {}), bullet: nextBullet } }
                            : item
                        )
                      );
                    }}
                    classNames={{ inputWrapper: "bg-white/[0.02] border-white/[0.08]" }}
                  />
                </div>
              ))
            )}
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setImportModalOpen(false)}>取消</Button>
            <Button color="primary" startContent={<CheckCircle2 size={14} />} isLoading={importingToDb} isDisabled={selectedImportCount === 0} onPress={() => void confirmImportCandidates()}>
              导入 {selectedImportCount} 条
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </motion.div>
  );
}
