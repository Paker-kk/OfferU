// ARIA accessibility tree analysis for element identification

export interface AriaFieldInfo {
  role: string | null;
  label: string;
  required: boolean;
  invalid: boolean;
  expanded: boolean;
  hasPopup: string | null;
  multiSelectable: boolean;
  valueText: string | null;
  disabled: boolean;
}

export function analyzeAriaAttributes(element: HTMLElement): AriaFieldInfo {
  const label = resolveAriaLabel(element);
  return {
    role: element.getAttribute("role"),
    label,
    required: element.getAttribute("aria-required") === "true",
    invalid: element.getAttribute("aria-invalid") === "true",
    expanded: element.getAttribute("aria-expanded") === "true",
    hasPopup: element.getAttribute("aria-haspopup"),
    multiSelectable: element.getAttribute("aria-multiselectable") === "true",
    valueText: element.getAttribute("aria-valuetext"),
    disabled: element.getAttribute("aria-disabled") === "true"
      || (element as HTMLInputElement).disabled === true,
  };
}

function resolveAriaLabel(element: HTMLElement): string {
  // 1. aria-label
  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel?.trim()) return ariaLabel.trim();

  // 2. aria-labelledby
  const labelledBy = element.getAttribute("aria-labelledby");
  if (labelledBy) {
    const ids = labelledBy.split(/\s+/);
    const texts: string[] = [];
    for (const id of ids) {
      const ref = document.getElementById(id);
      if (ref) {
        const text = ref.textContent?.trim() || ref.getAttribute("aria-label") || "";
        if (text) texts.push(text);
      }
    }
    if (texts.length > 0) return texts.join(" ");
  }

  // 3. aria-describedby fallback
  const describedBy = element.getAttribute("aria-describedby");
  if (describedBy) {
    const ref = document.getElementById(describedBy.split(/\s+/)[0]);
    if (ref) {
      const text = ref.textContent?.trim() || "";
      if (text) return text;
    }
  }

  return "";
}

export function hasAriaPopup(element: HTMLElement): boolean {
  const popup = element.getAttribute("aria-haspopup");
  return popup === "listbox" || popup === "menu" || popup === "dialog" || popup === "true";
}

export function isAriaExpanded(element: HTMLElement): boolean {
  return element.getAttribute("aria-expanded") === "true";
}

export const __AriaAnalyzerInternals = {
  resolveAriaLabel,
};
