// Field deduplication with quality-based conflict resolution
import type { ScannedField } from "../core/types.js";
import { FIELD_SCAN } from "../shared/constants.js";
import { escapeCssIdentifier } from "../shared/dom-utils.js";

export function scoreFieldQuality(field: ScannedField): number {
  let score = 0;

  const tag = field.element.tagName.toLowerCase();
  const isNative = tag === "input" || tag === "textarea" || tag === "select";
  if (isNative) score += 40;

  // Has meaningful label
  if (field.label && field.label.length >= 2) score += 20;
  else if (field.semanticLabel && field.semanticLabel.length >= 2) score += 12;

  // Inside form-like ancestor
  const form = field.element.closest("form, [role=form]");
  if (form) score += 10;

  // Complex control type
  if (field.controlType !== "input" && field.controlType !== "textarea") score += 8;

  // Has placeholder
  if (field.placeholder?.trim()) score += 8;

  // Has name/id attribute
  if (field.name?.trim() || field.element.id?.trim()) score += 8;

  return Math.max(0, score);
}

let fieldIdCounter = 0;
function generateFieldId(): string {
  fieldIdCounter += 1;
  return `f_${fieldIdCounter}_${Math.random().toString(36).slice(2, 6)}`;
}

function buildCssPath(element: HTMLElement): string {
  const parts: string[] = [];
  let current: HTMLElement | null = element;
  while (current && current !== document.body && parts.length < 5) {
    let segment = current.tagName.toLowerCase();
    if (current.id) {
      segment = `#${escapeCssIdentifier(current.id)}`;
      parts.unshift(segment);
      break;
    }
    if (current.className && typeof current.className === "string") {
      const cls = current.className.trim().split(/\s+/).slice(0, 2).join(".");
      if (cls) segment += `.${escapeCssIdentifier(cls)}`;
    }
    parts.unshift(segment);
    current = current.parentElement;
  }
  return parts.join(" > ");
}

const MAX_REPEAT_OCCURRENCES = 6;

export function deduplicateFields(
  fields: ScannedField[],
  maxCandidates: number = FIELD_SCAN.maxDedupeCandidates,
): ScannedField[] {
  const seen = new Map<string, ScannedField>();
  const occurrenceCounter = new Map<string, number>();

  for (const f of fields) {
    const quality = scoreFieldQuality(f);
    if (quality < 5) continue;

    const baseKey = `${f.structureToken || f.canonicalKey}::${f.groupSignature}`;
    const occ = occurrenceCounter.get(baseKey) || 0;
    occurrenceCounter.set(baseKey, occ + 1);

    const dedupKey = occ < MAX_REPEAT_OCCURRENCES
      ? `${baseKey}::${occ}`
      : baseKey;

    const existing = seen.get(dedupKey);
    if (existing && existing.qualityScore >= quality) continue;

    f.fieldId = generateFieldId();
    f.cssPath = buildCssPath(f.element);
    f.qualityScore = quality;
    seen.set(dedupKey, f);
  }

  return Array.from(seen.values())
    .sort((a, b) => b.qualityScore - a.qualityScore)
    .slice(0, maxCandidates);
}

export function resetFieldIdCounter(): void {
  fieldIdCounter = 0;
}

export const __DeduplicatorInternals = {
  scoreFieldQuality,
  buildCssPath,
};
