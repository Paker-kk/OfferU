import type { PageStructureConfig } from "../ats/adapters/adapter.interface.js";
import { WEAK_FIELD_LABELS } from "../core/types.js";
import { normalizeText } from "../shared/text-utils.js";

export interface FieldStructureContext {
  level1Title?: string;
  level2Title?: string;
  repeatGroupIndex?: number;
  structureToken?: string;
  qualifiedLabel?: string;
}

const DEFAULT_HEADING_SELECTOR = [
  "h1", "h2", "h3", "h4", "h5", "h6",
  "legend", "[role=heading]",
  ".section-title", ".module-title", ".card-title",
  ".ant-card-head-title", ".tab-title",
].join(",");

const DEFAULT_FIELD_LABEL_SELECTOR = [
  "label",
  "[class*=label]", "[class*=Label]",
  ".form-item__text", ".field-label", ".label-content",
  "[class*=title]", "[class*=Title]",
  "dt", "th",
].join(",");

let queryCache = new WeakMap<ParentNode, Map<string, HTMLElement[]>>();

export function resetStructureQueryCache(): void {
  queryCache = new WeakMap<ParentNode, Map<string, HTMLElement[]>>();
}

export function resolveFieldStructure(
  element: HTMLElement,
  config?: PageStructureConfig,
  fallbackLabel = "",
): FieldStructureContext {
  const level1Title = findLevel1Title(element, config);
  const level2Title = refineWeakTitle(
    findLevel2Title(element, config) || fallbackLabel,
    element,
  );
  const repeatGroupIndex = findRepeatGroupIndex(element, config);
  const qualifiedLabel = buildQualifiedLabel(level1Title, level2Title, repeatGroupIndex);
  const structureToken = buildStructureToken(level1Title, level2Title, repeatGroupIndex);

  return {
    level1Title: level1Title || undefined,
    level2Title: level2Title || undefined,
    repeatGroupIndex: repeatGroupIndex || undefined,
    structureToken: structureToken || undefined,
    qualifiedLabel: qualifiedLabel || undefined,
  };
}

export function cleanStructureText(text: string): string {
  return normalizeText(text)
    .replace(/^[*★●◆▸►■☐☑✓✔✗✘\s]+/, "")
    .replace(/[（(][^）)]*[）)]/g, "")
    .replace(/（必填）|\(必填\)|必填|可选|选填/g, "")
    .replace(/^(添加|新增|删除|编辑|修改)\s*/g, "")
    .replace(/[:：*]\s*$/, "")
    .trim()
    .slice(0, 80);
}

export function findLevel1Title(element: HTMLElement, config?: PageStructureConfig): string {
  const explicit = findNearestPrecedingText(element, config?.level1Selector);
  if (explicit) return explicit;

  let current: HTMLElement | null = element.parentElement;
  for (let depth = 0; current && depth < 10; depth++, current = current.parentElement) {
    const heading = queryFirstIn(current, DEFAULT_HEADING_SELECTOR, element);
    if (heading) {
      const text = cleanStructureText(heading.textContent || "");
      if (isUsefulStructureText(text)) return text;
    }
    if (current.tagName === "FIELDSET") {
      const legend = current.querySelector("legend");
      const text = cleanStructureText(legend?.textContent || "");
      if (isUsefulStructureText(text)) return text;
    }
  }
  return "";
}

export function findLevel2Title(element: HTMLElement, config?: PageStructureConfig): string {
  const configured = findNearestLocalLabel(element, config?.level2Selector);
  if (configured) return configured;

  const fallback = findNearestLocalLabel(element, DEFAULT_FIELD_LABEL_SELECTOR);
  if (fallback) return fallback;

  const placeholder = (element as HTMLInputElement).placeholder || "";
  const cleaned = cleanPromptPrefix(placeholder);
  return isUsefulStructureText(cleaned) ? cleaned : "";
}

