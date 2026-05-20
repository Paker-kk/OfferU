export type ResumeEditorSectionType =
  | "education"
  | "workExperiences"
  | "internshipExperiences"
  | "projects"
  | "skills"
  | "certificates"
  | "awards"
  | "personalExperiences";

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
  { key: "workExperiences", label: "工作经历" },
  { key: "internshipExperiences", label: "实习经历" },
  { key: "projects", label: "项目经历" },
  { key: "skills", label: "技能" },
  { key: "certificates", label: "证书" },
  { key: "awards", label: "获奖经历" },
  { key: "personalExperiences", label: "个人经历" },
];

const LEGACY_SECTION_TYPE_MAP: Record<string, ResumeEditorSectionType> = {
  education: "education",
  experience: "workExperiences",
  project: "projects",
  skill: "skills",
  certificate: "certificates",
  custom: "personalExperiences",
};

function asText(input: unknown): string {
  return typeof input === "string" ? input.trim() : String(input ?? "").trim();
}

function asTextList(input: unknown): string[] {
  if (Array.isArray(input)) {
    return input.map((item) => asText(item)).filter(Boolean);
  }
  const text = asText(input);
  if (!text) return [];
  return text
    .split(/[，,、\n]/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeDescription(input: unknown): string {
  if (Array.isArray(input)) {
    return input.map((item) => asText(item)).filter(Boolean).join("\n");
  }
  return asText(input);
}

export function getResumeSectionLabel(sectionType: string): string {
  return (
    RESUME_SECTION_DEFINITIONS.find((item) => item.key === sectionType)?.label ||
    "未命名模块"
  );
}

export function normalizeResumeSectionType(sectionType: string): ResumeEditorSectionType {
  if (RESUME_SECTION_DEFINITIONS.some((item) => item.key === sectionType)) {
    return sectionType as ResumeEditorSectionType;
  }
  return LEGACY_SECTION_TYPE_MAP[sectionType] || "personalExperiences";
}

function normalizeEducationItem(item: any): Record<string, any> {
  const row = item && typeof item === "object" ? item : {};
  return {
    ...row,
    school: asText(row.school || row.schoolName),
    degree: asText(row.degree || row.educationLevel),
    major: asText(row.major),
    gpa: asText(row.gpa),
    startDate: asText(row.startDate),
    endDate: asText(row.endDate || row.graduationDate),
    description: normalizeDescription(row.description || row.descriptions),
  };
}

function normalizeWorkItem(item: any): Record<string, any> {
  const row = item && typeof item === "object" ? item : {};
  return {
    ...row,
    company: asText(row.company || row.companyName),
    position: asText(row.position || row.positionName),
    startDate: asText(row.startDate),
    endDate: asText(row.endDate),
    description: normalizeDescription(row.description || row.descriptions),
  };
}

function normalizeInternshipItem(item: any): Record<string, any> {
  const row = item && typeof item === "object" ? item : {};
  return {
    ...row,
    company: asText(row.company || row.companyName),
    position: asText(row.position || row.positionName),
    startDate: asText(row.startDate),
    endDate: asText(row.endDate),
    description: normalizeDescription(row.description || row.descriptions),
  };
}

function normalizeProjectItem(item: any): Record<string, any> {
  const row = item && typeof item === "object" ? item : {};
  return {
    ...row,
    name: asText(row.name || row.projectName),
    role: asText(row.role || row.projectRole),
    url: asText(row.url || row.projectLink),
    startDate: asText(row.startDate),
    endDate: asText(row.endDate),
    description: normalizeDescription(row.description || row.descriptions),
  };
}

function normalizeSkillItem(item: any): Record<string, any> {
  const row = item && typeof item === "object" ? item : {};
  const items = asTextList(row.items);
  const skillName = asText(row.skillName);
  const category = asText(row.category || row.proficiency);
  return {
    ...row,
    category: category || (skillName ? "技能" : ""),
    items: items.length > 0 ? items : skillName ? [skillName] : [],
    remark: asText(row.remark),
  };
}

function normalizeCertificateItem(item: any): Record<string, any> {
  const row = item && typeof item === "object" ? item : {};
  return {
    ...row,
    name: asText(row.name || row.certificateName),
    scoreOrLevel: asText(row.scoreOrLevel),
    issuer: asText(row.issuer),
    date: asText(row.date || row.acquiredAt),
    url: asText(row.url),
  };
}

function normalizeAwardItem(item: any): Record<string, any> {
  const row = item && typeof item === "object" ? item : {};
  return {
    ...row,
    awardName: asText(row.awardName || row.name || row.title),
    issuer: asText(row.issuer),
    awardedAt: asText(row.awardedAt || row.date),
    description: normalizeDescription(row.description || row.descriptions),
  };
}

function normalizePersonalExperienceItem(item: any): Record<string, any> {
  const row = item && typeof item === "object" ? item : {};
  return {
    ...row,
    experienceTitle: asText(row.experienceTitle || row.subtitle || row.title),
    startDate: asText(row.startDate),
    endDate: asText(row.endDate),
    description: normalizeDescription(row.description || row.descriptions),
  };
}

function normalizeSectionItems(type: ResumeEditorSectionType, contentJson: any[]): any[] {
  const list = Array.isArray(contentJson) ? contentJson : [];
  if (type === "education") return list.map((item) => normalizeEducationItem(item));
  if (type === "workExperiences") return list.map((item) => normalizeWorkItem(item));
  if (type === "internshipExperiences") return list.map((item) => normalizeInternshipItem(item));
  if (type === "projects") return list.map((item) => normalizeProjectItem(item));
  if (type === "skills") return list.map((item) => normalizeSkillItem(item));
  if (type === "certificates") return list.map((item) => normalizeCertificateItem(item));
  if (type === "awards") return list.map((item) => normalizeAwardItem(item));
  return list.map((item) => normalizePersonalExperienceItem(item));
}

export function normalizeResumeSectionsForEditor(
  sections: ResumeEditorSection[],
): ResumeEditorSection[] {
  const sorted = [...(sections || [])].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
  );

  return sorted.map((section, index) => {
    const normalizedType = normalizeResumeSectionType(section.section_type);
    return {
      ...section,
      section_type: normalizedType,
      title: section.title || getResumeSectionLabel(normalizedType),
      content_json: normalizeSectionItems(normalizedType, section.content_json),
      sort_order: index,
    };
  });
}
