<h1 align="center">OfferU</h1>

<p align="center">
  <em>AI 驱动的校招简历定制系统 — 一个岗位一份简历，全程自动化</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Backend-FastAPI-009688?style=flat&logo=fastapi" />
  <img src="https://img.shields.io/badge/Frontend-Next.js%2014-000000?style=flat&logo=nextdotjs" />
  <img src="https://img.shields.io/badge/AI-Qwen%20%7C%20DeepSeek%20%7C%20OpenAI-412991?style=flat&logo=openai" />
  <img src="https://img.shields.io/badge/MCP-FastMCP%201.27-6366F1?style=flat" />
  <img src="https://img.shields.io/badge/Deploy-Docker-2496ED?style=flat&logo=docker" />
  <img src="https://img.shields.io/badge/License-MIT-brightgreen?style=flat" />
</p>

<p align="center">
  <a href="./README_EN.md">English</a> ·
  <a href="#-快速开始">快速开始</a> ·
  <a href="#-核心能力">核心能力</a> ·
  <a href="#-免责声明">免责声明</a>
</p>

---

> 💡 灵感来源于 [santifer/career-ops](https://github.com/santifer/career-ops)（31k⭐，CLI-first AI 求职系统）。Career-Ops 面向有技术能力的资深职场人（Claude Code CLI + $20/月），OfferU 将同样的 AI 求职理念带给**中国校招求职者**——零门槛 Web UI、¥0.15/百万 token 的 Qwen 模型、中文全链路。

---

## 📋 目录

1. [核心能力](#-核心能力)
2. [系统架构](#-系统架构)
3. [快速开始](#-快速开始)
4. [开发模式](#-开发模式)
5. [API 文档](#-api-文档)
6. [页面说明](#-页面说明)
7. [项目结构](#-项目结构)
8. [免责声明](#-免责声明)
9. [Roadmap](#-roadmap)
10. [联系方式](#-联系方式)

---

## 🎯 OfferU 解决什么问题？

**校招季，你面对的困境：**
- ❌ 每个岗位手动改简历，10 个岗位改 10 遍，效率极低
- ❌ 不清楚简历该怎么写才能通过 ATS 关键词筛选
- ❌ 经历描述平淡无力，缺乏量化成果和行动导向
- ❌ 不同岗位侧重点不同，但不知道该怎么"精准匹配"

**OfferU 的方案：**
1. **AI 对话引导** → 从零帮你挖掘经历，用 STAR 法则生成 Bullet Points
2. **一键批量定制** → 选中 N 个岗位，AI 自动匹配最相关经历并改写
3. **全程 Web UI** → 打开浏览器就能用，无需命令行或编程知识

---

## ✨ 核心能力

### 🧠 Profile 对话引导（Career-Ops 式 Onboarding）
- 5 大主题渐进式引导：教育 → 实习 → 项目 → 社团 → 技能
- AI 多轮对话从零挖掘经历，每轮提取 Bullet Point 候选
- 用户逐条确认/编辑 → 实时写入个人档案
- 置信度标记（高/中/低），低置信度条目标橙色提醒核实
- **防虚构规则**：AI 只能从用户原话中提取改写，严禁凭空生成事实

### 📥 三 Tab 岗位分拣（智能收件箱）
- **未筛选** → **已筛选** → **已忽略** 三级分拣流程
- 批次折叠：按采集批次分组，一键整批筛入/忽略
- 岗位池管理：创建自定义池（如"互联网运营"、"银行管培"），拖拽分配
- Hover 快捷操作：鼠标悬停即可分拣，无需打开详情

### ⚡ 三段式 AI 简历定制工作区（核心）
```
┌──────────────────────────────────────────────────────┐
│  ① 池/范围选择    ② 本轮岗位勾选     ③ 输出简历区    │
│                                                       │
│  [互联网运营]     ☑ 腾讯-内容运营     ┌───────────┐  │
│  [银行管培]       ☑ 阿里-市场专员     │ SSE 进度   │  │
│  [未分组]         □ 字节-品牌策划     │ ████░░ 2/3 │  │
│                                       │            │  │
│                   [逐岗位] [综合]     │ 预览+保存  │  │
│                   [开始生成]          └───────────┘  │
└──────────────────────────────────────────────────────┘
```
- **逐岗位模式**：N 个岗位 → N 份定制简历（SSE 流式进度）
- **综合模式**：N 个岗位 → 1 份通用简历
- **生成逻辑**：Profile Bullet 召回 → JD 关键词匹配 → STAR 改写 → 保存为 Resume
- **溯源标记**：每份简历标注"基于 腾讯-内容运营 生成"，可追溯来源

### 🤖 MCP Server + AI Agent（13 个工具）
- 内置 MCP Server（FastMCP Streamable HTTP），支持外部 AI Agent 调用
- Web Agent Console：对话式操作全系统（"帮我看看哪些岗位适合我"）
- 13 个 MCP Tools：档案查看/岗位统计/分拣操作/简历生成/池管理等
- LLM 自主决策调用工具链，多轮推理 + Tool Use

### 🔍 多平台岗位采集
- 可插拔爬虫适配器架构
- 支持：LinkedIn / BOSS直聘 / 智联招聘 / 实习僧 / 大厂官网（字节/阿里/腾讯）
- 关键词 + 地区 + 过滤词灵活配置
- 自动创建采集批次，批次内岗位自动标记为"未筛选"

### 📊 多 LLM 支持
- **默认**：阿里云百炼 Qwen（qwen-flash ¥0.15/百万 token，最低成本）
- 可选：DeepSeek / OpenAI / SiliconFlow / Gemini / 智谱 / 本地 Ollama
- 前端 Settings 页一键切换 Provider + Model
- 所有 LLM 调用走 OpenAI 兼容接口，统一抽象

### 📬 面试管理 & 数据看板
- Gmail OAuth 自动同步面试邮件，AI 解析时间/地点
- FullCalendar 日程管理（月/周/日视图）
- Dashboard 采集趋势、来源分布、投递追踪
- 响应式暗色主题 + Framer Motion 动画

---

## 🏗️ 系统架构

```
┌──────────────────────────────────────────────────────────────┐
│                       OfferU 系统架构                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────┐   REST + SSE    ┌──────────────────────┐   │
│  │  Frontend   │◄───────────────►│     Backend          │   │
│  │  Next.js 14 │                 │     FastAPI          │   │
│  │  NextUI 2.4 │                 │                      │   │
│  │  SWR + SSE  │                 │  ┌────────────────┐  │   │
│  └─────────────┘                 │  │  MCP Server    │  │   │
│        │                         │  │  13 Tools      │  │   │
│        │  Agent Console          │  │  Streamable    │  │   │
│        │  (Chat UI)              │  │  HTTP          │  │   │
│        └─────────────────────────┤  └────────┬───────┘  │   │
│                                  │           │          │   │
│                    ┌─────────────┤     ┌─────▼──────┐   │   │
│                    │             │     │ AI Agent   │   │   │
│              ┌─────▼──────┐     │     │ 编排层     │   │   │
│              │  爬虫适配器 │     │     │ LLM + Tool │   │   │
│              │  LinkedIn  │     │     │  Use       │   │   │
│              │  BOSS直聘  │     │     └─────┬──────┘   │   │
│              │  智联招聘  │     │           │          │   │
│              │  实习僧    │     │     ┌─────▼──────┐   │   │
│              │  大厂官网  │     │     │ LLM 抽象层 │   │   │
│              └────────────┘     │     │ Qwen/DS/OA │   │   │
│                    │            │     └────────────┘   │   │
│              ┌─────▼──────┐     │                      │   │
│              │  SQLite    │◄────┤                      │   │
│              │  (async)   │     │  Skills:             │   │
│              └────────────┘     │  · 对话引导提取       │   │
│                                 │  · Bullet 召回       │   │
│                                 │  · STAR 改写         │   │
│                                 │  · 叙事生成          │   │
│                                 └──────────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

---

## 🚀 快速开始

### 前置要求

- Python 3.9+（推荐 3.12）
- Node.js 18+
- [Docker](https://www.docker.com/products/docker-desktop/)（可选，用于一键部署）
- 阿里云百炼 API Key（[免费领取](https://bailian.console.aliyun.com/)）或其他 LLM Key

### 方式一：Docker 一键启动

```bash
git clone https://github.com/Paker-kk/OfferU.git
cd OfferU
cp .env.example .env
# 编辑 .env 填入 QWEN_API_KEY
docker compose up -d
```

### 方式二：本地开发

```bash
git clone https://github.com/Paker-kk/OfferU.git
cd OfferU

# 后端
cd backend
python -m venv .venv312
.venv312\Scripts\activate    # Linux/Mac: source .venv312/bin/activate
pip install -r requirements.txt
cp .env.example .env         # 编辑填入 QWEN_API_KEY
python run_server.py

# 前端（另开终端）
cd frontend
npm install
npm run dev
```

### 环境变量

| 变量 | 说明 | 必填 |
|---|---|---|
| `QWEN_API_KEY` | 阿里云百炼 API Key | ✅（默认 Provider） |
| `LLM_PROVIDER` | LLM 提供商（qwen/deepseek/openai/ollama...） | 默认 qwen |
| `LLM_MODEL` | 模型名称 | 默认 qwen-flash |
| `DATABASE_URL` | 数据库连接串 | 默认 SQLite |
| `NO_PROXY` | 代理绕过（国内用户如用 Clash 需配置） | 可选 |

| 服务 | 地址 | 说明 |
|---|---|---|
| 前端界面 | http://localhost:3000 | Web 应用主界面 |
| 后端 API | http://localhost:8000 | FastAPI + 自动文档 |
| API 文档 | http://localhost:8000/docs | Swagger 交互文档 |
| MCP 端点 | http://localhost:8000/mcp | MCP Streamable HTTP |

---

## 🛠️ 开发模式

### 后端（FastAPI + Python 3.12）

```bash
cd backend
python -m venv .venv312
.venv312\Scripts\activate
pip install -r requirements.txt
python run_server.py         # 启动 uvicorn --reload
```

### 前端（Next.js 14）

```bash
cd frontend
npm install
npm run dev
```

打开 http://localhost:3000

### MCP 测试

```bash
# 列出所有 MCP 工具
curl -X POST http://localhost:8000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

---

## 📡 API 文档

完整交互文档：http://localhost:8000/docs

### 主要接口

| 方法 | 路径 | 说明 |
|---|---|---|
| **Profile** | | |
| GET | `/api/profile/` | 获取个人档案（含 Sections + TargetRoles） |
| PUT | `/api/profile/` | 更新基础信息 |
| POST | `/api/profile/chat` | AI 对话引导（SSE 流式） |
| POST | `/api/profile/chat/confirm` | 确认 Bullet Point 入库 |
| POST | `/api/profile/generate-narrative` | 生成职业叙事 |
| **Jobs** | | |
| GET | `/api/jobs/` | 岗位列表（分页/筛选/分拣状态） |
| PATCH | `/api/jobs/{id}/triage` | 单个岗位分拣 |
| PATCH | `/api/jobs/batch-triage` | 批量分拣 |
| GET | `/api/jobs/batches` | 采集批次列表 |
| **Pools** | | |
| GET/POST/PUT/DELETE | `/api/pools/` | 岗位池 CRUD |
| **Optimize** | | |
| POST | `/api/optimize/generate` | AI 简历定制生成（SSE 流式） |
| **Agent** | | |
| POST | `/api/agent/chat` | AI Agent 对话（SSE 流式） |
| **MCP** | | |
| POST | `/mcp` | MCP Streamable HTTP 端点 |
| **Resume** | | |
| GET/POST | `/api/resume/` | 简历 CRUD |
| **其他** | | |
| GET/PUT | `/api/config/` | 系统配置 |
| POST | `/api/scraper/search` | 触发岗位采集 |
| GET | `/api/calendar/events` | 日程事件 |

---

## 🖥️ 页面说明

| 页面 | 路径 | 功能 |
|---|---|---|
| **Dashboard** | `/` | 统计卡片、采集趋势图、最新岗位 |
| **个人档案** | `/profile` | AI 对话引导构建 Profile + Bullet 预览 |
| **岗位分拣** | `/jobs` | 三 Tab 分拣（未筛选/已筛选/已忽略）+ 池管理 |
| **岗位详情** | `/jobs/[id]` | AI 摘要、关键词、分拣操作 |
| **AI 定制** | `/optimize` | 三段式工作区（池→岗位→SSE 生成） |
| **AI Agent** | `/agent` | 对话式 Agent Console |
| **简历管理** | `/resume` | 简历列表 + 来源溯源标签 |
| **岗位采集** | `/scraper` | 多平台采集配置 + 触发 |
| **投递管理** | `/applications` | 投递记录、状态追踪 |
| **日程表** | `/calendar` | 月/周/日视图 |
| **周报分析** | `/analytics` | 来源分布、热门关键词 |
| **设置** | `/settings` | LLM Provider 切换、API Key 配置 |

---

## 📁 项目结构

```
OfferU/
├── .env.example                    # 环境变量模板
├── docker-compose.yml              # Docker 服务编排
│
├── backend/                        # FastAPI 后端（Python 3.12）
│   ├── requirements.txt
│   ├── run_server.py               # 启动脚本
│   └── app/
│       ├── main.py                 # 应用入口 + MCP 挂载
│       ├── config.py               # 多 Provider 配置管理
│       ├── database.py             # SQLAlchemy 2.0 async
│       ├── mcp_server.py           # MCP Server（13 Tools + 1 Resource）
│       ├── models/models.py        # ORM（Profile/Job/Pool/Batch/Resume...）
│       ├── routes/
│       │   ├── profile.py          # Profile 16 端点 + AI 对话引导 SSE
│       │   ├── jobs.py             # 岗位 CRUD + 分拣 + 批量操作
│       │   ├── pools.py            # 岗位池 CRUD
│       │   ├── optimize.py         # AI 简历定制 SSE（Bullet 召回 + STAR 改写）
│       │   ├── agent.py            # AI Agent Chat SSE 编排
│       │   ├── resume.py           # 简历管理 + 溯源标签
│       │   ├── scraper.py          # 采集触发 + 批次管理
│       │   ├── config.py           # 系统配置（多 LLM Provider）
│       │   └── ...                 # calendar / email / applications
│       ├── agents/
│       │   ├── llm.py              # LLM 抽象层（Qwen/DeepSeek/OpenAI/Ollama/...）
│       │   └── skills/             # AI Skills
│       │       ├── conversational_extractor.py  # 对话引导提取
│       │       ├── narrative_generator.py       # 职业叙事生成
│       │       ├── jd_analyzer.py               # JD 深度分析
│       │       └── resume_matcher.py            # 简历匹配评分
│       └── services/scrapers/      # 多平台爬虫适配器
│           ├── boss.py / zhilian.py / shixiseng.py / linkedin.py / corporate.py
│           └── base.py             # 适配器基类
│
├── frontend/                       # Next.js 14 前端
│   └── src/
│       ├── app/
│       │   ├── profile/            # AI 对话引导 + Profile 预览
│       │   ├── jobs/               # 三 Tab 岗位分拣
│       │   ├── optimize/           # 三段式 AI 定制工作区
│       │   ├── agent/              # AI Agent Console
│       │   ├── resume/             # 简历管理 + 溯源
│       │   └── ...                 # scraper / calendar / analytics / settings
│       ├── components/
│       │   ├── jobs/               # BatchGroup / PoolManager / JobCard
│       │   ├── onboarding/         # ProfileOnboarding 冷启动向导
│       │   └── layout/             # Sidebar / TopBar
│       └── lib/
│           ├── api.ts              # REST + SSE 客户端
│           └── hooks.ts            # SWR Hooks（Profile/Jobs/Pools/Batches...）
│
└── docs/
    └── PRD_v2_FINAL.md             # 产品需求文档 v2.1
```

---

## ⚠️ 免责声明

### API Key 安全
- 你的 API Key（Qwen / DeepSeek / OpenAI 等）由你自行管理，本项目**不会**将 Key 上传到任何第三方服务器
- `.env` 文件已被 `.gitignore` 忽略，请**绝对不要**将包含真实 Key 的文件提交到 Git

### 数据与隐私
- 所有数据（个人档案、简历、岗位信息）存储在你自己的本地数据库中
- 调用 AI API 时，简历/JD 内容会发送至对应 AI 服务商处理，请注意其隐私政策

### 爬虫风险
- 本项目提供的爬虫适配器仅供学习研究使用
- 使用前请确认目标网站的 robots.txt 和使用条款
- 频繁爬取可能导致 IP 被封禁，后果由使用者自行承担
- **严禁**将爬取的数据用于商业用途或侵犯他人权益

### AI 生成内容
- AI 生成的简历仅供参考，**严禁虚构事实**
- OfferU 的 Profile 引导带有防虚构规则和置信度标记，但最终内容由使用者本人负责
- AI 生成内容可能存在表述偏差，请仔细核实后再投递

### 费用说明
- 默认 Qwen qwen-flash 模型仅 ¥0.15/百万 token，生成 100 份简历成本约 ¥1-2
- 切换 DeepSeek / OpenAI 等模型费用不同，请关注各平台计费标准
- 可使用本地 Ollama 运行开源模型，完全免费但需要足够硬件资源

---

## 🗺️ Roadmap

### 已完成 ✅
- [x] FastAPI 后端 + SQLAlchemy 2.0 async（Python 3.12）
- [x] Next.js 14 前端（NextUI 2.4 暗色主题）
- [x] 多平台爬虫适配器（LinkedIn / BOSS / 智联 / 实习僧 / 大厂官网）
- [x] Profile AI 对话引导（5 主题 Stepper + SSE 多轮 + Bullet 确认）
- [x] 三 Tab 岗位分拣（未筛选 / 已筛选 / 已忽略 + 批次折叠 + 岗位池）
- [x] 三段式 AI 简历定制工作区（池→岗位→SSE 生成）
- [x] MCP Server（13 Tools + 1 Resource，FastMCP Streamable HTTP）
- [x] AI Agent Chat（Web 对话式 Agent Console + Tool Use）
- [x] 简历溯源标记（"基于 XX 岗位生成"）
- [x] 多 LLM 支持（Qwen / DeepSeek / OpenAI / SiliconFlow / Gemini / 智谱 / Ollama）
- [x] Dashboard + 周报分析 + 日程管理
- [x] LLM STAR 法则改写引擎（premium tier 自动改写简历内容）
- [x] jieba 中文分词（精准提取缺失关键词，替代暴力 bigram）
- [x] 三级模型档位系统（fast / standard / premium，用户可自定义映射）
- [x] SSE 降级 warning（LLM 改写失败时通知前端，不再静默 fallback）

### 进行中 🔄
- [ ] PDF/Word 简历解析导入（pdfplumber + Qwen 结构化）
- [ ] 一键应用 AI 优化建议（HITL 采纳/拒绝）

### 未来计划 📋
- [ ] 投递自动化（自动填表提交）
- [ ] 简历 PDF 导出美化（ATS 优化模板）
- [ ] 面试准备模块（STAR 故事库 + 模拟面试）

---

## 📝 更新记录

### 2026-04-15 v3.1 — AI 改写引擎 + 分词修复 + 模型分级

**核心改进：**
- **LLM STAR 改写引擎**：在简历生成流水线中接入 AI 改写层，自动将 Bullet Points 按 STAR 法则（Situation-Task-Action-Result）重写，经历描述从平铺直叙变为量化成果导向
- **jieba 中文分词**：替换原先暴力 2-char bigram 分词，`missing_keywords` 现在返回 "项目管理"、"数据分析" 等有意义的词语，而非 "频生"、"类产" 等无效碎片
- **三级模型档位（tier）**：`chat_completion()` 新增 `tier` 参数（fast / standard / premium），不同场景自动选择最合适的模型：JD 分析用 fast、对话用 standard、简历改写用 premium
- **用户可自定义 tier 映射**：通过 `PUT /api/config/` 的 `tier_model_map` 字段覆盖默认映射，无需改代码即可切换模型
- **SSE 降级通知**：LLM 改写失败时发送 `warning` SSE 事件，前端可展示提示而非静默 fallback

**Bug 修复：**
- 修复技能 section 分词器将 "ComfyUI 工作流" 拆分为无意义 token 的问题
- 修复教育/经历/项目 section 未读取 `normalized` 字段导致内容缺失
- 修复 `_to_tokens` 将中英文混合字符串合并为超长 token 的正则 bug
- 更新 Qwen provider 预设模型列表（qwen-flash / qwen3.5-plus / qwen3.6-plus）
- 修复 Windows Clash 代理导致的 SSL 证书主机名不匹配问题

**E2E 验证：** 33/33 检查项全通过（Profile 9 + Jobs 3 + Optimize SSE 7 + Resume 8 + Config 4）。

---

## 📬 联系方式

- **GitHub**: [Paker-kk/OfferU](https://github.com/Paker-kk/OfferU)
- **灵感来源**: [santifer/career-ops](https://github.com/santifer/career-ops)

欢迎提 Issue 或 PR！
