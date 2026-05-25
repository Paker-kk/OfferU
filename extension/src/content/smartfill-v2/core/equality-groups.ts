// 28+ match alias groups with multi-language support
import { normalizeText } from "../shared/text-utils.js";

export interface EqualityGroup {
  groupId: string;
  intent: string;
  aliases: string[];
}

const GROUPS: EqualityGroup[] = [
  { groupId: "gender_male", intent: "gender", aliases: ["男", "男性", "Male", "M", "先生", "1", "Man", "boy"] },
  { groupId: "gender_female", intent: "gender", aliases: ["女", "女性", "Female", "F", "女士", "0", "Woman", "girl"] },
  { groupId: "degree_bachelor", intent: "degree", aliases: ["本科", "学士", "Bachelor", "B.S.", "B.A.", "BSc", "BA", "大学本科"] },
  { groupId: "degree_master", intent: "degree", aliases: ["硕士", "硕士研究生", "Master", "M.S.", "M.A.", "MSc", "MA", "MBA"] },
  { groupId: "degree_phd", intent: "degree", aliases: ["博士", "博士研究生", "Ph.D.", "PhD", "Doctor", "博士及以上"] },
  { groupId: "degree_associate", intent: "degree", aliases: ["大专", "专科", "Associate", "A.A.", "A.S."] },
  { groupId: "edu_fulltime", intent: "education_type", aliases: ["统招全日制", "全日制", "Full-time", "Full Time", "统招"] },
  { groupId: "edu_parttime", intent: "education_type", aliases: ["非全日制", "Part-time", "Part Time", "在职", "业余", "函授"] },
  { groupId: "yes", intent: "boolean_true", aliases: ["是", "Yes", "Y", "有", "True", "true", "1", "可以", "√", "✓"] },
  { groupId: "no", intent: "boolean_false", aliases: ["否", "No", "N", "无", "False", "false", "0", "不可以", "×", "✗"] },
  { groupId: "political_party", intent: "political_status", aliases: ["中共党员", "党员", "共产党", "中共", "Party Member"] },
  { groupId: "political_league", intent: "political_status", aliases: ["共青团员", "团员", "共青团", "League Member"] },
  { groupId: "political_masses", intent: "political_status", aliases: ["群众", "人民群众", "无党派", "无党派人士"] },
  { groupId: "marital_married", intent: "marital_status", aliases: ["已婚", "Married", "结婚"] },
  { groupId: "marital_single", intent: "marital_status", aliases: ["未婚", "Single", "单身", "Never Married"] },
  { groupId: "marital_divorced", intent: "marital_status", aliases: ["离异", "Divorced", "离婚"] },
  { groupId: "graduated", intent: "graduation_status", aliases: ["毕业", "已毕业", "Graduated", "往届", "离校"] },
  { groupId: "studying", intent: "graduation_status", aliases: ["应届", "在校", "在读", "即将毕业", "应届毕业生", "Student"] },
  { groupId: "cet4", intent: "language_level", aliases: ["CET-4", "CET4", "四级", "英语四级", "大学英语四级", "CET 4"] },
  { groupId: "cet6", intent: "language_level", aliases: ["CET-6", "CET6", "六级", "英语六级", "大学英语六级", "CET 6"] },
  { groupId: "proficiency_expert", intent: "skill_level", aliases: ["精通", "Expert", "专家", "Advanced", "高级", "流利"] },
  { groupId: "proficiency_good", intent: "skill_level", aliases: ["熟练", "良好", "Proficient", "Good", "熟练使用", "中级"] },
  { groupId: "proficiency_basic", intent: "skill_level", aliases: ["一般", "了解", "Basic", "Beginner", "初级", "入门", "基础"] },
  { groupId: "idtype_idcard", intent: "id_type", aliases: ["身份证", "居民身份证", "ID Card", "二代身份证"] },
  { groupId: "idtype_passport", intent: "id_type", aliases: ["护照", "Passport", "因私护照"] },
  { groupId: "idtype_military", intent: "id_type", aliases: ["军官证", "士兵证", "Military ID"] },
  { groupId: "nation_han", intent: "ethnicity", aliases: ["汉族", "汉", "Han"] },
  { groupId: "blood_a", intent: "blood_type", aliases: ["A型", "A", "Type A"] },
  { groupId: "blood_b", intent: "blood_type", aliases: ["B型", "B", "Type B"] },
  { groupId: "blood_ab", intent: "blood_type", aliases: ["AB型", "AB", "Type AB"] },
  { groupId: "blood_o", intent: "blood_type", aliases: ["O型", "O", "Type O"] },
  { groupId: "nationality_cn", intent: "nationality", aliases: ["中国", "China", "中华人民共和国", "Chinese"] },
  { groupId: "salary_monthly", intent: "salary_type", aliases: ["月薪", "Monthly", "每月"] },
  { groupId: "salary_annual", intent: "salary_type", aliases: ["年薪", "Annual", "每年", "年收入"] },
  { groupId: "worktype_fulltime", intent: "work_type", aliases: ["全职", "Full-time Job", "正式"] },
  { groupId: "worktype_intern", intent: "work_type", aliases: ["实习", "Internship", "Intern"] },
  { groupId: "worktype_parttime", intent: "work_type", aliases: ["兼职", "Part-time Job"] },
];

const aliasIndex = new Map<string, EqualityGroup>();
(function buildIndex() {
  for (const g of GROUPS) {
    for (const alias of g.aliases) {
      const key = normalizeText(alias).toLowerCase();
      if (!aliasIndex.has(key)) aliasIndex.set(key, g);
    }
  }
})();

export function getEqualityGroups(): EqualityGroup[] {
  return GROUPS;
}

export function findGroupByText(text: string): EqualityGroup | null {
  const normalized = normalizeText(text).toLowerCase();
  if (aliasIndex.has(normalized)) return aliasIndex.get(normalized)!;
  for (const [key, group] of aliasIndex) {
    if (normalized.includes(key) || key.includes(normalized)) return group;
  }
  return null;
}

export function expandWithAliases(text: string): string[] {
  const group = findGroupByText(text);
  return group ? group.aliases : [text];
}

export const __EqualityGroupsInternals = { GROUPS, aliasIndex };
