// =============================================
// OfferU Extension — Content Script (五平台)
// =============================================
// 列表页：网页内手动加入购物车（草稿态）
// 详情页：手动加入并补全 JD（可同步态）
// =============================================
import { buildHashKey, canonicalUrl, cleanText, parseSalary } from "./lib/collect-utils.js";
const PLATFORMS = [
    {
        source: "boss",
        hostPattern: /(?:^|\.)zhipin\.com$/i,
        listCard: "li.job-card-box, .job-list li.job-card-box",
        listActionTargets: [".job-info", ".job-card-left", ".info-public"],
        listTitle: [".job-name", ".job-title"],
        listCompany: [".company-name a", ".company-name", ".boss-name"],
        listSalary: [".salary"],
        listLocation: [".job-area"],
        listLink: ["a[href*='job_detail']", "a"],
        listTags: [".tag-list li", ".job-info .tag-list span"],
        listCompanyTags: [".company-tag-list li"],
        detailTitle: [".info-primary .name", ".name h1", "h1"],
        detailCompany: [".company-info .name", ".company-info a", ".boss-name"],
        detailSalary: [".salary"],
        detailLocation: [".location-address", ".job-location .location-address"],
        detailDescription: [".job-sec-text", ".job-detail .job-sec-text"],
        detailApplyLink: ["a.btn-startchat", "a.op-btn.op-btn-chat", "a[href*='job_detail']"],
        detailTags: [".job-tags .tag-item", ".tag-list li"],
        detailCompanyTags: [".company-info p", ".sider-company p"],
        detailPathHint: /job_detail/i,
    },
    {
        source: "liepin",
        hostPattern: /(?:^|\.)liepin\.com$/i,
        listCard: ".job-card-pc-container, .job-list-item, .job-item",
        listActionTargets: [".job-card-pc-container__header", ".job-title-box", ".job-item"],
        listTitle: [".job-title-box a", ".job-title", ".ellipsis-1"],
        listCompany: [".company-name", ".company-name a", ".company-title"],
        listSalary: [".job-salary", ".salary"],
        listLocation: [".job-dq", ".job-area", ".city"],
        listLink: ["a[href*='job']", "a"],
        listTags: [".job-labels-box span", ".labels span"],
        listCompanyTags: [".company-tags span", ".company-tags li"],
        detailTitle: [".job-title-box .name", ".job-title", "h1"],
        detailCompany: [".company-name", ".company-name a", ".company-title"],
        detailSalary: [".job-salary", ".salary"],
        detailLocation: [".basic-infor .job-address", ".job-address", ".city"],
        detailDescription: [".job-content", ".content-word", ".job-detail-content"],
        detailApplyLink: ["a[href*='deliver']", "a[href*='apply']"],
        detailTags: [".job-qualifications span", ".job-labels-box span"],
        detailCompanyTags: [".company-other span", ".company-tags span"],
        detailPathHint: /job/i,
    },
    {
        source: "zhaopin",
        hostPattern: /(?:^|\.)zhaopin\.com$/i,
        listCard: ".joblist-box__item, .positionlist__list-item, .joblist-item",
        listActionTargets: [".jobinfo__top", ".jobinfo", ".positionlist__item"],
        listTitle: [".jobinfo__name", ".job-title", ".position-name"],
        listCompany: [".company__name", ".company-name", ".company-title"],
        listSalary: [".jobinfo__salary", ".salary"],
        listLocation: [".jobinfo__area", ".job-area", ".job-address"],
        listLink: ["a[href*='jobs.zhaopin.com']", "a"],
        listTags: [".jobinfo__tag span", ".tag-box span"],
        listCompanyTags: [".company__info span", ".company-tag span"],
        detailTitle: [".jobdetail-box__title", ".job-name", "h1"],
        detailCompany: [".company-name", ".company-name a", ".company__name"],
        detailSalary: [".salary", ".jobdetail-box__salary"],
        detailLocation: [".jobdetail-box__job-address", ".job-address"],
        detailDescription: [".describtion__detail-content", ".jobdetail-box__content", ".job-description"],
        detailApplyLink: ["a.apply-btn", "a[href*='apply']"],
        detailTags: [".job-require span", ".jobdetail-box__labels span"],
        detailCompanyTags: [".company__info span", ".company-intro__item"],
        detailPathHint: /job/i,
    },
    {
        source: "shixiseng",
        hostPattern: /(?:^|\.)shixiseng\.com$/i,
        listCard: ".intern-item, .position-item, .intern-wrap .intern-item",
        listActionTargets: [".intern-detail", ".intern-item__bd", ".position-item"],
        listTitle: [".job-name", ".name", ".title a"],
        listCompany: [".company-name", ".company-info .name", ".company"],
        listSalary: [".day-salary", ".salary"],
        listLocation: [".area", ".city", ".address"],
        listLink: ["a[href*='/intern/']", "a"],
        listTags: [".more span", ".job-tags span"],
        listCompanyTags: [".company-more span", ".company-tags span"],
        detailTitle: [".new_job_name", ".job-name", "h1"],
        detailCompany: [".com-name", ".company-name", ".company-info .name"],
        detailSalary: [".job_money", ".salary"],
        detailLocation: [".job_position", ".position", ".city"],
        detailDescription: [".job_detail", ".detail-content", ".job-desc"],
        detailApplyLink: ["a.apply-btn", "a[href*='delivery']"],
        detailTags: [".job_msg span", ".job-tags span"],
        detailCompanyTags: [".com_msg span", ".company-tags span"],
        detailPathHint: /intern/i,
    },
    {
        source: "linkedin",
        hostPattern: /(?:^|\.)linkedin\.com$/i,
        listCard: ".jobs-search-results__list-item, .job-card-container, li.scaffold-layout__list-item",
        listActionTargets: [".job-card-container__content", ".job-card-list__entity-lockup", ".job-card-container"],
        listTitle: [".base-search-card__title", ".job-card-list__title", "h3"],
        listCompany: [".base-search-card__subtitle", ".job-card-container__company-name", ".artdeco-entity-lockup__subtitle"],
        listSalary: [".salary", ".compensation__salary"],
        listLocation: [".job-search-card__location", ".job-card-container__metadata-item"],
        listLink: ["a.base-card__full-link", "a.job-card-list__title", "a[href*='/jobs/view/']"],
        listTags: [".job-card-container__metadata-wrapper li", ".job-card-container__footer-item"],
        listCompanyTags: [".job-card-container__metadata-item", ".job-card-container__insight"],
        detailTitle: [".job-details-jobs-unified-top-card__job-title", "h1.t-24", "h1"],
        detailCompany: [".job-details-jobs-unified-top-card__company-name", ".jobs-unified-top-card__company-name"],
        detailSalary: [".salary", ".compensation__salary"],
        detailLocation: [".job-details-jobs-unified-top-card__bullet", ".jobs-unified-top-card__bullet"],
        detailDescription: [".jobs-description-content__text", ".jobs-box__html-content", ".show-more-less-html__markup"],
        detailApplyLink: ["a.jobs-apply-button", "a[data-control-name='jobdetails_topcard_inapply']"],
        detailTags: [".job-details-preferences-and-skills__pill", ".job-details-how-you-match__skills-item-subtitle"],
        detailCompanyTags: [".jobs-company__box li", ".jobs-company__inline-information li"],
        detailPathHint: /jobs\/view/i,
    },
];
const OFFERU_TOAST_ID = "offeru-ext-toast";
const DETAIL_BUTTON_ID = "offeru-ext-detail-button";
const LIST_BUTTON_FLAG = "data-offeru-list-btn";
const FLOATING_DOCK_ID = "offeru-ext-floating-dock";
function textOf(el) {
    return cleanText(el?.textContent || "");
}
function pickEl(root, selectors) {
    for (const selector of selectors) {
        const found = root.querySelector(selector);
        if (found)
            return found;
    }
    return null;
}
function pickText(root, selectors) {
    return textOf(pickEl(root, selectors));
}
function pickAllText(root, selectors) {
    const values = [];
    for (const selector of selectors) {
        const nodes = root.querySelectorAll(selector);
        nodes.forEach((node) => {
            const value = textOf(node);
            if (value)
                values.push(value);
        });
        if (values.length > 0)
            break;
    }
    return values;
}
function pickLink(root, selectors) {
    for (const selector of selectors) {
        const node = root.querySelector(selector);
        if (!node)
            continue;
        const href = node.href || node.getAttribute("href") || "";
        if (!href)
            continue;
        try {
            return canonicalUrl(new URL(href, window.location.href).href, window.location.href);
        }
        catch {
            return href;
        }
    }
    return "";
}
function pickTag(tags, rule) {
    return tags.find((tag) => rule.test(tag)) || "";
}
function buildMeta(pageType, source) {
    return JSON.stringify({
        pageType,
        source,
        hostname: window.location.hostname,
        path: window.location.pathname,
        capturedAt: new Date().toISOString(),
    });
}
function resolveCurrentPlatform() {
    const host = window.location.hostname;
    return PLATFORMS.find((platform) => platform.hostPattern.test(host)) || null;
}
function isDetailPage(platform) {
    if (platform.detailPathHint && platform.detailPathHint.test(window.location.pathname)) {
        return true;
    }
    const hasDescription = Boolean(pickText(document, platform.detailDescription));
    const hasTitle = Boolean(pickText(document, platform.detailTitle));
    return hasDescription && hasTitle;
}
function isListPage(platform) {
    return document.querySelectorAll(platform.listCard).length > 0;
}
function extractFromListCard(card, platform) {
    const title = pickText(card, platform.listTitle);
    const company = pickText(card, platform.listCompany);
    if (!title || !company)
        return null;
    const salaryText = pickText(card, platform.listSalary);
    const { min, max } = parseSalary(salaryText);
    const location = pickText(card, platform.listLocation);
    const url = canonicalUrl(pickLink(card, platform.listLink), window.location.href);
    const tags = pickAllText(card, platform.listTags);
    const companyTags = pickAllText(card, platform.listCompanyTags);
    return {
        title,
        company,
        location,
        salary_text: salaryText,
        salary_min: min,
        salary_max: max,
        raw_description: "",
        url,
        apply_url: url,
        source: platform.source,
        source_page_meta: buildMeta("list", platform.source),
        education: pickTag(tags, /本科|硕士|博士|大专|学历|degree/i),
        experience: pickTag(tags, /经验|应届|实习|年|experience/i),
        job_type: pickTag(tags, /全职|实习|校招|兼职|full|intern/i),
        company_size: pickTag(companyTags, /人|employees|employee/i),
        company_industry: companyTags.find((item) => !/人|employees|employee/i.test(item)) || "",
        hash_key: buildHashKey(platform.source, title, company, url),
        status: "draft_pending_jd",
        created_at: new Date().toISOString(),
    };
}
function extractFromDetailPage(platform) {
    const title = pickText(document, platform.detailTitle) || pickText(document, platform.listTitle);
    const company = pickText(document, platform.detailCompany) || pickText(document, platform.listCompany);
    if (!title || !company)
        return null;
    const salaryText = pickText(document, platform.detailSalary) || pickText(document, platform.listSalary);
    const { min, max } = parseSalary(salaryText);
    const location = pickText(document, platform.detailLocation) || pickText(document, platform.listLocation);
    const description = pickText(document, platform.detailDescription);
    const tags = pickAllText(document, platform.detailTags);
    const companyTags = pickAllText(document, platform.detailCompanyTags);
    const currentUrl = canonicalUrl(window.location.href, window.location.href);
    const applyUrl = canonicalUrl(pickLink(document, platform.detailApplyLink) || currentUrl, window.location.href);
    return {
        title,
        company,
        location,
        salary_text: salaryText,
        salary_min: min,
        salary_max: max,
        raw_description: description,
        url: currentUrl,
        apply_url: applyUrl,
        source: platform.source,
        source_page_meta: buildMeta("detail", platform.source),
        education: pickTag(tags, /本科|硕士|博士|大专|学历|degree/i),
        experience: pickTag(tags, /经验|应届|实习|年|experience/i),
        job_type: pickTag(tags, /全职|实习|校招|兼职|full|intern/i),
        company_size: pickTag(companyTags, /人|employees|employee/i),
        company_industry: companyTags.find((item) => !/人|employees|employee/i.test(item)) || "",
        hash_key: buildHashKey(platform.source, title, company, currentUrl),
        status: description ? "ready_to_sync" : "draft_pending_jd",
        created_at: new Date().toISOString(),
    };
}
function showToast(message, isError = false) {
    const existing = document.getElementById(OFFERU_TOAST_ID);
    if (existing)
        existing.remove();
    const toast = document.createElement("div");
    toast.id = OFFERU_TOAST_ID;
    toast.textContent = message;
    toast.style.position = "fixed";
    toast.style.top = "16px";
    toast.style.right = "16px";
    toast.style.zIndex = "2147483647";
    toast.style.padding = "10px 14px";
    toast.style.borderRadius = "8px";
    toast.style.background = isError ? "#b91c1c" : "#0f172a";
    toast.style.color = "#f8fafc";
    toast.style.fontSize = "13px";
    toast.style.boxShadow = "0 8px 20px rgba(0,0,0,0.25)";
    toast.style.maxWidth = "340px";
    document.body.appendChild(toast);
    window.setTimeout(() => toast.remove(), 2400);
}
function createFloatingDock(platform) {
    if (document.getElementById(FLOATING_DOCK_ID))
        return;
    const host = document.createElement("div");
    host.id = FLOATING_DOCK_ID;
    host.style.position = "fixed";
    host.style.zIndex = "2147483645";
    host.style.top = "38%";
    host.style.right = "12px";
    host.style.left = "auto";
    host.style.transition = "transform 0.18s ease";
    const root = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
    .dock {
      font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
    }
    .compact {
      all: initial;
      font-family: inherit;
      border: 1px solid #dbe2ea;
      border-radius: 999px;
      background: #ffffff;
      color: #111827;
      height: 28px;
      min-width: 86px;
      padding: 0 8px;
      box-shadow: 0 6px 16px rgba(15, 23, 42, 0.16);
      display: inline-flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
    }
    .brand {
      font-size: 11px;
      font-weight: 700;
      color: #1d4ed8;
      line-height: 1;
    }
    .badge {
      min-width: 14px;
      height: 14px;
      border-radius: 999px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: #ef4444;
      color: #fff;
      font-size: 10px;
      font-weight: 700;
      padding: 0 4px;
      line-height: 1;
    }
    .chev {
      color: #6b7280;
      font-size: 10px;
      line-height: 1;
      transform: translateY(1px);
    }
    .panel {
      margin-top: 8px;
      width: 142px;
      border: 1px solid #dbe2ea;
      border-radius: 10px;
      background: #ffffff;
      box-shadow: 0 10px 22px rgba(15, 23, 42, 0.2);
      padding: 8px;
      display: none;
    }
    .panel.show {
      display: block;
    }
    .actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
    }
    .action-btn {
      all: initial;
      font-family: inherit;
      border-radius: 7px;
      height: 24px;
      padding: 0 7px;
      font-size: 10px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      border: 1px solid #d4d9e1;
      background: #ffffff;
      color: #374151;
      line-height: 1;
    }
    .action-btn.primary {
      background: linear-gradient(135deg, #0f66e9, #1f88ff);
      border-color: #0f66e9;
      color: #ffffff;
    }
    .meta {
      margin-top: 7px;
      font-size: 10px;
      color: #6b7280;
      text-align: center;
      line-height: 1.3;
    }
    .dock.side-left .panel {
      transform-origin: left top;
    }
    .dock.side-right .panel {
      margin-left: auto;
      transform-origin: right top;
    }
  `;
    const wrap = document.createElement("div");
    wrap.className = "dock side-right";
    const compactBtn = document.createElement("button");
    compactBtn.type = "button";
    compactBtn.className = "compact";
    compactBtn.innerHTML = `
    <span class="brand">OfferU</span>
    <span class="badge" id="offeruFloatingBadge">0</span>
    <span class="chev" id="offeruFloatingChevron">˅</span>
  `;
    const panel = document.createElement("div");
    panel.className = "panel";
    panel.innerHTML = `
    <div class="actions">
      <button class="action-btn" data-action="collect" type="button">+ 加入</button>
      <button class="action-btn primary" data-action="sync" type="button">去同步</button>
    </div>
    <div class="meta" id="offeruFloatingMeta">草稿 0 条 | 可同步 0 条</div>
  `;
    wrap.appendChild(compactBtn);
    wrap.appendChild(panel);
    root.appendChild(style);
    root.appendChild(wrap);
    const badgeEl = root.querySelector("#offeruFloatingBadge");
    const chevEl = root.querySelector("#offeruFloatingChevron");
    const metaEl = root.querySelector("#offeruFloatingMeta");
    let expanded = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragOriginX = 0;
    let dragOriginY = 0;
    let dragging = false;
    let side = "right";
    function updatePeek() {
        if (expanded) {
            host.style.transform = "translateX(0)";
            return;
        }
        host.style.transform = side === "left" ? "translateX(-10px)" : "translateX(10px)";
    }
    function setSide(next) {
        side = next;
        wrap.classList.toggle("side-left", side === "left");
        wrap.classList.toggle("side-right", side === "right");
    }
    function setExpanded(next) {
        expanded = next;
        panel.classList.toggle("show", expanded);
        if (chevEl) {
            chevEl.textContent = expanded ? "˄" : "˅";
        }
        updatePeek();
    }
    function getRect() {
        const rect = host.getBoundingClientRect();
        return { x: rect.left, y: rect.top };
    }
    function moveTo(x, y) {
        const maxY = Math.max(8, window.innerHeight - 44);
        const safeY = Math.max(8, Math.min(y, maxY));
        host.style.top = `${safeY}px`;
        host.style.left = `${x}px`;
        host.style.right = "auto";
    }
    function snapToEdge() {
        const rect = host.getBoundingClientRect();
        const nextSide = rect.left + rect.width / 2 < window.innerWidth / 2 ? "left" : "right";
        setSide(nextSide);
        host.style.left = nextSide === "left" ? "8px" : "auto";
        host.style.right = nextSide === "right" ? "8px" : "auto";
        updatePeek();
    }
    async function refreshFloatingStatus() {
        try {
            const response = await sendRuntimeMessage({ type: "GET_STATUS" });
            if (badgeEl) {
                badgeEl.textContent = String(Math.max(0, response.total));
            }
            if (metaEl) {
                metaEl.textContent = `草稿 ${Math.max(0, response.draft)} 条 | 可同步 ${Math.max(0, response.ready)} 条`;
            }
        }
        catch {
            if (metaEl) {
                metaEl.textContent = "状态读取失败";
            }
        }
    }
    compactBtn.addEventListener("pointerdown", (event) => {
        dragging = false;
        dragStartX = event.clientX;
        dragStartY = event.clientY;
        const pos = getRect();
        dragOriginX = pos.x;
        dragOriginY = pos.y;
        compactBtn.setPointerCapture(event.pointerId);
    });
    compactBtn.addEventListener("pointermove", (event) => {
        if (!compactBtn.hasPointerCapture(event.pointerId))
            return;
        const dx = event.clientX - dragStartX;
        const dy = event.clientY - dragStartY;
        if (!dragging && (Math.abs(dx) > 4 || Math.abs(dy) > 4)) {
            dragging = true;
            setExpanded(false);
        }
        if (!dragging)
            return;
        host.style.transform = "translateX(0)";
        moveTo(dragOriginX + dx, dragOriginY + dy);
    });
    compactBtn.addEventListener("pointerup", (event) => {
        if (!compactBtn.hasPointerCapture(event.pointerId))
            return;
        compactBtn.releasePointerCapture(event.pointerId);
        if (dragging) {
            dragging = false;
            snapToEdge();
            return;
        }
        setExpanded(!expanded);
    });
    compactBtn.addEventListener("pointercancel", () => {
        dragging = false;
        snapToEdge();
    });
    wrap.addEventListener("mouseenter", () => {
        if (!expanded) {
            host.style.transform = "translateX(0)";
        }
    });
    wrap.addEventListener("mouseleave", () => {
        updatePeek();
    });
    panel.addEventListener("click", (event) => {
        const target = event.target;
        const action = target.closest("button[data-action]")?.dataset.action;
        if (!action)
            return;
        if (action === "collect") {
            if (!platform) {
                showToast("当前页面暂不支持采集，请前往招聘站页面", true);
                return;
            }
            const job = isDetailPage(platform)
                ? extractFromDetailPage(platform)
                : (() => {
                    const firstCard = document.querySelector(platform.listCard);
                    return firstCard ? extractFromListCard(firstCard, platform) : null;
                })();
            if (!job) {
                showToast("未识别到可加入岗位，请在详情页或岗位卡片操作", true);
                return;
            }
            collectJobs([job], (resp) => {
                if (!resp) {
                    showToast("加入失败，请稍后重试", true);
                    return;
                }
                if (resp.added > 0) {
                    showToast(`已加入：${job.title}`);
                }
                else if (resp.upgraded > 0) {
                    showToast(`已补全JD：${job.title}`);
                }
                else {
                    showToast("岗位已在购物车");
                }
                void refreshFloatingStatus();
            });
            return;
        }
        if (action === "sync") {
            chrome.runtime.sendMessage({ type: "SYNC_TO_SERVER" }, (resp) => {
                if (chrome.runtime.lastError) {
                    showToast("同步失败，请稍后重试", true);
                    return;
                }
                if (resp?.ok) {
                    showToast(`已同步 ${resp.synced} 条岗位`);
                }
                else {
                    showToast(resp?.error || "同步失败", true);
                }
                void refreshFloatingStatus();
            });
        }
    });
    document.body.appendChild(host);
    updatePeek();
    void refreshFloatingStatus();
}
function createShadowButton(label) {
    const host = document.createElement("div");
    const root = host.attachShadow({ mode: "open" });
    const style = document.createElement("style");
    style.textContent = `
    .offeru-btn {
      all: initial;
      font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 6px 10px;
      border-radius: 8px;
      border: 0;
      background: linear-gradient(135deg, #2563eb, #1d4ed8);
      color: #ffffff;
      font-size: 12px;
      font-weight: 600;
      line-height: 1;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(37,99,235,0.24);
    }
    .offeru-btn[disabled] {
      opacity: 0.7;
      cursor: default;
      box-shadow: none;
    }
  `;
    const button = document.createElement("button");
    button.className = "offeru-btn";
    button.textContent = label;
    button.type = "button";
    root.appendChild(style);
    root.appendChild(button);
    return {
        host,
        button,
        setLabel(text) {
            button.textContent = text;
        },
        setBusy(busy) {
            button.disabled = busy;
        },
    };
}
function collectJobs(jobs, onDone) {
    chrome.runtime.sendMessage({ type: "JOBS_COLLECTED", jobs }, (resp) => {
        if (chrome.runtime.lastError) {
            onDone(null);
            return;
        }
        onDone(resp || null);
    });
}
function sendRuntimeMessage(message) {
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
function decorateListPage(platform) {
    const cards = document.querySelectorAll(platform.listCard);
    cards.forEach((card) => {
        if (card.getAttribute(LIST_BUTTON_FLAG) === "1")
            return;
        const control = createShadowButton("加入简历购物车");
        control.host.style.display = "inline-block";
        control.host.style.marginTop = "8px";
        control.button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const job = extractFromListCard(card, platform);
            if (!job) {
                showToast("未识别到完整岗位标题或公司", true);
                return;
            }
            control.setBusy(true);
            collectJobs([job], (resp) => {
                control.setBusy(false);
                if (!resp) {
                    showToast("采集失败，请稍后重试", true);
                    return;
                }
                if (resp.added > 0) {
                    control.setLabel("已加入草稿");
                    showToast(`已加入草稿：${job.title}`);
                    return;
                }
                if (resp.upgraded > 0) {
                    control.setLabel("已补全JD");
                    showToast(`已补全并更新：${job.title}`);
                    return;
                }
                control.setLabel("已在购物车");
                showToast("岗位已存在购物车");
            });
        });
        const actionContainer = pickEl(card, platform.listActionTargets) ||
            card.querySelector(".job-info") ||
            card;
        actionContainer.appendChild(control.host);
        card.setAttribute(LIST_BUTTON_FLAG, "1");
    });
}
function decorateDetailPage(platform) {
    if (document.getElementById(DETAIL_BUTTON_ID))
        return;
    const control = createShadowButton("加入简历购物车（详情）");
    control.host.id = DETAIL_BUTTON_ID;
    control.host.style.position = "fixed";
    control.host.style.right = "20px";
    control.host.style.bottom = "90px";
    control.host.style.zIndex = "2147483646";
    control.button.addEventListener("click", () => {
        const job = extractFromDetailPage(platform);
        if (!job) {
            showToast("当前页面未识别到岗位详情信息", true);
            return;
        }
        control.setBusy(true);
        collectJobs([job], (resp) => {
            control.setBusy(false);
            if (!resp) {
                showToast("采集失败，请稍后重试", true);
                return;
            }
            if (resp.added > 0) {
                control.setLabel("已加入购物车");
                showToast(`已加入：${job.title}`);
                return;
            }
            if (resp.upgraded > 0) {
                control.setLabel("已补全并更新");
                showToast(`已补全JD：${job.title}`);
                return;
            }
            control.setLabel("已在购物车");
            showToast("岗位已存在购物车");
        });
    });
    document.body.appendChild(control.host);
}
function run() {
    const platform = resolveCurrentPlatform();
    createFloatingDock(platform);
    if (!platform)
        return;
    if (isDetailPage(platform)) {
        decorateDetailPage(platform);
    }
    if (isListPage(platform)) {
        decorateListPage(platform);
    }
}
let refreshTimer = null;
function scheduleRun() {
    if (refreshTimer !== null) {
        window.clearTimeout(refreshTimer);
    }
    refreshTimer = window.setTimeout(() => {
        run();
        refreshTimer = null;
    }, 220);
}
function init() {
    run();
    const observer = new MutationObserver(() => {
        scheduleRun();
    });
    observer.observe(document.body, { childList: true, subtree: true });
}
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
}
else {
    init();
}
