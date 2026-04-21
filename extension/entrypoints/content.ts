export default defineContentScript({
  matches: [
    "http://*/*",
    "https://*/*",
  ],
  runAt: "document_idle",
  main() {
    // Runtime logic lives in src/content.ts
    void import("../src/content");
  },
});
