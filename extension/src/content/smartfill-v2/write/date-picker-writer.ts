// Date and date-range picker interaction
import type { FrameworkHint } from "../core/types.js";
import { setNativeValue, simulateClick, simulateInput, simulateChange } from "./event-simulator.js";
import { normalizeText } from "../shared/text-utils.js";
import { WRITE } from "../shared/constants.js";

function parseDate(value: string): { year: number; month: number; day: number } | null {
  // Chinese format: 2024年1月15日 / 2024年01月15日
  const cnMatch = value.match(/(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/);
  if (cnMatch) return { year: +cnMatch[1], month: +cnMatch[2], day: +cnMatch[3] };

  // Chinese year-month only: 2024年9月
  const cnYmMatch = value.match(/(\d{4})\s*年\s*(\d{1,2})\s*月/);
  if (cnYmMatch) return { year: +cnYmMatch[1], month: +cnYmMatch[2], day: 1 };

  // Common separators: 2024-01-15 / 2024/01/15 / 2024.01.15
  const sepMatch = value.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);
  if (sepMatch) return { year: +sepMatch[1], month: +sepMatch[2], day: +sepMatch[3] };

  // Year-month only: 2024-09 / 2024/09
  const ymMatch = value.match(/^(\d{4})[-\/](\d{1,2})$/);
  if (ymMatch) return { year: +ymMatch[1], month: +ymMatch[2], day: 1 };

  // Space-separated: 2024 1 15
  const cleaned = value.replace(/[^0-9]/g, " ").trim().split(/\s+/);
  if (cleaned.length >= 3) {
    return { year: +cleaned[0], month: +cleaned[1], day: +cleaned[2] };
  }
  if (cleaned.length === 2) {
    return { year: +cleaned[0], month: +cleaned[1], day: 1 };
  }
  return null;
}

async function pollForDatePanel(maxWaitMs: number = 3000): Promise<HTMLElement | null> {
  const interval = 50;
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const panel = findVisibleDatePanel();
    if (panel) return panel;
    await sleep(interval);
  }
  return findVisibleDatePanel();
}

async function pollForDatePanels(maxWaitMs: number = 3000, minCount: number = 2): Promise<HTMLElement[]> {
  const interval = 50;
  const deadline = Date.now() + maxWaitMs;
  while (Date.now() < deadline) {
    const panels = findAllVisibleDatePanels();
    if (panels.length >= minCount) return panels;
    await sleep(interval);
  }
  return findAllVisibleDatePanels();
}

function normalizeDateString(value: string): string {
  const d = parseDate(value);
  if (!d) return value;
  return `${d.year}-${String(d.month).padStart(2, "0")}-${String(d.day).padStart(2, "0")}`;
}

function prefersMonthPrecision(host: HTMLElement): boolean {
  const label = host.getAttribute("aria-label") || "";
  const placeholder = (host as HTMLInputElement).placeholder || "";
  const combined = (label + " " + placeholder).toLowerCase();
  return /入学|毕业|开始|结束|入职|离职|起始|终止|from|to|start|end/.test(combined);
}

export async function writeDatePickerValue(
  host: HTMLElement,
  value: string,
  framework: FrameworkHint,
): Promise<boolean> {
  if (!host.isConnected) return false;
  const date = parseDate(value);
  if (!date) return false;
  const formatted = normalizeDateString(value);

  try {
    try { host.scrollIntoView({ block: "center", behavior: "smooth" }); } catch { /* ignore */ }

    // Step 1: Try direct/display input write. Many ATS date widgets keep a readonly
    // display input but still react to native setter + input/change events.
    const directInput = resolveDateInput(host);
    const directValue = prefersMonthPrecision(directInput || host)
      ? `${date.year}-${String(date.month).padStart(2, "0")}`
      : formatted;
    if (directInput && !directInput.disabled) {
      setNativeValue(directInput, directValue);
      simulateInput(directInput, directValue);
      simulateChange(directInput);
      await sleep(80);
      const current = directInput.value || directInput.textContent || "";
      if (current.includes(String(date.year)) || current === directValue || current === formatted) return true;
    }

    // Step 2: Open date picker panel
    simulateClick(host);

    const panel = await pollForDatePanel(3000);
    if (!panel) return false;

    // Step 4: Navigate year/month
    await navigateToYearMonth(panel, date.year, date.month);

    // Step 5: Click day cell (skip if month-precision field and day is 1)
    const skipDay = prefersMonthPrecision(host) && date.day === 1;
    if (!skipDay) {
      const dayCell = findDayCell(panel, date.day);
      if (dayCell) {
        simulateClick(dayCell);
        await sleep(80);
      }
    }

    // Step 6: Close panel
    try { document.body.click(); } catch { /* ignore */ }
    await sleep(80);

    // Step 7: Verify displayed value
    const displayed = readDisplayedDateValue(host);
    return displayed.includes(String(date.year))
      || displayed.includes(formatted)
      || displayed.includes(`${date.year}-${String(date.month).padStart(2, "0")}`);
  } catch {
    return false;
  }
}

