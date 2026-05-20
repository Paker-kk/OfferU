// Pure text normalization and comparison utilities

export function compactText(value: string, maxLen = 300): string {
  if (!value) return "";
  return normalizeText(value, maxLen)
    .replace(/[()（）[\]【】<>《》"'""''、,，。.·•\s|:：/\\-]/g, "")
    .replace(/^(请输入|请选择|请填写|上传文件|点击选择)\s*/g, "");
}

export function normalizeText(value: string, maxLen = 300): string {
  if (!value) return "";
  return value
    .replace(/\s+/g, " ")
    .replace(/[​ 　]/g, " ")
    .replace(/[\t\n\r]+/g, " ")
    .replace(/ +/g, " ")
    .trim()
    .slice(0, maxLen);
}

export function textMatchScore(a: string, b: string): number {
  const ca = compactText(a);
  const cb = compactText(b);
  if (!ca || !cb) return 0;
  if (ca === cb) return 12;
  if (ca.includes(cb) || cb.includes(ca)) {
    const diff = Math.abs(ca.length - cb.length);
    return 6 + Math.min(3, diff / Math.max(ca.length, 1));
  }
  const partsA = ca.split(/\s+/);
  const partsB = cb.split(/\s+/);
  let overlap = 0;
  for (const pa of partsA) {
    for (const pb of partsB) {
      if (pa === pb || pa.includes(pb) || pb.includes(pa)) {
        overlap++;
      }
    }
  }
  if (overlap === 0) return 0;
  const ratio = overlap / Math.max(partsA.length, partsB.length);
  return 2 + Math.round(ratio * 5);
}

export function expandMatchVariants(value: string, aliases?: string[][]): string[] {
  const normalized = normalizeText(value);
  const variants: string[] = [];
  if (normalized) {
    variants.push(normalized);
    variants.push(normalized.toLowerCase());
    variants.push(normalized.replace(/\s+/g, ""));
  }
  if (aliases) {
    for (const group of aliases) {
      const match = group.find(
        (a) => a === normalized || a.toLowerCase() === normalized.toLowerCase() || compactText(a) === compactText(normalized)
      );
      if (match) {
        variants.push(...group);
        break;
      }
    }
  }
  return [...new Set(variants.map((v) => v.toLowerCase()))];
}

export function stripChinesePromptWrappers(label: string): string {
  return label
    .replace(/^(请|请输入|请选择|请填写|请确认|请提供)\s*/g, "")
    .replace(/[*★●◆▸►■☐☑✓✔✗✘].+$/, "")
    .trim();
}

export function isJsonStringValue(value: string): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if ((trimmed.startsWith("{") && trimmed.endsWith("}"))
    || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try { JSON.parse(trimmed); return true; } catch { /* not valid JSON */ }
  }
  return false;
}

export function containsJsonStringFragment(value: string): boolean {
  if (!value || value.length < 4) return false;
  if (isJsonStringValue(value)) return true;
  const parts = value.split(/;\s*/);
  return parts.length > 1 && parts.some((p) => isJsonStringValue(p.trim()));
}

export function isNoiseValue(value: string): boolean {
  const v = normalizeText(value);
  if (!v) return true;
  if (/^(请选择|请填写|select|choose|pick|--|N\/A|n\/a|none|无)$/i.test(v)) return true;
  if (v.length <= 1) return true;
  return false;
}
