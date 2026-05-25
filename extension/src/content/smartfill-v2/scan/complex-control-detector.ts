// UI framework component type detection from DOM structure
import type { ControlType, FrameworkHint } from "../core/types.js";

interface FrameworkPattern {
  hint: FrameworkHint;
  classPatterns: RegExp[];
}

const FRAMEWORK_PATTERNS: FrameworkPattern[] = [
  {
    hint: "antd",
    classPatterns: [/ant-select/, /ant-picker/, /ant-cascader/, /ant-input/, /ant-form-item/, /ant-checkbox/, /ant-radio/],
  },
  {
    hint: "element-ui",
    classPatterns: [/el-select/, /el-date-editor/, /el-cascader/, /el-input/, /el-form-item/, /el-checkbox/, /el-radio/],
  },
  {
    hint: "arco",
    classPatterns: [/arco-select/, /arco-picker/, /arco-cascader/, /arco-input/, /arco-form-item/],
  },
  {
    hint: "kuma",
    classPatterns: [/kuma-select/, /kuma-calendar-picker/, /kuma-date-picker/, /kuma-uxform/, /kuma-input/],
  },
  {
    hint: "bootstrap",
    classPatterns: [/form-control/, /form-group/, /form-check/, /input-group/, /bootstrap-select/, /selectpicker/],
  },
  {
    hint: "iview",
    classPatterns: [/ivu-select/, /ivu-date-picker/, /ivu-cascader/, /ivu-input/, /ivu-form-item/, /ivu-checkbox/, /ivu-radio/],
  },
  {
    hint: "atsx",
    classPatterns: [/atsx-select/, /atsx-picker/, /atsx-cascader/, /atsx-input/, /atsx-form-item/],
  },
  {
    hint: "brick",
    classPatterns: [/brick-select/, /brick-date-picker/, /brick-cascader/, /brick-form-item/, /brick-input/],
  },
  {
    hint: "fusion-next",
    classPatterns: [/next-select/, /next-date-picker/, /next-cascader/, /next-form-item/, /next-input/, /next-checkbox/, /next-radio/],
  },
  {
    hint: "feishu-ud",
    classPatterns: [/ud__select/, /ud__picker/, /ud__formily-item/, /ud__cascader/, /ud__checkbox/, /ud__radio/, /throne-biz/],
  },
];

export function detectFrameworkHint(element: HTMLElement): FrameworkHint {
  const className = element.className || "";
  const ancestors = getAncestorClassNames(element, 5);

  for (const fp of FRAMEWORK_PATTERNS) {
    for (const pat of fp.classPatterns) {
      if (pat.test(className)) return fp.hint;
      for (const anc of ancestors) {
        if (pat.test(anc)) return fp.hint;
      }
    }
  }

  // Check for custom framework indicators
  if (/throne-biz/.test(className)) return "feishu-ud";
  if (/rc-select|rc-picker/.test(className)) return "antd";
  if (/ivu-/.test(className)) return "iview";
  if (/atsx-/.test(className)) return "atsx";
  if (/brick-/.test(className)) return "brick";
  if (/next-/.test(className)) return "fusion-next";

  return "native";
}

function getAncestorClassNames(element: HTMLElement, maxDepth: number): string[] {
  const classes: string[] = [];
  let current = element.parentElement;
  let depth = 0;
  while (current && depth < maxDepth) {
    if (current.className && typeof current.className === "string") {
      classes.push(current.className);
    }
    current = current.parentElement;
    depth++;
  }
  return classes;
}

function getLocalContextText(element: HTMLElement): string {
  const container = element.closest(
    ".form-item, .form-group, .kuma-uxform-field, .ant-form-item, .el-form-item, .ud-formily-item, .input-field",
  );
  if (!container) return "";
  const clone = container.cloneNode(true) as HTMLElement;
  clone.querySelectorAll("input, textarea, select, button, svg, script, style").forEach((node) => node.remove());
  return clone.textContent || "";
}

export function detectControlType(element: HTMLElement, framework: FrameworkHint): ControlType {
  const tag = element.tagName.toLowerCase();
  const type = (element as HTMLInputElement).type?.toLowerCase() || "";
  const className = (element.className || "").toString();
  const role = element.getAttribute("role") || "";
  const context = `${className} ${(element.getAttribute("aria-label") || "")} ${(element as HTMLInputElement).placeholder || ""} ${element.textContent || ""} ${getLocalContextText(element)}`;

  // ContentEditable
  if ((element as HTMLElement).contentEditable === "true") return "rich-text";
  if (element.querySelector("[contenteditable=true]")) return "rich-text";

  // File upload
  if (tag === "input" && type === "file") return "file-upload";
  if (/upload|file-picker/.test(className)) return "file-upload";

  // Cascaders
  if (/cascader/.test(className)) return "cascader";
  if (/country-input|city|area|province|district|cascad/i.test(context) && (element.matches(".country-input") || element.closest(".country-input, .el-cascader"))) {
    return "cascader";
  }

  // Date pickers. Keep this after cascader because Ant Design uses
  // "ant-cascader-picker" for cascader hosts.
  if (tag === "input" && (type === "date" || type === "month" || type === "datetime-local")) return "date-picker";
  if (/throne-biz-date-range-picker-input/.test(className)) return "date-range-picker";
  if (/kuma-calendar-picker-input|kuma-calendar-picker|kuma-date-picker|phoenix-datePicker/.test(className)) return "date-picker";
  if (/phoenix-select/.test(className) && /出生|生日|日期|时间|年月|date|time/i.test(context)) return "date-picker";
  if (/picker|calendar|date-picker|datepicker/.test(className)) {
    if (/range/.test(className)) return "date-range-picker";
    return "date-picker";
  }

  // Special: readonly input that looks like a date picker trigger
  if (tag === "input" && (element as HTMLInputElement).readOnly && /date|日期|时间/.test(className)) return "date-picker";

  // Selects / Comboboxes
  if (tag === "select") return "select";
  if (/select|dropdown/.test(className) || role === "combobox" || role === "listbox") {
    if (/search|filter|autocomplete/.test(className)) return "combobox";
    return "combobox";
  }
  if (/bootstrap-select|selectpicker|phoenix-select/.test(className)) return "combobox";

  // Radio / Checkbox
  if (tag === "input" && type === "radio") return "radio";
  if (tag === "input" && type === "checkbox") return "checkbox";
  if (/radio-group|radioGroup/.test(className)) return "radio";
  if (/checkbox-group|checkboxGroup/.test(className)) return "checkbox";
  if (role === "radio") return "radio";
  if (role === "checkbox") return "checkbox";

  // Textarea
  if (tag === "textarea") return "textarea";

  // Default: input
  return "input";
}

export const __ComplexControlDetectorInternals = {
  FRAMEWORK_PATTERNS,
  detectFrameworkHint,
  detectControlType,
  getLocalContextText,
};
