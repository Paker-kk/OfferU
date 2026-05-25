// Extracts metadata from a visible native element + container context
// Uses label-resolver.ts for multi-strategy label resolution
import type { ControlType, FrameworkHint, FieldOption, ScannedField } from "../core/types.js";
import type { PageStructureConfig } from "../ats/adapters/adapter.interface.js";
import { resolveLabelCandidates, resolveModuleNameForField, improveLabel } from "./label-resolver.js";
import { detectControlType, detectFrameworkHint } from "./complex-control-detector.js";
import { aggregateNearbyText } from "./nearby-text-aggregator.js";
import { resolveFieldStructure } from "./page-structure-extractor.js";
import { normalizeText } from "../shared/text-utils.js";
import { escapeCssString } from "../shared/dom-utils.js";

interface ExtractionOptions {
  labelSelector?: string;
  containerSelector?: string;
  sectionSelector?: string;
  pageStructure?: PageStructureConfig;
}

function cleanLabel(text: string): string {
  return text
    .replace(/[:：*]\s*$/, "")
    .replace(/（必填）|\(必填\)|必填/g, "")
    .replace(/^\s*(请输入|请选择|请填写)\s*/, "")
    .trim();
}

function readControlPlaceholder(element: HTMLElement): string {
  const direct = (element as HTMLInputElement).placeholder?.trim() || "";
  if (direct) return direct;
  try {
    const input = element.querySelector("input[placeholder], textarea[placeholder]") as HTMLInputElement | HTMLTextAreaElement | null;
    return input?.placeholder?.trim() || "";
  } catch {
    return "";
  }
}

// --- Container detection ---

function findContainer(el: HTMLElement): HTMLElement | null {
  let current = el.parentElement;
  for (let depth = 0; current && depth < 6; depth++, current = current.parentElement) {
    const cls = String(current.className || "");
    // Match form-item, field, row, cell classes
    if (/(?:form|field|item|row|cell|control)[-_]?(?:item|row|group|wrapper|container)?/i.test(cls)
      && current.querySelector("label, [class*=label], [class*=Label]")) {
      // Must contain a label-like element
    }
    if (/form-item|formItem|field|form-row|formRow|form-group|formGroup/i.test(cls)
      || /el-form-item|ant-form-item|arco-form-item/i.test(cls)) {
      return current;
    }
    // td/th is a natural container
    if (/^(td|th)$/i.test(current.tagName)) return current;
  }
  return el.parentElement;
}

// --- Text extraction ---

function getTextWithoutControls(node: HTMLElement, skipEl?: HTMLElement): string {
  if (!node) return "";
  const clone = node.cloneNode(true) as HTMLElement;
  // Remove control elements from clone
  const controls = clone.querySelectorAll(
    "input, select, textarea, button, svg, script, style, [aria-hidden=true],"
    + "[role=combobox], [role=listbox], [role=radiogroup]",
  );
  controls.forEach((c) => c.remove());
  // Remove the target element if it's in the clone
  if (skipEl && clone.contains(skipEl)) {
    const skipClone = clone.querySelector(`[id="${escapeCssString(skipEl.id || "")}"]`);
    if (skipClone) skipClone.remove();
  }
  return normalizeText(clone.textContent || "");
}

// --- Control type ---


// --- Options ---

function extractOptions(element: HTMLElement): FieldOption[] {
  const opts: FieldOption[] = [];
  if (element.tagName === "SELECT") {
    for (const opt of Array.from((element as HTMLSelectElement).options)) {
      opts.push({ text: opt.text.trim(), value: opt.value, selected: opt.selected });
    }
  }
  if ((element as HTMLInputElement).type === "radio") {
    const name = (element as HTMLInputElement).name;
    if (name) {
      const siblings = document.querySelectorAll(`input[type=radio][name="${escapeCssString(name)}"]`);
      for (const sib of Array.from(siblings)) {
        const label = (sib as HTMLElement).closest("label");
        const text = label?.textContent?.trim() || (sib as HTMLInputElement).value || "";
        if (text) opts.push({ text, value: (sib as HTMLInputElement).value || text, selected: (sib as HTMLInputElement).checked });
      }
    }
  }
  return opts;
}

// --- Section context inference ---

