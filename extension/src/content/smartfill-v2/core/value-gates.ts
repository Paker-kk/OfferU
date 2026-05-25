import type { AiValueTransform, ProfileCatalogItem, ProfileEntry, ProfileValueType, ScannedField } from "./types.js";
import { classifyFieldBucket, SemanticBucket } from "./semantic-buckets.js";
import { normalizeText } from "../shared/text-utils.js";

const BUCKET_VALUE_TYPES: Partial<Record<SemanticBucket, ProfileValueType[]>> = {
  [SemanticBucket.PHONE]: ["phone"],
  [SemanticBucket.EMAIL]: ["email"],
  [SemanticBucket.ID_NUMBER]: ["id-number"],
  [SemanticBucket.BIRTH_DATE]: ["date"],
  [SemanticBucket.GRADUATION_DATE]: ["date"],
  [SemanticBucket.EDUCATION_DATE_RANGE]: ["date", "date-range"],
  [SemanticBucket.WORK_DATE_RANGE]: ["date", "date-range"],
  [SemanticBucket.INTERNSHIP_DATE_RANGE]: ["date", "date-range"],
  [SemanticBucket.PROJECT_DATE_RANGE]: ["date", "date-range"],
  [SemanticBucket.GENDER]: ["choice"],
  [SemanticBucket.EDUCATION_LEVEL]: ["choice", "text"],
  [SemanticBucket.DEGREE]: ["choice", "text"],
  [SemanticBucket.GPA]: ["number", "text"],
  [SemanticBucket.SOCIAL_URL]: ["url"],
  [SemanticBucket.LINKEDIN_URL]: ["url"],
  [SemanticBucket.GITHUB_URL]: ["url"],
  [SemanticBucket.WEBSITE]: ["url"],
  [SemanticBucket.PORTFOLIO_URL]: ["url"],
  [SemanticBucket.SKILL]: ["multi-choice", "text", "long-text"],
};

const BUCKET_LABEL_HINTS: Partial<Record<SemanticBucket, RegExp[]>> = {
  [SemanticBucket.ID_NUMBER]: [/身份证|证件|idnumber|identity/i],
  [SemanticBucket.PHONE]: [/手机|电话|phone|mobile|tel/i],
  [SemanticBucket.EMAIL]: [/邮箱|email|mail/i],
  [SemanticBucket.SCHOOL_NAME]: [/学校|院校|school|university/i],
  [SemanticBucket.MAJOR]: [/专业|major/i],
  [SemanticBucket.DEGREE]: [/学位|degree/i],
  [SemanticBucket.EDUCATION_LEVEL]: [/学历|educationlevel|education_level/i],
  [SemanticBucket.COMPANY_NAME]: [/公司|单位|company|employer/i],
  [SemanticBucket.PROJECT_NAME]: [/项目|project/i],
};

export function isCatalogCompatibleWithField(
  field: ScannedField,
  item: ProfileCatalogItem,
  transform?: AiValueTransform,
): boolean {
  const context = [
    field.level1Title,
    field.level2Title,
    field.moduleName,
    field.qualifiedLabel,
    field.nearbyText,
  ].filter(Boolean).join(" ");
  const fieldLabel = field.semanticLabel || field.label || field.placeholder || "";
  const fieldBucket = classifyFieldBucket(fieldLabel, field.controlType, context);

  if (!isValueTypeCompatible(fieldBucket, item.valueType, transform)) {
    return false;
  }

  if (!isShapeCompatible(item.value, item.valueType, transform)) {
    return false;
  }

  if (fieldBucket !== SemanticBucket.CUSTOM && !isSemanticCompatible(fieldBucket, item)) {
    return false;
  }

  return true;
}

export function isProfileEntryCompatibleWithField(
  field: ScannedField,
  entry: ProfileEntry,
): boolean {
  const valueType = entry.valueType || inferEntryValueType(entry);
  const item: ProfileCatalogItem = {
    key: entry.key || entry.path || entry.label,
    path: entry.path || entry.key || entry.label,
    label: entry.label,
    categoryKey: entry.sectionType || "",
    categoryLabel: entry.category || "",
    sectionType: entry.sectionType || "",
    itemIndex: entry.itemIndex,
    value: entry.value,
    valueType,
    aliases: entry.aliases || [],
    sourceRef: entry.subsection || entry.category || "",
    signature: "",
  };
  return isCatalogCompatibleWithField(field, item);
}

export function isShapeCompatible(
  value: string,
  valueType: ProfileValueType,
  transform?: AiValueTransform,
): boolean {
  const finalValue = applyTransform(value, transform);
  const text = String(finalValue || "").trim();
  if (!text) return false;

  switch (valueType) {
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text);
    case "phone":
      return /(?:\+?86[-\s]?)?1[3-9]\d{9}/.test(text) || /^\+?\d[\d\s-]{6,}$/.test(text);
    case "url":
      return /^(https?:\/\/|www\.|[A-Za-z0-9.-]+\.[A-Za-z]{2,}\/?)/.test(text);
    case "id-number":
      return /^(\d{15}|\d{17}[\dXx])$/.test(text);
    case "date":
      return /(?:19|20)\d{2}(?:[-/.年]\s?\d{1,2})?(?:[-/.月]\s?\d{1,2})?/.test(text);
    case "date-range":
      return /(?:19|20)\d{2}/.test(text) && /-|–|—|~|至|到/.test(text);
    case "choice":
      return text.length <= 80;
    case "multi-choice":
      return text.length <= 500;
    case "number":
      return /\d/.test(text);
    default:
      return true;
  }
}

