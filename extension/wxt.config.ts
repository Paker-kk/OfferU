import { defineConfig } from "wxt";

export default defineConfig({
  manifest: {
    name: "OfferU 简历购物车助手",
    description: "在招聘站列表页/详情页手动采集岗位并同步到 OfferU",
    permissions: ["storage", "activeTab", "tabs", "clipboardWrite", "offscreen"],
    host_permissions: ["http://127.0.0.1:8000/*", "http://localhost:8000/*"],
    web_accessible_resources: [
      {
        resources: ["popup.html", "assets/*", "chunks/*"],
        matches: ["<all_urls>"],
      },
    ],
    browser_specific_settings: {
      gecko: {
        id: "offeru-extension@offeru.local",
      },
    },
  },
});
