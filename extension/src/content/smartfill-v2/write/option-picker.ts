// Configuration-driven dropdown option collector
// Layer 1: resolveOptionConfig — framework-aware selector config resolver
// Layer 2: collectDropdownOptions — framework-branching option collector with MutationObserver

import type { FrameworkHint } from "../core/types.js";
import type { OptionSelectorConfig } from "../ats/adapters/adapter.interface.js";
import { detectFrameworkHint } from "../scan/complex-control-detector.js";
import { normalizeText } from "../shared/text-utils.js";

export interface DropdownOption {
  text: string;
  element: HTMLElement;
}

export interface ResolvedOptionConfig {
  optionContainerSelector: string;
  optionSelector: string;
  searchInputSelector?: string;
}

// ===== Layer 1: Framework-Aware Config Resolver =====

export function resolveOptionConfig(
  element: HTMLElement,
  adapterConfig?: OptionSelectorConfig,
): ResolvedOptionConfig | null {
  // 1. Adapter-provided config takes priority
  if (adapterConfig?.dropdownSelector && adapterConfig?.optionSelector) {
    return {
      optionContainerSelector: adapterConfig.dropdownSelector,
      optionSelector: adapterConfig.optionSelector,
      searchInputSelector: adapterConfig.searchInputSelector,
    };
  }

  // 2. Framework detection — use framework-specific selectors
  const framework = detectFrameworkHint(element);

  switch (framework) {
    case "antd":
      return {
        optionContainerSelector: ".ant-select-dropdown:not(.ant-select-dropdown-hidden), .ant-picker-dropdown",
        optionSelector: ".ant-select-item-option, .ant-select-item, li[role='option']",
        searchInputSelector: ".ant-select-selection-search-input, .ant-select-search__field",
      };
    case "element-ui":
      return {
        optionContainerSelector: ".el-select-dropdown, .el-dropdown-menu",
        optionSelector: ".el-select-dropdown__item, .el-dropdown-menu__item",
        searchInputSelector: ".el-select__input, .el-input__inner",
      };
    case "arco":
      return {
        optionContainerSelector: ".arco-select-popup, .arco-picker-panel",
        optionSelector: ".arco-select-option, li",
        searchInputSelector: ".arco-select-view-search-input",
      };
    case "kuma":
      return {
        optionContainerSelector: ".kuma-select2-dropdown, .kuma-calendar-picker-panel",
        optionSelector: ".kuma-select2-option, .kuma-calendar-panel-cell",
        searchInputSelector: ".kuma-select2-search-input",
      };
    case "iview":
      return {
        optionContainerSelector: '.ivu-select-dropdown:not([style*="display: none"])',
        optionSelector: ".ivu-select-item, .ivu-cascader-menu-item",
        searchInputSelector: ".ivu-select-input",
      };
    case "atsx":
      return {
        optionContainerSelector: ".atsx-select-dropdown",
        optionSelector: 'li[role="option"]',
        searchInputSelector: ".atsx-select-search input",
      };
    case "brick":
      return {
        optionContainerSelector: "[class*=brick-select-dropdown]",
        optionSelector: "[class*=brick-select-option]",
        searchInputSelector: "[class*=brick-select-search] input",
      };
    case "fusion-next":
      return {
        optionContainerSelector: ".next-select-dropdown, .next-date-picker-panel",
        optionSelector: ".next-select-item, .next-cascader-option",
        searchInputSelector: ".next-select-input",
      };
    case "feishu-ud":
      return {
        optionContainerSelector: ".ud__select__dropdown:not(.ud__select__dropdown-hidden)",
        optionSelector: ".ud__select__list__item",
        searchInputSelector: ".ud__select-search input",
      };
    default:
      // 3. Generic fallback
      return {
        optionContainerSelector: '[class*="dropdown"], [class*="popup"], [class*="select-dropdown"], [role="listbox"]',
        optionSelector: '[role="option"], li, [class*="option"], [class*="item"]',
      };
  }
}

// ===== Layer 2: DropdownObserver — MutationObserver for Dynamic Dropdowns =====

export class DropdownObserver {
  private observer: MutationObserver | null = null;
  private excludePanels: Set<HTMLElement>;
  private newPanels: HTMLElement[] = [];
  private dropdownSelector: string;

  constructor(excludePanels: Set<HTMLElement>, dropdownSelector: string) {
    this.excludePanels = excludePanels;
    this.dropdownSelector = dropdownSelector;
  }

  startObserving(): void {
    this.newPanels = [];
    this.observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (this.excludePanels.has(node)) continue;
          try {
            if (node.matches(this.dropdownSelector)) {
              this.newPanels.push(node);
              continue;
            }
            const match = node.querySelector(this.dropdownSelector);
            if (match instanceof HTMLElement && !this.excludePanels.has(match)) {
              this.newPanels.push(match);
            }
          } catch { /* invalid selector */ }
        }
      }
    });

    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  stopAndCollect(): { panels: HTMLElement[] } {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    return { panels: this.newPanels };
  }
}

// ===== Option Collection Engine =====

