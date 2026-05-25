// Cascading select interaction (province/city/district, department/team)
import type { FrameworkHint } from "../core/types.js";
import { simulateClick, simulateMouseEvent, simulateFocus } from "./event-simulator.js";
import { normalizeText } from "../shared/text-utils.js";
import { WRITE } from "../shared/constants.js";

const CASCADER_MENU_SELECTORS = [
  ".ant-cascader-menu", ".el-cascader-menu", ".arco-cascader-menu",
  ".el-cascader-panel .el-scrollbar__view",
  ".kuma-cascader-menu", ".semi-cascader-list",
  ".t-cascader__menu", ".n-cascader-menu",
  ".ivu-cascader-menu", ".atsx-cascader-menu",
  ".brick-cascader-menu", ".next-cascader-menu",
  ".ud__cascader-menu",
  '[class*="cascader-menu"]', '[class*="cascader-list"]',
];

const CASCADER_OPTION_SELECTORS = [
  ".ant-cascader-menu-item", ".ant-cascader-menu-item-content",
  ".el-cascader-node", ".el-cascader-node__label",
  ".arco-cascader-option",
  ".kuma-cascader-item", ".semi-cascader-option",
  ".t-cascader__item", ".n-cascader-option",
  ".ivu-cascader-menu-item", ".atsx-cascader-option",
  ".brick-cascader-option", ".next-cascader-option",
  ".ud__cascader-option",
  "li", '[class*="cascader-item"]',
];

const CASCADER_CONFIRM_SELECTORS = [
  ".ant-cascader-menu .ant-btn-primary",
  ".ant-cascader-dropdown .ant-btn-primary",
  ".el-cascader__suggestion-panel button",
  ".el-cascader-panel button",
  ".arco-cascader-popup .arco-btn-primary",
  ".semi-cascader button",
  ".t-popup button",
  "[class*=cascader] button[class*=primary]",
  "[class*=cascader] [class*=confirm]",
  "[class*=cascader] [class*=ok]",
  "[role=dialog] button",
];

const TRIGGER_SELECTORS: Record<string, string[]> = {
  antd: [".ant-cascader", ".ant-cascader-picker"],
  "element-ui": [".el-cascader"],
  arco: [".arco-cascader"],
  kuma: [".kuma-cascader"],
  iview: [".ivu-cascader"],
  atsx: [".atsx-cascader"],
  brick: [".brick-cascader"],
  "fusion-next": [".next-cascader"],
  "feishu-ud": [".ud__cascader"],
};

export async function writeCascaderValue(
  host: HTMLElement,
  value: string,
  framework: FrameworkHint,
): Promise<boolean> {
  if (!host.isConnected) return false;
  const segments = parseSegments(value);
  if (segments.length === 0) return false;

  try {
    try { host.scrollIntoView({ block: "center", behavior: "smooth" }); } catch { /* ignore */ }

    // Step 1: Find the correct trigger element (framework container, not the raw input)
    const trigger = findCascaderTrigger(host, framework);
    if (!trigger) return false;

    // Step 2: Open panel with retry
    let panelOpened = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      simulateClick(trigger);
      await sleep(WRITE.datePanelOpenDelayMs);
      if (findMenuColumn(0)) { panelOpened = true; break; }
      // Retry with focus first
      simulateFocus(trigger);
      await sleep(50);
      simulateClick(trigger);
      await sleep(WRITE.datePanelOpenDelayMs);
      if (findMenuColumn(0)) { panelOpened = true; break; }
    }
    if (!panelOpened) return false;

    // Step 3: Navigate each level
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const isLast = i === segments.length - 1;

      await sleep(WRITE.cascaderLevelDelayMs);
      const menu = findMenuColumn(i);
      if (!menu) return false;

      const option = findOptionInMenu(menu, segment);
      if (!option) return false;

      if (framework === "antd" && !isLast) {
        simulateMouseEvent(option, "mouseover");
        simulateMouseEvent(option, "mouseenter");
        await sleep(100);
      } else if ((framework === "element-ui" || framework === "kuma") && !isLast) {
        simulateClick(option);
        await sleep(WRITE.cascaderLevelDelayMs);
      } else {
        simulateClick(option);
        await sleep(WRITE.cascaderLevelDelayMs);
      }
    }

    // Step 4: Close
    await sleep(80);
    clickConfirmIfPresent();
    await sleep(50);
    try { document.body.click(); } catch { /* ignore */ }
    return true;
  } catch {
    return false;
  }
}