export function applyTransform(value: string, transform?: AiValueTransform): string {
  const text = String(value || "").trim();
  const normalized = normalizeTransform(transform);

  if (normalized.type === "date_part") {
    const match = text.match(/((?:19|20)\d{2})(?:[-/.年]\s?(\d{1,2}))?(?:[-/.月]\s?(\d{1,2}))?/);
    if (!match) return "";
    if (normalized.part === "year") return match[1] || "";
    if (normalized.part === "month") return match[2] ? match[2].padStart(2, "0") : "";
    return match[3] ? match[3].padStart(2, "0") : "";
  }

  if (normalized.type === "phone_part") {
    if (normalized.part === "countryCode") {
      const match = text.match(/^\+?\d{1,4}/);
      return match ? match[0] : "";
    }
    return text.replace(/^\+?\d{1,4}[\s-]*/, "").trim();
  }

  if (normalized.type === "boolean_choice") {
    return /^(true|1|yes|y|是|有|愿意)$/i.test(text) ? normalized.trueValue : normalized.falseValue;
  }

  return text;
}

export function normalizeTransform(transform?: AiValueTransform): AiValueTransform {
  if (!transform || typeof transform !== "object") return { type: "none" };
  if (transform.type === "date_part") {
    return {
      type: "date_part",
      part: ["year", "month", "day"].includes(transform.part) ? transform.part : "year",
    };
  }
  if (transform.type === "phone_part") {
    return {
      type: "phone_part",
      part: transform.part === "countryCode" ? "countryCode" : "nationalNumber",
    };
  }
  if (transform.type === "boolean_choice") {
    return {
      type: "boolean_choice",
      trueValue: String(transform.trueValue ?? "是"),
      falseValue: String(transform.falseValue ?? "否"),
    };
  }
  if (transform.type === "join") {
    return { type: "join", separator: String(transform.separator || ", ") };
  }
  return { type: "none" };
}

function isValueTypeCompatible(
  fieldBucket: SemanticBucket,
  valueType: ProfileValueType,
  transform?: AiValueTransform,
): boolean {
  const transformType = normalizeTransform(transform).type;
  if (transformType === "date_part") return ["date", "date-range", "text"].includes(valueType);
  if (transformType === "phone_part") return ["phone", "text"].includes(valueType);

  const allowed = BUCKET_VALUE_TYPES[fieldBucket];
  if (!allowed || allowed.length === 0) return true;
  return allowed.includes(valueType);
}

function inferEntryValueType(entry: ProfileEntry): ProfileValueType {
  const source = `${entry.label} ${entry.path || entry.key || ""}`.toLowerCase();
  if (/email|邮箱|邮件/.test(source)) return "email";
  if (/phone|mobile|tel|手机|电话|联系方式/.test(source)) return "phone";
  if (/url|link|github|linkedin|website|链接|网址|主页|作品|论文/.test(source)) return "url";
  if (/idnumber|id_number|identity|身份证|证件号|证件号码/.test(source)) return "id-number";
  if (/date|time|日期|时间|入学|毕业|开始|结束|出生|到岗/.test(source)) return "date";
  if (/gender|sex|性别|学历|学位|政治面貌|婚姻|是否|状态|类型/.test(source)) return "choice";
  if (/课程|技能|skills|items|relatedcourses/.test(source)) return "multi-choice";
  if (/gpa|score|rank|height|weight|薪资|分数|成绩|排名/.test(source) && /\d/.test(entry.value)) return "number";
  return "text";
}

function isSemanticCompatible(fieldBucket: SemanticBucket, item: ProfileCatalogItem): boolean {
  const source = normalizeText(`${item.path} ${item.label} ${item.categoryLabel} ${(item.aliases || []).join(" ")}`);
  const hints = BUCKET_LABEL_HINTS[fieldBucket];
  if (hints && hints.some((pattern) => pattern.test(source))) {
    return true;
  }

  if (fieldBucket === SemanticBucket.ID_NUMBER) return false;
  if (fieldBucket === SemanticBucket.PHONE) return false;
  if (fieldBucket === SemanticBucket.EMAIL) return false;
  if (fieldBucket === SemanticBucket.SCHOOL_NAME) return /education|教育|学校|院校/i.test(source);
  if (fieldBucket === SemanticBucket.COMPANY_NAME) return /work|internship|工作|实习|公司|单位/i.test(source);
  if (fieldBucket === SemanticBucket.PROJECT_NAME) return /project|项目/i.test(source);

  return true;
}

export const __ValueGatesInternals = {
  applyTransform,
  normalizeTransform,
  isProfileEntryCompatibleWithField,
  isValueTypeCompatible,
  isSemanticCompatible,
};
