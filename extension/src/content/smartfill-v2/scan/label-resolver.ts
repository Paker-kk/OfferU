// Multi-strategy label resolution for form fields
// Priority: explicit label > framework-specific > semantic attr > fallback
import { analyzeAriaAttributes } from "./aria-analyzer.js";
import { normalizeText } from "../shared/text-utils.js";
import { escapeCssString } from "../shared/dom-utils.js";

export interface RawLabelCandidate {
  text: string;
  source: string;
  score: number;
}

interface LabelResolverOptions {
  labelSelector?: string;
  containerSelector?: string;
}

export function resolveLabelCandidates(
  element: HTMLElement,
  options?: LabelResolverOptions,
): RawLabelCandidate[] {
  const candidates: RawLabelCandidate[] = [];

  // 1. data-form-field-i18n-name (ATS metadata, highest priority)
  const i18nName = element.getAttribute("data-form-field-i18n-name");
  if (i18nName?.trim()) {
    candidates.push({ text: i18nName.trim(), source: "form-item", score: 55 });
  }
  const dataLabel = element.getAttribute("data-form-field-name")
    || element.getAttribute("data-field-label")
    || element.getAttribute("data-label")
    || element.getAttribute("data-title");
  if (dataLabel?.trim()) {
    candidates.push({ text: dataLabel.trim(), source: "form-item", score: 52 });
  }

  // 2. ARIA attributes
  const aria = analyzeAriaAttributes(element);
  if (aria.label) {
    candidates.push({ text: aria.label, source: "aria-labelledby", score: 52 });
  }
  const ariaLabel = element.getAttribute("aria-label");
  if (ariaLabel?.trim() && ariaLabel !== aria.label) {
    candidates.push({ text: ariaLabel.trim(), source: "aria-label", score: 48 });
  }

  // 3. Explicit <label for="...">
  const id = element.id;
  if (id) {
    const labelEl = document.querySelector(`label[for="${escapeCssString(id)}"]`);
    if (labelEl) {
      const text = getNodeTextWithoutControls(labelEl as HTMLElement);
      if (text) candidates.push({ text, source: "for-attr", score: 50 });
    }
  }

  // 4. Wrapping <label>
  const wrappingLabel = element.closest("label");
  if (wrappingLabel) {
    const text = getNodeTextWithoutControls(wrappingLabel as HTMLElement);
    if (text) candidates.push({ text, source: "wrapping-label", score: 45 });
  }

  // 5. Framework-specific label selectors
  const frameworkLabels = resolveFrameworkLabels(element, options);
  for (const fl of frameworkLabels) {
    candidates.push(fl);
  }

  // 6. Form-item container label (look for label element in same form-item)
  const containerLabel = resolveContainerLabel(element);
  if (containerLabel) {
    candidates.push({ text: containerLabel, source: "form-item", score: 40 });
  }

  // 7. Previous sibling text
  const prevText = getPreviousSiblingText(element);
  if (prevText) {
    candidates.push({ text: prevText, source: "adjacent-text", score: 35 });
  }

  // 8. Title attribute
  const title = element.getAttribute("title");
  if (title?.trim()) {
    candidates.push({ text: title.trim(), source: "adjacent-text", score: 30 });
  }

  // 9. Placeholder
  const placeholder = (element as HTMLInputElement).placeholder;
  if (placeholder?.trim()) {
    candidates.push({ text: placeholder.trim(), source: "placeholder", score: 25 });
  }

  // 10. Name attribute fallback
  const name = (element as HTMLInputElement).name || element.getAttribute("name");
  if (name?.trim() && !/^[a-z_]\w*$/.test(name)) { // skip machine-generated names
    candidates.push({ text: name.trim(), source: "name-attr", score: 20 });
  }

  // 11. ID attribute fallback
  if (id && id !== name) {
    const idText = id.replace(/[-_]/g, " ").trim();
    if (idText.length > 1 && !/^[a-z_]\w*$/.test(idText)) {
      candidates.push({ text: idText, source: "id-attr", score: 18 });
    }
  }

  // 12. Placeholder semantic extraction — strip "请输入/请选择" prefix to get real label
  const ph = (element as HTMLInputElement).placeholder;
  if (ph?.trim() && /^(请输入|请选择|请填写)/.test(ph.trim())) {
    const cleaned = ph.trim()
      .replace(/^(请输入|请选择|请填写|点击选择)\s*/, "")
      .replace(/[*★●◆▸►■☐☑✓✔✗✘].+$/, "")
      .trim();
    if (cleaned && cleaned.length >= 2) {
      candidates.push({ text: cleaned, source: "placeholder-semantic", score: 28 });
    }
  }

  // 13. Name attribute semantic mapping — known English names to Chinese labels
  const nameAttr = (element as HTMLInputElement).name || element.getAttribute("name");
  if (nameAttr?.trim()) {
    const semantic = nameToSemanticLabel(nameAttr.trim());
    if (semantic) {
      candidates.push({ text: semantic, source: "name-semantic", score: 18 });
    }
  }

  return candidates;
}

