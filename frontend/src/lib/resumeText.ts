const BULLET_MARKER_RE = /^\s*(?:[•●▪◦·*-]|\d+[.)、]|[（(]?\d+[）)]|[a-zA-Z][.)])\s*/;

function decodeEntities(value: string) {
  return value
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function textFromHtml(value: string) {
  return decodeEntities(value || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/\r/g, "\n")
    .trim();
}

export function stripBulletMarker(value: string) {
  return (value || "").replace(BULLET_MARKER_RE, "").trim();
}

function splitInlineBullets(line: string) {
  const normalized = (line || "").trim();
  if (!normalized) return [];
  const pieces = normalized.split(/(?=\s*(?:[•●▪◦·*-]|\d+[.)、]|[（(]?\d+[）)])\s+)/g);
  return pieces.map((piece) => stripBulletMarker(piece)).filter(Boolean);
}

export function splitBullets(value: string): string[] {
  const text = textFromHtml(value);
  if (!text) return [];

  const result: string[] = [];
  for (const rawLine of text.split(/\n+/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const pieces = splitInlineBullets(line);
    if (pieces.length > 0) {
      result.push(...pieces);
    }
  }
  return result;
}

export function descriptionLinesToPlainText(lines: string[]) {
  return (lines || [])
    .map((item) => stripBulletMarker(String(item || "")))
    .filter(Boolean)
    .join("\n");
}
