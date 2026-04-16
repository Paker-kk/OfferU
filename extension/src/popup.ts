// =============================================
// OfferU Extension — Popup Script
// =============================================

import type { Message } from "./types.js";

// ---- DOM 元素 ----
const jobCountEl = document.getElementById("jobCount")!;
const syncBtn = document.getElementById("syncBtn") as HTMLButtonElement;
const clearBtn = document.getElementById("clearBtn") as HTMLButtonElement;
const messageEl = document.getElementById("message")!;
const serverUrlInput = document.getElementById("serverUrl") as HTMLInputElement;
const saveSettingsBtn = document.getElementById("saveSettingsBtn")!;

// ---- 状态刷新 ----
function refreshStatus(): void {
  const msg: Message = { type: "GET_STATUS" };
  chrome.runtime.sendMessage(msg, (resp: { count: number; serverUrl: string }) => {
    if (resp) {
      jobCountEl.textContent = String(resp.count);
      serverUrlInput.value = resp.serverUrl;
      syncBtn.disabled = resp.count === 0;
    }
  });
}

// ---- 显示消息 ----
function showMessage(text: string, type: "success" | "error" | "info"): void {
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
  setTimeout(() => {
    messageEl.textContent = "";
    messageEl.className = "message";
  }, 4000);
}

// ---- 同步按钮 ----
syncBtn.addEventListener("click", () => {
  syncBtn.disabled = true;
  syncBtn.innerHTML = '<span class="btn-icon">⏳</span> 同步中...';

  const msg: Message = { type: "SYNC_TO_SERVER" };
  chrome.runtime.sendMessage(msg, (resp: { ok: boolean; synced: number; error?: string }) => {
    if (resp?.ok) {
      showMessage(`✅ 成功同步 ${resp.synced} 个岗位到 OfferU`, "success");
      refreshStatus();
    } else {
      showMessage(`❌ 同步失败: ${resp?.error || "未知错误"}`, "error");
    }
    syncBtn.innerHTML = '<span class="btn-icon">🚀</span> 一键同步到 OfferU';
    syncBtn.disabled = false;
  });
});

// ---- 清空按钮 ----
clearBtn.addEventListener("click", () => {
  const msg: Message = { type: "CLEAR_JOBS" };
  chrome.runtime.sendMessage(msg, () => {
    showMessage("已清空采集列表", "info");
    refreshStatus();
  });
});

// ---- 保存设置 ----
saveSettingsBtn.addEventListener("click", () => {
  const url = serverUrlInput.value.trim();
  if (!url) {
    showMessage("请输入有效的服务器地址", "error");
    return;
  }
  // 简单的 URL 验证
  try {
    new URL(url);
  } catch {
    showMessage("请输入有效的 URL 格式", "error");
    return;
  }
  chrome.storage.local.set({ settings: { serverUrl: url } }, () => {
    showMessage("✅ 设置已保存", "success");
  });
});

// ---- 初始化 ----
refreshStatus();