const SECTION_KEYWORDS: Array<{ section: string; keywords: RegExp[] }> = [
  { section: "教育经历", keywords: [/教育经历/, /学校/, /专业/, /学历/, /学位/, /毕业/, /学制/, /gpa/i, /绩点/] },
  { section: "实习经历", keywords: [/实习经历/, /实习公司/, /实习岗位/, /实习生/] },
  { section: "工作经历", keywords: [/工作经历/, /公司名称/, /工作单位/, /所属部门/, /工作职责/, /离职原因/] },
  { section: "项目经历", keywords: [/项目经历/, /项目名称/, /项目角色/, /项目链接/, /本人职责/] },
  { section: "基本信息", keywords: [/基本信息/, /个人信息/, /联系方式/, /姓名/, /手机/, /邮箱/, /证件/] },
  { section: "语言能力", keywords: [/语言/, /外语/, /雅思/, /托福/, /CET/i, /四六级/] },
  { section: "证书", keywords: [/证书/, /认证/, /资格证/] },
  { section: "获奖情况", keywords: [/奖项/, /荣誉/, /获奖/, /奖励/] },
  { section: "求职意向", keywords: [/求职意向/, /期望职位/, /期望薪资/, /工作城市/] },
  { section: "家庭信息", keywords: [/家庭/, /亲属/, /家属/, /紧急联系人/] },
  { section: "技能", keywords: [/技能/, /掌握/, /擅长/] },
  { section: "校园经历", keywords: [/校园/, /社团/, /学生会/, /志愿/] },
];

function resolveSectionText(element: HTMLElement): string {
  const headingSelector = "h2, h3, h4, h5, h6, legend, [role=heading], .section-title, .module-title, .card-title, .ant-card-head-title";

  // Step 1: Try to find explicit heading text in ancestor hierarchy
  let current: HTMLElement | null = element.parentElement;
  for (let depth = 0; current && depth < 10; depth++, current = current.parentElement) {
    try {
      const heading = current.querySelector(headingSelector);
      if (heading && heading !== current && !heading.contains(element)) {
        const text = normalizeText(heading.textContent || "");
        if (text && text.length >= 2 && text.length <= 80) return text;
      }
    } catch { /* ignore */ }
    if (current.tagName === "FIELDSET") {
      const legend = current.querySelector("legend");
      if (legend && !legend.contains(element)) {
        const text = normalizeText(legend.textContent || "");
        if (text) return text;
      }
    }
  }

  // Step 2: Infer from nearby label + nearbyText using keyword patterns
  const container = findContainer(element);
  const contextText = container ? normalizeText(getTextWithoutControls(container)) : "";
  const label = normalizeText((element as HTMLInputElement).placeholder || element.getAttribute("aria-label") || element.getAttribute("name") || "");

  const combined = (contextText + " " + label).toLowerCase();
  for (const rule of SECTION_KEYWORDS) {
    if (rule.keywords.some((kw) => kw.test(combined))) {
      return rule.section;
    }
  }

  return "";
}

// --- Main extract ---

export function extractField(
  element: HTMLElement,
  options?: ExtractionOptions,
): ScannedField | null {
  if (!element.isConnected) return null;

  // Use label-resolver's multi-strategy resolution (replaces custom label collection)
  const candidates = resolveLabelCandidates(element, {
    labelSelector: options?.labelSelector,
    containerSelector: options?.containerSelector,
  });
  const filtered = candidates.filter((c) => c.text && c.text.length > 1);
  filtered.sort((a, b) => b.score - a.score);
  const best = filtered[0];
  const rawLabel = best?.text || "";
  const labelSource = best?.source || "";
  const improvedLabel = improveLabel(rawLabel, labelSource, filtered, element);
  const label = cleanLabel(improvedLabel);

  // Module/section
  const structure = resolveFieldStructure(element, options?.pageStructure, label);
  const moduleName = structure.level1Title || resolveModuleNameForField(element, label);
  const semanticLabel = structure.level2Title || label;

  // Control type — use complex-control-detector for full coverage
  const frameworkHint = detectFrameworkHint(element);
  const controlType = detectControlType(element, frameworkHint);

  // Options
  const fieldOptions = extractOptions(element);

  // Required
  const isRequired =
    element.getAttribute("aria-required") === "true"
    || (element as HTMLInputElement).required === true
    || element.hasAttribute("required")
    || /\*|（必填）|(必填)|required/i.test(label);

  // Nearby text — comprehensive context aggregation
  const nearbyText = aggregateNearbyText(element);

  // Container for group signature
  const container = findContainer(element);

  // Placeholder and name
  const placeholder = readControlPlaceholder(element);
  const name = (element as HTMLInputElement).name?.trim() || element.getAttribute("name")?.trim() || "";

  // Group signature
  const groupSignature = buildGroupSig(element, controlType, container);

  // Canonical key
  const canonicalKey = [moduleName, semanticLabel, controlType, structure.repeatGroupIndex || ""].filter(Boolean).join("::");

  return {
    fieldId: "",
    element,
    cssPath: "",
    controlType,
    frameworkHint,
    label,
    labelSource,
    semanticLabel,
    moduleName,
    level1Title: structure.level1Title,
    level2Title: structure.level2Title,
    repeatGroupIndex: structure.repeatGroupIndex,
    structureToken: structure.structureToken,
    qualifiedLabel: structure.qualifiedLabel,
    canonicalKey,
    placeholder,
    name,
    options: fieldOptions,
    isRequired,
    nearbyText: nearbyText.slice(0, 420),
    groupSignature,
    structuralHash: "",
    qualityScore: 0,
    runtime: {
      writable: !(element as HTMLInputElement).disabled
        && !(element as HTMLInputElement).readOnly
        && element.getAttribute("aria-disabled") !== "true",
    },
  };
}

