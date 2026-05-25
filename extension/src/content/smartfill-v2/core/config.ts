import type { SmartFillConfig } from "./types.js";

export const DEFAULT_CONFIG: SmartFillConfig = {
  scan: {
    retryLimit: 3,
    retryDelayMs: 280,
    maxEditExpansions: 14,
    expansionDelayMs: 160,
    maxShadowDepth: 3,
    maxDedupeCandidates: 200,
  },
  match: {
    ruleConfidenceThreshold: 0.72,
    aiConfidenceThreshold: 0.55,
    minAcceptableConfidence: 0.45,
    maxOccurrenceLookahead: 20,
  },
  write: {
    comboBoxOptionLookupAttempts: 6,
    comboBoxOptionRetryDelayMs: 70,
    searchInputAttempts: 3,
    searchInputDelayMs: 60,
    cascaderLevelDelayMs: 80,
    datePanelOpenDelayMs: 150,
    verificationDelayMs: 30,
    throttleBetweenWritesMs: 60,
  },
  ai: {
    slowHintTimeoutMs: 18000,
    requestTimeoutMs: 90000,
    cacheTtlMs: 300000,
    cacheMaxEntries: 24,
  },
  ats: {
    detectionStrategy: "layered",
    htmlScanMaxBytes: 8000,
  },
};
