import type { PlatformConfig } from "./types.js";
import { BOSS_PLATFORM } from "./boss.js";
import { LIEPIN_PLATFORM } from "./liepin.js";
import { ZHAOPIN_PLATFORM } from "./zhaopin.js";
import { SHIXISENG_PLATFORM } from "./shixiseng.js";
import { LINKEDIN_PLATFORM } from "./linkedin.js";

export const PLATFORM_CONFIGS: PlatformConfig[] = [
  BOSS_PLATFORM,
  LIEPIN_PLATFORM,
  ZHAOPIN_PLATFORM,
  SHIXISENG_PLATFORM,
  LINKEDIN_PLATFORM,
];
