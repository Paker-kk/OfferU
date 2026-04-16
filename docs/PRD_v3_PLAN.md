# OfferU PRD v3 — 本地化全量计划书

> **更新时间：2026-04-13**  
> **状态：Dario Round 6 审查 — 方向性重构版**  
> **定位升级：SaaS 计划 → 纯本地应用 + Landing Page 分发**  
> **审查人：Dario (首席执行总监)**  
> **本轮变更：5 项方向性决策调整（去认证/纯本地/扩展购物车/面经模块/定位扩大）**

---

## 0. 产品定位（一句话）

**OfferU = 帮所有求职者（校招+社招）从零构建 Bullet 级个人档案，再按每个 JD 智能组装定制简历、收集同岗位面经的 AI 求职助手。纯本地运行，数据不离开用户电脑。**

### 核心壁垒

| 维度 | 竞品做法 | OfferU 做法 |
|------|---------|------------|
| 简历生成 | **剪裁**（Teal：Master Resume 复制+删减） | **组装**（Profile 事实库 → LLM 逐条推理 JD←→Bullet 匹配度 → 按相关性排序+改写+组装全新简历）|
| Bullet 召回 | Career-Ops：LLM 直接读 cv.md 推理 | OfferU：结构化 ProfileSection 表 + source/confidence 字段 + LLM 推理，**可追溯**每条 Bullet 来源 |
| 数据来源 | 用户手动粘贴 JD | **双轨采集**（后端爬虫 + Chrome **Side Panel 购物车**从 Boss直聘实时收藏） |
| 用户画像 | 面向有经验的求职者 / 面向特定人群 | **面向所有求职者**（校招零经验 → AI 对话引导；社招有简历 → PDF/Word 导入解析） |
| Profile 粒度 | 段落级 / 模板填空 | **Bullet 级**（每个成就点独立条目，含 source + confidence，可精确召回） |
| 面试准备 | Career-Ops：STAR+Reflection Story Bank | OfferU：**收集同岗位真实面经** → LLM 提炼高频问题 → 生成 HR面/部门面分类题库 |
| 部署方式 | SaaS 注册制 | **纯本地运行**，零注册，数据不上传 |

### 与竞品对比（2026 年 4 月调研）

| 产品 | 类型 | 特点 | OfferU 差异 |
|------|------|------|------------|
| **Career-Ops** (32k⭐) | 开源 CLI | Profile.yml + LLM 推理召回 + LaTeX + STAR Story Bank | OfferU 做了 Web GUI + 对话引导 + 浏览器 Side Panel + 面经收集 |
| **get_jobs** (6.3k⭐) | 开源 Java | ChromeDriver 自动投递 + AI 打招呼 | Boss直聘有反检测（issue#250），OfferU 不做自动投递 |
| **ai-resume-architect** | 开源 Web | Gemini + STAR 法则 + A4 预览 | 无 Profile 概念，无岗位采集 |
| **LocalHire** | 开源 Self-hosted | Ollama + 隐私优先 + Job Tracking | 无中文优化，无校招适配 |
| **ai-job-copilot** | 浏览器插件 | Workday/Greenhouse 浏览器端改写 | 仅限西方 ATS |
| **JobPilot** (油猴) | 油猴脚本 | Boss直聘批量聊天 | 只做海投，无简历定制，有封号风险 |
| **宝藏求职** | 商业 SaaS | AI 简历 + 模拟面试 | 闭源、收费、无 Profile 组装 |

---

## 1. 系统架构总览

> ⚠️ **v3.1 重大变更**: 去掉 Auth/User/PostgreSQL，纯本地单用户应用

