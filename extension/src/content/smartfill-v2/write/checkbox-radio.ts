// Checkbox and radio group handling
import type { ScannedField } from "../core/types.js";
import { expandMatchVariants, normalizeText } from "../shared/text-utils.js";
import { findGroupByText } from "../core/equality-groups.js";
import { simulateClick, simulateChange } from "./event-simulator.js";
import { escapeCssString } from "../shared/dom-utils.js";

export async function writeCheckbox(
  element: HTMLInputElement,
  value: string,
  label: string,
): Promise<boolean> {
  if (!element.isConnected) return false;
  try {
    try { element.scrollIntoView({ block: "center", behavior: "smooth" }); } catch { /* ignore */ }

    const isBoolean = isBooleanValue(value);
    if (isBoolean) {
      const shouldCheck = shouldCheckCheckbox(value, label);
      if (shouldCheck !== element.checked) {
        simulateClick(element);
        if (shouldCheck !== element.checked) {
          element.checked = shouldCheck;
          simulateChange(element);
        }
      }
      return true;
    }

    return writeCheckboxGroup(element, value);
  } catch {
    return false;
  }
}

function isBooleanValue(value: string): boolean {
  const normalized = normalizeText(value).toLowerCase();
  const boolPatterns = [/^是$/, /^yes$/i, /^true$/i, /^y$/i, /^1$/, /^有$/, /^同意$/, /^agree$/i,
    /^否$/, /^no$/i, /^false$/i, /^0$/, /^无$/, /^不同意$/, /^disagree$/i];
  return boolPatterns.some((p) => p.test(normalized));
}

