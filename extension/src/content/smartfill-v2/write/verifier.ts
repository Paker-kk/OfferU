// Post-write value verification
import type { MatchCandidate, ScannedField } from "../core/types.js";
import { isShapeCompatible } from "../core/value-gates.js";
import { normalizeText, isNoiseValue, isJsonStringValue } from "../shared/text-utils.js";

export function verifyWrite(field: ScannedField, expectedValue: string, candidate?: MatchCandidate): boolean {
  const actual = readFieldValue(field);
  if (!actual) return false;
  if (isNoiseValue(actual) && !isShortChoiceReadback(field, actual, expectedValue, candidate)) return false;
  if (isJsonStringValue(actual)) return false;
  if (candidate?.valueType && !isShapeCompatible(expectedValue, candidate.valueType, candidate.transform)) return false;

  const normalizedActual = normalizeText(actual);
  const normalizedExpected = normalizeText(expectedValue);

  if (!normalizedActual || !normalizedExpected) return false;

  if (candidate?.valueType && !typedReadbackMatches(normalizedActual, normalizedExpected, candidate.valueType)) {
    return false;
  }

  // Exact match
  if (normalizedActual === normalizedExpected) return true;

  // Contains match
  if (normalizedActual.includes(normalizedExpected)) return true;
  if (normalizedExpected.includes(normalizedActual)) return true;

  // Date format variation
  const actualDate = normalizedActual.replace(/[年月]/g, "-").replace(/日/g, "").trim();
  const expectedDate = normalizedExpected.replace(/[年月]/g, "-").replace(/日/g, "").trim();
  if (actualDate === expectedDate) return true;

  // Multi-select tags
  const actualParts = normalizedActual.split(/[,，、;\s]+/).filter(Boolean);
  const expectedParts = normalizedExpected.split(/[,，、;\s]+/).filter(Boolean);
  if (actualParts.length > 1 && expectedParts.length > 0) {
    const matchCount = expectedParts.filter((ep) =>
      actualParts.some((ap) => ap.includes(ep) || ep.includes(ap)),
    ).length;
    if (matchCount >= expectedParts.length * 0.7) return true;
  }

  return false;
}

function isShortChoiceReadback(
  field: ScannedField,
  actual: string,
  expectedValue: string,
  candidate?: MatchCandidate,
): boolean {
  if (candidate?.valueType !== "choice" && field.controlType !== "radio" && field.controlType !== "checkbox") return false;
  const normalizedActual = normalizeText(actual);
  const normalizedExpected = normalizeText(expectedValue);
  if (!normalizedActual || !normalizedExpected) return false;
  if (normalizedActual.length > 2) return false;
  return normalizedActual === normalizedExpected || normalizedExpected.includes(normalizedActual);
}

function typedReadbackMatches(actual: string, expected: string, valueType: string): boolean {
  if (valueType === "email") {
    return actual.toLowerCase() === expected.toLowerCase();
  }
  if (valueType === "phone") {
    return digits(actual).endsWith(digits(expected)) || digits(expected).endsWith(digits(actual));
  }
  if (valueType === "id-number") {
    return actual.toUpperCase() === expected.toUpperCase();
  }
  if (valueType === "url") {
    return normalizeUrlish(actual) === normalizeUrlish(expected);
  }
  if (valueType === "date" || valueType === "date-range") {
    const actualDates = actual.match(/(?:19|20)\d{2}(?:[-/.年]\s?\d{1,2})?/g) || [];
    const expectedDates = expected.match(/(?:19|20)\d{2}(?:[-/.年]\s?\d{1,2})?/g) || [];
    return expectedDates.length > 0 && expectedDates.every((date) => actualDates.some((item) => normalizeDateToken(item) === normalizeDateToken(date)));
  }
  if (valueType === "choice") {
    return normalizeText(actual).includes(normalizeText(expected)) || normalizeText(expected).includes(normalizeText(actual));
  }
  return true;
}

function digits(value: string): string {
  return value.replace(/\D/g, "");
}

function normalizeUrlish(value: string): string {
  return value.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "");
}

function normalizeDateToken(value: string): string {
  return value.replace(/[年月/.]/g, "-").replace(/日/g, "").replace(/-+/g, "-").replace(/-$/, "");
}

export function readFieldValue(field: ScannedField): string {
  const el = field.element;
  if (!el || !el.isConnected) return "";

  const tag = el.tagName.toLowerCase();
  const controlType = field.controlType;

  const displayInput = field.runtime.displayInput;
  if (displayInput && displayInput.isConnected) {
    const displayValue = displayInput.value || displayInput.getAttribute("value") || "";
    if (displayValue.trim()) return displayValue;
  }

  // Input / Textarea
  if (tag === "input" || tag === "textarea") {
    try {
      const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
      if (proto?.get) return proto.get.call(el) || "";
    } catch { /* ignore */ }
    return (el as HTMLInputElement).value || "";
  }

  // Select
  if (tag === "select") {
    const select = el as HTMLSelectElement;
    if (select.selectedIndex >= 0) {
      return select.options[select.selectedIndex]?.text || select.value || "";
    }
    return select.value || "";
  }

  // ContentEditable
  if (controlType === "rich-text" || (el as HTMLElement).contentEditable === "true") {
    return el.textContent?.trim() || "";
  }

  // Combobox / Complex control
  const valueAttr = el.getAttribute("value") || el.getAttribute("data-value") || "";
  if (valueAttr) return valueAttr;

  const selectedAttr = el.getAttribute("data-offeru-selected-value");
  if (selectedAttr) return selectedAttr;

  const selectedComplex = el.querySelector("[data-offeru-selected-value], [aria-checked=true], [class*=offferu-radio-selected]") as HTMLElement | null;
  if (selectedComplex) {
    const selectedValue = selectedComplex.getAttribute("data-offeru-selected-value") || selectedComplex.textContent?.trim() || "";
    if (selectedValue) return selectedValue;
  }

  // Text content for framework components
  const textContent = el.textContent?.trim() || "";
  if (textContent && textContent.length < 200) return textContent;

  return (el as HTMLInputElement).value || "";
}

export function hasExistingMeaningfulValue(field: ScannedField): boolean {
  const value = readFieldValue(field);
  return !isNoiseValue(value);
}

export const __VerifierInternals = {
  readFieldValue,
  verifyWrite,
  typedReadbackMatches,
  isShortChoiceReadback,
};