function buildGroupSig(el: HTMLElement, controlType: ControlType, container: HTMLElement | null): string {
  if (controlType === "radio" || controlType === "checkbox") {
    const n = (el as HTMLInputElement).name;
    if (n) return `group:${n}`;
  }
  if (container) {
    const section = container.closest("[class*=section], [class*=module], [class*=card], fieldset");
    if (section) {
      const h = section.querySelector("h2, h3, h4, h5, legend, [class*=title]");
      if (h) return `section:${normalizeText(h.textContent || "").slice(0, 40)}`;
    }
  }
  return "default";
}

const REPEAT_ITEM_SELECTORS = [
  ".ant-card", ".ant-collapse-item",
  ".el-card", ".el-collapse-item",
  ".arco-card",
  ".t-card",
  "[class*=resume-item]", "[class*=experience-item]",
  "[class*=list-item]", "[class*=record-item]",
  "[class*=card-item]", "[class*=resume-block]",
  "[class*=applyFormModuleWrapper]",
];

const CONTROL_SELECTOR_FOR_COUNT = [
  'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="image"]):not([type="file"])',
  "textarea", "select",
  '[contenteditable="true"]', '[role="textbox"]', '[role="combobox"]',
].join(",");

let repeatCandidateCache = new WeakMap<HTMLElement, boolean>();

export function resetFieldExtractorCaches(): void {
  repeatCandidateCache = new WeakMap<HTMLElement, boolean>();
}

export function findRepeatItemRoot(element: HTMLElement): HTMLElement | null {
  if (!element) return null;

  for (const selector of REPEAT_ITEM_SELECTORS) {
    try {
      const adapterRoot = element.closest(selector) as HTMLElement | null;
      if (adapterRoot && isRepeatItemRootCandidate(adapterRoot)) {
        return adapterRoot;
      }
    } catch { /* invalid selector */ }
  }

  let current = element.parentElement;
  let best: HTMLElement | null = null;
  for (let depth = 0; current && depth < 8; depth++, current = current.parentElement) {
    if (isRepeatItemRootCandidate(current)) {
      const text = getTextWithoutControls(current);
      if (/家庭|社会关系|亲属/.test(text)) return current;
      best = current;
    }
  }
  return best;
}

function isRepeatItemRootCandidate(root: HTMLElement | null): boolean {
  if (!root) return false;
  const cached = repeatCandidateCache.get(root);
  if (cached !== undefined) return cached;
  const controls = Array.from(root.querySelectorAll(CONTROL_SELECTOR_FOR_COUNT))
    .filter((el) => {
      const htmlEl = el as HTMLElement;
      const style = window.getComputedStyle(htmlEl);
      if (style.display === "none" || style.visibility === "hidden") return false;
      const rect = htmlEl.getBoundingClientRect();
      return rect.width > 0 || rect.height > 0;
    });
  const result = controls.length >= 2 && controls.length <= 24;
  repeatCandidateCache.set(root, result);
  return result;
}

export const __FieldExtractorInternals = {
  cleanLabel,
  findContainer,
  getTextWithoutControls,
  findRepeatItemRoot,
  isRepeatItemRootCandidate,
  resetFieldExtractorCaches,
};
