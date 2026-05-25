// Multi-strategy field-to-intent classification engine
import type { ScannedField, IntentMatch } from "./types.js";
import { classifyFieldBucket, getEligibleIntents } from "./semantic-buckets.js";
import { findGroupByText } from "./equality-groups.js";
import { textMatchScore, compactText, expandMatchVariants } from "../shared/text-utils.js";
import { MATCH } from "../shared/constants.js";

export type IntentAliasMap = Record<string, string>;

function tryAliasMatch(
  label: string,
  aliases: IntentAliasMap,
): IntentMatch | null {
  const normalized = compactText(label).toLowerCase();
  for (const [pattern, intent] of Object.entries(aliases)) {
    const patNorm = compactText(pattern).toLowerCase();
    if (normalized === patNorm || normalized.includes(patNorm) || patNorm.includes(normalized)) {
      return { intent, confidence: MATCH.atsAliasConfidence, strategy: "ats-alias" };
    }
  }
  return null;
}

function tryEqualityGroup(label: string): IntentMatch[] {
  const results: IntentMatch[] = [];
  const group = findGroupByText(label);
  if (group) {
    results.push({
      intent: group.intent,
      confidence: MATCH.equalityGroupConfidence,
      strategy: "equality-group",
    });
  }
  return results;
}

function trySemanticBucket(label: string, controlType: string, context: string): IntentMatch[] {
  const bucket = classifyFieldBucket(label, controlType, context);
  const intents = getEligibleIntents(bucket);
  return intents.map((intent) => ({
    intent,
    confidence: MATCH.semanticBucketConfidence,
    strategy: "semantic-bucket" as const,
  }));
}

const GENERIC_PATTERNS: Array<{
  regex: RegExp;
  intent: string;
  moduleHint?: RegExp;
}> = [
  { regex: /[(（]年.*月.*日[)）]|起止.*时间|开始.*结束/, intent: "time_range", moduleHint: /教育|学校|学历|学习/ },
  { regex: /[(（]年.*月.*日[)）]|起止.*时间|开始.*结束/, intent: "work_time_range", moduleHint: /工作|公司|企业/ },
  { regex: /描述|说明|内容|详情|description|content|detail/i, intent: "description_text" },
  { regex: /自我评价|个人简介|自我介绍|about.me/i, intent: "summary" },
  { regex: /上传|upload|附件|简历文件/i, intent: "file_upload" },
  { regex: /城市|地点|地区|location/i, intent: "city" },
  { regex: /薪资|年薪|月薪|salary|期望薪资/i, intent: "expected_salary" },
  { regex: /职位|岗位|应聘|apply.*for/i, intent: "expected_position" },
];

function tryGenericRegex(
  label: string,
  moduleContext: string,
): IntentMatch[] {
  const results: IntentMatch[] = [];
  const combined = label + " " + (moduleContext || "");
  for (const rule of GENERIC_PATTERNS) {
    if (rule.regex.test(label)) {
      if (rule.moduleHint && !rule.moduleHint.test(combined)) continue;
      results.push({
        intent: rule.intent,
        confidence: MATCH.genericRegexConfidence,
        strategy: "regex",
        moduleContext,
      });
    }
  }
  return results;
}

export function resolveFieldIntent(
  field: ScannedField,
  adapterAliases: IntentAliasMap,
  moduleContext?: string,
): IntentMatch[] {
  const ctx = moduleContext || field.moduleName || "";
  const rawLabel = field.semanticLabel || field.label || "";
  const results: IntentMatch[] = [];

  // Layer 1: ATS adapter aliases (exact match)
  const aliasMatch = tryAliasMatch(rawLabel, adapterAliases);
  if (aliasMatch) results.push(aliasMatch);

  // Layer 2: Equality group matching
  results.push(...tryEqualityGroup(rawLabel));

  // Layer 3: Semantic bucket classification
  results.push(...trySemanticBucket(rawLabel, field.controlType, ctx));

  // Layer 4: Generic regex patterns
  results.push(...tryGenericRegex(rawLabel, ctx));

  // Prioritize matches that include module context
  for (const r of results) {
    if (r.moduleContext && ctx && r.moduleContext === ctx) {
      r.confidence += MATCH.moduleContextBonus;
    }
    // Bonus if field is required
    if (field.isRequired) {
      r.confidence += MATCH.requiredFieldBonus;
    }
  }

  // Deduplicate by intent, keep highest confidence
  const seen = new Map<string, IntentMatch>();
  for (const r of results) {
    const existing = seen.get(r.intent);
    if (!existing || r.confidence > existing.confidence) {
      seen.set(r.intent, r);
    }
  }

  return Array.from(seen.values()).sort((a, b) => b.confidence - a.confidence);
}

export const __IntentResolverInternals = {
  tryAliasMatch,
  tryEqualityGroup,
  trySemanticBucket,
  tryGenericRegex,
  GENERIC_PATTERNS,
};
