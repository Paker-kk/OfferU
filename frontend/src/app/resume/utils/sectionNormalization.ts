export type ResumeEditorSectionType =
  | "education"
  | "experience"
  | "project"
  | "skill"
  | "custom";

export interface ResumeEditorSection {
  id: number;
  section_type: string;
  title: string;
  visible: boolean;
  content_json: any[];
  sort_order: number;
}

export const RESUME_SECTION_DEFINITIONS: ReadonlyArray<{
  key: ResumeEditorSectionType;
  label: string;
}> = [
  { key: "education", label: "教育经历" },
  { key: "experience", label: "工作经历" },
  { key: "project", label: "项目经历" },
  { key: "skill", label: "技能与证书" },
  { key: "custom", label: "个人经历" },
];

export function getResumeSectionLabel(sectionType: string): string {
  return (
    RESUME_SECTION_DEFINITIONS.find((item) => item.key === sectionType)?.label ||
    "未命名模块"
  );
}

export function normalizeResumeSectionType(
  sectionType: string
): ResumeEditorSectionType {
  if (sectionType === "certificate") return "skill";
  if (
    sectionType === "education" ||
    sectionType === "experience" ||
    sectionType === "project" ||
    sectionType === "skill" ||
    sectionType === "custom"
  ) {
    return sectionType;
  }
  return "custom";
}

function looksLikeCertificateEntry(item: Record<string, any>): boolean {
  if (item._entryType === "certificate") return true;
  if (item._entryType === "skill") return false;
  return Boolean(
    item.name ||
      item.certificateName ||
      item.issuer ||
      item.date ||
      item.acquiredAt ||
      item.scoreOrLevel
  );
}

function normalizeSkillEntry(item: Record<string, any>): Record<string, any> {
  const rawItems = Array.isArray(item.items)
    ? item.items
    : typeof item.itemsText === "string"
      ? item.itemsText.split(/[，,、\n]/g)
      : [];
  const normalizedItems = rawItems
    .map((entry) => String(entry || "").trim())
    .filter(Boolean);
  return {
    _entryType: "skill",
    category: String(item.category || "").trim(),
    items: normalizedItems,
    _source_profile_section_id: item._source_profile_section_id,
    _source_profile_updated_at: item._source_profile_updated_at,
    _source_profile_category_key: item._source_profile_category_key,
  };
}

function normalizeCertificateEntry(
  item: Record<string, any>
): Record<string, any> {
  return {
    _entryType: "certificate",
    name: String(item.name || item.certificateName || "").trim(),
    scoreOrLevel: String(item.scoreOrLevel || "").trim(),
    issuer: String(item.issuer || "").trim(),
    date: String(item.date || item.acquiredAt || "").trim(),
    url: String(item.url || "").trim(),
    _source_profile_section_id: item._source_profile_section_id,
    _source_profile_updated_at: item._source_profile_updated_at,
    _source_profile_category_key: item._source_profile_category_key,
  };
}

export function normalizeSkillOrCertificateEntry(
  item: any,
  sourceSectionType?: string
): Record<string, any> {
  const raw = item && typeof item === "object" ? (item as Record<string, any>) : {};
  const forcedCertificate = sourceSectionType === "certificate";
  if (forcedCertificate || looksLikeCertificateEntry(raw)) {
    return normalizeCertificateEntry(raw);
  }
  return normalizeSkillEntry(raw);
}

export function normalizeResumeSectionsForEditor(
  sections: ResumeEditorSection[]
): ResumeEditorSection[] {
  const sorted = [...(sections || [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)
  );
  const normalized: ResumeEditorSection[] = [];
  let mergedSkillSection: ResumeEditorSection | null = null;

  for (const section of sorted) {
    const normalizedType = normalizeResumeSectionType(section.section_type);
    const currentContent = Array.isArray(section.content_json)
      ? section.content_json
      : [];

    if (normalizedType === "skill") {
      const nextItems = currentContent.map((item) =>
        normalizeSkillOrCertificateEntry(item, section.section_type)
      );
      if (!mergedSkillSection) {
        mergedSkillSection = {
          ...section,
          section_type: "skill",
          title: "技能与证书",
          content_json: nextItems,
        };
        normalized.push(mergedSkillSection);
      } else {
        mergedSkillSection.content_json = [
          ...(Array.isArray(mergedSkillSection.content_json)
            ? mergedSkillSection.content_json
            : []),
          ...nextItems,
        ];
      }
      continue;
    }

    normalized.push({
      ...section,
      section_type: normalizedType,
      content_json: currentContent,
    });
  }

  return normalized.map((item, index) => ({
    ...item,
    sort_order: index,
  }));
}

export function splitSkillAndCertificateEntries(contentJson: any[]): {
  skills: Record<string, any>[];
  certificates: Record<string, any>[];
} {
  const skills: Record<string, any>[] = [];
  const certificates: Record<string, any>[] = [];
  for (const raw of contentJson || []) {
    const normalized = normalizeSkillOrCertificateEntry(raw);
    if (normalized._entryType === "certificate") {
      certificates.push(normalized);
    } else {
      skills.push(normalized);
    }
  }
  return { skills, certificates };
}
