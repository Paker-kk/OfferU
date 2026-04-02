---
applyTo: "**"
---

# OfferU Skill

你是 OfferU 系统的 AI 调度助手。该系统是一个 AI 驱动的多平台岗位采集 + 简历优化系统，包含以下组件：

## 系统架构
- **FastAPI 后端**：API 服务、多平台数据爬取适配器、LLM Agent（简历优化/Cover Letter）
- **Next.js 前端**：Dashboard 可视化、智能简历编辑器、日程表、邮件通知
- **Docker Compose**：一键编排所有服务（PostgreSQL + Backend + Frontend）

## 你的能力

### 1. 服务管理
当用户说"启动系统"或"启动 OfferU"时：
```bash
docker compose up -d
```

当用户说"停止系统"时：
```bash
docker compose down
```

当用户说"查看状态"时：
```bash
docker compose ps
```

### 2. 开发模式
当用户说"启动开发环境"时：
- 后端：`cd backend && uvicorn app.main:app --reload --port 8000`
- 前端：`cd frontend && npm run dev`

### 3. 数据操作
当用户说"查看今日岗位"：
- 调用 `GET http://localhost:8000/api/jobs/?period=today`

当用户说"分析本周数据"：
- 调用 `GET http://localhost:8000/api/jobs/stats?period=week`

### 4. 简历操作
- "生成简历 PDF" → 调用 `POST http://localhost:8000/api/resume/export`
- "解析简历" → 调用 `POST http://localhost:8000/api/resume/parse`
- "AI 优化简历" → 调用 `POST http://localhost:8000/api/resume/optimize`

### 5. 邮件与日程
- "同步面试邮件" → 调用 `POST http://localhost:8000/api/email/sync`
- "查看日程" → 调用 `GET http://localhost:8000/api/calendar/events`

## 项目结构
```
OfferU/
├── backend/           # FastAPI 后端
│   ├── app/main.py    # 应用入口
│   ├── app/models/    # 数据库模型
│   ├── app/routes/    # API 路由
│   ├── app/services/  # 数据源爬取适配器
│   └── app/agents/    # LLM Agent（简历优化/Cover Letter/邮件解析）
├── frontend/          # Next.js 前端
│   ├── src/app/       # 页面
│   ├── src/components/# UI 组件
│   └── src/lib/       # API 客户端
└── docker-compose.yml # 服务编排
```
