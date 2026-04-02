<h1 align="center">OfferU</h1>

<p align="center">
  <em>Offer \+ U = OfferU — 做你校招路上的英雄搭档</em>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Backend-FastAPI-009688?style=flat&logo=fastapi" />
  <img src="https://img.shields.io/badge/Frontend-Next.js%2014-000000?style=flat&logo=nextdotjs" />
  <img src="https://img.shields.io/badge/AI-OpenAI%20%7C%20DeepSeek%20%7C%20Ollama-412991?style=flat&logo=openai" />
  <img src="https://img.shields.io/badge/Deploy-Docker-2496ED?style=flat&logo=docker" />
  <img src="https://img.shields.io/badge/License-MIT-brightgreen?style=flat" />
</p>

<p align="center">
  <a href="./README_EN.md">English</a> ·
  <a href="#-快速开始">快速开始</a> ·
  <a href="#-功能特色">功能特色</a> ·
  <a href="#-免责声明">免责声明</a>
</p>

---

## 致谢

本项目 fork 自 [chunxubioinfor/DailyJobMatch](https://github.com/chunxubioinfor/DailyJobMatch)，感谢原作者 Chunxu Han 的杰出贡献。OfferU 在原项目基础上进行了架构重构，移除了 n8n 依赖和评分系统，聚焦于**智能简历编辑 + 多平台岗位采集 + AI 简历优化**三大核心能力。

---

## 📋 目录

1. [功能特色](#-功能特色)
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

## ✨ 功能特色

### 🎨 智能简历编辑器
- Tiptap 富文本编辑器，黑底白字简洁设计
- 实时预览 + PDF 一键导出（WeasyPrint）
- 拖拽排序、多模板切换、撤销/重做

### 🔍 多平台岗位采集
- 可插拔爬虫适配器架构
- 支持：LinkedIn / BOSS直聘 / 智联招聘 / 实习僧 / 大厂官网（字节/阿里/腾讯）
- 关键词 + 地区 + 过滤词灵活配置

### 🤖 AI 简历优化（核心亮点）
- 选择目标岗位 JD → AI 分析简历与 JD 的差距 → 生成优化建议 → 一键修改
- 支持多 LLM：OpenAI / DeepSeek / 本地 Ollama
- AI 生成 Cover Letter

### 📊 数据可视化
- Dashboard 岗位采集趋势图
- 周报分析：来源分布饼图、热门关键词、环比对比
- 响应式暗色主题 + Framer Motion 流畅动画

### 📬 面试管理
- Gmail OAuth 自动同步面试邮件
- AI 解析面试时间/地点/公司
- FullCalendar 日程管理（月/周/日视图）
- 投递追踪（待投 → 面试 → offer）

---

## 🏗️ 系统架构

```
┌─────────────────────────────────────────────┐
│              OfferU 系统架构                   │
├─────────────────────────────────────────────┤
│                                             │
│  ┌──────────┐   REST API   ┌────────────┐  │
│  │ Frontend │◄────────────►│  Backend   │  │
│  │ Next.js  │              │  FastAPI   │  │
│  │ NextUI   │              │            │  │
│  └──────────┘              └─────┬──────┘  │
│                                  │         │
│                    ┌─────────────┤         │
│                    │             │         │
│              ┌─────▼─────┐ ┌────▼────┐    │
│              │ 爬虫适配器 │ │ AI Agent│    │
│              │ LinkedIn  │ │ 简历优化 │    │
│              │ BOSS      │ │ 求职信   │    │
│              │ 智联      │ │ 邮件解析 │    │
│              │ 实习僧    │ └─────────┘    │
│              │ 大厂官网  │                 │
│              └───────────┘                 │
│                    │                       │
│              ┌─────▼─────┐                 │
│              │ PostgreSQL │                 │
│              │  / SQLite  │                 │
│              └───────────┘                 │
└─────────────────────────────────────────────┘
```

---

## 🚀 快速开始

### 前置要求

- [Docker](https://www.docker.com/products/docker-desktop/) & Docker Compose
- OpenAI API Key（或其他兼容 LLM 的 Key）

> **国内用户提示**：如果拉取镜像慢，可在 Docker 配置中添加镜像源 `https://m.daocloud.io`

### 1. 克隆 & 配置

```bash
git clone https://github.com/Paker-kk/OfferU.git
cd OfferU
cp .env.example .env
```

编辑 `.env` 填入你的配置：

| 变量 | 说明 | 必填 |
|---|---|---|
| `OPENAI_API_KEY` | OpenAI API Key | ✅ |
| `DATABASE_URL` | 数据库连接串 | 默认 SQLite |
| `SECRET_KEY` | 安全密钥（生产环境务必修改） | ✅ |
| `APIFY_API_KEY` | Apify Token（LinkedIn 爬取） | 可选 |
| `GMAIL_CLIENT_ID` | Gmail OAuth（邮件同步） | 可选 |
| `CORS_ORIGINS` | 前端跨域地址 | 默认 localhost:3000 |

### 2. 启动

```bash
docker compose up -d
```

| 服务 | 地址 | 说明 |
|---|---|---|
| 前端界面 | http://localhost:3000 | Web 应用主界面 |
| 后端 API | http://localhost:8000 | FastAPI + 自动文档 |
| API 文档 | http://localhost:8000/docs | Swagger 交互文档 |

### 3. 验证

```bash
docker compose ps
curl http://localhost:8000/api/health
# 返回 {"status": "healthy", "service": "OfferU"}
```

---

## 🛠️ 开发模式

### 后端（FastAPI）

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Linux/Mac: source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### 前端（Next.js）

```bash
cd frontend
npm install
npm run dev
```

打开 http://localhost:3000

---

## 📡 API 文档

完整交互文档：http://localhost:8000/docs

### 主要接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/jobs/` | 岗位列表（分页/筛选） |
| GET | `/api/jobs/stats` | 统计汇总 |
| GET | `/api/jobs/{id}` | 岗位详情 |
| GET | `/api/jobs/trend` | 采集趋势数据 |
| GET | `/api/jobs/weekly-report` | 周报分析 |
| POST | `/api/jobs/ingest` | 批量写入岗位数据 |
| GET/POST | `/api/resume/` | 简历 CRUD |
| POST | `/api/resume/export` | 导出 PDF |
| POST | `/api/resume/optimize` | AI 优化简历 |
| GET | `/api/calendar/events` | 日程事件 |
| POST | `/api/email/sync` | 同步邮件 |
| GET | `/api/email/notifications` | 面试通知 |
| GET/PUT | `/api/config/` | 系统配置 |
| GET/POST | `/api/applications/` | 投递管理 |
| POST | `/api/applications/generate` | AI 生成求职信 |

---

## 🖥️ 页面说明

| 页面 | 路径 | 功能 |
|---|---|---|
| **Dashboard** | `/` | 统计卡片、采集趋势图、最新岗位 |
| **岗位列表** | `/jobs` | 全部岗位、按时间筛选 |
| **岗位详情** | `/jobs/[id]` | AI 摘要、关键词、一键投递 |
| **简历编辑器** | `/resume` | 富文本编辑、实时预览、PDF 导出 |
| **投递管理** | `/applications` | 投递记录、AI 求职信、状态追踪 |
| **日程表** | `/calendar` | 月/周/日视图、AI 自动填充 |
| **邮件通知** | `/email` | Gmail 授权、面试通知 |
| **周报分析** | `/analytics` | 环比对比、来源分布、热门关键词 |
| **设置** | `/settings` | API Key、搜索词、数据源开关 |

---

## 📁 项目结构

```
OfferU/
├── .env.example                   # 环境变量模板
├── docker-compose.yml             # Docker 服务编排
│
├── backend/                       # FastAPI 后端
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app/
│       ├── main.py                # 应用入口
│       ├── config.py              # 配置管理
│       ├── database.py            # 异步数据库引擎
│       ├── models/models.py       # ORM 模型
│       ├── routes/                # API 路由
│       │   ├── jobs.py            # 岗位 CRUD + 统计 + 周报
│       │   ├── resume.py          # 简历管理 + PDF 导出
│       │   ├── applications.py    # 投递管理 + AI 求职信
│       │   ├── calendar.py        # 日程管理
│       │   ├── email.py           # Gmail OAuth + 邮件同步
│       │   └── config.py          # 系统配置
│       ├── services/scrapers/     # 多平台爬虫适配器
│       │   ├── base.py            # 适配器基类 + 注册表
│       │   ├── linkedin.py        # LinkedIn (Apify)
│       │   ├── boss.py            # BOSS直聘
│       │   ├── zhilian.py         # 智联招聘
│       │   ├── shixiseng.py       # 实习僧
│       │   └── corporate.py       # 大厂官网
│       └── agents/                # LLM Agent
│           ├── resume_optimizer.py# 简历优化
│           ├── cover_letter.py    # 求职信生成
│           └── email_parser.py    # 邮件解析
│
├── frontend/                      # Next.js 14 前端
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── app/                   # 页面
│       ├── components/            # UI 组件
│       └── lib/                   # API 客户端 + Hooks
│
└── Archive/                       # 历史版本归档
```

---

## ⚠️ 免责声明

### API Key 安全
- 你的 API Key（OpenAI / DeepSeek 等）由你自行管理，本项目**不会**将 Key 上传到任何第三方服务器
- `.env` 文件已被 `.gitignore` 忽略，请**绝对不要**将包含真实 Key 的文件提交到 Git
- 建议定期轮换 Key，并在 OpenAI 后台设置 Usage Limit

### 数据与隐私
- 所有数据（简历、岗位信息、面试记录）存储在你自己的本地数据库中
- Gmail OAuth 授权仅用于读取面试相关邮件，不会访问其他邮件内容
- 调用 AI API 时，简历/JD 内容会发送至对应 AI 服务商进行处理，请注意其隐私政策

### 爬虫风险
- 本项目提供的爬虫适配器仅供学习研究使用
- 使用前请确认目标网站的 robots.txt 和使用条款
- 频繁爬取可能导致 IP 被封禁，后果由使用者自行承担
- **严禁**将爬取的数据用于商业用途或侵犯他人权益

### AI 生成内容
- AI 优化后的简历和 Cover Letter 仅供参考，请仔细核实后再使用
- AI 生成内容可能存在事实性错误，使用者应自行判断
- 最终投递的简历内容由使用者本人负责

### 费用说明
- 调用 OpenAI / DeepSeek 等商业 API 会产生费用，请关注各平台的计费标准
- 推荐先使用小模型（如 GPT-4o-mini）测试，确认需求后再切换更强模型
- 可使用本地 Ollama 运行开源模型，完全免费但需要足够的硬件资源

---

## 🗺️ Roadmap

- [x] FastAPI 后端 API
- [x] Next.js 前端 Dashboard
- [x] 多平台爬虫适配器架构
- [x] 简历编辑器 + PDF 导出
- [x] Gmail OAuth 邮件同步
- [x] FullCalendar 日程管理
- [x] 投递管理 + AI 求职信
- [x] 周报分析
- [ ] AI 简历优化（选 JD → 分析差距 → 一键修改）
- [ ] 多 LLM 支持（DeepSeek / Ollama）
- [ ] Tauri 桌面版（双击安装，零 Docker 依赖）
- [ ] 微信小程序版
- [ ] 投递自动化（自动填表提交）

---

## 📬 联系方式

- **GitHub**: [Paker-kk/OfferU](https://github.com/Paker-kk/OfferU)
- **原项目**: [chunxubioinfor/DailyJobMatch](https://github.com/chunxubioinfor/DailyJobMatch)

欢迎提 Issue 或 PR！
