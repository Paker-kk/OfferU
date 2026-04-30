import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

function testHookCanImportLatestExtensionBatch() {
  const source = read("src/lib/hooks.ts");
  assert.match(source, /importLatestExtensionBatchToApplicationTable/);
  assert.match(source, /import-latest-extension-batch/);
}

function testApplicationsPageHasOneClickPluginImport() {
  const source = read("src/app/applications/page.tsx");
  assert.match(source, /handleImportLatestExtensionBatch/);
  assert.match(source, /导入最近插件同步/);
  assert.match(source, /插件购物车/);
  assert.match(source, /插件购物车同步后可直接导入当前表/);
}

testHookCanImportLatestExtensionBatch();
testApplicationsPageHasOneClickPluginImport();

console.log("extension application link guards passed");
