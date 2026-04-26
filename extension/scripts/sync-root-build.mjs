import { copyFileSync, existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";

const rootDir = resolve(process.cwd());
const outputDir = resolve(rootDir, ".output", "chrome-mv3");

function ensureParentDir(path) {
  mkdirSync(dirname(path), { recursive: true });
}

function copyRequiredFile(fromRelativePath, toRelativePath) {
  const source = resolve(outputDir, fromRelativePath);
  const target = resolve(rootDir, toRelativePath);

  if (!existsSync(source)) {
    throw new Error(`Missing build artifact: ${source}`);
  }

  ensureParentDir(target);
  copyFileSync(source, target);
}

function copyOptionalDir(dirName) {
  const source = resolve(outputDir, dirName);
  if (!existsSync(source)) return;

  const target = resolve(rootDir, dirName);
  if (existsSync(target)) {
    rmSync(target, { recursive: true, force: true });
  }
  copyDirectory(source, target);
}

function copyOptionalDirFromRoot(sourceRelativePath, targetRelativePath) {
  const source = resolve(rootDir, sourceRelativePath);
  if (!existsSync(source)) return;

  const target = resolve(rootDir, targetRelativePath);
  if (existsSync(target)) {
    rmSync(target, { recursive: true, force: true });
  }
  copyDirectory(source, target);
}

function copyOptionalDirToOutput(sourceRelativePath, targetRelativePath) {
  const source = resolve(rootDir, sourceRelativePath);
  if (!existsSync(source)) return;

  const target = resolve(outputDir, targetRelativePath);
  if (existsSync(target)) {
    rmSync(target, { recursive: true, force: true });
  }
  copyDirectory(source, target);
}

function copyDirectory(source, target) {
  mkdirSync(target, { recursive: true });

  for (const entry of readdirSync(source)) {
    const sourcePath = resolve(source, entry);
    const targetPath = resolve(target, entry);

    if (statSync(sourcePath).isDirectory()) {
      copyDirectory(sourcePath, targetPath);
    } else {
      ensureParentDir(targetPath);
      copyFileSync(sourcePath, targetPath);
    }
  }
}

copyRequiredFile("background.js", "background.js");
copyRequiredFile("content-scripts/content.js", "content-scripts/content.js");
copyRequiredFile("content-scripts/content.js", "content.js");
copyRequiredFile("manifest.json", "manifest.json");
copyRequiredFile("popup.html", "popup.html");
copyOptionalDir("chunks");
copyOptionalDir("assets");
copyOptionalDirFromRoot("static/offscreen", "offscreen");
copyOptionalDirToOutput("static/offscreen", "offscreen");

console.log("[sync-root-build] Synced build artifacts to extension root.");