```
┌──────────────────────────────────────────────────────────────┐
│                        用户触达层                              │
├──────────────┬─────────────────────┬────────────────────────┤
│  Next.js 14  │ Chrome Side Panel   │  Claude / ChatGPT MCP  │
│  前端 Web UI  │ Boss直聘购物车mini-app│  AI Agent 接入         │
└──────┬───────┴──────────┬──────────┴──────────┬─────────────┘
       │                  │                     │
       ▼                  ▼                     ▼
┌──────────────────────────────────────────────────────────────┐
│                FastAPI 后端 (Python 3.12)                      │
├──────────┬────────────┬──────────────────────────────────────┤
│ 52+端点   │ AI Agent   │ MCP Server                          │
│ REST API  │ 5模块+7技能 │ 13工具+1资源                        │
├──────────┴────────────┴──────────────────────────────────────┤
│                LLM 分级调用层                                  │
│  ┌───────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │ Fast 层   │  │ Standard 层       │  │ Premium 层      │  │
│  │qwen3.5-   │  │qwen3.5-plus      │  │qwen3.6-plus    │  │
│  │flash      │  │(阶梯定价)         │  │                 │  │
│  │0.2元/M    │  │0.3-0.8元/M       │  │2元/M           │  │
│  └───────────┘  └──────────────────┘  └──────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│                SQLite（本地单文件，零配置）                      │
│                13 张表（7 核心 + 6 Profile/Pool 扩展）          │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. 已确认决策总表（v3.1 更新）

| # | 决策项 | 结论 | 来源 |
|---|--------|------|------|
| 1-20 | (继承 PRD v2 全部 20 项) | 不变 | PRD v2 |
| 21 | **LLM 升级** | 分级调用：fast=qwen3.5-flash / standard=qwen3.5-plus(阶梯价) / premium=qwen3.6-plus | Dario R5 |
| 22 | ~~认证方案~~ | **❌ 已删除** — 纯本地应用，无需用户认证 | Dario R6 |
| 23 | **部署目标** | 纯本地运行（pip install / Docker），Landing Page 做下载引流 | Dario R6 |
| 24 | **核心壁垒** | Profile → 定制简历的 AI 组装链路 + 面经收集 | Dario R6 |
| 25 | **浏览器插件** | Manifest V3 + TypeScript + **Side Panel** 购物车 mini-app，Boss直聘优先 | Dario R6 |
| 26 | **数据库** | 仅 SQLite（本地单文件，零部署成本） | Dario R6 |
| 27 | ~~认证库~~ | **❌ 已删除** | Dario R6 |
| 28 | **用户定位** | 从"文科生小白"扩大到"所有求职者（校招+社招）" | Dario R6 |
| 29 | **自动投递** | **❌ 不做** — 平台有反检测（get_jobs issue#250），只做手动收集+一键跳转+简历图片 | Dario R6 |
| 30 | **面经模块** | 新增"收集网上同岗位面经 → LLM 提炼题库"功能 | Dario R6 |
| 31 | **面经采集方式** | 乞勒模式：只爬公开页面 + 遵守 robots.txt + ≤1 req/s + 用户手动粘贴兜底 | Dario R6 |
| 32 | **离线体验** | Side Panel 支持完全离线收藏 + 延迟同步 + 后端状态探针(🟢/🔴) | Dario R6 |
| 33 | **冷启动渠道** | 学校群+掘金/V2EX/知乎+小红书短视频+Landing Page 在线 Demo | Dario R6 |

---

## 3. 核心旅程（6+1 步主线，v3.1 扩展）

```
[Chrome Side Panel] Boss直聘页面 → 一键收藏到"购物车"
       ↓ chrome.storage.local → 批量同步后端
/scraper 后端爬虫采集导入
       ↓
/jobs Inbox 分拣（未筛选→已筛选/已忽略，分池管理）
       ↓
/profile 个人档案（表单基础项 + AI 对话引导 → Bullet 级事实库）
       ↓
/optimize AI 简历定制工作区（选池→选岗位→按 JD 组装生成）
       ↓
/resume 简历资产管理（编辑微调→导出 PDF/Word→手动投递）
       ↓ （新增 v3.1）
