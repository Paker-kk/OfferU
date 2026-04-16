// =============================================
// OfferU Extension — Background Service Worker
// =============================================
// 管理采集的岗位存储、与后端 API 通信
// =============================================
const DEFAULT_SETTINGS = {
    serverUrl: "http://localhost:8000",
};
// ---- 存储操作 ----
async function getJobs() {
    const result = await chrome.storage.local.get("collectedJobs");
    return result.collectedJobs || [];
}
async function saveJobs(jobs) {
    await chrome.storage.local.set({ collectedJobs: jobs });
}
async function getSettings() {
    const result = await chrome.storage.local.get("settings");
    return result.settings || DEFAULT_SETTINGS;
}
// ---- 去重合并 ----
async function mergeJobs(newJobs) {
    const existing = await getJobs();
    const existingKeys = new Set(existing.map((j) => j.hash_key));
    let added = 0;
    for (const job of newJobs) {
        if (!existingKeys.has(job.hash_key)) {
            existing.push(job);
            existingKeys.add(job.hash_key);
            added++;
        }
    }
    await saveJobs(existing);
    // 更新 badge
    await chrome.action.setBadgeText({ text: existing.length > 0 ? String(existing.length) : "" });
    await chrome.action.setBadgeBackgroundColor({ color: "#3b82f6" });
    return added;
}
// ---- 同步到 OfferU 后端 ----
async function syncToServer() {
    const jobs = await getJobs();
    if (jobs.length === 0) {
        return { ok: true, synced: 0 };
    }
    const settings = await getSettings();
    const batchId = `boss-ext-${Date.now()}`;
    const payload = {
        jobs,
        source: "boss-extension",
        batch_id: batchId,
    };
    try {
        const resp = await fetch(`${settings.serverUrl}/api/jobs/ingest`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!resp.ok) {
            const text = await resp.text();
            return { ok: false, synced: 0, error: `HTTP ${resp.status}: ${text}` };
        }
        const data = await resp.json();
        const synced = jobs.length;
        // 同步成功后清空本地缓存
        await saveJobs([]);
        await chrome.action.setBadgeText({ text: "" });
        return { ok: true, synced, ...data };
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, synced: 0, error: msg };
    }
}
// ---- 消息处理 ----
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    switch (message.type) {
        case "JOBS_COLLECTED":
            mergeJobs(message.jobs).then((added) => {
                sendResponse({ added });
            });
            return true; // 异步 sendResponse
        case "SYNC_TO_SERVER":
            syncToServer().then((result) => {
                sendResponse(result);
            });
            return true;
        case "GET_STATUS":
            getJobs().then((jobs) => {
                getSettings().then((settings) => {
                    sendResponse({ count: jobs.length, serverUrl: settings.serverUrl });
                });
            });
            return true;
        case "CLEAR_JOBS":
            saveJobs([]).then(() => {
                chrome.action.setBadgeText({ text: "" });
                sendResponse({ ok: true });
            });
            return true;
        default:
            sendResponse({ error: "Unknown message type" });
    }
});
// ---- 初始化 badge ----
chrome.runtime.onInstalled.addListener(async () => {
    const jobs = await getJobs();
    if (jobs.length > 0) {
        await chrome.action.setBadgeText({ text: String(jobs.length) });
        await chrome.action.setBadgeBackgroundColor({ color: "#3b82f6" });
    }
});
export {};
