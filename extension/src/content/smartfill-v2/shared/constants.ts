// Shared constants - all magic numbers in one place
export const FIELD_SCAN = {
  maxEditExpansions: 14,
  expansionDelayMs: 800,
  maxShadowDepth: 3,
  maxDedupeCandidates: 200,
  qualityThreshold: 5,
} as const;

export const WRITE = {
  comboBoxOptionLookupAttempts: 6,
  comboBoxOptionRetryDelayMs: 500,
  searchInputAttempts: 3,
  searchInputDelayMs: 400,
  cascaderLevelDelayMs: 600,
  datePanelOpenDelayMs: 500,
  verificationDelayMs: 200,
  throttleBetweenWritesMs: 300,
  maxRecoveryAttempts: 5,
} as const;

export const AI = {
  slowHintTimeoutMs: 18000,
  requestTimeoutMs: 90000,
  cacheTtlMs: 5 * 60 * 1000,
  cacheMaxEntries: 24,
} as const;

export const ATS = {
  htmlScanMaxBytes: 8000,
  minConfidence: 0.55,
} as const;

export const MATCH = {
  ruleConfidenceDefault: 0.96,
  atsAliasConfidence: 0.90,
  equalityGroupConfidence: 0.85,
  semanticBucketConfidence: 0.78,
  genericRegexConfidence: 0.70,
  aiConfidenceThreshold: 0.55,
  minAcceptableConfidence: 0.45,
  ruleBypassAiThreshold: 0.85,
  moduleContextBonus: 0.02,
  optionsMatchBonus: 0.05,
  requiredFieldBonus: 0.03,
} as const;

export const UI = {
  throttleRunMs: 800,
  autoResetDelayMs: 2000,
  scrollIntoViewInterval: 3,
} as const;

export const TAG = {
  SCAN: "[扫描]",
  STRUCTURE: "[结构]",
  MATCH: "[匹配]",
  MATCH_AI: "[匹配:ai]",
  FILL: "[填充]",
  FILL_OK: "[填充:成功]",
  FILL_FAIL: "[填充:失败]",
  DATE: "[日期]",
  CACHE: "[缓存]",
  RECOVERY: "[恢复]",
  VERIFY: "[校验]",
} as const;