/interview AI 面经工作区（选岗位→收集同岗位面经→LLM 提炼题库→HR面/部门面分类）
```

### 投递方式（v3.1 明确：不做自动投递）

| 方式 | 说明 |
|------|------|
| 一键跳转 | 点击岗位卡片 → 新标签页打开 Boss直聘/招聘网站原始链接 |
| 简历图片 | 生成简历截图 → 用户复制粘贴到 Boss直聘聊天窗口（规避 PDF 限制） |
| 手动下载 | 导出 PDF/Word → 用户自行上传到各平台 |

---

## 4. LLM 分级调用策略（v3.1 定价修正）

基于阿里云 DashScope 2026 Q2 最新定价（2026-04-13 核实）：

| 档位 | 默认模型 (Qwen) | 上下文 | 参考价格 | 使用场景 |
|------|------|--------|-------------|---------|
| **fast** | `qwen3.5-flash` | 1M | 0.2 / 2 元/百万 Token | 分拣/分类/基础JD摘要/对话轻量回复 |
| **standard** | `qwen3.5-plus` | 1M | 阶梯定价（见下方） | JD 深度分析/Bullet 抽取/简历改写/面经提炼 |
| **premium** | `qwen3.6-plus` | 256K | 2 / 12 元/百万 Token | 简历终版生成/narrative 生成/复杂匹配 |

> **v3.2 Provider-Agnostic 架构**：以上模型为 Qwen 默认值。用户可在设置页切换到 **任意 OpenAI 兼容提供商**（DeepSeek / OpenAI / Gemini / 智谱 / SiliconFlow / Ollama / 任意第三方），并通过 `tier_model_map` JSON 自定义各档位对应的模型名。
>
> 内置 8 个 Provider Preset：deepseek / openai / qwen / siliconflow / gemini / zhipu / ollama / **custom**（自定义 OpenAI 兼容端点）。 

#### qwen3.5-plus 阶梯定价（重要修正）

| 月调用量 | 输入价格 | 输出价格 |
|---------|---------|---------|
| ≤50万次 | 0.3 元/百万 Token | 1.2 元/百万 Token |
| ≤500万次 | 0.5 元/百万 Token | 2.0 元/百万 Token |
| >500万次 | 0.8 元/百万 Token | 4.8 元/百万 Token |

> ⚠️ **v3 原版写的 0.8/4.8 是最贵一档**。本地应用月调用量远低于 50 万次，实际走 **0.3/1.2 最便宜档**。

### 调用映射

```python
LLM_TIER_MAP = {
    # 分拣/分类 — 走 fast
    "triage": "fast",
    "campus_detect": "fast",
    "jd_summary": "fast",
    
    # 核心 AI 链路 — 走 standard
    "jd_analyze": "standard",
    "bullet_extract": "standard",
    "content_rewrite": "standard",
    "conversational_extract": "standard",
    "interview_extract": "standard",    # v3.1 新增：面经提炼
    
    # 高精度 — 走 premium
    "resume_assemble": "premium",
    "narrative_generate": "premium",
    "resume_final_polish": "premium",
    "interview_question_gen": "premium",  # v3.1 新增：面试题生成
}
```

### 代码改动 (`agents/llm.py`)

```python
# 新增 tier 参数
async def chat_completion(
    messages: list[dict],
    temperature: float = 0.3,
    json_mode: bool = False,
    max_tokens: int = 4096,
    tier: str = "standard",  # fast / standard / premium
) -> Optional[str]:
```

### 成本估算（单用户本地使用/月，按最低阶梯档）

| 操作 | 频次 | Token消耗 | 档位 | 成本 |
|------|------|----------|------|------|
| 岗位分拣 | 200 次 | ~500 Token/次 = 100K | fast | 0.02 + 0.2 = 0.22 元 |
| JD 分析 | 30 次 | ~2K Token/次 = 60K | standard | 0.02 + 0.07 = 0.09 元 |
| Bullet 抽取 | 20 轮对话 | ~3K Token/轮 = 60K | standard | 0.02 + 0.07 = 0.09 元 |
| 面经提炼 | 10 次 | ~4K Token/次 = 40K | standard | 0.01 + 0.05 = 0.06 元 |
| 简历生成 | 10 次 | ~5K Token/次 = 50K | premium | 0.1 + 0.6 = 0.7 元 |
| **月均总成本** | | | | **≈1.16 元/用户/月** |

> 比 v3 原版估算 1.6 元更低，因为 qwen3.5-plus 阶梯定价第一档 0.3/1.2 远低于之前写的 0.8/4.8。

---

## 5. ~~认证系统设计~~ → 已删除

> **v3.1 决策**：纯本地应用，无需用户认证。所有数据存储在用户本地 SQLite 文件中，不存在多租户。
> 
> 原 Section 5 的邮箱/SMS/微信登录全部移除。不再需要 User 表、JWT 中间件、数据隔离（WHERE user_id=?）。
> 
> **安全补充**：API Key（Qwen 等）存在本地 `.env` / `config.json`，前端不暴露。

---

## 6. 数据库策略（v3.1 简化）

### 唯一数据库：SQLite

> **决策**：纯本地应用不需要 PostgreSQL。SQLite 单文件、零配置、零成本。

```python
# config.py
database_url: str = "sqlite+aiosqlite:///./offeru.db"
# 不再有生产 PostgreSQL 切换逻辑
```

### 备份方案

- 用户数据全部在 `offeru.db` 单文件
- 前端提供"导出备份"按钮 → 下载 `.db` 文件
- 前端提供"导入备份"按钮 → 上传覆盖（需确认对话框）

### 迁移工具

保留 Alembic 做结构升级（版本更新时自动 migrate）：

```bash
pip install alembic
alembic upgrade head  # 用户更新版本后执行
```

---

## 7. 分发架构（v3.1 重构：Landing Page + 本地安装）

> **不再是 SaaS 服务器部署**，而是 Landing Page 引流 + 用户本地安装

### 架构图

```
Landing Page (offeru.cn / GitHub Pages)
    │
    ├── 产品介绍 + 演示视频 + 截图
    ├── 下载链接 → GitHub Releases / Gitee Releases
    ├── 安装教程（pip install / Docker / 一键脚本）
    └── 使用统计（匿名 download count）