export function pickNearestLabelByGeometry(
  element: HTMLElement,
  candidates: HTMLElement[],
): HTMLElement | null {
  const targetRect = element.getBoundingClientRect();
  let best: HTMLElement | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const candidate of candidates) {
    if (!candidate.isConnected || candidate.contains(element)) continue;
    const text = cleanStructureText(candidate.textContent || "");
    if (!isUsefulStructureText(text)) continue;
    const rect = candidate.getBoundingClientRect();
    if (!hasUsableBox(candidate, rect)) continue;

    const verticalGap = Math.max(0, targetRect.top - rect.bottom);
    const horizontalGap = Math.abs(targetRect.left - rect.left);
    const isAbove = rect.bottom <= targetRect.top + 8;
    const isLeft = rect.right <= targetRect.left + 24
      && Math.abs(rect.top - targetRect.top) <= Math.max(36, targetRect.height * 2);
    const sameLine = Math.abs(rect.top - targetRect.top) <= 16;
    if (!isAbove && !isLeft && !sameLine) continue;

    const score = (isLeft ? 0 : 30) + verticalGap * 2 + horizontalGap * 0.25;
    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

export function findRepeatGroupIndex(element: HTMLElement, config?: PageStructureConfig): number {
  if (!config?.groupSelector) return 0;
  const group = closestBySelector(element, config.groupSelector);
  if (!group) return 0;

  const allGroups = safeQueryAll(document, config.groupSelector);
  const sameBand = filterGroupsInSameModule(element, group, allGroups, config);
  const ordered = sameBand.length > 0 ? sameBand : allGroups;
  const index = ordered.indexOf(group);
  if (index < 0) return 0;
  return config.reverseGroupOrder ? ordered.length - index : index + 1;
}

function findNearestPrecedingText(element: HTMLElement, selector?: string): string {
  if (!selector) return "";
  const candidates = safeQueryAll(document, selector);
  const targetTop = element.getBoundingClientRect().top;
  let best: HTMLElement | null = null;
  let bestTop = Number.NEGATIVE_INFINITY;

  for (const candidate of candidates) {
    if (candidate.contains(element)) continue;
    const text = cleanStructureText(candidate.textContent || "");
    if (!isUsefulStructureText(text)) continue;
    const rect = candidate.getBoundingClientRect();
    if (!hasUsableBox(candidate, rect)) continue;
    if (rect.top <= targetTop + 2 && rect.top >= bestTop) {
      best = candidate;
      bestTop = rect.top;
    }
  }

  return best ? cleanStructureText(best.textContent || "") : "";
}

function findNearestLocalLabel(element: HTMLElement, selector?: string): string {
  if (!selector) return "";
  const candidates: HTMLElement[] = [];
  let current: HTMLElement | null = element.parentElement;

  for (let depth = 0; current && depth < 12; depth++, current = current.parentElement) {
    candidates.push(...safeQueryAll(current, selector).filter((item) => item !== element));
    if (candidates.length > 0) {
      const picked = pickNearestLabelByGeometry(element, candidates);
      if (picked) return cleanStructureText(picked.textContent || "");
    }
  }

  return "";
}

function filterGroupsInSameModule(
  element: HTMLElement,
  group: HTMLElement,
  groups: HTMLElement[],
  config: PageStructureConfig,
): HTMLElement[] {
  if (!config.level1Selector) {
    const parent = group.parentElement;
    return groups.filter((item) => item.parentElement === parent);
  }

  const headings = safeQueryAll(document, config.level1Selector);
  const targetTop = element.getBoundingClientRect().top;
  let start = Number.NEGATIVE_INFINITY;
  let end = Number.POSITIVE_INFINITY;

  for (const heading of headings) {
    const rect = heading.getBoundingClientRect();
    if (rect.top <= targetTop + 2 && rect.top > start) start = rect.top;
    if (rect.top > targetTop + 2 && rect.top < end) end = rect.top;
  }

  return groups.filter((item) => {
    const top = item.getBoundingClientRect().top;
    return top >= start && top < end;
  });
}

function buildQualifiedLabel(
  level1Title: string,
  level2Title: string,
  repeatGroupIndex: number,
): string {
  const parts: string[] = [];
  if (level1Title) parts.push(level1Title);
  if (repeatGroupIndex > 0) parts.push(`第${repeatGroupIndex}条`);
  if (level2Title) parts.push(level2Title);
  return parts.join("/");
}

function buildStructureToken(level1Title: string, level2Title: string, repeatGroupIndex: number): string {
  const parts = [level1Title, repeatGroupIndex > 0 ? String(repeatGroupIndex) : "", level2Title];
  return parts.some(Boolean) ? parts.join("&&&") : "";
}

function refineWeakTitle(title: string, element: HTMLElement): string {
  const cleaned = cleanStructureText(title);
  if (!WEAK_FIELD_LABELS.test(cleaned)) return cleaned;

  const placeholder = cleanPromptPrefix(readElementPlaceholder(element));
  if (placeholder && placeholder !== cleaned && !WEAK_FIELD_LABELS.test(placeholder)) {
    return `${cleaned}_${placeholder}`;
  }
  return cleaned;
}

function cleanPromptPrefix(text: string): string {
  return cleanStructureText(text.replace(/^(请输入|请选择|请填写|点击选择)\s*/, ""));
}

function readElementPlaceholder(element: HTMLElement): string {
  const direct = (element as HTMLInputElement).placeholder || "";
  if (direct) return direct;
  try {
    const input = element.querySelector("input[placeholder], textarea[placeholder]") as HTMLInputElement | HTMLTextAreaElement | null;
    return input?.placeholder || "";
  } catch {
    return "";
  }
}

function queryFirstIn(root: HTMLElement, selector: string, target: HTMLElement): HTMLElement | null {
  for (const item of safeQueryAll(root, selector)) {
    if (item === root || item.contains(target)) continue;
    return item;
  }
  return null;
}

function closestBySelector(element: HTMLElement, selector: string): HTMLElement | null {
  try {
    return element.closest(selector) as HTMLElement | null;
  } catch {
    return null;
  }
}

function safeQueryAll(root: ParentNode, selector: string): HTMLElement[] {
  let rootCache = queryCache.get(root);
  if (!rootCache) {
    rootCache = new Map<string, HTMLElement[]>();
    queryCache.set(root, rootCache);
  }
  const cached = rootCache.get(selector);
  if (cached) return cached;
  try {
    const result = Array.from(root.querySelectorAll(selector)) as HTMLElement[];
    rootCache.set(selector, result);
    return result;
  } catch {
    rootCache.set(selector, []);
    return [];
  }
}

function hasUsableBox(element: HTMLElement, rect = element.getBoundingClientRect()): boolean {
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") return false;
  return rect.width > 0 || rect.height > 0;
}

function isUsefulStructureText(text: string): boolean {
  if (!text) return false;
  if (text.length < 2 || text.length > 80) return false;
  return !/^(请输入|请选择|请填写|select|choose|enter|input)$/i.test(text);
}

export const __PageStructureInternals = {
  cleanStructureText,
  findLevel1Title,
  findLevel2Title,
  pickNearestLabelByGeometry,
  findRepeatGroupIndex,
  buildQualifiedLabel,
  refineWeakTitle,
  readElementPlaceholder,
  resetStructureQueryCache,
};