function clickConfirmIfPresent(): boolean {
  for (const selector of CASCADER_CONFIRM_SELECTORS) {
    try {
      const buttons = Array.from(document.querySelectorAll(selector)) as HTMLElement[];
      for (const button of buttons) {
        const rect = button.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;
        const text = normalizeText(button.textContent || "");
        if (text && !/确定|确认|完成|ok|submit|apply/i.test(text)) continue;
        simulateClick(button);
        return true;
      }
    } catch { /* ignore */ }
  }
  return false;
}

function findCascaderTrigger(host: HTMLElement, framework: FrameworkHint): HTMLElement | null {
  const selectors = TRIGGER_SELECTORS[framework] || [];
  for (const sel of selectors) {
    const container = host.closest(sel);
    if (container) {
      const trigger = container.querySelector(
        '.ant-cascader-picker-label, .el-input, .arco-cascader-view,'
        + ' .ivu-cascader-label, .next-cascader-label, .ud__cascader-label,'
        + ' [tabindex]',
      ) as HTMLElement;
      return trigger || (container as HTMLElement);
    }
  }
  return host;
}

export function parseSegments(value: string): string[] {
  let text = value.trim();

  // Chinese administrative division: 广东省深圳市南山区 → [广东省, 深圳市, 南山区]
  const adminMatch = text.match(
    /^([一-龥]+(?:省|自治区|特别行政区))([一-龥]+(?:市|地区|自治州))([一-龥]+[区县旗])$/,
  );
  if (adminMatch) return [adminMatch[1], adminMatch[2], adminMatch[3]].filter(Boolean);

  // Split by common separators
  const parts = text.split(/[/\\|｜，,、\-\s]+\s*/).map((s) => s.trim()).filter((s) => s.length > 0);
  if (parts.length > 1) return parts;

  // Single string: try to split by Chinese admin keywords
  const segments: string[] = [];
  const pattern = /[一-龥]+(?:省|市|区|县|旗|镇|乡|街道|自治区|特别行政区|地区|自治州)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    segments.push(match[0]);
  }
  return segments.length > 1 ? segments : parts;
}

function findMenuColumn(index: number): HTMLElement | null {
  const columns: HTMLElement[] = [];
  for (const selector of CASCADER_MENU_SELECTORS) {
    try {
      const elements = document.querySelectorAll(selector);
      for (const el of elements) {
        const htmlEl = el as HTMLElement;
        const rect = htmlEl.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) columns.push(htmlEl);
      }
    } catch { /* ignore */ }
  }
  columns.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
  const unique: HTMLElement[] = [];
  for (const col of columns) {
    const colRect = col.getBoundingClientRect();
    const isDup = unique.some((u) => Math.abs(u.getBoundingClientRect().left - colRect.left) < 5);
    if (!isDup) unique.push(col);
  }
  return unique[index] || null;
}

function findOptionInMenu(menu: HTMLElement, text: string): HTMLElement | null {
  const normalized = normalizeText(text).toLowerCase();
  const options: Array<{ element: HTMLElement; score: number }> = [];
  for (const selector of CASCADER_OPTION_SELECTORS) {
    try {
      const elements = menu.querySelectorAll(selector);
      for (const el of elements) {
        const htmlEl = el as HTMLElement;
        const rect = htmlEl.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) continue;
        const optionText = normalizeText(htmlEl.textContent || "").toLowerCase();
        if (!optionText) continue;
        let score = 0;
        if (optionText === normalized) score = 120;
        else if (optionText.startsWith(normalized)) score = 90;
        else if (optionText.includes(normalized)) score = 70;
        else if (normalized.includes(optionText)) score = 45;
        if (score > 0) options.push({ element: htmlEl, score });
      }
    } catch { /* ignore */ }
  }
  if (options.length === 0) return null;
  options.sort((a, b) => b.score - a.score);
  return options[0].element;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const __CascaderWriterInternals = {
  parseSegments, findCascaderTrigger, findMenuColumn, findOptionInMenu, clickConfirmIfPresent,
  CASCADER_MENU_SELECTORS, CASCADER_OPTION_SELECTORS,
};
