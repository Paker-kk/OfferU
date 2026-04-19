// =============================================
// OfferU Extension  Popup Script
// =============================================
const DEFAULT_SERVER_URL = "http://127.0.0.1:8000";
// ---- DOM 元素 ----
const tabButtons = Array.from(document.querySelectorAll(".tab-btn"));
const tabPanels = Array.from(document.querySelectorAll(".tab-panel"));
const totalCountEl = document.getElementById("totalCount");
const readyCountEl = document.getElementById("readyCount");
const draftCountEl = document.getElementById("draftCount");
const syncBtn = document.getElementById("syncBtn");
const clearBtn = document.getElementById("clearBtn");
const removeSelectedBtn = document.getElementById("removeSelectedBtn");
const selectAllJobsEl = document.getElementById("selectAllJobs");
const messageEl = document.getElementById("message");
const jobListEl = document.getElementById("jobList");
const resumeSearchInput = document.getElementById("resumeSearchInput");
const refreshResumeBtn = document.getElementById("refreshResumeBtn");
const resumeListEl = document.getElementById("resumeList");
const resumePreviewModal = document.getElementById("resumePreviewModal");
const resumeModalTitleEl = document.getElementById("resumeModalTitle");
const resumeModalMetaEl = document.getElementById("resumeModalMeta");
const resumeModalBodyEl = document.getElementById("resumeModalBody");
const copyResumeBtn = document.getElementById("copyResumeBtn");
const closeResumePreviewBtn = document.getElementById("closeResumePreviewBtn");
const closeResumePreviewBtn2 = document.getElementById("closeResumePreviewBtn2");
const serverUrlInput = document.getElementById("serverUrl");
const saveSettingsBtn = document.getElementById("saveSettingsBtn");
const checkServerBtn = document.getElementById("checkServerBtn");
const serviceStatusEl = document.getElementById("serviceStatus");
const selectedHashKeys = new Set();
const resumeDetailCache = new Map();
let currentTab = "cart";
let currentJobs = [];
let currentResumes = [];
let selectedResumeId = null;
function sendMessage(message) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (resp) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
                return;
            }
            resolve(resp);
        });
    });
}
function escapeHtml(input) {
    return input
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
function formatDateTime(iso) {
    if (!iso)
        return "-";
    const dt = new Date(iso);
    if (Number.isNaN(dt.getTime()))
        return iso;
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    const hh = String(dt.getHours()).padStart(2, "0");
    const mm = String(dt.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${d} ${hh}:${mm}`;
}
function normalizeServerUrl(input) {
    const value = input.trim() || DEFAULT_SERVER_URL;
    try {
        const parsed = new URL(value);
        if (!/^https?:$/i.test(parsed.protocol)) {
            return DEFAULT_SERVER_URL;
        }
        return parsed.origin;
    }
    catch {
        return DEFAULT_SERVER_URL;
    }
}
function getServerUrl() {
    return normalizeServerUrl(serverUrlInput.value || DEFAULT_SERVER_URL);
}
function showMessage(text, type) {
    messageEl.textContent = text;
    messageEl.className = `message ${type}`;
    window.setTimeout(() => {
        if (messageEl.textContent === text) {
            messageEl.textContent = "";
            messageEl.className = "message";
        }
    }, 4200);
}
function activateTab(tab) {
    currentTab = tab;
    tabButtons.forEach((button) => {
        button.classList.toggle("active", button.dataset.tab === tab);
    });
    tabPanels.forEach((panel) => {
        panel.classList.toggle("active", panel.dataset.panel === tab);
    });
    if (tab === "resumes") {
        void refreshResumes();
    }
}
function updateSelectionControls() {
    const total = currentJobs.length;
    const selected = selectedHashKeys.size;
    selectAllJobsEl.checked = total > 0 && selected === total;
    selectAllJobsEl.indeterminate = selected > 0 && selected < total;
    removeSelectedBtn.disabled = selected === 0;
}
function renderJobs(jobs) {
    currentJobs = [...jobs].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    const validKeys = new Set(currentJobs.map((job) => job.hash_key));
    for (const key of Array.from(selectedHashKeys)) {
        if (!validKeys.has(key))
            selectedHashKeys.delete(key);
    }
    if (currentJobs.length === 0) {
        jobListEl.innerHTML = '<div class="empty-jobs">购物车为空，去招聘网站列表页或详情页手动加入岗位</div>';
        updateSelectionControls();
        return;
    }
    const topJobs = currentJobs.slice(0, 40);
    jobListEl.innerHTML = topJobs
        .map((job) => {
        const statusLabel = job.status === "ready_to_sync" ? "可同步" : "草稿待补全";
        const statusClass = job.status === "ready_to_sync" ? "chip-ready" : "chip-draft";
        const checked = selectedHashKeys.has(job.hash_key) ? "checked" : "";
        return `
        <article class="job-item">
          <div class="job-item-head">
            <input class="job-check" type="checkbox" data-hash="${escapeHtml(job.hash_key)}" ${checked} />
            <div class="job-item-main">
              <div class="job-title" title="${escapeHtml(job.title)}">${escapeHtml(job.title)}</div>
              <div class="job-company" title="${escapeHtml(job.company)}">${escapeHtml(job.company)}</div>
              <div class="job-meta">
                <span class="chip ${statusClass}">${statusLabel}</span>
                <span class="chip chip-source">${escapeHtml(job.source)}</span>
              </div>
              <div class="job-submeta">
                <span class="job-salary">${escapeHtml(job.salary_text || "薪资未标注")}</span>
                <span>${escapeHtml(formatDateTime(job.created_at))}</span>
              </div>
            </div>
            <button class="job-remove" type="button" data-remove-hash="${escapeHtml(job.hash_key)}">移除</button>
          </div>
        </article>
      `;
    })
        .join("");
    updateSelectionControls();
}
async function refreshJobs() {
    try {
        const msg = { type: "GET_JOBS" };
        const resp = await sendMessage(msg);
        renderJobs(resp?.jobs || []);
    }
    catch {
        jobListEl.innerHTML = '<div class="empty-jobs">读取岗位失败，请稍后重试</div>';
    }
}
async function removeOneJob(hashKey) {
    try {
        const msg = { type: "REMOVE_JOB", hashKey };
        const resp = await sendMessage(msg);
        if (resp.ok) {
            selectedHashKeys.delete(hashKey);
            showMessage("已移除岗位", "info");
            await refreshStatus();
        }
    }
    catch {
        showMessage("移除失败，请重试", "error");
    }
}
async function removeSelectedJobs() {
    if (selectedHashKeys.size === 0)
        return;
    const confirmed = window.confirm(`确认移除 ${selectedHashKeys.size} 条已选岗位吗？`);
    if (!confirmed)
        return;
    removeSelectedBtn.disabled = true;
    try {
        const msg = { type: "REMOVE_JOBS", hashKeys: Array.from(selectedHashKeys) };
        const resp = await sendMessage(msg);
        if (resp.ok) {
            selectedHashKeys.clear();
            showMessage(`已移除 ${resp.removed} 条岗位`, "info");
            await refreshStatus();
        }
    }
    catch {
        showMessage("批量移除失败，请重试", "error");
    }
    finally {
        removeSelectedBtn.disabled = false;
    }
}
function bindJobListEvents() {
    jobListEl.addEventListener("change", (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement))
            return;
        if (!target.matches("input.job-check"))
            return;
        const hash = target.dataset.hash || "";
        if (!hash)
            return;
        if (target.checked) {
            selectedHashKeys.add(hash);
        }
        else {
            selectedHashKeys.delete(hash);
        }
        updateSelectionControls();
    });
    jobListEl.addEventListener("click", (event) => {
        const target = event.target;
        const button = target.closest("button[data-remove-hash]");
        if (!button)
            return;
        const hash = button.dataset.removeHash || "";
        if (!hash)
            return;
        void removeOneJob(hash);
    });
}
async function refreshStatus() {
    const msg = { type: "GET_STATUS" };
    try {
        const resp = await sendMessage(msg);
        totalCountEl.textContent = String(resp.total);
        readyCountEl.textContent = String(resp.ready);
        draftCountEl.textContent = String(resp.draft);
        serverUrlInput.value = resp.serverUrl;
        syncBtn.disabled = resp.ready === 0;
        await refreshJobs();
    }
    catch {
        showMessage("读取状态失败，请重试", "error");
    }
}
async function fetchJson(url, init) {
    const resp = await fetch(url, init);
    if (!resp.ok) {
        const text = await resp.text();
        throw new Error(`HTTP ${resp.status}: ${text || "request failed"}`);
    }
    return (await resp.json());
}
function renderResumes(resumes) {
    const keyword = resumeSearchInput.value.trim().toLowerCase();
    const list = [...resumes].sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
    const filtered = keyword
        ? list.filter((item) => {
            const title = (item.title || "").toLowerCase();
            const owner = (item.user_name || "").toLowerCase();
            return title.includes(keyword) || owner.includes(keyword);
        })
        : list;
    if (filtered.length === 0) {
        resumeListEl.innerHTML = '<div class="empty-jobs">暂无简历，先在 OfferU 桌面端生成后再查看</div>';
        return;
    }
    resumeListEl.innerHTML = filtered
        .map((resume) => {
        return `
        <article class="resume-item">
          <div class="resume-title" title="${escapeHtml(resume.title || "未命名简历")}">${escapeHtml(resume.title || "未命名简历")}</div>
          <div class="resume-meta">${escapeHtml(resume.user_name || "默认候选人")}  更新于 ${escapeHtml(formatDateTime(resume.updated_at))}</div>
          <div class="resume-actions">
            <button class="btn btn-sm btn-ghost" type="button" data-preview-resume="${resume.id}">预览</button>
            <button class="btn btn-sm" type="button" data-copy-resume="${resume.id}">复制图片</button>
          </div>
        </article>
      `;
    })
        .join("");
}
async function refreshResumes() {
    refreshResumeBtn.disabled = true;
    try {
        const serverUrl = getServerUrl();
        const resumes = await fetchJson(`${serverUrl}/api/resume/`);
        currentResumes = resumes || [];
        renderResumes(currentResumes);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "读取简历失败";
        resumeListEl.innerHTML = `<div class="empty-jobs">读取简历失败：${escapeHtml(message)}</div>`;
    }
    finally {
        refreshResumeBtn.disabled = false;
    }
}
function openResumeModal() {
    resumePreviewModal.classList.remove("hidden");
    resumePreviewModal.setAttribute("aria-hidden", "false");
}
function closeResumeModal() {
    resumePreviewModal.classList.add("hidden");
    resumePreviewModal.setAttribute("aria-hidden", "true");
}
function normalizeSectionLines(section) {
    const lines = [];
    for (const item of section.content_json || []) {
        if (!item || typeof item !== "object")
            continue;
        const text = Object.values(item)
            .filter((v) => typeof v === "string" && v.trim())
            .join("  ")
            .trim();
        if (text)
            lines.push(text);
    }
    return lines;
}
function renderResumePreview(detail) {
    resumeModalTitleEl.textContent = detail.title || "未命名简历";
    resumeModalMetaEl.textContent = `${detail.user_name || "默认候选人"}  更新时间 ${formatDateTime(detail.updated_at)}`;
    const summary = (detail.summary || "").trim();
    const sectionBlocks = detail.sections
        .filter((section) => section.visible)
        .slice(0, 8)
        .map((section) => {
        const lines = normalizeSectionLines(section).slice(0, 4);
        const body = lines.length
            ? `<ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`
            : "<p>暂无内容</p>";
        return `
        <section class="modal-section">
          <div class="modal-section-title">${escapeHtml(section.title || section.section_type)}</div>
          ${body}
        </section>
      `;
    })
        .join("");
    const summaryHtml = summary
        ? `<section class="modal-section"><div class="modal-section-title">个人摘要</div><p>${escapeHtml(summary)}</p></section>`
        : "";
    resumeModalBodyEl.innerHTML = summaryHtml + sectionBlocks;
}
async function getResumeDetail(resumeId) {
    const cached = resumeDetailCache.get(resumeId);
    if (cached)
        return cached;
    const serverUrl = getServerUrl();
    const detail = await fetchJson(`${serverUrl}/api/resume/${resumeId}`);
    resumeDetailCache.set(resumeId, detail);
    return detail;
}
async function copyBlobToClipboard(blob) {
    if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
        throw new Error("当前浏览器不支持图片写入剪贴板 API");
    }
    const mimeType = blob.type || "image/png";
    await navigator.clipboard.write([new ClipboardItem({ [mimeType]: blob })]);
}
async function fetchResumeImageBlob(resumeId) {
    const serverUrl = getServerUrl();
    const response = await fetch(`${serverUrl}/api/resume/${resumeId}/export/image`, {
        method: "POST",
    });
    if (!response.ok) {
        let detail = `HTTP ${response.status}`;
        const contentType = response.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
            try {
                const payload = (await response.json());
                detail = payload.detail || detail;
            }
            catch {
                // ignore json parse failure
            }
        }
        else {
            const text = await response.text();
            if (text)
                detail = text;
        }
        throw new Error(`后端导出图片失败：${detail}`);
    }
    const mediaType = response.headers.get("content-type") || "";
    if (!mediaType.startsWith("image/")) {
        throw new Error(`后端返回了非图片内容：${mediaType || "unknown"}`);
    }
    return await response.blob();
}
async function copyResumeImage(resumeId) {
    const blob = await fetchResumeImageBlob(resumeId);
    await copyBlobToClipboard(blob);
    showMessage("复制成功", "success");
}
async function openResumePreview(resumeId) {
    selectedResumeId = resumeId;
    copyResumeBtn.disabled = true;
    copyResumeBtn.textContent = "加载中...";
    try {
        const detail = await getResumeDetail(resumeId);
        renderResumePreview(detail);
        openResumeModal();
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "读取简历详情失败";
        showMessage(`预览失败：${message}`, "error");
    }
    finally {
        copyResumeBtn.disabled = false;
        copyResumeBtn.textContent = "复制简历图片";
    }
}
function bindResumeListEvents() {
    resumeListEl.addEventListener("click", (event) => {
        const target = event.target;
        const previewBtn = target.closest("button[data-preview-resume]");
        if (previewBtn) {
            const id = Number(previewBtn.dataset.previewResume || "0");
            if (id > 0) {
                void openResumePreview(id);
            }
            return;
        }
        const copyBtn = target.closest("button[data-copy-resume]");
        if (!copyBtn)
            return;
        const id = Number(copyBtn.dataset.copyResume || "0");
        if (id <= 0)
            return;
        copyBtn.disabled = true;
        const oldText = copyBtn.textContent;
        copyBtn.textContent = "复制中...";
        void (async () => {
            try {
                await copyResumeImage(id);
            }
            catch (err) {
                const message = err instanceof Error ? err.message : "复制失败";
                showMessage(`复制失败：${message}`, "error");
            }
            finally {
                copyBtn.disabled = false;
                copyBtn.textContent = oldText || "复制图片";
            }
        })();
    });
}
async function checkServerConnection() {
    const serverUrl = getServerUrl();
    serviceStatusEl.textContent = "检查中...";
    serviceStatusEl.style.color = "#1d4ed8";
    try {
        const health = await fetchJson(`${serverUrl}/api/health`);
        serviceStatusEl.textContent = `连接正常：${health.service} (${health.status})`;
        serviceStatusEl.style.color = "#047857";
    }
    catch {
        serviceStatusEl.textContent = "连接失败：请先启动 OfferU 桌面端后端服务";
        serviceStatusEl.style.color = "#b91c1c";
    }
}
function bindModalEvents() {
    closeResumePreviewBtn.addEventListener("click", closeResumeModal);
    closeResumePreviewBtn2.addEventListener("click", closeResumeModal);
    resumePreviewModal.addEventListener("click", (event) => {
        const target = event.target;
        if (target.matches("[data-close-modal='1']")) {
            closeResumeModal();
        }
    });
}
function bindTabEvents() {
    tabButtons.forEach((button) => {
        button.addEventListener("click", () => {
            const tab = (button.dataset.tab || "cart");
            activateTab(tab);
        });
    });
}
// ---- 绑定购物车操作 ----
syncBtn.addEventListener("click", () => {
    syncBtn.disabled = true;
    syncBtn.innerHTML = '<span class="btn-icon">..</span> 同步中...';
    const msg = { type: "SYNC_TO_SERVER" };
    sendMessage(msg)
        .then((resp) => {
        if (resp?.ok) {
            const tip = resp.skippedDraft > 0 ? `，${resp.skippedDraft} 条草稿待补全` : "";
            showMessage(`已同步 ${resp.synced} 条岗位${tip}`, "success");
        }
        else {
            const base = resp?.error || "未知错误";
            const tip = resp?.skippedDraft ? `（草稿待补全: ${resp.skippedDraft}）` : "";
            showMessage(`同步失败: ${base}${tip}`, "error");
        }
        return refreshStatus();
    })
        .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        showMessage(`同步失败: ${message}`, "error");
        return refreshStatus();
    })
        .finally(() => {
        syncBtn.innerHTML = '<span class="btn-icon">→</span> 一键同步到 OfferU';
    });
});
clearBtn.addEventListener("click", () => {
    const confirmClear = window.confirm("确认清空购物车中的岗位吗？");
    if (!confirmClear)
        return;
    const msg = { type: "CLEAR_JOBS" };
    sendMessage(msg)
        .then(() => {
        selectedHashKeys.clear();
        showMessage("已清空购物车", "info");
        return refreshStatus();
    })
        .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        showMessage(`清空失败: ${message}`, "error");
    });
});
removeSelectedBtn.addEventListener("click", () => {
    void removeSelectedJobs();
});
selectAllJobsEl.addEventListener("change", () => {
    if (selectAllJobsEl.checked) {
        currentJobs.forEach((job) => selectedHashKeys.add(job.hash_key));
    }
    else {
        selectedHashKeys.clear();
    }
    jobListEl.querySelectorAll("input.job-check").forEach((input) => {
        input.checked = selectAllJobsEl.checked;
    });
    updateSelectionControls();
});
saveSettingsBtn.addEventListener("click", () => {
    const url = serverUrlInput.value.trim();
    if (!url) {
        showMessage("请输入有效的服务器地址", "error");
        return;
    }
    try {
        const parsed = new URL(url);
        if (!/^https?:$/i.test(parsed.protocol)) {
            showMessage("仅支持 http/https 地址", "error");
            return;
        }
    }
    catch {
        showMessage("请输入有效的 URL 格式", "error");
        return;
    }
    chrome.storage.local.set({ settings: { serverUrl: normalizeServerUrl(url) } }, () => {
        showMessage("设置已保存", "success");
    });
});
checkServerBtn.addEventListener("click", () => {
    void checkServerConnection();
});
resumeSearchInput.addEventListener("input", () => {
    renderResumes(currentResumes);
});
refreshResumeBtn.addEventListener("click", () => {
    void refreshResumes();
});
copyResumeBtn.addEventListener("click", () => {
    if (!selectedResumeId) {
        showMessage("请先选择要复制的简历", "error");
        return;
    }
    copyResumeBtn.disabled = true;
    const oldText = copyResumeBtn.textContent;
    copyResumeBtn.textContent = "复制中...";
    void (async () => {
        try {
            await copyResumeImage(selectedResumeId);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "复制失败";
            showMessage(`复制失败：${message}`, "error");
        }
        finally {
            copyResumeBtn.disabled = false;
            copyResumeBtn.textContent = oldText || "复制简历图片";
        }
    })();
});
function bootstrap() {
    bindTabEvents();
    bindJobListEvents();
    bindResumeListEvents();
    bindModalEvents();
    removeSelectedBtn.disabled = true;
    activateTab("cart");
    void refreshStatus();
    void checkServerConnection();
}
bootstrap();
export {};