export async function writeDateRangeValue(
  host: HTMLElement,
  dates: [string, string],
  framework: FrameworkHint,
): Promise<boolean> {
  const start = parseDate(dates[0]);
  const end = parseDate(dates[1]);
  if (!start || !end) return false;

  try {
    try { host.scrollIntoView({ block: "center", behavior: "smooth" }); } catch { /* ignore */ }

    simulateClick(host);

    const panels = await pollForDatePanels(3000, 2);

    if (panels.length >= 2) {
      // Ant Design RangePicker: left panel = start, right panel = end
      await navigateToYearMonth(panels[0], start.year, start.month);
      const startCell = findDayCell(panels[0], start.day);
      if (startCell) simulateClick(startCell);
      await sleep(120);

      await navigateToYearMonth(panels[1], end.year, end.month);
      const endCell = findDayCell(panels[1], end.day);
      if (endCell) simulateClick(endCell);
      await sleep(80);
    } else if (panels.length === 1) {
      // Single panel: select start then end
      await navigateToYearMonth(panels[0], start.year, start.month);
      const startCell = findDayCell(panels[0], start.day);
      if (startCell) simulateClick(startCell);
      await sleep(120);

      await navigateToYearMonth(panels[0], end.year, end.month);
      const endCell = findDayCell(panels[0], end.day);
      if (endCell) simulateClick(endCell);
      await sleep(80);
    }

    try { document.body.click(); } catch { /* ignore */ }
    await sleep(80);

    const displayed = readDisplayedDateValue(host);
    const startStr = String(start.year);
    const endStr = String(end.year);
    return displayed.includes(startStr) || displayed.includes(endStr);
  } catch {
    return false;
  }
}

function findAllVisibleDatePanels(): HTMLElement[] {
  const selector = [
    ".ant-picker-panel", ".ant-picker-panel-container",
    ".el-picker-panel",
    ".arco-picker-panel",
    ".ivu-date-picker-panel", ".ivu-picker-panel",
    ".atsx-picker-panel", ".brick-date-picker-panel",
    ".next-date-picker-panel",
    ".ud__picker-panel", ".throne-biz-date-picker-panel",
    ".semi-datepicker-panel", ".t-date-picker-panel",
    '[class*="picker-panel"]', '[class*="date-picker"]',
  ].join(", ");

  const panels: HTMLElement[] = [];
  try {
    const elements = document.querySelectorAll(selector);
    for (const el of elements) {
      const htmlEl = el as HTMLElement;
      const rect = htmlEl.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) panels.push(htmlEl);
    }
  } catch { /* ignore */ }
  panels.sort((a, b) => a.getBoundingClientRect().left - b.getBoundingClientRect().left);
  return panels;
}

function findVisibleDatePanel(): HTMLElement | null {
  const selector = [
    ".ant-picker-dropdown:not(.ant-picker-dropdown-hidden)",
    ".ant-picker-panel",
    ".el-picker-panel",
    ".el-date-picker",
    ".arco-picker-panel",
    ".kuma-calendar-picker-panel",
    ".kuma-calendar-panel",
    ".ivu-date-picker-panel",
    ".ivu-picker-panel",
    ".atsx-picker-panel",
    ".brick-date-picker-panel",
    ".next-date-picker-panel",
    ".ud__picker-panel",
    ".throne-biz-date-picker-panel",
    ".throne-biz-date-range-picker-panel",
    ".semi-datepicker-panel",
    ".t-date-picker-panel",
    '[class*="picker-panel"]',
    '[class*="date-picker"]',
    '[class*="calendar"]',
    '[role="dialog"]',
  ].join(", ");

  try {
    const panels = document.querySelectorAll(selector);
    for (const p of panels) {
      const el = p as HTMLElement;
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) return el;
    }
  } catch { /* ignore */ }

  return null;
}