用户本地：
    ┌────────────────────────────────────────┐
    │  启动方式 A: pip install offeru        │
    │  启动方式 B: docker compose up         │
    │  启动方式 C: 一键 .bat/.sh 脚本         │
    │                                        │
    │  localhost:3000 (前端)                  │
    │  localhost:8000 (后端 API)              │
    │  offeru.db (SQLite 数据文件)            │
    └────────────────────────────────────────┘
    + Chrome 扩展 (本地安装 / Chrome Web Store)
```

### Landing Page 技术选型

| 方案 | 成本 | 域名要求 |
|------|------|---------|
| **GitHub Pages** (推荐) | 免费 | 无需备案，自带 HTTPS |
| Vercel | 免费 | 无需备案 |
| 阿里云 OSS 静态托管 | ~5 元/月 | 需 ICP 备案 |

### 分发渠道

| 渠道 | 说明 |
|------|------|
| GitHub Releases | `.tar.gz` / `.zip` 包 + Docker image |
| Gitee Releases | 国内镜像（GitHub 有时被墙） |
| PyPI | `pip install offeru` 一键安装 |
| Chrome Web Store | 浏览器扩展单独发布 |

### 使用统计（匿名）

- GitHub Star / Clone / Release download count
- Landing Page 的 Google Analytics / Umami（自托管）
- 可选：后端启动时发送匿名 ping（opt-in，非强制）

---

## 8. Chrome 扩展架构（v3.1 重构：Side Panel 购物车 mini-app）

> **v3.1 核心变更**：从 "Popup + 后台采集" 升级为 **Side Panel 购物车** 模式。
> 用户在 Boss直聘浏览时，Side Panel 常驻右侧，浏览到感兴趣的岗位一键收藏到"购物车"，
> 攒够一批后一键同步到本地后端。类似"淘宝边逛边加购物车"的体验。

### 为什么 Side Panel 而不是 Popup

| 维度 | Popup (旧方案) | Side Panel (新方案) |
|------|---------------|-------------------|
| 生命周期 | 点击图标打开，点其他地方关闭 | **常驻打开**，切 Tab 不关 |
| 交互深度 | 只能看计数+点同步 | 完整列表/搜索/筛选/批量操作 |
| 与页面协作 | 互斥——看 Popup 就看不到页面 | **并排显示**——左边页面右边购物车 |
| Chrome API | chrome.action.popup | **chrome.sidePanel** (Chrome 114+) |

### 新架构

```
Boss直聘详情页/列表页
    ↓ content.ts DOM 解析 → ExtractedJob
    ↓ chrome.runtime.sendMessage("ADD_TO_CART")
    
background.ts (Service Worker)
    ├── chrome.storage.local 存储购物车列表
    ├── 去重判断（job_id / title+company hash）
    ├── chrome.storage.onChanged → 通知 Side Panel 更新
    └── 收到 "SYNC_TO_BACKEND" → POST localhost:8000/api/jobs/ingest
    
Side Panel (sidepanel.html + sidepanel.ts)
    ├── 购物车列表（岗位名/公司/薪资/收藏时间）
    ├── 搜索/筛选/删除/全选功能
    ├── "同步到 OfferU" 按钮 → 批量推送后端
    ├── 状态显示：已同步 ✅ / 待同步 🔄 / 同步失败 ❌
    ├── 连接状态：后端在线 🟢 / 离线 🔴（ping localhost:8000/api/health）
    └── 离线模式：禁用同步按钮，显示"请先启动 OfferU 后端"提示
```

### 离线体验设计（Dario R6 确认）

```
场景：用户在图书馆/公司浏览 Boss直聘（后端未启动）

1. 浏览岗位 → 点"加入购物车" → ✅ 正常存入 chrome.storage.local
2. Side Panel 展示购物车列表 → ✅ 纯本地，不依赖后端
3. 点击岗位可查看完整 JD → ✅ JD 文本已在 chrome.storage.local
4. 点"同步到 OfferU" → ❌ 按钮置灰 + toast "后端离线，回家后启动 OfferU 再同步"
5. Side Panel 右上角状态灯：🔴 离线（每 30s 自动 ping 一次）