const KNOWN_NAME_MAP: Record<string, string> = {
  name: "姓名", username: "用户名", fullname: "姓名",
  phone: "手机号", mobile: "手机号", telephone: "电话",
  email: "邮箱", mail: "邮箱",
  idcard: "身份证号", idnumber: "身份证号",
  gender: "性别", sex: "性别",
  birthday: "出生日期", birth: "出生日期",
  school: "学校", university: "大学", college: "学院",
  major: "专业", specialty: "专业",
  degree: "学历", education: "学历",
  company: "公司", employer: "工作单位",
  position: "职位", job: "职位", title: "职位",
  salary: "薪资", pay: "薪资",
  address: "地址", city: "城市",
  province: "省份", zipcode: "邮编",
  website: "个人网站", homepage: "个人主页",
  summary: "自我评价", description: "描述",
  skill: "技能", language: "语言",
  certificate: "证书", award: "奖项",
};

function nameToSemanticLabel(name: string): string | null {
  const lower = name.toLowerCase().replace(/[-_]/g, "");
  return KNOWN_NAME_MAP[lower] || null;
}

function resolveFrameworkLabels(
  element: HTMLElement,
  options?: LabelResolverOptions,
): RawLabelCandidate[] {
  const candidates: RawLabelCandidate[] = [];

  // Kuma
  const kumaField = element.closest(".kuma-uxform-field");
  if (kumaField) {
    const kumaLabel = kumaField.querySelector(".kuma-label, .label-content");
    if (kumaLabel) {
      const text = kumaLabel.textContent?.trim() || "";
      if (text) candidates.push({ text, source: "form-item", score: 42 });
    }
  }

  // Beisen Phoenix
  const phoenixField = element.closest(".form-item--phoenix, .form-item, [class*=phoenix]");
  if (phoenixField) {
    const phoenixLabel = phoenixField.querySelector(".form-item__text, .form-item__title label, [class*=form-item__text]");
    if (phoenixLabel) {
      const text = phoenixLabel.textContent?.trim().replace(/[:：]\s*$/, "") || "";
      if (text) candidates.push({ text, source: "form-item", score: 44 });
    }
  }

  // Beisen/Kuma uxform fields sometimes use label-content without a label tag.
  const uxFormField = element.closest(".kuma-uxform-field, [class*=uxform-field]");
  if (uxFormField) {
    const label = uxFormField.querySelector(".label-content, [class*=label-content]");
    if (label) {
      const text = label.textContent?.trim().replace(/[:：]\s*$/, "") || "";
      if (text) candidates.push({ text, source: "form-item", score: 44 });
    }
  }

  // Ant Design
  const antItem = element.closest(".ant-form-item");
  if (antItem) {
    const antLabel = antItem.querySelector(".ant-form-item-label > label");
    if (antLabel) {
      const text = antLabel.textContent?.trim().replace(/[:：]\s*$/, "") || "";
      if (text) candidates.push({ text, source: "form-item", score: 42 });
    }
  }

  // Element UI
  const elItem = element.closest(".el-form-item");
  if (elItem) {
    const elLabel = elItem.querySelector(".el-form-item__label");
    if (elLabel) {
      const text = elLabel.textContent?.trim().replace(/[:：]\s*$/, "") || "";
      if (text) candidates.push({ text, source: "form-item", score: 42 });
    }
  }

  // Arco
  const arcoItem = element.closest(".arco-form-item");
  if (arcoItem) {
    const arcoLabel = arcoItem.querySelector(".arco-form-item-label");
    if (arcoLabel) {
      const text = arcoLabel.textContent?.trim().replace(/[:：]\s*$/, "") || "";
      if (text) candidates.push({ text, source: "form-item", score: 42 });
    }
  }

  // Semi Design
  const semiField = element.closest(".semi-form-field");
  if (semiField) {
    const semiLabel = semiField.querySelector(".semi-form-field-label");
    if (semiLabel) {
      const text = semiLabel.textContent?.trim().replace(/[:：]\s*$/, "") || "";
      if (text) candidates.push({ text, source: "form-item", score: 42 });
    }
  }

  // TDesign
  const tdesignField = element.closest(".t-form__item");
  if (tdesignField) {
    const tdesignLabel = tdesignField.querySelector(".t-form__label");
    if (tdesignLabel) {
      const text = tdesignLabel.textContent?.trim().replace(/[:：]\s*$/, "") || "";
      if (text) candidates.push({ text, source: "form-item", score: 42 });
    }
  }

  // Naive UI
  const naiveField = element.closest(".n-form-item");
  if (naiveField) {
    const naiveLabel = naiveField.querySelector(".n-form-item-label");
    if (naiveLabel) {
      const text = naiveLabel.textContent?.trim().replace(/[:：]\s*$/, "") || "";
      if (text) candidates.push({ text, source: "form-item", score: 42 });
    }
  }

  // iView
  const ivuItem = element.closest(".ivu-form-item");
  if (ivuItem) {
    const ivuLabel = ivuItem.querySelector(".ivu-form-item-label");
    if (ivuLabel) {
      const text = ivuLabel.textContent?.trim().replace(/[:：]\s*$/, "") || "";
      if (text) candidates.push({ text, source: "form-item", score: 42 });
    }
  }

  // ATSX
  const atsxItem = element.closest(".atsx-form-item");
  if (atsxItem) {
    const atsxLabel = atsxItem.querySelector(".atsx-form-item-label");
    if (atsxLabel) {
      const text = atsxLabel.textContent?.trim().replace(/[:：]\s*$/, "") || "";
      if (text) candidates.push({ text, source: "form-item", score: 42 });
    }
  }

  // Brick
  const brickItem = element.closest(".brick-form-item");
  if (brickItem) {
    const brickLabel = brickItem.querySelector(".brick-form-item-label");
    if (brickLabel) {
      const text = brickLabel.textContent?.trim().replace(/[:：]\s*$/, "") || "";
      if (text) candidates.push({ text, source: "form-item", score: 42 });
    }
  }

  // Fusion Next
  const nextItem = element.closest(".next-form-item");
  if (nextItem) {
    const nextLabel = nextItem.querySelector(".next-form-item-label");
    if (nextLabel) {
      const text = nextLabel.textContent?.trim().replace(/[:：]\s*$/, "") || "";
      if (text) candidates.push({ text, source: "form-item", score: 42 });
    }
  }

  // Feishu UD / Throne Biz
  const udItem = element.closest(".ud-formily-item, .throne-biz-form-item");
  if (udItem) {
    const udLabel = udItem.querySelector(".ud-formily-item-label-content, .ud__formily-item-label, .throne-biz-form-item-label");
    if (udLabel) {
      const text = udLabel.textContent?.trim().replace(/[:：]\s*$/, "") || "";
      if (text) candidates.push({ text, source: "form-item", score: 42 });
    }
  }

  // Bootstrap style form groups
  const bootstrapGroup = element.closest(".form-group, .bootstrap-form");
  if (bootstrapGroup) {
    const label = bootstrapGroup.querySelector("label, .control-label");
    if (label) {
      const text = getNodeTextWithoutControls(label as HTMLElement);
      if (text) candidates.push({ text, source: "form-item", score: 42 });
    }
  }

  // Tencent/self-built style fields
  const inputField = element.closest(".input-field, [class*=input-field], [class*=field]");
  if (inputField) {
    const label = inputField.querySelector(".field-label, [class*=field-label], [class*=FieldLabel]");
    if (label) {
      const text = getNodeTextWithoutControls(label as HTMLElement);
      if (text) candidates.push({ text, source: "form-item", score: 43 });
    }
  }

  // Table layout — find column header via <th>
  const td = element.closest("td");
  if (td) {
    const tr = td.closest("tr");
    if (tr) {
      const tds = Array.from(tr.children);
      const myIndex = tds.indexOf(td);
      // Try header row
      const headerRow = tr.previousElementSibling;
      if (headerRow) {
        const headerTds = Array.from(headerRow.children);
        if (headerTds[myIndex]) {
          const text = (headerTds[myIndex] as HTMLElement).textContent?.trim() || "";
          if (text) candidates.push({ text, source: "table-header", score: 38 });
        }
      }
    }
  }

  // Adjacent label — label element right before or alongside the input
  const parent = element.parentElement;
  if (parent) {
    const prevSibling = element.previousElementSibling
      || parent.querySelector("label, [class*=label], [class*=Label]");
    if (prevSibling && prevSibling !== element) {
      const text = getNodeTextWithoutControls(prevSibling as HTMLElement);
      if (text && text.length >= 2 && text.length <= 40) {
        candidates.push({ text, source: "adjacent-label", score: 36 });
      }
    }
  }

  // Adapter-provided label selector
  if (options?.labelSelector) {
    candidates.push(...resolveAdapterScopedLabels(element, options.labelSelector, options.containerSelector));
  }

  return candidates;
}

