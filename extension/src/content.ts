// =============================================
// OfferU Extension — Content Script (Boss直聘)
// =============================================
// 在 zhipin.com 页面注入采集按钮，解析岗位 DOM
// =============================================

import type { ExtractedJob } from "./types.js";

// ---- DOM 选择器 (Boss直聘 2025/2026) ----
const SEL = {
  // 列表页
  JOB_CARD: "li.job-card-box",
  JOB_NAME: ".job-name",
  JOB_AREA: ".job-area",
  SALARY: ".salary",
  COMPANY_NAME: ".company-name a, .company-name",
  COMPANY_TAG: ".company-tag-list li",
  JOB_INFO_TAG: ".tag-list li, .job-info .tag-list span",

  // 详情页
  DETAIL_NAME: ".name h1, .info-primary .name",
  DETAIL_SALARY: ".salary",
  DETAIL_TAGS: ".job-tags .tag-item, .tag-list li",
  DETAIL_LOCATION: ".location-address, .job-location .location-address",
  DETAIL_DESC: ".job-sec-text, .job-detail .job-sec-text",
  DETAIL_COMPANY_NAME: ".company-info .name, .company-info a",
  DETAIL_COMPANY_TAGS: ".company-info p, .sider-company p",

  // 通用（列表页卡片）
  BOSS_NAME: ".boss-name",
};

const OFFERU_BADGE_CLASS = "offeru-collected-badge";

// ---- 薪资解析 ----
function parseSalary(text: string): { min: number | null; max: number | null } {
  // "15-25K·13薪" → { min: 15000, max: 25000 }
  const m = text.match(/(\d+)\s*[-~]\s*(\d+)\s*(K|k|千)/);
  if (m) {
    const factor = m[3].toLowerCase() === "k" || m[3] === "千" ? 1000 : 1;
    return { min: parseInt(m[1]) * factor, max: parseInt(m[2]) * factor };
  }
  const m2 = text.match(/(\d+)\s*[-~]\s*(\d+)\s*(万)/);
  if (m2) {
    return { min: parseInt(m2[1]) * 10000, max: parseInt(m2[2]) * 10000 };
  }
  return { min: null, max: null };
}

// ---- 生成 hash_key (简单版：URL 或 title+company) ----
function makeHashKey(title: string, company: string, url: string): string {
  const raw = url || `${title}||${company}`;
  // 简单 hash（类似 djb2）
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = (hash << 5) - hash + raw.charCodeAt(i);
    hash |= 0;
  }
  return `boss-ext-${Math.abs(hash).toString(36)}`;
}

// ---- 文本辅助 ----
function txt(el: Element | null): string {
  return el?.textContent?.trim() || "";
}

// ---- 判断是列表页还是详情页 ----
function isDetailPage(): boolean {
  return /\/job_detail\//.test(location.pathname);
}

function isListPage(): boolean {
  const cards = document.querySelectorAll(SEL.JOB_CARD);
  return cards.length > 0;
}

// ---- 从列表页卡片提取 ----
function extractFromCard(card: Element): ExtractedJob | null {
  const title = txt(card.querySelector(SEL.JOB_NAME));
  const company =
    txt(card.querySelector(SEL.COMPANY_NAME)) || txt(card.querySelector(SEL.BOSS_NAME));
  if (!title || !company) return null;

  const salaryText = txt(card.querySelector(SEL.SALARY));
  const { min, max } = parseSalary(salaryText);
  const location = txt(card.querySelector(SEL.JOB_AREA));
  const url = (card.querySelector("a") as HTMLAnchorElement)?.href || "";

  const tags = Array.from(card.querySelectorAll(SEL.JOB_INFO_TAG)).map(txt);
  const education = tags.find((t) => /本科|硕士|博士|大专|学历/.test(t)) || "";
  const experience = tags.find((t) => /经验|年|应届|实习/.test(t)) || "";

  const companyTags = Array.from(card.querySelectorAll(SEL.COMPANY_TAG)).map(txt);

  return {
    title,
    company,
    location: location.replace(/…$/, ""),
    salary_text: salaryText,
    salary_min: min,
    salary_max: max,
    raw_description: "", // 列表页没有完整 JD
    url,
    source: "boss",
    education,
    experience,
    job_type: tags.find((t) => /全职|实习|校招|兼职/.test(t)) || "",
    company_size: companyTags.find((t) => /人/.test(t)) || "",
    company_industry: companyTags.find((t) => !/人/.test(t)) || "",
    hash_key: makeHashKey(title, company, url),
  };
}

// ---- 从详情页提取 ----
function extractFromDetail(): ExtractedJob | null {
  const title =
    txt(document.querySelector(SEL.DETAIL_NAME)) ||
    txt(document.querySelector(SEL.JOB_NAME));
  const company =
    txt(document.querySelector(SEL.DETAIL_COMPANY_NAME)) ||
    txt(document.querySelector(SEL.BOSS_NAME));
  if (!title || !company) return null;

  const salaryText = txt(document.querySelector(SEL.DETAIL_SALARY));
  const { min, max } = parseSalary(salaryText);
  const location = txt(document.querySelector(SEL.DETAIL_LOCATION));
  const description = txt(document.querySelector(SEL.DETAIL_DESC));

  const tags = Array.from(
    document.querySelectorAll(SEL.DETAIL_TAGS)
  ).map(txt);
  const education = tags.find((t) => /本科|硕士|博士|大专|学历/.test(t)) || "";
  const experience = tags.find((t) => /经验|年|应届|实习/.test(t)) || "";

  const companyTags = Array.from(
    document.querySelectorAll(SEL.DETAIL_COMPANY_TAGS)
  ).map(txt);

  return {
    title,
    company,
    location,
    salary_text: salaryText,
    salary_min: min,
    salary_max: max,
    raw_description: description,
    url: window.location.href,
    source: "boss",
    education,
    experience,
    job_type: tags.find((t) => /全职|实习|校招|兼职/.test(t)) || "",
    company_size: companyTags.find((t) => /人/.test(t)) || "",
    company_industry: companyTags.find((t) => !/人/.test(t)) || "",
    hash_key: makeHashKey(title, company, window.location.href),
  };
}