回家后：
6. 启动后端 → 状态灯变 🟢 → 同步按钮解锁
7. 一键同步 → 购物车所有待同步岗位批量 POST /api/jobs/ingest
8. 同步完成 → 已同步项标记 ✅，从"待同步"变为"已同步"
```

### manifest.json 改动

```json
{
  "manifest_version": 3,
  "name": "OfferU 求职购物车",
  "permissions": ["storage", "sidePanel", "activeTab"],
  "side_panel": {
    "default_path": "sidepanel.html"
  },
  "action": {
    "default_title": "打开 OfferU 购物车"
  },
  "content_scripts": [{
    "matches": ["*://*.zhipin.com/*"],
    "js": ["content.js"]
  }],
  "background": {
    "service_worker": "background.js"
  }
}
```

### chrome.storage.local 数据结构

```typescript
interface CartItem {
  id: string;              // 唯一ID（Boss job_id 或 hash）
  title: string;
  company: string;
  salary: string;
  location: string;
  jd_text: string;         // 完整 JD 文本
  source_url: string;      // Boss直聘原始链接
  added_at: string;        // ISO timestamp
  synced: boolean;         // 是否已同步到后端
  synced_at?: string;      // 同步时间
}

// chrome.storage.local.set({ cart: CartItem[] })
```

### 当前代码适配工作

| 现有文件 | 改动 |
|---------|------|
| `extension/static/manifest.json` | 加 `sidePanel` 权限和 `side_panel` 配置 |
| `extension/src/content.ts` | 注入"加入购物车"按钮（替换旧的"采集"按钮） |
| `extension/src/background.ts` | 改为购物车存储逻辑 + onChanged 转发 |
| `extension/src/popup.ts` | **删除**（不再需要 Popup） |
| `extension/static/popup.html/css` | **删除** |
| **新增** `extension/src/sidepanel.ts` | 购物车 UI 逻辑 |
| **新增** `extension/static/sidepanel.html` | 购物车 HTML |
| **新增** `extension/static/sidepanel.css` | 购物车样式 |
| `extension/src/types.ts` | 新增 `CartItem` interface |

### Side Panel 特定网站激活

```typescript
// background.ts — 仅在 Boss直聘 上自动激活 Side Panel
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (!tab.url) return;
  const url = new URL(tab.url);
  if (url.hostname.includes('zhipin.com')) {
    await chrome.sidePanel.setOptions({ tabId, path: 'sidepanel.html', enabled: true });
  } else {
    await chrome.sidePanel.setOptions({ tabId, enabled: false });
  }
});

// 点击扩展图标切换 Side Panel
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
```

### 待验证（继承 v3 + 新增）

- [ ] Boss直聘真机 DOM 测试
- [ ] Side Panel 在 Boss直聘 上正确激活
- [ ] chrome.storage.local ↔ Side Panel 实时同步
- [ ] "同步到后端" 端到端测试（localhost:8000）
- [ ] 购物车去重逻辑
- [ ] 扩展图标

---

## 8.5 AI 面经模块（v3.1 新增）

> **核心理念**：不做 AI 模拟面试（太假），而是**收集真实面经 → LLM 提炼高频问题 → 分类题库**。
> 参考 Career-Ops Block F 的 STAR+Reflection Story Bank 思路，但数据源是网上真实面经，不是 AI 编造。

### 用户故事

1. 用户在 `/optimize` 选好目标岗位（如"字节跳动-产品运营"）
2. 点击"收集面经" → 后端自动搜索同岗位/同公司面经（牛客网、看准网、脉脉、知乎等）
3. LLM 对面经原文进行结构化提炼：
   - 面试轮次（HR面 / 业务面 / 终面）
   - 具体问题列表
   - 难度评级
   - 面试官关注点
4. 按 HR面 / 部门面 / 终面 分类展示题库
5. 用户可针对每个问题查看"推荐回答思路"（LLM 基于用户 Profile Bullet 生成）

### 数据来源（乞勒模式 — Dario R6 确认）

> **合规红线**：只爬公开可访问（无需登录）页面，遵守 robots.txt，请求频率 ≤1 req/s，不存储原文超过合理引用范围的内容。用户手动粘贴为 P0 兜底。

| 来源 | 采集方式 | 是否需登录 | 合规风险 | 优先级 |
|------|---------|-----------|---------|--------|
| **用户手动粘贴** | 前端文本框 | 否 | 零风险 | **P0** |
| 牛客网 | 公开面经页爬取 | 否（公开页） | 低 | P1 |
| 看准网 | 公开面试模块 | 否（部分公开） | 低 | P1 |
| 知乎 | 搜索引擎索引结果 | 否 | 中（知乎起诉过爬虫） | P2 |
| ~~脉脉~~ | ~~需登录~~ | ~~是~~ | ~~高~~ | **❌ 不做** |

### 技术设计

```python
# 新增 Agent: agents/interview_prep.py