async function navigateToYearMonth(
  panel: HTMLElement,
  targetYear: number,
  targetMonth: number,
): Promise<void> {
  // Strategy 1: Try clicking year header to enter year selection
  const yearBtn = panel.querySelector(
    '[class*="year"], .ant-picker-year-btn, .el-date-picker__header-label,'
    + ' .ivu-picker-panel-year-btn, .next-date-picker-year-btn,'
    + ' .ud__picker-year-btn, .throne-biz-date-picker-year-btn',
  ) as HTMLElement;
  if (yearBtn) simulateClick(yearBtn);
  await sleep(80);

  // Find and click target year in year panel
  const yearCell = findCellByText(panel, String(targetYear));
  if (yearCell) {
    simulateClick(yearCell);
    await sleep(80);

    // Click target month
    const monthCell = findCellByText(
      panel,
      `${targetMonth}月`,
    ) || findCellByText(panel, getMonthAbbr(targetMonth));
    if (monthCell) {
      simulateClick(monthCell);
      await sleep(80);
    }
    return;
  }

  // Strategy 2: Use prev/next arrows to navigate (more robust)
  const prev = panel.querySelector(
    '[class*="prev"], .ant-picker-header-prev-btn, button[class*="left"]',
  ) as HTMLElement;
  const next = panel.querySelector(
    '[class*="next"], .ant-picker-header-next-btn, button[class*="right"]',
  ) as HTMLElement;

  for (let i = 0; i < 36; i++) {
    const currentYearText = panel.textContent || "";
    const yearMatch = currentYearText.match(/(\d{4})/);
    if (!yearMatch) break;
    const currentYear = +yearMatch[1];
    if (currentYear === targetYear) break;

    if (currentYear > targetYear && prev) {
      simulateClick(prev);
      await sleep(50);
    } else if (currentYear < targetYear && next) {
      simulateClick(next);
      await sleep(50);
    } else {
      break;
    }
  }

  // Now select the month
  const monthCell = findCellByText(
    panel,
    `${targetMonth}月`,
  ) || findCellByText(panel, getMonthAbbr(targetMonth));
  if (monthCell) {
    simulateClick(monthCell);
    await sleep(80);
  }
}

function findDayCell(panel: HTMLElement, day: number): HTMLElement | null {
  const dayStr = String(day);
  const dateArea = panel.querySelector(
    '[class*="body"], [class*="content"], [class*="date"], tbody, [role="grid"],'
    + ' .ivu-picker-panel-body, .next-date-picker-body,'
    + ' .ud__picker-content, .throne-biz-date-picker-body',
  ) || panel;
  const candidates = dateArea.querySelectorAll(
    "td, li, button, span, div[tabindex], [role=gridcell], [role=option]",
  );

  let best: HTMLElement | null = null;
  let bestArea = Infinity;

  for (const c of candidates) {
    const el = c as HTMLElement;
    const cellText = el.textContent?.trim() || "";
    if (cellText !== dayStr && cellText !== dayStr.replace(/^0+/, "")) continue;

    const parentText = el.parentElement?.textContent?.trim() || "";
    if (parentText.length > 20 && /\d{4}/.test(parentText) && day < 32) {
      const siblingYears = el.parentElement?.querySelectorAll("[class*=year], [class*=Year]");
      if (siblingYears && siblingYears.length > 0) continue;
    }

    const rect = el.getBoundingClientRect();
    const area = rect.width * rect.height;
    if (area > 0 && area < bestArea) {
      bestArea = area;
      best = el;
    }
  }
  return best;
}

function findCellByText(panel: HTMLElement, text: string): HTMLElement | null {
  const candidates = panel.querySelectorAll(
    "td, li, button, span, div[tabindex], [role=gridcell], [role=option]",
  );

  let best: HTMLElement | null = null;
  let bestArea = Infinity;

  for (const c of candidates) {
    const el = c as HTMLElement;
    const cellText = el.textContent?.trim() || "";
    if (cellText === text || cellText === text.replace(/^0+/, "")) {
      const rect = el.getBoundingClientRect();
      const area = rect.width * rect.height;
      if (area > 0 && area < bestArea) {
        bestArea = area;
        best = el;
      }
    }
  }
  return best;
}

function getMonthAbbr(month: number): string {
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return months[month - 1] || "";
}

function readDisplayedDateValue(host: HTMLElement): string {
  const direct = host instanceof HTMLInputElement
    ? host.value
    : "";
  if (direct.trim()) return direct;

  const attrs = [
    host.getAttribute("value"),
    host.getAttribute("data-value"),
    host.getAttribute("aria-valuetext"),
  ].filter(Boolean).join(" ");
  if (attrs.trim()) return attrs;

  const inputs = host.querySelectorAll("input, textarea");
  for (const input of Array.from(inputs)) {
    if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) {
      const value = input.value || input.getAttribute("value") || input.getAttribute("aria-valuetext") || "";
      if (value.trim()) return value;
    }
  }

  return host.textContent || "";
}

function resolveDateInput(host: HTMLElement): HTMLInputElement | HTMLTextAreaElement | null {
  if (host instanceof HTMLInputElement || host instanceof HTMLTextAreaElement) return host;
  try {
    const input = host.querySelector("input, textarea");
    if (input instanceof HTMLInputElement || input instanceof HTMLTextAreaElement) return input;
  } catch { /* ignore */ }
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const __DatePickerWriterInternals = {
  parseDate, normalizeDateString, prefersMonthPrecision,
  findVisibleDatePanel, findAllVisibleDatePanels,
  findDayCell,
  readDisplayedDateValue,
  resolveDateInput,
};
