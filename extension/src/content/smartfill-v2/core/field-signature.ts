// Field structure fingerprinting for AI cache keys
import type { ScannedField } from "./types.js";

export function normalizeCacheText(text: string): string {
  return text
    .replace(/^(请|请输入|请选择|请填写|请确认|请提供)\s*/g, "")
    .replace(/[*★●◆▸►▪].*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

export function computeFieldSignature(field: ScannedField): string {
  const parts: string[] = [
    normalizeCacheText(field.label || ""),
    field.controlType,
    field.placeholder?.slice(0, 30) || "",
    field.name?.slice(0, 30) || "",
    ...field.options.slice(0, 8).map((o) => o.text.slice(0, 20)).sort(),
    field.isRequired ? "1" : "0",
    field.moduleName?.slice(0, 30) || "",
  ];
  return simpleHash(parts.join("|"));
}

export function computePageSignature(fields: ScannedField[]): string {
  const signatures = fields
    .map((f) => computeFieldSignature(f))
    .sort();
  return simpleHash(signatures.join(","));
}

export function buildCacheKey(
  host: string,
  fields: Pick<ScannedField, "label" | "controlType" | "placeholder" | "name" | "options" | "isRequired" | "moduleName">[],
): string {
  const parts = fields.map((f) => computeFieldSignature(f as ScannedField)).sort();
  return `${host}:${simpleHash(parts.join(","))}`;
}

export const __FieldSignatureInternals = {
  normalizeCacheText,
  simpleHash,
};