function resolveAdapterScopedLabels(
  element: HTMLElement,
  labelSelector: string,
  containerSelector?: string,
): RawLabelCandidate[] {
  const results: RawLabelCandidate[] = [];
  const roots: HTMLElement[] = [];

  if (containerSelector) {
    try {
      const container = element.closest(containerSelector) as HTMLElement | null;
      if (container) roots.push(container);
    } catch { /* invalid selector */ }
  }

  let current = element.parentElement;
  for (let depth = 0; current && depth < 8; depth++, current = current.parentElement) {
    if (!roots.includes(current)) roots.push(current);
  }

  for (const root of roots) {
    let labels: HTMLElement[] = [];
    try {
      labels = Array.from(root.querySelectorAll(labelSelector)) as HTMLElement[];
    } catch {
      labels = [];
    }
    const picked = pickNearestAdapterLabel(element, labels);
    if (picked) {
      const text = getNodeTextWithoutControls(picked);
      if (text) {
        results.push({ text, source: "form-item", score: 44 });
        break;
      }
    }
  }

  return results;
}

function pickNearestAdapterLabel(element: HTMLElement, labels: HTMLElement[]): HTMLElement | null {
  const targetRect = element.getBoundingClientRect();
  let best: HTMLElement | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const label of labels) {
    if (label === element || label.contains(element)) continue;
    const text = getNodeTextWithoutControls(label);
    if (!text || text.length < 2 || text.length > 50) continue;
    const rect = label.getBoundingClientRect();
    const isAbove = rect.bottom <= targetRect.top + 10;
    const isLeft = rect.right <= targetRect.left + 24
      && Math.abs(rect.top - targetRect.top) <= Math.max(36, targetRect.height * 2);
    const sameLine = Math.abs(rect.top - targetRect.top) <= 16;
    if (!isAbove && !isLeft && !sameLine) continue;

    const score = Math.abs(targetRect.top - rect.top) * 2 + Math.abs(targetRect.left - rect.left) * 0.25;
    if (score < bestScore) {
      best = label;
      bestScore = score;
    }
  }

  return best;
}

