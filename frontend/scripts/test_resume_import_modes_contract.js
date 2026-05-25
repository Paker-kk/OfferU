const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const onboarding = fs.readFileSync(
  path.join(root, "src", "app", "profile", "components", "ProfileOnboarding.tsx"),
  "utf8"
);
const hooks = fs.readFileSync(path.join(root, "src", "lib", "hooks.ts"), "utf8");
const dock = fs.readFileSync(path.join(root, "src", "components", "ai", "ProfileAgentDock.tsx"), "utf8");

if (!hooks.includes('export type ResumeImportParseMode = "ai" | "mechanical"')) {
  throw new Error("ResumeImportParseMode must expose ai and mechanical modes");
}
if (!hooks.includes("parse_mode: parseMode")) {
  throw new Error("importProfileResume must send parse_mode to the backend");
}
if (!onboarding.includes('openResumeImport("ai")') || !onboarding.includes('openResumeImport("mechanical")')) {
  throw new Error("ProfileOnboarding must expose separate AI and mechanical import entry points");
}
if (!onboarding.includes("offeru:open-profile-agent") || !onboarding.includes("agent_session_id")) {
  throw new Error("Resume import must open the profile agent session after parsing");
}
if (!dock.includes("offeru:open-profile-agent") || !dock.includes("getProfileAgentSession")) {
  throw new Error("ProfileAgentDock must listen for import memory sessions");
}

console.log("resume import mode contract passed");