// ---- 注入样式 ----
function injectStyles(): void {
  if (document.getElementById("offeru-ext-styles")) return;
  const style = document.createElement("style");
  style.id = "offeru-ext-styles";
  style.textContent = `
    .offeru-collect-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      color: #fff;
      border: none;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      z-index: 999;
      white-space: nowrap;
    }
    .offeru-collect-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(59,130,246,0.4);
    }
    .offeru-collect-btn.collected {
      background: #22c55e;
      cursor: default;
    }
    .offeru-collect-all-fab {
      position: fixed;
      bottom: 80px;
      right: 24px;
      padding: 12px 20px;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      color: #fff;
      border: none;
      border-radius: 12px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 8px 24px rgba(59,130,246,0.4);
      z-index: 10000;
      transition: all 0.2s;
    }
    .offeru-collect-all-fab:hover {
      transform: translateY(-2px);
      box-shadow: 0 12px 32px rgba(59,130,246,0.5);
    }
    .offeru-toast {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background: #1e293b;
      color: #e2e8f0;
      border-radius: 8px;
      font-size: 14px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.3);
      z-index: 100000;
      opacity: 0;
      transform: translateY(-10px);
      transition: all 0.3s;
    }
    .offeru-toast.show {
      opacity: 1;
      transform: translateY(0);
    }
    .${OFFERU_BADGE_CLASS} {
      display: inline-block;
      padding: 2px 6px;
      background: #22c55e;
      color: #fff;
      border-radius: 4px;
      font-size: 11px;
      margin-left: 6px;
    }
  `;
  document.head.appendChild(style);
}

// ---- Toast 通知 ----
function showToast(msg: string, duration = 2500): void {
  const existing = document.querySelector(".offeru-toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = "offeru-toast";
  toast.textContent = msg;
  document.body.appendChild(toast);

  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ---- 发送采集的岗位到 background ----
function sendToBackground(jobs: ExtractedJob[]): void {
  chrome.runtime.sendMessage({ type: "JOBS_COLLECTED", jobs });
}

// ---- 列表页：给每个卡片添加采集按钮 ----
function decorateListPage(): void {
  const cards = document.querySelectorAll(SEL.JOB_CARD);
  cards.forEach((card) => {
    if (card.querySelector(".offeru-collect-btn")) return; // 已添加

    const btn = document.createElement("button");
    btn.className = "offeru-collect-btn";
    btn.innerHTML = "📥 采集";
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const job = extractFromCard(card);
      if (job) {
        sendToBackground([job]);
        btn.innerHTML = "✅ 已采集";
        btn.classList.add("collected");
        showToast(`✅ 已采集: ${job.title} @ ${job.company}`);
      }
    });

    // 插入到卡片内部合适位置
    const infoRight = card.querySelector(".job-info") || card;
    infoRight.appendChild(btn);
  });
}

// ---- 列表页：浮动的"一键采集全部"按钮 ----
function addCollectAllFab(): void {
  if (document.querySelector(".offeru-collect-all-fab")) return;

  const fab = document.createElement("button");
  fab.className = "offeru-collect-all-fab";
  fab.innerHTML = "📥 一键采集本页所有岗位";
  fab.addEventListener("click", () => {
    const cards = document.querySelectorAll(SEL.JOB_CARD);
    const jobs: ExtractedJob[] = [];
    cards.forEach((card) => {
      const job = extractFromCard(card);
      if (job) jobs.push(job);

      // 标记已采集
      const btn = card.querySelector(".offeru-collect-btn");
      if (btn) {
        btn.innerHTML = "✅ 已采集";
        btn.classList.add("collected");
      }
    });

    if (jobs.length > 0) {
      sendToBackground(jobs);
      showToast(`✅ 已采集 ${jobs.length} 个岗位`);
      fab.innerHTML = `✅ 已采集 ${jobs.length} 个岗位`;
      setTimeout(() => {
        fab.innerHTML = "📥 一键采集本页所有岗位";
      }, 3000);
    } else {
      showToast("❌ 未找到可采集的岗位");
    }
  });

  document.body.appendChild(fab);
}

// ---- 详情页：添加浮动采集按钮 ----
function decorateDetailPage(): void {
  if (document.querySelector(".offeru-collect-all-fab")) return;

  const fab = document.createElement("button");
  fab.className = "offeru-collect-all-fab";
  fab.innerHTML = "📥 采集此岗位到 OfferU";
  fab.addEventListener("click", () => {
    const job = extractFromDetail();
    if (job) {
      sendToBackground([job]);
      fab.innerHTML = "✅ 已采集";
      showToast(`✅ 已采集: ${job.title} @ ${job.company}`);
    } else {
      showToast("❌ 无法解析岗位信息");
    }
  });

  document.body.appendChild(fab);
}

// ---- 主入口 ----
function init(): void {
  injectStyles();

  if (isDetailPage()) {
    decorateDetailPage();
  } else if (isListPage()) {
    decorateListPage();
    addCollectAllFab();

    // 监听 DOM 变化（Boss直聘是 SPA，动态加载卡片）
    const observer = new MutationObserver(() => {
      decorateListPage();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

// 等页面准备好再执行
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