function normalizeCheckboxCandidates(value: string): string[] {
  return value
    .split(/[,，;；\n\r|、\/\\]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

async function writeCheckboxGroup(triggerElement: HTMLInputElement, value: string): Promise<boolean> {
  const candidates = normalizeCheckboxCandidates(value);
  if (candidates.length === 0) return false;

  const name = triggerElement.name;
  const groupContainer = triggerElement.closest("[role=group], [class*=checkbox-group], [class*=check-group], form, body");
  const siblings = name
    ? (groupContainer || document).querySelectorAll(`input[type=checkbox][name="${escapeCssString(name)}"]`)
    : (groupContainer || document).querySelectorAll('input[type=checkbox]');

  let checkedCount = 0;
  for (const input of siblings) {
    const checkbox = input as HTMLInputElement;
    const checkboxLabel = resolveCheckboxLabel(checkbox);
    const checkboxText = normalizeText(checkboxLabel).toLowerCase();

    let matched = false;
    for (const candidate of candidates) {
      const candidateNorm = normalizeText(candidate).toLowerCase();
      if (checkboxText === candidateNorm) {
        matched = true;
        break;
      }
      const groupAliases = findGroupByText(candidate);
      const variants = expandMatchVariants(candidate, groupAliases ? [groupAliases.aliases] : undefined);
      for (const v of variants) {
        if (checkboxText === v || checkboxText.includes(v) || v.includes(checkboxText)) {
          const score = 60 + (Math.min(v.length, checkboxText.length) / Math.max(v.length, 1)) * 20;
          if (score >= 60) { matched = true; break; }
        }
      }
      if (matched) break;
    }

    if (matched && !checkbox.checked) {
      try { checkbox.scrollIntoView({ block: "center", behavior: "smooth" }); } catch { /* ignore */ }
      simulateClick(checkbox);
      if (!checkbox.checked) {
        checkbox.checked = true;
        simulateChange(checkbox);
      }
      checkedCount++;
    }
  }

  return checkedCount > 0;
}

function resolveCheckboxLabel(input: HTMLInputElement): string {
  const ariaLabel = input.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel;

  const wrappingLabel = input.closest("label");
  if (wrappingLabel) return wrappingLabel.textContent?.trim() || "";

  const container = input.closest("[class*=checkbox], [class*=form-item], div");
  if (container) {
    const labelEl = container.querySelector("label, [class*=label], span");
    if (labelEl) return labelEl.textContent?.trim() || "";
  }

  const id = input.id;
  if (id) {
    const labelFor = document.querySelector(`label[for="${escapeCssString(id)}"]`);
    if (labelFor) return labelFor.textContent?.trim() || "";
  }

  return input.value || input.name || "";
}

export async function writeRadioGroup(
  element: HTMLInputElement,
  value: string,
  label: string,
): Promise<boolean> {
  if (!element.isConnected) return false;
  const name = element.name;
  if (!name) return false;

  try {
    // Find all radio inputs in the same group
    const group = element.closest("[role=radiogroup]")
      || element.closest(".radio-group")
      || document;
    const siblings = group.querySelectorAll(`input[type=radio][name="${escapeCssString(name)}"]`);

    const normalized = normalizeText(value).toLowerCase();
    const groupAliases = findGroupByText(value);
    const variants = expandMatchVariants(value, groupAliases ? [groupAliases.aliases] : undefined);

    let bestInput: HTMLInputElement | null = null;
    let bestScore = 0;

    for (const input of siblings) {
      const radio = input as HTMLInputElement;
      const radioLabel = resolveRadioLabel(radio);
      const radioText = normalizeText(radioLabel).toLowerCase();

      // Exact match on label
      if (radioText === normalized) {
        bestInput = radio;
        break;
      }

      // Variant match
      for (const v of variants) {
        if (radioText === v) {
          bestInput = radio;
          bestScore = 100;
          break;
        }
        if (radioText.includes(v) || v.includes(radioText)) {
          const score = 60 + (Math.min(v.length, radioText.length) / Math.max(v.length, 1)) * 20;
          if (score > bestScore) {
            bestScore = score;
            bestInput = radio;
          }
        }
      }
    }

    if (!bestInput) return false;

    try { bestInput.scrollIntoView({ block: "center", behavior: "smooth" }); } catch { /* ignore */ }
    if (!bestInput.checked) {
      simulateClick(bestInput);
      if (!bestInput.checked) {
        bestInput.checked = true;
        simulateChange(bestInput);
      }
    }
    return true;
  } catch {
    return false;
  }
}

export async function writeRadioHost(
  host: HTMLElement,
  value: string,
): Promise<boolean> {
  if (!host.isConnected) return false;
  const options = Array.from(host.querySelectorAll('[role="radio"], .phoenix-radio, .el-radio, .ant-radio-wrapper, .ivu-radio-wrapper')) as HTMLElement[];
  if (options.length === 0 && host.getAttribute("role") !== "radio") return false;

  const candidates = options.length > 0 ? options : [host];
  const normalized = normalizeText(value).toLowerCase();
  const groupAliases = findGroupByText(value);
  const variants = expandMatchVariants(value, groupAliases ? [groupAliases.aliases] : undefined);

  let best: HTMLElement | null = null;
  let bestScore = 0;
  for (const option of candidates) {
    const text = normalizeText(resolveRadioHostLabel(option)).toLowerCase();
    if (!text) continue;
    if (text === normalized) {
      best = option;
      bestScore = 120;
      break;
    }
    for (const variant of variants) {
      if (text === variant) {
        best = option;
        bestScore = 110;
        break;
      }
      if (text.includes(variant) || variant.includes(text)) {
        const score = 60 + (Math.min(variant.length, text.length) / Math.max(variant.length, 1)) * 30;
        if (score > bestScore) {
          bestScore = score;
          best = option;
        }
      }
    }
  }

  if (!best || bestScore < 60) return false;
  try { best.scrollIntoView({ block: "center", behavior: "smooth" }); } catch { /* ignore */ }
  const selected = best.closest(".phoenix-radio, .el-radio, .ant-radio-wrapper, .ivu-radio-wrapper, [role=radio]") as HTMLElement | null || best;
  simulateClick(selected);
  selected.setAttribute("aria-checked", "true");
  selected.classList.add("offferu-radio-selected");
  selected.setAttribute("data-offeru-selected-value", value);
  host.setAttribute("data-offeru-selected-value", value);
  const input = selected.querySelector("input[type=radio]") as HTMLInputElement | null;
  if (input && !input.checked) {
    input.checked = true;
    simulateChange(input);
  }
  return true;
}

function shouldCheckCheckbox(value: string, label: string): boolean {
  const normalized = normalizeText(value).toLowerCase();
  const positivePatterns = [/^是$/, /^yes$/i, /^true$/i, /^y$/i, /^1$/, /^有$/, /^同意$/, /^agree$/i];
  const negativePatterns = [/^否$/, /^no$/i, /^false$/i, /^0$/, /^无$/, /^不同意$/, /^disagree$/i];

  for (const p of positivePatterns) {
    if (p.test(normalized)) return true;
  }
  for (const p of negativePatterns) {
    if (p.test(normalized)) return false;
  }
  return value.trim().length > 0;
}

function resolveRadioLabel(input: HTMLInputElement): string {
  // Check for aria-label
  const ariaLabel = input.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel;

  // Check for wrapping label
  const wrappingLabel = input.closest("label");
  if (wrappingLabel) return wrappingLabel.textContent?.trim() || "";

  // Check for adjacent label
  const container = input.closest("[class*=radio], [class*=form-item], div");
  if (container) {
    const labelEl = container.querySelector("label");
    if (labelEl) return labelEl.textContent?.trim() || "";
  }

  // Check for label with for= attribute
  const id = input.id;
  if (id) {
    const labelFor = document.querySelector(`label[for="${escapeCssString(id)}"]`);
    if (labelFor) return labelFor.textContent?.trim() || "";
  }

  return input.value || input.name || "";
}

function resolveRadioHostLabel(element: HTMLElement): string {
  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel;
  const labelLike = element.querySelector("[class*=radio-text], [class*=label], span");
  if (labelLike?.textContent?.trim()) return labelLike.textContent.trim();
  return element.textContent?.trim() || "";
}

export const __CheckboxRadioInternals = {
  shouldCheckCheckbox,
  isBooleanValue,
  normalizeCheckboxCandidates,
  resolveRadioLabel,
  resolveCheckboxLabel,
  resolveRadioHostLabel,
};