class InterviewPrepAgent:
    """面经收集 + 题库生成 Agent"""
    
    async def collect_experiences(self, company: str, role: str) -> list[dict]:
        """从网上收集面经（爬虫/API）"""
        
    async def extract_questions(self, raw_texts: list[str]) -> list[InterviewQuestion]:
        """LLM 提炼面经 → 结构化问题列表 (tier=standard)"""
        
    async def generate_answer_hints(
        self, question: InterviewQuestion, profile_bullets: list[str]
    ) -> str:
        """基于用户 Profile 生成推荐回答思路 (tier=premium)"""
```

### 新增数据模型

```python
class InterviewExperience(Base):
    """收集到的面经原文"""
    __tablename__ = "interview_experiences"
    id: Mapped[int] = mapped_column(primary_key=True)
    company: Mapped[str]
    role: Mapped[str]
    source_url: Mapped[Optional[str]]       # 面经来源链接
    source_platform: Mapped[str]            # niuke/zhihu/maimai/manual
    raw_text: Mapped[str]                   # 面经原文
    interview_rounds: Mapped[Optional[str]] # JSON: 面试轮次
    collected_at: Mapped[datetime]

class InterviewQuestion(Base):
    """从面经中提炼的问题"""
    __tablename__ = "interview_questions"
    id: Mapped[int] = mapped_column(primary_key=True)
    experience_id: Mapped[int] = mapped_column(ForeignKey("interview_experiences.id"))
    question_text: Mapped[str]
    round_type: Mapped[str]                 # hr / department / final
    category: Mapped[str]                   # behavioral / technical / case / motivation
    difficulty: Mapped[int]                 # 1-5
    frequency: Mapped[int] = mapped_column(default=1)  # 出现次数（多面经去重合并）
    suggested_answer: Mapped[Optional[str]] # LLM 生成的回答思路
    job_id: Mapped[Optional[int]]           # 关联的目标岗位
