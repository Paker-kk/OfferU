// Multi-stage write recovery strategies
import type { ScannedField, RecoveryStep, WriteResult } from "../core/types.js";
import { simulateClick } from "./event-simulator.js";
import { normalizeText } from "../shared/text-utils.js";
import { WRITE } from "../shared/constants.js";
import { escapeCssString } from "../shared/dom-utils.js";

interface RecoveryOptions {
  enableCssPathRecovery?: boolean;
  enableMetadataRefind?: boolean;
  enableEditScopeRecovery?: boolean;
  enableSpecializedControlRetry?: boolean;
}

export async function writeWithRecovery(
  field: ScannedField,
  value: string,
  writeFn: (f: ScannedField) => Promise<boolean>,
  options?: RecoveryOptions,
): Promise<{ success: boolean; recoveryPath: RecoveryStep[]; effectiveField: ScannedField }> {
  const recoveryPath: RecoveryStep[] = [];
  let effectiveField = { ...field };

  // Step 1: DIRECT - try writing to the original element
  recoveryPath.push("direct");
  if (await writeFn(effectiveField)) {
    return { success: true, recoveryPath, effectiveField };
  }

  // Step 2: CSS_PATH - re-find element via stored CSS path
  if (options?.enableCssPathRecovery !== false && field.cssPath) {
    recoveryPath.push("cssPath");
    try {
      const found = document.querySelector(field.cssPath) as HTMLElement;
      if (found && found.isConnected) {
        effectiveField = { ...field, element: found };
        if (await writeFn(effectiveField)) {
          return { success: true, recoveryPath, effectiveField };
        }
      }
    } catch { /* selector parse error */ }
  }

  // Step 3: METADATA_REFIND - search by label/name/placeholder
  if (options?.enableMetadataRefind !== false) {
    recoveryPath.push("metadata-refind");
    const found = await refindFieldByMetadata(field);
    if (found) {
      effectiveField = { ...field, element: found };
      if (await writeFn(effectiveField)) {
        return { success: true, recoveryPath, effectiveField };
      }
    }
  }

  // Step 4: OPEN_EDIT_SCOPE - click edit buttons in parent containers
  if (options?.enableEditScopeRecovery !== false) {
    recoveryPath.push("open-edit-scope");
    const expanded = await expandEditScope(field.element);
    if (expanded) {
      const found = await refindFieldByMetadata(field);
      if (found) {
        effectiveField = { ...field, element: found };
        if (await writeFn(effectiveField)) {
          return { success: true, recoveryPath, effectiveField };
        }
      }
    }
  }

  // Step 5: SPECIALIZED_CONTROL - mark as needing special handling
  if (options?.enableSpecializedControlRetry !== false) {
    recoveryPath.push("specialized-control");
  }

  return { success: false, recoveryPath, effectiveField };
}

async function refindFieldByMetadata(field: ScannedField): Promise<HTMLElement | null> {
  const label = normalizeText(field.semanticLabel || field.label);
  const placeholder = normalizeText(field.placeholder);
  const name = normalizeText(field.name);
  const cssClass = field.controlType;

  // Search for elements with matching label/placeholder/name
  const candidates = document.querySelectorAll(
    "input:not([type=hidden]), textarea, select, [contenteditable=true], [role=combobox]",
  );

  let best: HTMLElement | null = null;
  let bestScore = 0;

  for (const c of candidates) {
    const el = c as HTMLElement;
    if (!isElementVisible(el)) continue;

    const elLabel = normalizeText(
      (el as HTMLInputElement).placeholder
      || el.getAttribute("aria-label")
      || el.getAttribute("name")
      || el.id
      || "",
    );

    let score = 0;
    if (label && elLabel === label) score += 50;
    if (label && elLabel.includes(label)) score += 30;
    if (placeholder && elLabel === placeholder) score += 40;
    if (name && elLabel === name) score += 30;

    const nearbyLabel = findNearbyLabel(el);
    if (label && nearbyLabel && nearbyLabel.includes(label)) score += 25;

    if (score > bestScore) {
      bestScore = score;
      best = el;
    }
  }

  return bestScore >= 30 ? best : null;
}

async function expandEditScope(element: HTMLElement): Promise<boolean> {
  const editLabels = ["编辑", "修改", "edit", "expand", "展开"];
  const container = element.closest("[class*=card], [class*=item], [class*=section]");
  if (!container) return false;

  const buttons = container.querySelectorAll("button, [role=button], a.btn");
  for (const btn of buttons) {
    const text = (btn.textContent || "").trim().toLowerCase();
    if (editLabels.some((l) => text.includes(l))) {
      try {
        simulateClick(btn as HTMLElement);
        await sleep(200);
        return true;
      } catch { /* ignore */ }
    }
  }
  return false;
}

function isElementVisible(el: HTMLElement): boolean {
  const rect = el.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function findNearbyLabel(element: HTMLElement): string | null {
  const id = element.id;
  if (id) {
    const label = document.querySelector(`label[for="${escapeCssString(id)}"]`);
    if (label) return normalizeText(label.textContent || "");
  }
  const wrappingLabel = element.closest("label");
  if (wrappingLabel) return normalizeText(wrappingLabel.textContent || "").replace(element.textContent || "", "");
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const __RecoveryInternals = {
  refindFieldByMetadata,
  expandEditScope,
};
