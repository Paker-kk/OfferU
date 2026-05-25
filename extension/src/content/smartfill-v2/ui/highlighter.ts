// Pending field highlighter - preserves V1 CSS classes and API
// CSS classes preserved: offeru-smartfill-pending, offeru-smartfill-label-pending,
// offeru-smartfill-label-active, offeru-smartfill-highlight-style
import type { ScannedField } from "../core/types.js";
import { escapeCssString } from "../shared/dom-utils.js";

const PENDING_CLASS = "offeru-smartfill-pending";
const LABEL_PENDING_CLASS = "offeru-smartfill-label-pending";
const LABEL_ACTIVE_CLASS = "offeru-smartfill-label-active";

let highlightStyleEl: HTMLStyleElement | null = null;

function ensureHighlightStyle(): void {
  if (highlightStyleEl) return;
  if (document.querySelector("#offeru-smartfill-highlight-style")) {
    highlightStyleEl = document.querySelector("#offeru-smartfill-highlight-style") as HTMLStyleElement;
    return;
  }
  highlightStyleEl = document.createElement("style");
  highlightStyleEl.id = "offeru-smartfill-highlight-style";
  highlightStyleEl.textContent = `
    .${PENDING_CLASS} {
      outline: 2px solid rgba(239, 68, 68, 0.55) !important;
      outline-offset: 2px !important;
      border-radius: 4px !important;
      transition: outline-color 0.2s ease !important;
    }
    .offeru-smartfill-label-pending {
      color: #dc2626 !important;
      font-weight: 600 !important;
    }
    .offeru-smartfill-label-active {
      color: #b91c1c !important;
      text-decoration: underline !important;
    }
  `;
  document.head.appendChild(highlightStyleEl);
}

export class PendingFieldHighlighter {
  private fields: ScannedField[] = [];
  private unresolved: Set<string> = new Set();
  private currentIdx = 0;
  private labelElements: Map<string, HTMLElement> = new Map();
  private focusedEl: HTMLElement | null = null;

  setPending(fields: ScannedField[]): void {
    this.clear();
    this.fields = [...fields];
    this.currentIdx = 0;
    for (const f of fields) {
      this.unresolved.add(f.fieldId);
    }
    ensureHighlightStyle();
    this.applyHighlights();
  }

  private applyHighlights(): void {
    for (const field of this.fields) {
      try {
        if (field.element.isConnected) {
          field.element.classList.add(PENDING_CLASS);
        }
        const labelEl = this.findLabelElement(field);
        if (labelEl) {
          labelEl.classList.add(LABEL_PENDING_CLASS);
          this.labelElements.set(field.fieldId, labelEl);
        }
      } catch { /* element may be detached */ }
    }
  }

  private findLabelElement(field: ScannedField): HTMLElement | null {
    const el = field.element;
    // Check for wrapping label
    const wrapperLabel = el.closest("label");
    if (wrapperLabel) return wrapperLabel as HTMLElement;

    // Check for <label for="...">
    const id = el.id;
    if (id) {
      try {
        const forLabel = document.querySelector(`label[for="${escapeCssString(id)}"]`);
        if (forLabel) return forLabel as HTMLElement;
      } catch { /* invalid selector */ }
    }

    // Check for framework-specific label
    const container = el.closest("[class*=form-item], [class*=field], td");
    if (container) {
      const labelInContainer = container.querySelector(
        "label, .label, [class*=label], dt, th",
      );
      if (labelInContainer) return labelInContainer as HTMLElement;
    }

    return null;
  }

  clear(): void {
    for (const field of this.fields) {
      try {
        field.element.classList.remove(PENDING_CLASS);
      } catch { /* ignore */ }
    }
    for (const el of this.labelElements.values()) {
      try {
        el.classList.remove(LABEL_PENDING_CLASS, LABEL_ACTIVE_CLASS);
      } catch { /* ignore */ }
    }
    if (this.focusedEl) {
      try { this.focusedEl.classList.remove(LABEL_ACTIVE_CLASS); } catch { /* ignore */ }
    }
    this.fields = [];
    this.unresolved.clear();
    this.labelElements.clear();
    this.currentIdx = 0;
    this.focusedEl = null;
  }

  size(): number {
    return this.fields.length;
  }

  currentIndex(): number {
    return this.fields.length > 0 ? this.currentIdx + 1 : 0;
  }

  unresolvedCount(): number {
    return this.unresolved.size;
  }

  unresolvedFields(): ScannedField[] {
    return this.fields.filter((f) => this.unresolved.has(f.fieldId));
  }

  resolvedFields(): ScannedField[] {
    return this.fields.filter((f) => !this.unresolved.has(f.fieldId));
  }

  focusFirst(): boolean {
    if (this.fields.length === 0) return false;
    // Find first unresolved, or first overall
    const firstUnresolved = this.fields.find((f) => this.unresolved.has(f.fieldId));
    const target = firstUnresolved || this.fields[0];
    this.currentIdx = this.fields.indexOf(target);
    this.scrollToField(target);
    return true;
  }

  focusNext(): void {
    if (this.fields.length === 0) return;
    // Try to find next unresolved
    for (let i = this.currentIdx + 1; i < this.fields.length; i++) {
      if (this.unresolved.has(this.fields[i].fieldId)) {
        this.currentIdx = i;
        this.scrollToField(this.fields[i]);
        return;
      }
    }
    // Wrap around
    const first = this.fields.find((f) => this.unresolved.has(f.fieldId));
    if (first) {
      this.currentIdx = this.fields.indexOf(first);
      this.scrollToField(first);
    }
  }

  focusPrev(): void {
    if (this.fields.length === 0) return;
    for (let i = this.currentIdx - 1; i >= 0; i--) {
      if (this.unresolved.has(this.fields[i].fieldId)) {
        this.currentIdx = i;
        this.scrollToField(this.fields[i]);
        return;
      }
    }
    // Wrap to end
    for (let i = this.fields.length - 1; i >= 0; i--) {
      if (this.unresolved.has(this.fields[i].fieldId)) {
        this.currentIdx = i;
        this.scrollToField(this.fields[i]);
        return;
      }
    }
  }

  focusByFieldId(fieldId: string): boolean {
    const idx = this.fields.findIndex((f) => f.fieldId === fieldId);
    if (idx < 0) return false;
    this.currentIdx = idx;
    this.scrollToField(this.fields[idx]);
    return true;
  }

  private scrollToField(field: ScannedField): void {
    // Clear previous active highlight
    if (this.focusedEl) {
      try { this.focusedEl.classList.remove(LABEL_ACTIVE_CLASS); } catch { /* ignore */ }
    }

    // Highlight label
    const labelEl = this.labelElements.get(field.fieldId);
    if (labelEl) {
      labelEl.classList.add(LABEL_ACTIVE_CLASS);
      this.focusedEl = labelEl;
    }

    // Scroll to element
    try {
      if (field.element.isConnected) {
        field.element.scrollIntoView({ block: "center", behavior: "smooth" });
        // Brief flash on the element
        field.element.style.transition = "box-shadow 0.3s ease";
        field.element.style.boxShadow = "0 0 0 4px rgba(239, 68, 68, 0.3)";
        setTimeout(() => {
          try { field.element.style.boxShadow = ""; } catch { /* ignore */ }
        }, 1500);
      }
    } catch { /* element may be detached */ }
  }

  checklist(): Array<{ field: ScannedField; resolved: boolean }> {
    return this.fields.map((f) => ({
      field: f,
      resolved: !this.unresolved.has(f.fieldId),
    }));
  }
}
