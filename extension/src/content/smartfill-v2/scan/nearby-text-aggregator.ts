import { normalizeText } from "../shared/text-utils.js";
import { escapeCssString } from "../shared/dom-utils.js";

export interface NearbyTextConfig {
  maxLen: number;
  maxAncestorDepth: number;
  includeLabelSources: boolean;
  includeContainerText: boolean;
  includeSiblingText: boolean;
  includeSectionHeading: boolean;
  includePlaceholder: boolean;
  includeNameAttr: boolean;
  includeIdAttr: boolean;
  includeTitleAttr: boolean;
  dedupMinTokenLen: number;
}

const DEFAULT_CONFIG: NearbyTextConfig = {
  maxLen: 420,
  maxAncestorDepth: 3,
  includeLabelSources: true,
  includeContainerText: true,
  includeSiblingText: true,
  includeSectionHeading: true,
  includePlaceholder: true,
  includeNameAttr: true,
  includeIdAttr: true,
  includeTitleAttr: true,
  dedupMinTokenLen: 2,
};

export interface NearbyTextSource {
  text: string;
  source: string;
  priority: number;
}

export function aggregateNearbyText(
  element: HTMLElement,
  config: Partial<NearbyTextConfig> = {},
): string {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const sources: NearbyTextSource[] = [];

  if (cfg.includeLabelSources) {
    collectLabelSources(element, sources);
  }

  if (cfg.includeContainerText) {
    collectContainerText(element, sources, cfg.maxAncestorDepth);
  }

  if (cfg.includeSiblingText) {
    collectSiblingText(element, sources);
  }

  if (cfg.includeSectionHeading) {
    collectSectionHeading(element, sources);
  }

  if (cfg.includePlaceholder) {
    const ph = (element as HTMLInputElement).placeholder?.trim();
    if (ph) sources.push({ text: ph, source: "placeholder", priority: 6 });
  }

  if (cfg.includeNameAttr) {
    const name = (element as HTMLInputElement).name?.trim() || element.getAttribute("name")?.trim();
    if (name) sources.push({ text: name, source: "name", priority: 5 });
  }

  if (cfg.includeIdAttr) {
    const id = element.id?.trim();
    if (id) sources.push({ text: id, source: "id", priority: 4 });
  }

  if (cfg.includeTitleAttr) {
    const title = element.getAttribute("title")?.trim();
    if (title) sources.push({ text: title, source: "title", priority: 5 });
  }

  sources.sort((a, b) => b.priority - a.priority);

  const seen = new Set<string>();
  const parts: string[] = [];

  for (const s of sources) {
    const normalized = normalizeText(s.text);
    if (!normalized || normalized.length < cfg.dedupMinTokenLen) continue;

    const tokens = tokenize(normalized);
    const isDuplicate = tokens.length > 0 && tokens.every((t) => seen.has(t));
    if (isDuplicate) continue;

    for (const t of tokens) seen.add(t);
    parts.push(normalized);
  }

  const joined = parts.join(" | ");
  return joined.slice(0, cfg.maxLen);
}

function collectLabelSources(element: HTMLElement, sources: NearbyTextSource[]): void {
  const aria = element.getAttribute("aria-label")?.trim();
  if (aria) sources.push({ text: aria, source: "aria-label", priority: 10 });

  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    for (const id of labelledBy.split(/\s+/)) {
      const ref = document.getElementById(id);
      if (ref) {
        const text = ref.textContent?.trim() || "";
        if (text) sources.push({ text, source: "aria-labelledby", priority: 10 });
      }
    }
  }

  const elementId = element.id;
  if (elementId) {
    const escapedId = escapeCssString(elementId);
    const labelFor = document.querySelector(`label[for="${escapedId}"]`);
    if (labelFor) {
      const text = getTextWithoutControls(labelFor as HTMLElement);
      if (text) sources.push({ text, source: "label-for", priority: 9 });
    }
  }

  const wrappingLabel = element.closest("label");
  if (wrappingLabel) {
    const text = getTextWithoutControls(wrappingLabel as HTMLElement);
    if (text) sources.push({ text, source: "wrapping-label", priority: 9 });
  }

  const dataLabel = element.getAttribute("data-form-field-i18n-name")
    || element.getAttribute("data-form-field-name")
    || element.getAttribute("data-field-label")
    || element.getAttribute("data-label")
    || element.getAttribute("data-title");
  if (dataLabel?.trim()) {
    sources.push({ text: dataLabel.trim(), source: "data-attr", priority: 8 });
  }
}

function collectContainerText(
  element: HTMLElement,
  sources: NearbyTextSource[],
  maxDepth: number,
): void {
  let current = element.parentElement;
  for (let depth = 0; current && depth < maxDepth; depth++, current = current.parentElement) {
    const cls = String(current.className || "");
    if (!/(?:form|field|item|row|cell|control)[-_]?(?:item|row|group|wrapper|container)?/i.test(cls)
      && !/^(td|th|dd|dt|div)$/i.test(current.tagName)) {
      continue;
    }

    const text = getTextWithoutControls(current, element);
    if (text && text.length >= 2 && text.length <= 500) {
      sources.push({ text, source: `container-L${depth}`, priority: 7 - depth });
    }
  }
}

function collectSiblingText(element: HTMLElement, sources: NearbyTextSource[]): void {
  const container = element.parentElement;
  if (!container) return;

  const prev = element.previousElementSibling;
  if (prev) {
    const text = getTextWithoutControls(prev as HTMLElement);
    if (text && text.length >= 2 && text.length <= 200) {
      sources.push({ text, source: "prev-sibling", priority: 6 });
    }
  }

  for (const child of container.childNodes) {
    if (child === element || child.contains(element)) break;
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent?.trim() || "";
      if (text && text.length >= 2 && text.length <= 100) {
        sources.push({ text, source: "prev-text-node", priority: 5 });
      }
    }
  }
}

function collectSectionHeading(element: HTMLElement, sources: NearbyTextSource[]): void {
  const headingSelector = "h2, h3, h4, h5, h6, legend, [role=heading], .section-title, .module-title";
  let current: HTMLElement | null = element.parentElement;
  for (let depth = 0; current && depth < 6; depth++, current = current.parentElement) {
    const heading = current.querySelector(headingSelector);
    if (heading && !heading.contains(element)) {
      const text = normalizeText(heading.textContent || "");
      if (text && text.length >= 2 && text.length <= 80) {
        sources.push({ text, source: "section-heading", priority: 8 });
        break;
      }
    }
  }
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s|,，;；:：、\/\\]+/)
    .filter((t) => t.length >= 2);
}

function getTextWithoutControls(node: HTMLElement, skipEl?: HTMLElement): string {
  const clone = node.cloneNode(true) as HTMLElement;
  const controls = clone.querySelectorAll(
    "input, select, textarea, button, svg, script, style, [aria-hidden=true],"
    + "[role=combobox], [role=listbox], [role=radiogroup]",
  );
  controls.forEach((c) => c.remove());
  if (skipEl && clone.contains(skipEl)) {
    const skipClone = clone.querySelector(`[id="${escapeCssString(skipEl.id || "")}"]`);
    if (skipClone) skipClone.remove();
  }
  return normalizeText(clone.textContent || "");
}

export const __NearbyTextInternals = {
  collectLabelSources,
  collectContainerText,
  collectSiblingText,
  collectSectionHeading,
  tokenize,
  DEFAULT_CONFIG,
};
