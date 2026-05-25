import { cpSync, mkdirSync, rmSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const EXT_ROOT = resolve(import.meta.dirname, "..");
const WXT_OUTPUT = join(EXT_ROOT, ".output", "chrome-mv3");
const STATIC_DIR = join(EXT_ROOT, "static");

const SYNC_TARGETS = [
  "manifest.json",
  "background.js",
  "popup.html",
  "content-scripts",
  "assets",
  "chunks",
];

const STATIC_SYNC_TARGETS = ["offscreen", "popup.css"];

if (!existsSync(WXT_OUTPUT)) {
  console.error("[sync-root-build] WXT output not found:", WXT_OUTPUT);
  console.error("[sync-root-build] Run 'wxt build' first.");
  process.exit(1);
}

for (const target of SYNC_TARGETS) {
  const src = join(WXT_OUTPUT, target);
  const dest = join(EXT_ROOT, target);

  if (!existsSync(src)) {
    console.warn("[sync-root-build] Skip missing:", target);
    continue;
  }

  rmSync(dest, { recursive: true, force: true });
  cpSync(src, dest, { recursive: true, force: true });
  console.log("[sync-root-build] Synced:", target);
}

for (const target of STATIC_SYNC_TARGETS) {
  const src = join(STATIC_DIR, target);
  const dest = join(EXT_ROOT, target);

  if (!existsSync(src)) {
    console.warn("[sync-root-build] Skip missing static:", target);
    continue;
  }

  rmSync(dest, { recursive: true, force: true });
  cpSync(src, dest, { recursive: true, force: true });
  console.log("[sync-root-build] Synced static:", target);
}

const stalePatterns = ["dist"];
for (const pattern of stalePatterns) {
  const staleDir = join(EXT_ROOT, pattern);
  if (existsSync(staleDir)) {
    rmSync(staleDir, { recursive: true, force: true });
    console.log("[sync-root-build] Cleaned stale:", pattern);
  }
}

console.log("[sync-root-build] Done. Extension root is ready for browser loading.");