function resolveContainerLabel(element: HTMLElement): string | null {
  const container = element.closest(
    '[class*="form-item"], [class*="formItem"], [class*="form-row"], [class*="formRow"],'
    + ' [class*="field"], [class*="form-group"], [class*="formGroup"],'
    + ' [class*="uxform-field"], [class*="input-field"],'
    + ' td, .form-cell',
  );
  if (!container) return null;

  // Look for label-like element within container
  const labelEl = container.querySelector(
    'label, .label, [class*="label"], [class*="Label"], .form-item__text, .field-label, dt, th, [class*="title"]',
  );
  if (labelEl) {
    const text = getNodeTextWithoutControls(labelEl as HTMLElement);
    if (text) return text;
  }

  // If container is td/th, use its direct text
  if (/^(td|th)$/i.test(container.tagName)) {
    const text = getNodeTextWithoutControls(container as HTMLElement);
    if (text && text.length < 80) return text;
  }

  return null;
}

function getPreviousSiblingText(element: HTMLElement): string | null {
  const container = element.closest(
    '[class*="form-item"], [class*="field"], td, .form-cell, label, div',
  );
  if (!container) {
    const prev = element.previousElementSibling;
    if (prev) {
      const text = prev.textContent?.trim() || "";
      if (text && text.length < 60) return text;
    }
    return null;
  }

  // Look for preceding text node or sibling with label text
  for (const child of container.childNodes) {
    if (child === element || child.contains(element)) break;
    if (child.nodeType === Node.TEXT_NODE) {
      const text = child.textContent?.trim() || "";
      if (text && text.length < 60) return text;
    }
    if (child instanceof HTMLElement) {
      if (child.tagName === "LABEL" || child.classList.contains("label")) {
        const text = child.textContent?.trim() || "";
        if (text && text.length < 60) return text;
      }
    }
  }
  return null;
}

