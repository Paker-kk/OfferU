// =============================================
// OfferU Extension — Background Service Worker
// =============================================
// 管理岗位购物车存储、状态分层与后端同步
// =============================================
import { JOBS_SCHEMA_VERSION, JOBS_STORAGE_KEY, sanitizeVersionedJobsStore, } from "./background/storage.js";
import { buildSyncPlan, isJobReadyToSync, retainUnsyncedJobs, } from "./background/sync-contract.js";
const DEFAULT_SETTINGS = {
    serverUrl: "http://127.0.0.1:8000",
};
const SETTINGS_KEY = "settings";
const OFFSCREEN_CLIPBOARD_DOCUMENT = "offscreen/clipboard.html";
const OFFSCREEN_WRITE_TIMEOUT_MS = 12000;
let creatingOffscreenDocument = null;
const pendingClipboardRequests = new Map();
function buildOffscreenRequestId() {
    return `copy-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
function getOffscreenApi() {
    return chrome.offscreen || null;
}
async function hasOffscreenDocument(documentUrl) {
    const runtimeWithContexts = chrome.runtime;
    if (!runtimeWithContexts.getContexts) {
        return false;
    }
    const contexts = await runtimeWithContexts.getContexts({
        contextTypes: ["OFFSCREEN_DOCUMENT"],
        documentUrls: [documentUrl],
    });
    return contexts.length > 0;
}
async function ensureOffscreenClipboardDocument() {
    const offscreenApi = getOffscreenApi();
    if (!offscreenApi) {
        throw new Error("当前浏览器不支持 offscreen 剪贴板能力");
    }
    const documentUrl = chrome.runtime.getURL(OFFSCREEN_CLIPBOARD_DOCUMENT);
    if (await hasOffscreenDocument(documentUrl)) {
        return;
    }
    if (!creatingOffscreenDocument) {
        creatingOffscreenDocument = offscreenApi
            .createDocument({
            url: OFFSCREEN_CLIPBOARD_DOCUMENT,
            reasons: ["CLIPBOARD"],
            justification: "Write exported resume image to clipboard from extension context",
        })
            .finally(() => {
            creatingOffscreenDocument = null;
        });
    }
    await creatingOffscreenDocument;
}
function waitForOffscreenResult(requestId) {
    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            pendingClipboardRequests.delete(requestId);
            resolve({ ok: false, error: "离屏复制超时" });
        }, OFFSCREEN_WRITE_TIMEOUT_MS);
        pendingClipboardRequests.set(requestId, (result) => {
            clearTimeout(timer);
            pendingClipboardRequests.delete(requestId);
            resolve(result);
        });
    });
}
async function copyImageToClipboardViaOffscreen(imageUrl) {
    if (!imageUrl) {
        return { ok: false, error: "缺少图片地址" };
    }
    try {
        await ensureOffscreenClipboardDocument();
        const requestId = buildOffscreenRequestId();
        const waitResult = waitForOffscreenResult(requestId);
        chrome.runtime.sendMessage({
            type: "OFFSCREEN_WRITE_IMAGE",
            requestId,
            imageUrl,
        });
        return await waitResult;
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return { ok: false, error: message || "离屏复制失败" };
    }
}
function normalizeUrl(url) {
    if (!url)
        return "";
    try {
        return new URL(url).href;
    }
    catch {
        return url;
    }
}
function normalizePostedAt(value) {
    const text = (value || "").trim();
    return text || null;
}
function sanitizeJob(job) {
    const url = normalizeUrl(job.url || "");
    const applyUrl = normalizeUrl(job.apply_url || url);
    const rawDescription = (job.raw_description || "").trim();
    return {
        ...job,
        title: (job.title || "").trim(),
        company: (job.company || "").trim(),
        location: (job.location || "").trim(),
        salary_text: (job.salary_text || "").trim(),
        raw_description: rawDescription,
        posted_at: normalizePostedAt(job.posted_at),
        url,
        apply_url: applyUrl,
        source_page_meta: job.source_page_meta || "",
        education: (job.education || "").trim(),
        experience: (job.experience || "").trim(),
        job_type: (job.job_type || "").trim(),
        company_size: (job.company_size || "").trim(),
        company_industry: (job.company_industry || "").trim(),
        status: rawDescription ? "ready_to_sync" : "draft_pending_jd",
        created_at: job.created_at || new Date().toISOString(),
    };
}
function mergeJob(existing, incoming) {
    const merged = {
        ...existing,
        ...incoming,
        title: incoming.title || existing.title,
        company: incoming.company || existing.company,
        location: incoming.location || existing.location,
        salary_text: incoming.salary_text || existing.salary_text,
        salary_min: incoming.salary_min ?? existing.salary_min,
        salary_max: incoming.salary_max ?? existing.salary_max,
        raw_description: incoming.raw_description || existing.raw_description,
        posted_at: incoming.posted_at || existing.posted_at,
        url: incoming.url || existing.url,
        apply_url: incoming.apply_url || existing.apply_url || incoming.url || existing.url,
        source_page_meta: incoming.source_page_meta || existing.source_page_meta,
        education: incoming.education || existing.education,
        experience: incoming.experience || existing.experience,
        job_type: incoming.job_type || existing.job_type,
        company_size: incoming.company_size || existing.company_size,
        company_industry: incoming.company_industry || existing.company_industry,
        status: incoming.status === "ready_to_sync" || existing.raw_description || incoming.raw_description
            ? "ready_to_sync"
            : "draft_pending_jd",
        created_at: existing.created_at || incoming.created_at || new Date().toISOString(),
    };
    return sanitizeJob(merged);
}
function toIngestJobPayload(job) {
    return {
        title: job.title,
        company: job.company,
        location: job.location,
        url: job.url,
        apply_url: job.apply_url || job.url,
        source: job.source,
        raw_description: job.raw_description,
        posted_at: job.posted_at || undefined,
        hash_key: job.hash_key,
        salary_min: job.salary_min,
        salary_max: job.salary_max,
        salary_text: job.salary_text,
        education: job.education,
        experience: job.experience,
        job_type: job.job_type,
        company_size: job.company_size,
        company_industry: job.company_industry,
    };
}
async function updateBadge(total) {
    await chrome.action.setBadgeText({ text: total > 0 ? String(total) : "" });
    if (total > 0) {
        await chrome.action.setBadgeBackgroundColor({ color: "#2563eb" });
    }
}
// ---- 存储操作 ----
async function getJobs() {
    const result = await chrome.storage.local.get(JOBS_STORAGE_KEY);
    const raw = result[JOBS_STORAGE_KEY];
    // Legacy migration: older versions stored plain array in collectedJobs.
    if (Array.isArray(raw)) {
        const migrated = {
            version: JOBS_SCHEMA_VERSION,
            jobs: raw,
        };
        await chrome.storage.local.set({ [JOBS_STORAGE_KEY]: migrated });
        return migrated.jobs;
    }
    const parsed = sanitizeVersionedJobsStore(raw);
    return parsed.jobs;
}
async function saveJobs(jobs) {
    const payload = {
        version: JOBS_SCHEMA_VERSION,
        jobs,
    };
    await chrome.storage.local.set({ [JOBS_STORAGE_KEY]: payload });
    await updateBadge(jobs.length);
}
async function getSettings() {
    const result = await chrome.storage.local.get(SETTINGS_KEY);
    return result[SETTINGS_KEY] || DEFAULT_SETTINGS;
}
// ---- 去重合并 ----
async function mergeJobs(newJobs) {
    const existing = await getJobs();
    const existingMap = new Map(existing.map((j) => [j.hash_key, j]));
    let added = 0;
    let upgraded = 0;
    let skipped = 0;
    for (const job of newJobs) {
        const incoming = sanitizeJob(job);
        const old = existingMap.get(incoming.hash_key);
        if (!old) {
            existing.push(incoming);
            existingMap.set(incoming.hash_key, incoming);
            added++;
            continue;
        }
        const merged = mergeJob(old, incoming);
        const oldReady = old.status === "ready_to_sync";
        const newReady = merged.status === "ready_to_sync";
        const improvedDescription = Boolean(merged.raw_description) && merged.raw_description !== old.raw_description;
        if (!oldReady && newReady) {
            upgraded++;
        }
        else if (improvedDescription) {
            upgraded++;
        }
        else {
            skipped++;
        }
        const idx = existing.findIndex((j) => j.hash_key === merged.hash_key);
        if (idx >= 0) {
            existing[idx] = merged;
        }
    }
    await saveJobs(existing);
    return { added, upgraded, skipped };
}
async function getStatus() {
    const jobs = await getJobs();
    const ready = jobs.filter((j) => isJobReadyToSync(j)).length;
    const draft = jobs.length - ready;
    const settings = await getSettings();
    return {
        total: jobs.length,
        ready,
        draft,
        serverUrl: settings.serverUrl,
    };
}
async function removeOneJob(hashKey) {
    if (!hashKey) {
        const jobs = await getJobs();
        return { ok: false, removed: 0, remaining: jobs.length };
    }
    const jobs = await getJobs();
    const before = jobs.length;
    const next = jobs.filter((job) => job.hash_key !== hashKey);
    await saveJobs(next);
    return {
        ok: true,
        removed: Math.max(0, before - next.length),
        remaining: next.length,
    };
}
async function removeManyJobs(hashKeys) {
    if (!hashKeys || hashKeys.length === 0) {
        const jobs = await getJobs();
        return { ok: false, removed: 0, remaining: jobs.length };
    }
    const keySet = new Set(hashKeys.filter(Boolean));
    const jobs = await getJobs();
    const before = jobs.length;
    const next = jobs.filter((job) => !keySet.has(job.hash_key));
    await saveJobs(next);
    return {
        ok: true,
        removed: Math.max(0, before - next.length),
        remaining: next.length,
    };
}
// ---- 同步到 OfferU 后端 ----
async function syncToServer() {
    const jobs = await getJobs();
    if (jobs.length === 0) {
        return { ok: true, synced: 0, skippedDraft: 0 };
    }
    const normalizedJobs = jobs.map(sanitizeJob);
    const { jobsToSync, skippedDraft } = buildSyncPlan(normalizedJobs);
    if (jobsToSync.length === 0) {
        return { ok: true, synced: 0, skippedDraft };
    }
    const settings = await getSettings();
    const batchId = `offeru-ext-${Date.now()}`;
    const payload = {
        jobs: jobsToSync.map(toIngestJobPayload),
        source: "offeru-extension",
        batch_id: batchId,
    };
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
        const resp = await fetch(`${settings.serverUrl}/api/jobs/ingest`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
            body: JSON.stringify(payload),
        });
        if (!resp.ok) {
            const text = await resp.text();
            return { ok: false, synced: 0, skippedDraft, error: `HTTP ${resp.status}: ${text}` };
        }
        const data = await resp.json().catch(() => ({}));
        const created = typeof data.created === "number" ? data.created : jobsToSync.length;
        const skipped = typeof data.skipped === "number" ? data.skipped : 0;
        const synced = Math.max(0, created + skipped);
        const remainingJobs = retainUnsyncedJobs(normalizedJobs, jobsToSync);
        await saveJobs(remainingJobs);
        return { ok: true, synced, skippedDraft };
    }
    catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
            return { ok: false, synced: 0, skippedDraft, error: "同步超时，请检查后端服务是否可访问" };
        }
        const msg = err instanceof Error ? err.message : String(err);
        return { ok: false, synced: 0, skippedDraft, error: msg };
    }
    finally {
        clearTimeout(timeout);
    }
}
// ---- 消息处理 ----
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    switch (message.type) {
        case "JOBS_COLLECTED":
            mergeJobs(message.jobs).then((result) => {
                sendResponse(result);
            });
            return true; // 异步 sendResponse
        case "SYNC_TO_SERVER":
            syncToServer().then((result) => {
                sendResponse(result);
            });
            return true;
        case "GET_STATUS":
            getStatus().then((status) => {
                sendResponse(status);
            });
            return true;
        case "GET_JOBS":
            getJobs().then((jobs) => {
                sendResponse({ jobs });
            });
            return true;
        case "COPY_IMAGE_TO_CLIPBOARD":
            copyImageToClipboardViaOffscreen(message.imageUrl).then((result) => {
                sendResponse(result);
            });
            return true;
        case "OFFSCREEN_WRITE_IMAGE_RESULT": {
            const resolver = pendingClipboardRequests.get(message.requestId);
            if (resolver) {
                resolver({ ok: message.ok, error: message.error });
            }
            return false;
        }
        case "OFFSCREEN_WRITE_IMAGE":
            // Relay message for offscreen page only.
            return false;
        case "OPEN_DRAWER": {
            const tab = message.tab || "settings";
            const url = chrome.runtime.getURL(`popup.html?tab=${tab}`);
            chrome.tabs.create({ url }, () => {
                if (chrome.runtime.lastError) {
                    sendResponse({ ok: false, error: chrome.runtime.lastError.message });
                    return;
                }
                sendResponse({ ok: true });
            });
            return true;
        }
        case "REMOVE_JOB":
            removeOneJob(message.hashKey).then((result) => {
                sendResponse(result);
            });
            return true;
        case "REMOVE_JOBS":
            removeManyJobs(message.hashKeys).then((result) => {
                sendResponse(result);
            });
            return true;
        case "CLEAR_JOBS":
            saveJobs([]).then(() => {
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
    await updateBadge(jobs.length);
});
chrome.runtime.onStartup.addListener(async () => {
    const jobs = await getJobs();
    await updateBadge(jobs.length);
});
