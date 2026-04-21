import type { JobSource } from "../types.js";

export function cleanText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function canonicalUrl(rawUrl: string, baseUrl?: string): string {
  if (!rawUrl) return "";
  try {
    const parsed = new URL(rawUrl, baseUrl);
    return `${parsed.origin}${parsed.pathname}`;
  } catch {
    return rawUrl;
  }
}

export function parseSalary(text: string): { min: number | null; max: number | null } {
  const value = text.replace(/,/g, "");

  const yuanMatch = value.match(/(\d+(?:\.\d+)?)\s*[-~]\s*(\d+(?:\.\d+)?)\s*(?:元|人民币|RMB)/i);
  if (yuanMatch) {
    return {
      min: Math.round(parseFloat(yuanMatch[1])),
      max: Math.round(parseFloat(yuanMatch[2])),
    };
  }

  const kMatch = value.match(/(\d+(?:\.\d+)?)\s*[-~]\s*(\d+(?:\.\d+)?)\s*(k|K|千)/);
  if (kMatch) {
    return {
      min: Math.round(parseFloat(kMatch[1]) * 1000),
      max: Math.round(parseFloat(kMatch[2]) * 1000),
    };
  }

  const wMatch = value.match(/(\d+(?:\.\d+)?)\s*[-~]\s*(\d+(?:\.\d+)?)\s*(万)/);
  if (wMatch) {
    return {
      min: Math.round(parseFloat(wMatch[1]) * 10000),
      max: Math.round(parseFloat(wMatch[2]) * 10000),
    };
  }

  return { min: null, max: null };
}

export function buildHashKey(source: JobSource, title: string, company: string, url: string): string {
  const raw = `${source}::${url || `${title}::${company}`}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return `offeru-${source}-${Math.abs(hash).toString(36)}`;
}