function getNodeTextWithoutControls(node: HTMLElement): string {
  const clone = node.cloneNode(true) as HTMLElement;
  const controls = clone.querySelectorAll(
    "input, select, textarea, button, svg, script, style, [aria-hidden=true]",
  );
  controls.forEach((c) => c.remove());
  return normalizeText(clone.textContent || "").replace(/[:：*]\s*$/, "");
}

const GENERIC_LABELS = /^(请输入|请选择|请填写|输入|选择|信息|内容|详情|select|choose|enter|input|please)\s*$/i;

const PLACEHOLDER_DERIVED_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  { pattern: /GPA|平均学分成绩/i, label: "GPA分数" },
  { pattern: /没有班级排名/, label: "无班级排名原因" },
  { pattern: /六级.*分数|分数.*六级/, label: "六级分数" },
  { pattern: /四级.*分数|分数.*四级/, label: "四级分数" },
  { pattern: /排名.*比例|比例.*排名/, label: "排名比例" },
  { pattern: /获奖.*级别|级别.*获奖/, label: "获奖级别" },
  { pattern: /证书.*编号|编号.*证书/, label: "证书编号" },
  { pattern: /薪资.*月|月薪|月.*薪资/, label: "月薪" },
  { pattern: /入职.*时间|到岗.*时间/, label: "入职时间" },
  { pattern: /紧急联系人.*电话|电话.*紧急/, label: "紧急联系人电话" },
];

export function improveLabel(
  bestLabel: string,
  bestSource: string,
  candidates: RawLabelCandidate[],
  element: HTMLElement,
): string {
  if (!GENERIC_LABELS.test(bestLabel)) return bestLabel;

  for (const c of candidates) {
    if (c.source === bestSource) continue;
    if (!GENERIC_LABELS.test(c.text) && c.text.length >= 2) return c.text;
  }

  const placeholder = (element as HTMLInputElement).placeholder?.trim() || "";
  if (placeholder) {
    for (const { pattern, label } of PLACEHOLDER_DERIVED_PATTERNS) {
      if (pattern.test(placeholder)) return label;
    }
    if (/^(请输入|请选择|请填写)/.test(placeholder)) {
      const cleaned = placeholder
        .replace(/^(请输入|请选择|请填写|点击选择)\s*/, "")
        .replace(/[*★●◆▸►■☐☑✓✔✗✘].+$/, "")
        .trim();
      if (cleaned && cleaned.length >= 2 && !GENERIC_LABELS.test(cleaned)) return cleaned;
    }
  }

  const container = element.closest(
    '[class*="form-item"], [class*="field"], [class*="formItem"], [class*="FormItem"]',
  );
  if (container) {
    const labelEl = container.querySelector("label, [class*=label], [class*=Label]");
    if (labelEl) {
      const text = getNodeTextWithoutControls(labelEl as HTMLElement);
      if (text && text.length >= 2 && !GENERIC_LABELS.test(text)) return text;
    }
  }

  return bestLabel;
}

export function resolveModuleNameForField(element: HTMLElement, label: string): string {
  const section = element.closest(
    "fieldset, [role=group], [class*=section], [class*=module], [class*=block],"
    + " [class*=card], .ant-card, .el-card, .arco-card, .tab-pane, .tab-content",
  );
  if (section) {
    const heading = section.querySelector(
      "h1, h2, h3, h4, h5, h6, legend, [role=heading], .section-title,"
      + " .module-title, .card-title, .ant-card-head-title, .tab-title",
    );
    if (heading) {
      const text = normalizeText(heading.textContent || "");
      if (text) return text;
    }
    if (section.tagName === "FIELDSET") {
      const legend = section.querySelector("legend");
      if (legend) {
        const text = normalizeText(legend.textContent || "");
        if (text) return text;
      }
    }
  }
  return "";
}

export const __LabelResolverInternals = {
  resolveFrameworkLabels,
  resolveAdapterScopedLabels,
  pickNearestAdapterLabel,
  resolveContainerLabel,
  getNodeTextWithoutControls,
};
