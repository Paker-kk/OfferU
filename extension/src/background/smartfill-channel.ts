import type { SmartFillAiSettings } from "../types.js";

export type SmartFillChannel = "plugin-direct" | "backend";

export function hasDirectChannelConfig(settings: SmartFillAiSettings): boolean {
  return Boolean(
    settings.baseUrl.trim()
    && settings.apiKey.trim()
    && settings.model.trim(),
  );
}

export function resolveChannelOrder(settings: SmartFillAiSettings): {
  preferred: SmartFillChannel | null;
  secondary: SmartFillChannel | null;
} {
  const hasDirect = hasDirectChannelConfig(settings);
  if (hasDirect) {
    return {
      preferred: "plugin-direct",
      secondary: settings.enableFallback ? "backend" : null,
    };
  }

  return {
    preferred: "backend",
    secondary: null,
  };
}
