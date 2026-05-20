import type { SmartFillCatalogItem } from "../types.js";
import type { SmartFillProfileFieldValue } from "./smartfill-profile.js";

function simpleHash(input: string): string {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function stripCatalogValues(catalog: SmartFillProfileFieldValue[]): SmartFillCatalogItem[] {
  return catalog.map((item) => ({
    key: item.key,
    path: item.path || item.key,
    label: item.label,
    categoryKey: item.categoryKey || item.sectionType || "",
    categoryLabel: item.categoryLabel || item.category || "",
    sectionType: item.sectionType || item.categoryKey || "general",
    itemIndex: item.itemIndex,
    valueType: item.valueType || "text",
    aliases: item.aliases || [],
    sourceRef: item.sourceRef || "",
    signature: item.signature || simpleHash(`${item.path || item.key}:${item.label}:${item.category || ""}`),
  }));
}

export function sanitizeRuntimeCatalogItem(item: SmartFillCatalogItem): SmartFillCatalogItem | null {
  const path = String(item.path || item.key || "").trim();
  const label = String(item.label || "").trim();
  if (!path || !label) return null;

  const key = String(item.key || path).trim();
  return {
    key,
    path,
    label,
    categoryKey: String(item.categoryKey || item.sectionType || "").trim(),
    categoryLabel: String(item.categoryLabel || "").trim(),
    sectionType: String(item.sectionType || item.categoryKey || "general").trim() || "general",
    itemIndex: Number.isFinite(Number(item.itemIndex)) && Number(item.itemIndex) > 0
      ? Math.round(Number(item.itemIndex))
      : undefined,
    valueType: item.valueType || "text",
    aliases: Array.isArray(item.aliases)
      ? item.aliases.map((alias) => String(alias).trim()).filter(Boolean).slice(0, 12)
      : [],
    sourceRef: String(item.sourceRef || "").trim(),
    signature: String(item.signature || simpleHash(`${path}:${label}`)).trim(),
  };
}

export function buildRuntimeCatalog(
  runtimeCatalog: SmartFillCatalogItem[] | undefined,
  profileValues: SmartFillProfileFieldValue[],
): SmartFillCatalogItem[] {
  if (Array.isArray(runtimeCatalog) && runtimeCatalog.length > 0) {
    const seen = new Set<string>();
    const sanitized: SmartFillCatalogItem[] = [];
    for (const item of runtimeCatalog) {
      if (!item || typeof item !== "object") continue;
      const clean = sanitizeRuntimeCatalogItem(item);
      if (!clean) continue;
      const dedupeKey = clean.path || clean.key;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      sanitized.push(clean);
    }
    if (sanitized.length > 0) return sanitized;
  }

  return stripCatalogValues(profileValues);
}

export function selectAuthoritativeCatalog(
  backendCatalog: SmartFillCatalogItem[] | undefined,
  runtimeCatalog: SmartFillCatalogItem[] | undefined,
  profileValues: SmartFillProfileFieldValue[],
): SmartFillCatalogItem[] {
  const backend = buildRuntimeCatalog(backendCatalog, []);
  const fallback = buildRuntimeCatalog(runtimeCatalog, profileValues);
  if (backend.length === 0) return fallback;
  if (fallback.length === 0) return backend;

  const fallbackByPath = new Map(fallback.map((item) => [item.path, item]));
  const backendByPath = new Map(backend.map((item) => [item.path, item]));
  const result: SmartFillCatalogItem[] = [];

  for (const fallbackItem of fallback) {
    const backendItem = backendByPath.get(fallbackItem.path);
    if (backendItem) {
      result.push({
        ...backendItem,
        key: backendItem.key || fallbackItem.key,
        path: fallbackItem.path,
        valueType: backendItem.valueType || fallbackItem.valueType,
        itemIndex: backendItem.itemIndex || fallbackItem.itemIndex,
      });
      continue;
    }
    result.push(fallbackItem);
  }

  for (const backendItem of backend) {
    if (fallbackByPath.has(backendItem.path)) continue;
    // Backend-only paths cannot be resolved by the content script local catalog.
    // Keep them out of the AI prompt until content receives the same catalog source.
  }

  return result;
}

export function buildSmartFillCatalogSignature(catalog: SmartFillCatalogItem[]): string {
  return catalog
    .map((item) => `${item.path || item.key}:${item.signature || ""}`)
    .join("||");
}

export function resolveCatalogValueMap(
  catalog: SmartFillCatalogItem[],
  profileValues: SmartFillProfileFieldValue[],
): Record<string, string> {
  const valueByPath: Record<string, string> = {};
  const valueByKey: Record<string, string> = {};
  for (const item of profileValues) {
    const path = String(item.path || item.key || "").trim();
    const key = String(item.key || path).trim();
    const value = String(item.value || "").trim();
    if (!value) continue;
    if (path) valueByPath[path] = value;
    if (key) valueByKey[key] = value;
  }

  const result: Record<string, string> = {};
  for (const item of catalog) {
    const value = valueByPath[item.path] || valueByKey[item.key] || "";
    if (value) {
      result[item.path] = value;
      result[item.key] = value;
    }
  }
  return result;
}

export const __SmartFillCatalogContractInternals = {
  simpleHash,
};
