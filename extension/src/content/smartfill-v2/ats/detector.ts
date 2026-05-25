// Layered ATS site detection engine
// Replaces the current detectAtsSystemByDocument (full outerHTML scan)
// Uses multi-signal detection: URL > meta > CSS > DOM fingerprint (budget-limited)
import type { DetectionResult, DetectionSignal } from "../core/types.js";
import { ATS } from "../shared/constants.js";
import { atsRegistry } from "./registry.js";
import type { AtsAdapter } from "./adapters/adapter.interface.js";

export function detectSite(document: Document, url: string): DetectionResult {
  const adapters = atsRegistry.getAll();
  const signals: DetectionSignal[] = [];

  // Layer 1: URL pattern matching (free, most reliable)
  for (const adapter of adapters) {
    const urlSignals = adapter.getDetectionSignals().filter((s) => s.type === "url-pattern");
    for (const sig of urlSignals) {
      try {
        if (new RegExp(sig.value).test(url)) {
          signals.push({ type: "url-pattern", value: adapter.id, weight: sig.weight });
        }
      } catch { /* invalid regex */ }
    }
  }

  // Layer 2: Meta tag inspection (free)
  try {
    const metaGenerator = document.querySelector('meta[name="generator"]')?.getAttribute("content") || "";
    const metaAuthor = document.querySelector('meta[name="author"]')?.getAttribute("content") || "";
    const combined = metaGenerator + metaAuthor;
    for (const adapter of adapters) {
      const metaSignals = adapter.getDetectionSignals().filter(
        (s) => s.type === "meta-content" || s.type === "script-src",
      );
      for (const sig of metaSignals) {
        try {
          if (new RegExp(sig.value, "i").test(combined)) {
            signals.push({ type: "meta-tag", value: adapter.id, weight: sig.weight });
          }
        } catch { /* invalid regex */ }
      }
    }
  } catch { /* DOM not ready */ }

  // Layer 3: Page title (free)
  try {
    const title = document.title || "";
    for (const adapter of adapters) {
      const titleSignals = adapter.getDetectionSignals().filter((s) => s.type === "page-title");
      for (const sig of titleSignals) {
        try {
          if (new RegExp(sig.value, "i").test(title)) {
            signals.push({ type: "meta-tag", value: adapter.id, weight: sig.weight });
          }
        } catch { /* invalid regex */ }
      }
    }
  } catch { /* DOM not ready */ }

  // Layer 4: CSS class signatures (cheap - single querySelectorAll)
  try {
    for (const adapter of adapters) {
      const cssSignals = adapter.getDetectionSignals().filter((s) => s.type === "css-class" || s.type === "dom-signature");
      for (const sig of cssSignals) {
        try {
          const elements = document.querySelectorAll(sig.value);
          if (elements.length > 0) {
            signals.push({ type: "css-class", value: adapter.id, weight: sig.weight });
          }
        } catch { /* invalid selector */ }
      }
    }
  } catch { /* DOM not ready */ }

  // Layer 5: DOM signature scan (expensive, budget-limited)
  if (signals.length === 0) {
    try {
      const htmlSample = document.documentElement.outerHTML.slice(0, ATS.htmlScanMaxBytes);
      for (const adapter of adapters) {
        const domSignals = adapter.getDetectionSignals().filter(
          (s) => s.type === "dom-signature" || s.type === "script-src",
        );
        for (const sig of domSignals) {
          try {
            if (new RegExp(sig.value, "i").test(htmlSample)) {
              signals.push({ type: "dom-signature", value: adapter.id, weight: sig.weight * 0.5 });
            }
          } catch { /* invalid regex */ }
        }
      }
    } catch { /* DOM not available */ }
  }

  // Aggregate scores per adapter
  const scores = new Map<string, { total: number; count: number; name: string }>();
  for (const sig of signals) {
    const existing = scores.get(sig.value);
    if (existing) {
      existing.total += sig.weight;
      existing.count++;
    } else {
      const adapter = adapters.find((a) => a.id === sig.value);
      scores.set(sig.value, { total: sig.weight, count: 1, name: adapter?.displayName || sig.value });
    }
  }

  // Find best matching adapter
  let bestId = "unknown";
  let bestName = "通用";
  let bestConfidence = 0;
  let bestSignals: DetectionSignal[] = [];

  for (const [id, score] of scores) {
    const confidence = Math.min(score.total, 1.0);
    if (confidence > bestConfidence) {
      bestConfidence = confidence;
      bestId = id;
      bestName = score.name;
      bestSignals = signals.filter((s) => s.value === id);
    }
  }

  // Get capabilities for best adapter
  const adapter = atsRegistry.get(bestId);
  const capabilities = adapter?.getCapabilities() || getDefaultCapabilities();

  return {
    adapterId: bestId,
    adapterName: bestName,
    confidence: bestConfidence,
    matchedSignals: bestSignals.slice(0, 10),
    capabilities,
  };
}

function getDefaultCapabilities() {
  return {
    enableCssPathRecovery: true,
    enableMetadataRefind: true,
    enableEditScopeRecovery: false,
    enableSpecializedControlRetry: true,
    supportedFrameworks: [] as import("../core/types.js").FrameworkHint[],
    datePickerInteraction: false,
    cascaderInteraction: false,
    fileUploadAutomation: false,
    enableDynamicSectionExpansion: false,
    sectionExpandSelectors: {},
    forceNativeWrite: false,
    prototypeWritePreferred: true,
    verificationDelayMs: 30,
    useCustomVerifier: false,
  };
}

export const __DetectorInternals = {
  getDefaultCapabilities,
};
