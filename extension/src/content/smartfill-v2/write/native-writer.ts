// Native input/textarea/select writing
import type { ScannedField, FieldOption } from "../core/types.js";
import { setNativeValue, simulateInput, simulateChange, simulateFocus, simulateBlur } from "./event-simulator.js";
import { isNoiseValue, normalizeText } from "../shared/text-utils.js";
import { WRITE } from "../shared/constants.js";

export async function writeNativeInput(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string,
  field: ScannedField,
): Promise<boolean> {
  if (!element || !element.isConnected) return false;
  if (element.disabled || element.readOnly) return false;

  try {
    // Scroll into view
    try { element.scrollIntoView({ block: "center", behavior: "smooth" }); } catch { /* ignore */ }

    // Focus and set value
    simulateFocus(element);
    setNativeValue(element, value);

    // Dispatch events
    simulateInput(element, value);
    simulateChange(element);
    simulateBlur(element);

    // Wait for framework reaction
    await sleep(WRITE.verificationDelayMs);

    // Verify
    const currentValue = readInputValue(element);
    return fuzzyMatch(currentValue, value);
  } catch {
    return false;
  }
}

export async function writeNativeSelect(
  element: HTMLSelectElement,
  value: string,
  options: FieldOption[],
): Promise<boolean> {
  if (!element || !element.isConnected) return false;
  if (element.disabled) return false;

  try {
    try { element.scrollIntoView({ block: "center", behavior: "smooth" }); } catch { /* ignore */ }

    // Try direct value match first
    const normalized = normalizeText(value).toLowerCase();
    let bestIndex = -1;
    let bestScore = 0;

    for (let i = 0; i < element.options.length; i++) {
      const opt = element.options[i];
      if (isNoiseValue(opt.text)) continue; // skip placeholder options

      const optText = normalizeText(opt.text).toLowerCase();
      const optValue = normalizeText(opt.value).toLowerCase();

      // Exact match
      if (optText === normalized || optValue === normalized) {
        bestIndex = i;
        break;
      }

      // Contains match
      if (optText.includes(normalized) || normalized.includes(optText)) {
        const score = Math.min(normalized.length, optText.length) / Math.max(normalized.length, optText.length);
        if (score > bestScore) {
          bestScore = score;
          bestIndex = i;
        }
      }

      // Fuzzy match (lower priority)
      if (bestScore < 0.5 && (optText.includes(normalized.slice(0, 3)) || normalized.includes(optText.slice(0, 3)))) {
        const score = 0.4;
        if (score > bestScore) {
          bestScore = score;
          bestIndex = i;
        }
      }
    }

    if (bestIndex < 0) {
      // Try setting value directly (for framework-managed selects)
      simulateFocus(element);
      setNativeValue(element, value);
      simulateChange(element);
      simulateBlur(element);
      await sleep(WRITE.verificationDelayMs);
      return element.value !== "";
    }

    element.selectedIndex = bestIndex;
    simulateFocus(element);
    simulateChange(element);
    simulateBlur(element);
    await sleep(WRITE.verificationDelayMs);

    return true;
  } catch {
    return false;
  }
}

function readInputValue(element: HTMLInputElement | HTMLTextAreaElement): string {
  try {
    const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
    if (proto?.get) return proto.get.call(element) || "";
  } catch { /* ignore */ }
  return element.value || "";
}

function fuzzyMatch(actual: string, expected: string): boolean {
  const a = normalizeText(actual);
  const e = normalizeText(expected);
  if (!a || !e) return false;
  if (a === e) return true;
  if (a.includes(e) || e.includes(a)) return true;
  return a.replace(/[-/\s]/g, "") === e.replace(/[-/\s]/g, "");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const __NativeWriterInternals = {
  readInputValue,
  fuzzyMatch,
};