```

### 新增路由

```
GET  /api/interview/questions?company=X&role=Y   — 查询已有题库
POST /api/interview/collect                       — 触发面经收集
POST /api/interview/extract                       — LLM 提炼问题
POST /api/interview/generate-answer               — 生成推荐回答
```

### 新增前端页面

```
/interview                    — 面经题库主页
/interview/[jobId]           — 某岗位的题库详情
/interview/[jobId]/practice  — 练习模式（逐题查看+展开回答思路）
```

---

## 9. 分期执行计划（v3.1 重构 — 去认证，加面经+购物车）

### Phase 0：跑通核心 AI（1-2 天）🔥 阻塞级

> **目标：让 AI 功能链路从"完全不可用"变为"可 Demo"**

| 编号 | 任务 | 改动文件 | 验收标准 |
|------|------|---------|---------|
| P0-1 | 升级 LLM 分级调用 | `agents/llm.py`, `config.py` | `chat_completion(tier="fast")` 能调通 |
| P0-2 | 配置 Qwen API Key | `.env`, `config.json` | 三档模型均能返回结果 |
| P0-3 | 跑通 Profile 对话 | 启动后端 + 前端 | 对话生成 Bullet 并入库 |
| P0-4 | 跑通 JD 分析 | `/optimize` 页面 | 选岗位 → AI 分析 JD → 显示匹配度 |
| P0-5 | 跑通简历生成 | `/optimize` 页面 | 选岗位 → 生成定制简历文本 |

### Phase 1：数据入口完善（2-3 天）

> **目标：让用户有数据可用**

| 编号 | 任务 | 改动文件 | 验收标准 |
|------|------|---------|---------|
| P1-1 | 简历 PDF 解析 | 新增 `services/resume_parser.py` | 上传 PDF → 提取文本 → 可导入 Profile |
| P1-2 | 简历 Word 解析 | 同上 | 上传 .docx → 提取结构化内容 |
| P1-3 | 前端上传入口 | `/profile` 页面 | "从简历导入" 按钮 → 解析 → 预填 Profile |
| P1-4 | 后端 CORS 对 Extension 开放 | `main.py` | chrome-extension:// 能访问 API |
| P1-5 | 端到端冒烟测试 | 全链路 | 导入数据 → 分拣 → 生成简历 |

### Phase 2：Side Panel 购物车（3-5 天）⚡ 核心差异化

> **目标：Chrome 扩展从 Popup 升级为 Side Panel 购物车 mini-app**

| 编号 | 任务 | 改动文件 | 验收标准 |
|------|------|---------|---------|
| P2-1 | manifest.json 加 sidePanel | `extension/static/manifest.json` | 配置正确，Chrome 可加载 |
| P2-2 | 新建 sidepanel.html/ts/css | 新增 3 文件 | 基础购物车 UI 可展示 |
| P2-3 | content.ts 注入"加入购物车" | `extension/src/content.ts` | Boss直聘详情页出现采集按钮 |
| P2-4 | background.ts 购物车存储 | `extension/src/background.ts` | chrome.storage.local 增删改查 |
| P2-5 | Side Panel ← storage 实时更新 | `sidepanel.ts` | 添加岗位后 Side Panel 立即刷新 |
| P2-6 | "同步到 OfferU" 批量推送 | background.ts + sidepanel.ts | 点击同步 → POST /api/jobs/ingest |
| P2-7 | 删除 popup.ts/html/css | 删除旧文件 | Popup 不再存在 |
| P2-8 | Boss直聘真机测试 | 全部 extension 文件 | 列表页+详情页真实 DOM 采集成功 |

### Phase 3：面经模块（3-5 天）

> **目标：从零实现面经收集 + 题库生成**

| 编号 | 任务 | 改动文件 | 验收标准 |
|------|------|---------|---------|
| P3-1 | InterviewExperience/Question 模型 | `models/models.py` | 2 张新表，Alembic 迁移 |
| P3-2 | 面经爬虫（牛客网优先） | 新增 `services/scrapers/niuke.py` | 输入公司+岗位 → 返回面经列表 |
| P3-3 | LLM 面经提炼 Agent | 新增 `agents/interview_prep.py` | 面经原文 → 结构化问题列表 |
| P3-4 | 面经路由 | 新增 `routes/interview.py` | 4 个 API 端点可调用 |
| P3-5 | 前端面经页面 | 新增 `/interview` 路由组 | 题库展示 + 练习模式 |
| P3-6 | 基于 Profile 生成回答思路 | `agents/interview_prep.py` | 选题 → 结合 Bullet 生成参考答案 |

### Phase 4：打磨 + Landing Page（2-3 天）

> **目标：可分发状态**

| 编号 | 任务 | 说明 | 验收标准 |
|------|------|------|---------|
| P4-1 | Landing Page | GitHub Pages 或 Vercel | 产品介绍 + 下载链接 |
| P4-2 | 安装脚本 | `install.sh` / `install.bat` | 一键安装可运行 |
| P4-3 | Docker Compose 完善 | `docker-compose.yml` | `docker compose up` 一键启动 |
| P4-4 | README 重写 | `README.md` | 安装/使用/截图/视频 |
| P4-5 | 简历导出 PDF/Word | `/resume` 页面 | 点击导出 → 下载文件 |
| P4-6 | 简历截图发送 | `/resume` 页面 | 一键生成简历图片（用于 Boss直聘聊天窗口） |

---

## 10. 技术选型总表（2026 最新 — v3.1 简化）

| 组件 | 选型 | 版本 | 理由 |
|------|------|------|------|
| 前端框架 | Next.js | 14.2 | 已有，SSR + App Router |
| UI 库 | NextUI + Tailwind | 2.4 / 3.4 | 已有 |
| 状态管理 | SWR | 2.2 | 已有，轻量 |
| 后端框架 | FastAPI | 0.128 | 已有，async + 自动文档 |
| ORM | SQLAlchemy | 2.0 async | 已有 |
| LLM SDK | openai | 1.50+ | 已有，Qwen/DeepSeek 兼容 |
| MCP Server | FastMCP | 1.27 | 已有 |
| 数据库 | SQLite | — | 纯本地，零配置，aiosqlite 驱动 |
| 数据库迁移 | Alembic | 1.x | SQLAlchemy 官方 |
| PDF 解析 | pdfplumber | 0.11+ | 纯 Python，免费 |
| Word 解析 | python-docx | 1.1+ | .docx 解析 |
| Chrome 扩展 | Manifest V3 + TypeScript + **Side Panel** | Chrome 114+ | 购物车 mini-app |
| Landing Page | GitHub Pages / Vercel | — | 免费静态托管 |
| ~~认证 (后端)~~ | ~~FastAPI + python-jose~~ | — | **❌ 已删除** |
| ~~认证 (前端)~~ | ~~Better Auth~~ | — | **❌ 已删除** |
| ~~生产数据库~~ | ~~PostgreSQL~~ | — | **❌ 已删除** |
| ~~部署~~ | ~~Docker + Nginx + ECS~~ | — | **❌ 改为本地安装** |

---

## 11. 风险与缓解（v3.1 更新）

| 风险 | 严重度 | 缓解措施 |
|------|--------|---------|
| Boss直聘 DOM 改版 | 🟡 中 | 选择器做成可配置 JSON，改版时只改配置不改代码 |
| Qwen API 不稳定 | 🟡 中 | 多 Provider fallback（DeepSeek 做备选） |
| 面经爬虫被反爬 | 🟡 中 | 支持用户手动粘贴兜底；多源分散风险 |
| LLM 成本失控 | 🟢 低 | 纯本地单用户，月均 ~1.2 元，几乎不可能超标 |
| 单人开发进度 | 🔴 高 | 严格按 Phase 执行，每 Phase 有 Demo 可展示 |
| 本地安装门槛高 | 🟡 中 | 提供一键脚本 + Docker + 详细教程 + 视频 |
| Side Panel 兼容性 | 🟢 低 | Chrome 114+ (2023.5 发布)，用户几乎都已更新 |
| ~~ICP 备案时间~~ | — | **❌ 不再需要**（纯本地+GitHub Pages） |
| ~~微信登录企业资质~~ | — | **❌ 不再需要** |

---

## 12. 衡量指标（v3.1 — 本地应用指标体系）

| 指标 | V1 目标 | 衡量方式 |
|------|--------|---------|
| GitHub Star | 100⭐ | GitHub API |
| Release 下载量 | 200 次 | GitHub Releases download count |
| Chrome 扩展安装量 | 50 人 | Chrome Web Store |
| Landing Page 访问 | 1000 PV/月 | Google Analytics / Umami |
| Profile 完成率 | >60% 使用者完成 3+ steps | 本地 ProfileChatSession 数据 |
| 简历生成次数 | 使用者月均 10+ 次 | 本地 Resume 表统计 |
| 面经收集使用率 | >30% 使用者触发过面经收集 | 本地 InterviewExperience 表 |
| AI 对话轮数 | >5 轮/使用者 | ProfileChatSession.messages_json |
| 社区反馈 | 10+ Issues / 5+ PRs | GitHub Issues & PR |

---

## 附录 A：当前代码完整度（v3.1 更新）

| 组件 | 文件/端点数 | 完成度 |
|------|-----------|--------|
| 后端路由 | 12 文件 / 52 端点 | 95% |
| AI Agent | 5 模块 + 7 Skills | 80% |
| 前端页面 | 13 路由 / 15 编译 | 100% |
| API 函数 | 30+ | 90% |
| Chrome 扩展 | 9 文件 (需重构为 Side Panel) | 60% ⚠️ |
| 数据模型 | 7 表 (需加 2 面经表) | 85% |
| MCP Server | 10+ 工具 | 85% |
| **面经模块** | **0** | **❌ 未开始** |
| **Side Panel 购物车** | **0** | **❌ 未开始** |
| **Landing Page** | **0** | **❌ 未开始** |
| ~~认证系统~~ | — | **已删除，不再需要** |
| ~~PostgreSQL 迁移~~ | — | **已删除，不再需要** |

---

## 附录 B：Bullet 召回算法设计参考（Career-Ops 调研）

> 基于 2026-04-13 对 Career-Ops (32k⭐) oferta.md / pdf.md / _shared.md 的深度调研

### Career-Ops 的做法（LLM 纯推理）

1. **读取 cv.md** 作为唯一事实源
2. **提取 JD 关键词** 15-20 个
3. **检测岗位原型** 6 类（AI Platform / Agentic / Technical PM / SA / FDE / Transformation）
4. **Block B - CV Match**：LLM 逐条将 JD 需求映射到 cv.md 的精确行号，标注 gap
5. **Bullet 排序**：按 JD 相关性重排experience bullets
6. **Keyword Injection**：用 JD 词汇改写现有成就，**绝不编造**
7. **选择 Top 3-4 项目**：最相关的项目优先展示

### OfferU 的增强方案

| Career-Ops | OfferU 增强 |
|-----------|------------|
| cv.md 纯文本 | ProfileSection 表：每条 Bullet 有 `source`(对话/导入/手填) + `confidence`(0-1) |
| 无持久化，每次重新推理 | 数据库持久化 + **增量更新**（新对话产生新 Bullet 即入库） |
| CLI 单次执行 | Web GUI **实时预览** + 多轮调优 |
| 不区分岗位原型 | 参考 Career-Ops 6 原型 → 适配中国市场岗位类型（运营/产品/技术/市场/行政/金融） |
| 英文优先 | 中文优先 + 中英双语支持 |

---

*此文档为 Dario Round 6 审查版。核心变更：去认证 → 纯本地、扩展 → Side Panel 购物车、新增面经模块、定位扩大到所有求职者。*
*所有 Phase 执行前需逐项确认。*
