import { simulateInput, simulateChange, simulateFocus, simulateBlur } from "./event-simulator.js";
import { normalizeText } from "../shared/text-utils.js";
import { detectRichTextEditor } from "./rich-text-detector.js";

export async function writeRichTextValue(
  element: HTMLElement,
  value: string,
): Promise<boolean> {
  if (!element.isConnected) return false;

  try {
    try { element.scrollIntoView({ block: "center", behavior: "smooth" }); } catch { /* ignore */ }

    const editor = detectRichTextEditor(element);

    if (editor) {
      editor.focus();
      const success = editor.setContent(value);
      if (success) {
        simulateInput(element, value);
        simulateChange(element);
        simulateBlur(element);
        return verifyContent(editor.getContent(), value);
      }
    }

    simulateFocus(element);

    if (/<[a-z][\s\S]*>/i.test(value)) {
      element.innerHTML = value;
    } else {
      element.textContent = value;
    }

    simulateInput(element, value);
    simulateChange(element);
    simulateBlur(element);

    const current = normalizeText(element.textContent || "");
    const expected = normalizeText(value);
    return current.length > 0
      && (current.includes(expected.slice(0, 10)) || expected.includes(current.slice(0, 10)));
  } catch {
    return false;
  }
}

function verifyContent(actual: string, expected: string): boolean {
  const normalizedActual = normalizeText(actual);
  const normalizedExpected = normalizeText(expected);
  if (!normalizedActual) return false;
  if (normalizedActual.includes(normalizedExpected.slice(0, 10))) return true;
  if (normalizedExpected.includes(normalizedActual.slice(0, 10))) return true;

  const stripHtml = (s: string) => s.replace(/<[^>]+>/g, "").trim();
  const plainActual = normalizeText(stripHtml(actual));
  const plainExpected = normalizeText(stripHtml(expected));
  return plainActual.length > 0
    && (plainActual.includes(plainExpected.slice(0, 10)) || plainExpected.includes(plainActual.slice(0, 10)));
}

export const __RichTextWriterInternals = {
  verifyContent,
};