export async function collectDropdownOptions(
  element: HTMLElement,
  config?: OptionSelectorConfig,
  options?: {
    shouldRetry?: boolean;
    preselectedContainer?: HTMLElement | null;
    excludePanels?: Set<HTMLElement>;
    maxWaitMs?: number;
  },
): Promise<DropdownOption[]> {
  // Fast path: native HTMLSelectElement
  if (element instanceof HTMLSelectElement) {
    return extractNativeSelectOptions(element);
  }

  const resolved = resolveOptionConfig(element, config);
  if (!resolved) return [];

  const excludePanels = options?.excludePanels || new Set<HTMLElement>();
  const maxWaitMs = options?.maxWaitMs || 800;

  // Step 1: Check for already open dropdown
  let container = findOpenDropdown(element, resolved);
  if (!container && options?.shouldRetry !== false) {
    container = findAnyOpenDropdown(resolved);
  }

  // Step 2: Start MutationObserver if no dropdown found yet
  let observer: DropdownObserver | null = null;
  if (!container && !options?.preselectedContainer) {
    observer = new DropdownObserver(excludePanels, resolved.optionContainerSelector);
    observer.startObserving();
  }

  // Step 3: Wait for DOM to render dropdown
  if (options?.preselectedContainer) {
    container = options.preselectedContainer;
  } else {
    const pollInterval = 50;
    const deadline = Date.now() + maxWaitMs;
    while (!container && Date.now() < deadline) {
      await sleep(pollInterval);
      container = findOpenDropdown(element, resolved);
      if (!container && options?.shouldRetry !== false) {
        container = findAnyOpenDropdown(resolved);
      }
      if (container) break;
    }
  }

  // Step 4: Try MutationObserver results
  if (!container && observer) {
    const { panels } = observer.stopAndCollect();
    if (panels.length > 0) {
      container = pickNearestContainer(element, panels, excludePanels);
    }
  }

  if (observer) {
    observer.stopAndCollect();
    observer = null;
  }

  if (!container) return [];

  // Step 5: Re-select nearest container (with distance + exclude logic)
  if (!options?.preselectedContainer) {
    const allContainers = safeQueryAll(document, resolved.optionContainerSelector);
    container = pickNearestContainer(element, allContainers, excludePanels) || container;
  }

  // Step 6: Extract options from container
  return extractOptionsFromContainer(container, resolved.optionSelector);
}

// ===== Helper Functions =====

function findOpenDropdown(element: HTMLElement, config: ResolvedOptionConfig): HTMLElement | null {
  // Search in ancestors first (for inline dropdowns like Element UI, Feishu UD)
  let current: HTMLElement | null = element.parentElement;
  for (let depth = 0; current && depth < 12; depth++, current = current.parentElement) {
    try {
      const found = current.querySelector(config.optionContainerSelector);
      if (found instanceof HTMLElement && isElementVisible(found)) return found;
    } catch { /* invalid selector */ }
  }
  // Global search (for portal dropdowns like Ant Design)
  return findAnyOpenDropdown(config);
}

function findAnyOpenDropdown(config: ResolvedOptionConfig): HTMLElement | null {
  try {
    const candidates = document.querySelectorAll(config.optionContainerSelector);
    for (const c of candidates) {
      if (c instanceof HTMLElement && isElementVisible(c)) return c;
    }
  } catch { /* invalid selector */ }
  return null;
}

function pickNearestContainer(
  element: HTMLElement,
  containers: HTMLElement[],
  excludePanels: Set<HTMLElement>,
): HTMLElement | null {
  const targetRect = element.getBoundingClientRect();
  let best: HTMLElement | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const container of containers) {
    if (excludePanels.has(container)) continue;
    if (!isElementVisible(container)) continue;
    const rect = container.getBoundingClientRect();
    const dx = Math.max(0, targetRect.left - rect.right, rect.left - targetRect.right);
    const dy = Math.max(0, targetRect.top - rect.bottom, rect.top - targetRect.bottom);
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = container;
    }
  }

  return best;
}

function extractOptionsFromContainer(container: HTMLElement, optionSelector: string): DropdownOption[] {
  const results: DropdownOption[] = [];
  try {
    const elements = container.querySelectorAll(optionSelector);
    for (const el of elements) {
      const htmlEl = el as HTMLElement;
      const rect = htmlEl.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      const text = normalizeText(htmlEl.textContent || "");
      if (text && text.length > 0) {
        results.push({ text, element: htmlEl });
      }
    }
  } catch { /* invalid selector */ }
  // Deduplicate
  const seen = new Set<HTMLElement>();
  return results.filter((r) => {
    if (seen.has(r.element)) return false;
    seen.add(r.element);
    return true;
  });
}

function extractNativeSelectOptions(element: HTMLSelectElement): DropdownOption[] {
  const results: DropdownOption[] = [];
  for (const opt of element.options) {
    const text = normalizeText(opt.textContent || opt.value || "");
    if (text) results.push({ text, element: opt as unknown as HTMLElement });
  }
  return results;
}

function isElementVisible(el: HTMLElement): boolean {
  if (!el.isConnected) return false;
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function safeQueryAll(root: ParentNode, selector: string): HTMLElement[] {
  try {
    return Array.from(root.querySelectorAll(selector)) as HTMLElement[];
  } catch {
    return [];
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const __OptionPickerInternals = {
  resolveOptionConfig,
  findOpenDropdown,
  findAnyOpenDropdown,
  pickNearestContainer,
  extractOptionsFromContainer,
};
