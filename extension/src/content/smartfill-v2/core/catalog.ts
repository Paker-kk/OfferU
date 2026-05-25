import type { NormalizedProfile, ProfileCatalogItem, ProfileEntry, ProfileValueType } from "./types.js";
import { compactText, containsJsonStringFragment, isJsonStringValue, normalizeText } from "../shared/text-utils.js";

const SECTION_TYPE_BY_CATEGORY: Array<[RegExp, string]> = [
  [/教育|学历|学校/i, "education"],
  [/实习/i, "internship"],
  [/工作|经历/i, "work"],
  [/项目|科研/i, "project"],
  [/证书|认证|语言/i, "certificate"],
  [/奖|荣誉/i, "award"],
  [/技能/i, "skill"],
  [/家庭|亲属/i, "family"],
  [/身份|基本|联系/i, "basic"],
];

export function buildProfileCatalog(profile: NormalizedProfile): ProfileCatalogItem[] {
  const items: ProfileCatalogItem[] = [];
  const seen = new Set<string>();

  for (const entry of profile.entries) {
    const value = String(entry.value || "").trim();
    if (!value) continue;
    if (isJsonStringValue(value) || containsJsonStringFragment(value)) continue;

    const path = entry.path || fallbackPathForEntry(entry);
    const key = entry.key || path;
    if (!path || seen.has(key)) continue;
    seen.add(key);

    const categoryLabel = entry.category || "";
    const sectionType = entry.sectionType || inferSectionType(categoryLabel, path);
    const valueType = entry.valueType || inferValueType(entry.label, path, value);
    const aliases = Array.from(new Set([entry.label, ...(entry.aliases || [])].map((item) => normalizeText(item)).filter(Boolean)));

    items.push({
      key,
      path,
      label: entry.label,
      categoryKey: sectionType,
      categoryLabel,
      sectionType,
      itemIndex: entry.itemIndex,
      value,
      valueType,
      aliases,
      sourceRef: entry.sourceRef || `${categoryLabel}${entry.subsection ? `/${entry.subsection}` : ""}/${entry.label}`,
      signature: buildCatalogSignature({
        path,
        label: entry.label,
        categoryLabel,
        itemIndex: entry.itemIndex,
        valueType,
      }),
    });
  }

  return items;
}

export function resolveCatalogItem(
  catalog: ProfileCatalogItem[],
  keyOrPath: string | undefined,
): ProfileCatalogItem | null {
  const needle = String(keyOrPath || "").trim();
  if (!needle) return null;
  return catalog.find((item) => item.key === needle || item.path === needle) || null;
}

export function resolveCatalogValue(
  catalog: ProfileCatalogItem[],
  keyOrPath: string | undefined,
): string {
  return resolveCatalogItem(catalog, keyOrPath)?.value || "";
}

function fallbackPathForEntry(entry: ProfileEntry): string {
  const category = compactText(entry.category || "profile", 80) || "profile";
  const label = compactText(entry.label || "field", 80) || "field";
  const item = entry.itemIndex ? `.${entry.itemIndex - 1}` : "";
  return `legacy.${category}${item}.${label}`;
}

function inferSectionType(categoryLabel: string, path: string): string {
  const source = `${categoryLabel} ${path}`;
  for (const [pattern, type] of SECTION_TYPE_BY_CATEGORY) {
    if (pattern.test(source)) return type;
  }
  return "general";
}

export function inferValueType(label: string, path: string, value: string): ProfileValueType {
  const text = `${label} ${path}`.toLowerCase();
  if (/email|邮箱|邮件/.test(text)) return "email";
  if (/phone|mobile|tel|手机|电话|联系方式/.test(text)) return "phone";
  if (/url|link|github|linkedin|website|链接|网址|主页|作品|论文/.test(text)) return "url";
  if (/idnumber|id_number|identity|身份证|证件号|证件号码/.test(text)) return "id-number";
  if (/date|time|日期|时间|入学|毕业|开始|结束|出生|到岗/.test(text)) {
    return isDateRangeValue(value) ? "date-range" : "date";
  }
  if (/gender|sex|性别|学历|学位|政治面貌|婚姻|是否|状态|类型/.test(text)) return "choice";
  if (/课程|技能|skills|items|relatedcourses/.test(text)) return "multi-choice";
  if (/gpa|score|rank|height|weight|薪资|分数|成绩|排名/.test(text) && /\d/.test(value)) return "number";
  if (value.length > 120 || /description|summary|content|描述|简介|评价|职责|内容/.test(text)) return "long-text";
  return "text";
}

function isDateRangeValue(value: string): boolean {
  const text = String(value || "").trim();
  if (!text) return false;
  const dateToken = String.raw`(?:19|20)\d{2}(?:[-/.年]\s?\d{1,2})?(?:[-/.月]\s?\d{1,2})?`;
  return new RegExp(`${dateToken}\\s*(?:至|到|~|—|–|\\s-\\s)\\s*${dateToken}`).test(text);
}

function buildCatalogSignature(input: {
  path: string;
  label: string;
  categoryLabel: string;
  itemIndex?: number;
  valueType: ProfileValueType;
}): string {
  const payload = [
    input.path,
    input.categoryLabel,
    input.itemIndex ? String(input.itemIndex) : "",
    input.label,
    input.valueType,
  ].join("::");
  let hash = 2166136261;
  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export const __CatalogInternals = {
  inferSectionType,
  inferValueType,
  isDateRangeValue,
  fallbackPathForEntry,
  buildCatalogSignature,
};
