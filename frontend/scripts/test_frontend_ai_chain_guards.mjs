import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");

function testOptimizeWarningsAreVisible() {
  const source = read("src/app/optimize/components/OptimizeWorkspace.tsx");
  assert.match(source, /warningMessages/);
  assert.match(source, /event === "warning"/);
  assert.match(source, /setWarningMessages/);
}

function testPdfExportErrorsAreVisible() {
  const source = read("src/app/resume/[id]/page.tsx");
  assert.match(source, /exportError/);
  assert.match(source, /setExportError/);
  assert.match(source, /PDF 导出失败/);
}

function testPdfFontRegistrationDoesNotUseRemoteGstatic() {
  const source = read("src/lib/fonts.ts");
  assert.doesNotMatch(source, /fonts\.gstatic\.com/);
  assert.match(source, /registerHyphenationCallback/);
}

function testProfileAgentDockIsMountedOnProfileOnly() {
  const source = read("src/app/providers.tsx");
  assert.match(source, /ProfileAgentDock/);
  assert.match(source, /pathname === "\/profile"/);
}

function testProfilePageHydratesServerArchiveBeforePreservingLocalEdits() {
  const source = read("src/app/profile/page.tsx");
  assert.match(source, /lastProfileArchiveUpdatedAtRef/);
  assert.doesNotMatch(source, /prev\.updatedAt && prev\.updatedAt !== fromProfile\.updatedAt/);
  assert.doesNotMatch(
    source,
    /setArchive\(\(prev\)[\s\S]*?lastProfileArchiveUpdatedAtRef\.current\s=/,
    "profile archive hydration must not mutate refs inside a React state updater"
  );
}

testOptimizeWarningsAreVisible();
testPdfExportErrorsAreVisible();
testPdfFontRegistrationDoesNotUseRemoteGstatic();
testProfileAgentDockIsMountedOnProfileOnly();
testProfilePageHydratesServerArchiveBeforePreservingLocalEdits();

console.log("frontend AI chain guards passed");
