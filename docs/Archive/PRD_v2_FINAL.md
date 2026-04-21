# OfferU PRD v2（Dario 审查通过版）

> 更新时间：2026-04-09 (v2.1 — Profile 对话引导重设计)  
> 状态：**Dario Round 3 审后修订，Profile 重大变更**  
> 审查人：Dario (首席执行总监)  
> 参考项目：Career-Ops (santifer/career-ops)

---

## 0. 产品定位（一句话）

**OfferU = 帮文科生小白从零构建结构化个人档案，再按每个 JD 智能组装定制简历的求职助手。**

- Teal 做的是**剪裁**（从 Master Resume 复制+删减）
- OfferU 做的是**组装**（从 Profile 事实库按 JD 智能抽取+改写+组装成一份全新简历）
- 差异化：Profile 是灵魂，定制是价值，爬虫批量采集是效率武器

---

## 1. 核心旅程（5 步主线）

```
/scraper 采集导入
    ↓
/jobs Inbox 分拣（未筛选→已筛选/已忽略，分池管理）
    ↓
/profile 个人档案（表单基础项 + AI对话引导 → Bullet级事实库）
    ↓
/optimize AI 简历定制工作区（选池→选岗位→按JD组装生成）
    ↓
/resume 简历资产管理（编辑微调→导出投递）
```

---

## 2. 已确认决策总表

| # | 决策项 | 结论 | 来源 |
|---|--------|------|------|
| 1 | 池模式 | 用户自定义池，单选（一岗一池），允许未分组 (pool_id=null) | PRD v1 |
| 2 | 池管理入口 | **放 /jobs 页面**（已筛选视图内创建/改名/删除） | Dario 审查修正 |
| 3 | 生成策略 | 默认单版（逐岗位），可切换综合输出 | PRD v1 |
| 4 | 简历保存 | 每次生成新增简历，不覆盖旧简历 | PRD v1 |
| 5 | Profile 回写 | 默认不回写，显式采纳才回写 | PRD v1 |
| 6 | 基底简历 | 取消必选，Profile=唯一事实源，可选参考简历 | PRD v1 |
| 7 | Phase 3 UI规范 | **全保留**（视进度在第2周评估是否简化） | 用户决策 |
| 8 | 旧数据迁移 | 全部标为"已筛选" + 生成一个"历史导入"批次 | 用户决策 |
| 9 | LLM 跑通 | **第1周就必须配 API Key 跑通端到端** | Dario 要求 + 用户同意 |
| 10 | 多 Provider 路由 | 参考 Flovart 的 resolveGenerationProvider 架构 | 用户要求 |
| 11 | Profile 参考项目 | **复刻 Career-Ops 的 profile.yml 五大块结构** | Dario Round 3 |
| 12 | Profile 数据粒度 | **Bullet 级别**（每个成就点/职责=独立条目） | Dario Round 3 |
| 13 | Profile 冷启动 | **混合模式**（表单填基础项 + AI 对话补充经历细节） | Dario Round 3 |
| 14 | Profile 对话数据流 | **每轮对话实时确认入库**（非最后统一确认） | Dario Round 3 |
| 15 | 用户画像 | 文科生小白，**什么都没有**，需要对话从零构建 | Dario Round 3 |
| 16 | 即时价值钩子 | 选完目标岗位后 **3句话先出草稿简历**，再追问填充 bullets | Dario Round 4 |
| 17 | 多轮对话 | **直接做多轮，一步到位**（不做同步单轮 MVP） | Dario Round 4 |
| 18 | LLM Provider | **阿里云百炼 Qwen**（OpenAI 兼容接口），`llm.py` 新增 qwen provider | Dario Round 4 |
| 19 | Bullet 召回 | **和 Career-Ops 一样**（需联网研究具体实现） | Dario Round 4 |
| 20 | Phase 3 砍掉 | UI 规范工时 **让给 Profile 对话引导**（Phase 3 不做或极简化） | Dario Round 4 |

---

## 3. 硬约束（不可变）

1. AI 简历定制页必须保留，且有可感知价值
2. 岗位页必须能查看完整 JD（二级详情页展示 raw_description）
3. 爬虫/采集前移到岗位浏览之前（导入→inbox）
4. 默认不回写个人档案（HITL：显式采纳才回写）
5. 生成**仅允许改写与重组**，不允许引入 Profile 中不存在的事实

---

## 4. 现有代码基线（精确到字段）

### 4.1 数据库（7 张表）

| 表 | 核心字段 | PRD 需新增字段 |
|----|---------|---------------|
| **jobs** | id, title, company, location, url, source, raw_description, summary, keywords, hash_key... | `triage_status`, `pool_id`, `batch_id` |
| **resumes** | id, user_name, title, summary, contact_json, template_id, style_config, language... | `source_job_ids` (JSON), `source_mode` (per_job/combined/manual), `source_profile_snapshot` (JSON, 可选) |
| **resume_sections** | id, resume_id, section_type, sort_order, title, visible, content_json | 无变更 |
| **resume_templates** | id, name, css_variables, html_layout, is_builtin | 无变更 |
| **interview_notifications** | id, email_subject, email_body, company, position, interview_time... | 无变更 |
| **calendar_events** | id, title, event_type, start_time, related_job_id... | 无变更 |
| **applications** | id, job_id, status, cover_letter, notes... | 无变更 |

**新增表:**

| 新表 | 字段 | 说明 |
|------|------|------|
| **pools** | id, name, description, color, sort_order, created_at | 用户自定义岗位分组 |
| **batches** | id, source, keywords, location, max_results, job_count, status, created_at | 采集批次记录 |
| **profiles** | id, name, headline, exit_story, cross_cutting_advantage, is_default, created_at, updated_at | 个人档案主表 — Career-Ops narrative 层（MVP 单用户只有一个） |
| **profile_sections** | id, profile_id, section_type, parent_id(nullable), title, sort_order, content_json, source(manual/ai_chat/ai_import), confidence, created_at, updated_at | Bullet 级事实条目（段→bullet 树形），与 resume_sections 兼容 |
| **profile_target_roles** | id, profile_id, role_name, role_level, fit(primary/secondary/adjacent), created_at | 目标岗位列表 — Career-Ops target_roles 层 |
| **profile_chat_sessions** | id, profile_id, topic(education/experience/project/skill/general), messages_json, extracted_bullets_count, status(active/completed), created_at, updated_at | AI 对话引导会话记录（多轮状态持久化） |

### 4.2 后端路由（6 个模块已注册）

| 前缀 | 模块 | 状态 |
|------|------|------|
| `/api/jobs` | routes.jobs | 需重构（新增分拣/池/批次查询） |
| `/api/resume` | routes.resume | 需扩展（生成溯源字段） |
| `/api/scraper` | routes.scraper | 需扩展（输出 batch_id） |
| `/api/config` | routes.config | 无变更 |
| `/api/applications` | routes.applications | 无变更 |
| `/api/calendar` | routes.calendar | 无变更 |
| — | — | **新增** `/api/pools`, `/api/profile`, `/api/profile/chat`, `/api/optimize` |

### 4.3 前端导航（10 项）

现有：Dashboard / 岗位 / 简历 / AI优化 / 投递 / 爬虫 / 日程 / 邮件通知 / 周报分析 / 设置

需新增：**个人档案** (Profile)，位于"简历"之前

### 4.4 AI Skill 管道（4 阶段串行）

```
JD分析 → 匹配分析 → 内容改写 → 模块重排
```

**需扩展**：
- Profile 对话引导链路：conversational_extractor.py → 分主题追问 → Bullet 抽取
- Profile 叙事生成链路：narrative_generator.py → headline/exit_story 生成
- 简历组装链路：Profile Bullet 召回 → 相关性排序 → 按 JD 组装 → 改写润色

### 4.5 LLM 配置

支持 qwen(阿里云百炼) / deepseek / openai / ollama，统一 OpenAI 兼容 API。
**Phase 0 使用阿里云百炼 Qwen 跑通（API Key 已获得，存 .env，禁止 Git 追踪）。**
需新增 `qwen` provider: base_url=`{workspace_host}/compatible-mode/v1`, API Key 从 .env 读取。

---

## 5. 页面职责定义

### 5.1 采集页 `/scraper`（现有，需扩展）

**现有能力**：配置数据源 → 运行爬虫 → 查看任务列表  
**需新增**：
- 爬虫完成后生成 `batch` 记录（写入 batches 表）
- 新岗位入库时 `triage_status=unscreened`，`batch_id=该批次ID`
- 一键跳转到 `/jobs?tab=unscreened&batch_id=xxx`

### 5.2 岗位页 `/jobs`（现有，需重构）

**现有能力**：9维筛选 + 分页 + 批量选择 + BatchOptimizeModal  
**需改造为 Inbox**：
- Tabs：`未筛选` / `已筛选` / `已忽略`
- 未筛选：按 batch 分区（可折叠）
- 已筛选：按池分组 + `未分组` 视图
- 池管理：创建/改名/删除池（此页面内完成）
- 快捷操作：忽略 / 加入已筛选 / 分配池
- 批量选择 → "去 AI 简历定制"（跳转 /optimize 带 job_ids）
- 点击岗位进入详情页（展示完整 raw_description）

### 5.3 个人档案页 `/profile`（**全新** — 复刻 Career-Ops 六步 Onboarding）

**数据结构（五大块，适配校招文科生）**：

| 模块 | Career-Ops 原名 | OfferU 校招适配 | profile_sections.section_type |
|------|----------------|-----------------|-------------------------------|
| 基础信息 | candidate | 姓名/学校/专业/学位/GPA/邮箱/电话/微信 | 存 profiles 表字段 |
| 目标岗位 | target_roles | 运营/产品/市场/行政/教育... + fit 分级 | profile_target_roles 表 |
| 职业叙事 | narrative | headline + exit_story + 超能力 + 证明点 | profiles 表字段 |
| 经历条目 | — (新增) | 实习/社团/项目/志愿者/比赛 (Bullet 级) | education / internship / project / activity / competition |
| 技能证书 | — (新增) | 硬技能/软技能/语言/证书/荣誉 | skill / certificate / honor / language |

**冷启动流程（混合模式 — 参考 Career-Ops Step 1-5）**：

```
空 Profile 进入页面 → Onboarding 引导流程
    ↓
Step 1: 表单填基础信息（姓名/学校/专业/邮箱/电话）
    ↓
Step 2: 目标岗位选择（多选 Chip + 自定义输入 + fit 分级: primary/secondary）
    ↓
Step 2.5: ★即时价值钩子★ — "告诉我你的3段经历名称"
           AI 根据 3 句话 + 目标岗位 → 秒出一份草稿简历框架
           用户看到产出 → 激励继续填充细节
    ↓
Step 3: AI 对话引导经历（按主题轮转）
    ┌─────────────────────────────────────────────────────┐
    │ AI: "你在大学做过什么实习？在哪家公司？主要做什么？"   │
    │ 用户: "在xx公司实习了3个月，做了公众号运营…"          │
    │ AI: 提取 → [公众号运营实习生 | xx公司 | 3个月]       │
    │     追问: "运营期间粉丝增长了多少？发了多少篇？"       │
    │ 用户: "粉丝从500涨到2000，发了15篇原创"              │
    │ AI: 生成 Bullet →                                    │
    │     "负责公众号日常运营，3个月原创15篇，               │
    │      粉丝从500增至2000（+300%）"                      │
    │ 用户: ✅确认 → 实时写入 profile_sections              │
    └─────────────────────────────────────────────────────┘
    ↓
Step 4: AI 继续追问（社团/项目/比赛/志愿者/荣誉/技能）
    ↓
Step 5: 职业叙事总结
         AI 根据已有条目自动生成 headline + exit_story
         用户确认/编辑后保存
    ↓
Profile 构建完成 → "你已有 N 条档案条目，可以去 AI 简历定制了！"
```

**对话引导 UI**：
- **左侧面板**：已构建的 Profile 实时预览（按 section_type 分区展示 bullets，带确认标记）
- **右侧面板**：AI 对话面板（ChatGPT 风格 + 结构化引导提示 + 主题切换器）
- **Bullet 确认**：每轮对话后 AI 输出的 bullet 以可编辑卡片展示，用户 ✅确认 → 实时写入左侧
- **主题进度条**：顶部显示 "教育 ✅ → 实习 🔄 → 项目 ○ → 社团 ○ → 技能 ○"
- **手动编辑**：左侧已有内容可随时编辑/删除/手动新增

**辅助导入路径**（非主路径）：
- 上传简历（PDF/Word）→ AI 解析 → 生成 bullet candidates → 用户逐条确认
- 重复导入时：疑似重复提示（基于文本相似度），用户决定合并/替换/保留

**防虚构规则**：
- AI 只能从用户原话中提取和改写，**严禁凭空生成事实**
- 每条 bullet 附 confidence 评分（高/中/低）
- 低置信度 bullet 标橙色，提示"请核实此条目"
- 空档案时：其他页面提示"请先填写个人档案"

### 5.4 AI 简历定制页 `/optimize`（现有，需重构为工作区）

**现有能力**：选简历+选JD → AI分析 → HITL建议采纳  
**需改造为三段式工作区**：

```
┌─────────────────────────────────────────────────────┐
│ ① 池/范围选择   ② 本轮岗位勾选    ③ 输出简历区     │
│                                                      │
│ [池A] [池B]      □ 腾讯-产品助理    ┌──────────┐    │
│ [未分组]         □ 字节-运营实习    │ 生成进度   │    │
│                  ☑ 阿里-市场专员    │ ████░░ 3/5│    │
│                                     │            │    │
│                  [逐岗位] [综合]    │ 预览+保存  │    │
│                  [开始生成]         └──────────┘    │
└─────────────────────────────────────────────────────┘
```

**生成逻辑（核心）**：
1. 从 Profile 的 profile_sections Bullet 池中检索与目标 JD 最相关的条目（关键词匹配 + 语义召回）
2. 按 section_type 组装成简历骨架（教育+实习+项目+技能...）
3. 对每个条目按 JD 关键词改写润色（STAR 法，零虚构）
4. 输出解释："使用了哪些档案 Bullet" + "缺失哪些能力" + "Profile 命中率 X/N"
5. 保存为新 Resume 记录（source_mode=per_job/combined，source_job_ids=[...]）

**逐岗位模式**：N 个岗位 → N 份简历（SSE 流式进度）  
**综合模式**：N 个岗位 → 1 份通用简历

### 5.5 简历页 `/resume`（现有，轻微扩展）

**现有能力**：简历列表 + Canva 编辑器 + 模板 + PDF 导出  
**需新增**：
- 简历卡片显示来源标签（"基于 腾讯-产品助理 生成" / "手动创建"）
- 不再承载池管理（已移至 /jobs）

---

## 6. API 变更清单

### 6.1 新增 API

```
# Pool CRUD
GET    /api/pools                     → Pool[]
POST   /api/pools                     → Pool  (body: {name, description?, color?})
PUT    /api/pools/{id}                → Pool  (body: {name?, description?, color?})
DELETE /api/pools/{id}                → void  (含岗位归属处理)

# Profile (复刻 Career-Ops Onboarding)
GET    /api/profile                   → Profile + ProfileSection[] + TargetRole[]
PUT    /api/profile                   → Profile  (更新基础信息 + narrative 字段)

# Profile Target Roles
GET    /api/profile/target-roles      → TargetRole[]
POST   /api/profile/target-roles      → TargetRole  (body: {role_name, role_level?, fit?})
DELETE /api/profile/target-roles/{id} → void

# Profile Sections (Bullet 级 CRUD)
POST   /api/profile/sections          → ProfileSection  (手动新增条目)
PUT    /api/profile/sections/{id}     → ProfileSection  (编辑单条 bullet)
DELETE /api/profile/sections/{id}     → void

# Profile AI 对话引导 ★核心新接口★
POST   /api/profile/chat              → SSE stream
       body: {
         topic: "education" | "experience" | "project" | "activity" | "skill" | "general",
         message: string,
         session_id?: int   // 续接已有对话，不传则新建
       }
       SSE events:
         - ai_message     {content: string}  (AI追问/引导文本)
         - bullet_candidate  {index: int, section_type, title, content_json, confidence}
         - topic_complete  {topic, bullets_extracted: int}  (本主题引导完成)
         - heartbeat       {}

# Profile 对话 Bullet 确认入库
POST   /api/profile/chat/confirm      → ProfileSection
       body: {session_id: int, bullet_index: int, edits?: {title?, content_json?}}
       说明: 用户确认/编辑后 → 写入 profile_sections (source="ai_chat")

# Profile 职业叙事生成
POST   /api/profile/generate-narrative → {headline, exit_story, cross_cutting_advantage}
       说明: AI根据已有 profile_sections 生成叙事，用户确认后写入 profiles 表

# Profile 简历导入 (辅助路径)
POST   /api/profile/import-resume     → {bullets: BulletCandidate[], session_id: int}
       (file: PDF/Word → AI抽取 → 返回候选 bullets，需逐条 confirm)

# Batch
GET    /api/batches                   → Batch[]  (采集批次列表+统计)

# Optimize (新生成接口)
POST   /api/optimize/generate         → SSE stream  
       body: {
         job_ids: int[],
         mode: "per_job" | "combined",
         reference_resume_id?: int   // 可选参考简历
       }
       events: progress / result / error / done / heartbeat
```

### 6.2 修改 API

```
# Jobs — 新增查询参数
GET  /api/jobs/?triage_status=unscreened|screened|ignored
                &pool_id=int (含 "null" 表示未分组)
                &batch_id=int
                &...(保留现有9维筛选)

# Jobs — 新增分拣操作
PATCH /api/jobs/{id}                  → Job  (body: {triage_status?, pool_id?})
PATCH /api/jobs/batch-triage          → void (body: {job_ids: int[], triage_status?, pool_id?})

# Jobs — 批次统计
GET   /api/jobs/batches               → [{batch_id, source, keywords, count, created_at}]

# Scraper — 扩展
POST  /api/scraper/run                → task_id (响应中包含 batch_id)

# Resume — 新增溯源字段
POST  /api/resume/                    → Resume (body 新增 source_job_ids?, source_mode?)
```

---

## 7. 实施计划（6 周 × 2 人）

### Phase 0：需求冻结与 LLM 跑通（第1周前半，阻塞一切）

| # | 任务 | 负责人 | 产出 | 文件 |
|---|------|--------|------|------|
| 0.1 | 配置阿里云百炼 Qwen API Key（存 .env + .gitignore），跑通 Skill Pipeline 端到端（单岗位） | 李+彭 | .env 有有效 Key，/optimize 能返回真实 AI 结果 | `backend/.env`, `backend/app/agents/llm.py`, `backend/app/config.py` |
| 0.2 | 确认现有路径可回归（/scraper→/jobs→/resume→/optimize） | 李 | 手动冒烟测试通过，截图存档 | — |
| 0.3 | 统一命名基线文档 | 彭 | triage_status/pool_id/batch_id/profile 命名确认 | `docs/NAMING_CONVENTION.md` |

### Phase 1：后端模型与接口（第1周后半 ~ 第2周）

| # | 任务 | 依赖 | 文件改动 |
|---|------|------|---------|
| 1.1 | 新增 Pool, Batch, Profile, ProfileSection, ProfileTargetRole, ProfileChatSession 模型 | 0.3 | `backend/app/models/models.py` |
| 1.2 | Job 表补 triage_status/pool_id/batch_id 字段 + _auto_migrate 适配 | 0.3 | `models.py`, `database.py` |
| 1.3 | Resume 表补 source_job_ids/source_mode 字段 | 1.1 | `models.py`, `database.py` |
| 1.4 | 旧数据迁移脚本（全部标已筛选 + 历史批次） | 1.2 | `database.py` (_auto_migrate 扩展) |
| 1.5 | Pool CRUD 路由 | 1.1 | 新建 `backend/app/routes/pools.py` |
| 1.6 | Profile 路由（CRUD + TargetRoles + 对话引导 SSE + Bullet 确认 + 简历导入） | 1.1 | 新建 `backend/app/routes/profile.py` |
| 1.6a | Profile 对话引导 AI Skill（分主题引导 + Bullet 提取 + 追问模板） | 1.1 | 新建 `backend/app/agents/skills/conversational_extractor.py` |
| 1.6b | Profile 叙事生成 AI Skill（从 bullets 生成 headline/exit_story） | 1.6a | 新建 `backend/app/agents/skills/narrative_generator.py` |
| 1.7 | Jobs 路由扩展（triage/pool/batch 筛选 + PATCH 分拣） | 1.2 | `backend/app/routes/jobs.py` |
| 1.8 | Scraper 输出 batch_id | 1.2 | `backend/app/routes/scraper.py` |
| 1.9 | Optimize 生成接口（Profile→JD 组装→SSE） | 1.6 | 新建 `backend/app/routes/optimize.py` |
| 1.10 | 注册新路由到 main.py | 1.5-1.9 | `backend/app/main.py` |
| 1.11 | OpenAPI 文档验证 | 1.10 | `/docs` 自动生成 |

### Phase 2：前端信息架构与交互（第2周 ~ 第4周）

| # | 任务 | 依赖 | 文件改动 |
|---|------|------|---------|
| 2.1 | Sidebar 新增 Profile 入口，调整导航顺序 | 1.6 | `frontend/src/components/layout/Sidebar.tsx` |
| 2.2 | 前端 API 层新增 pools/profile/profile-chat/target-roles/batches/optimize 接口 | 1.5-1.9 | `frontend/src/lib/api.ts`, `frontend/src/lib/hooks.ts` |
| 2.3 | Jobs 页重构为 Inbox（三状态 Tabs + 批次分区 + 池筛选） | 1.7 | `frontend/src/app/jobs/page.tsx` |
| 2.4 | Jobs 页池管理面板（创建/改名/删除池） | 1.5 | `frontend/src/app/jobs/page.tsx` (内嵌 PoolManager 组件) |
| 2.5 | 岗位详情页展示完整 raw_description | 1.7 | `frontend/src/app/jobs/[id]/page.tsx` |
| 2.6 | Profile 页面（新建：左侧预览+右侧对话引导+Onboarding流程+主题切换） | 1.6 | 新建 `frontend/src/app/profile/page.tsx`, 新建 `frontend/src/app/profile/components/` |
| 2.6a | Profile 对话面板组件（ChatPanel + BulletConfirmCard + TopicStepper） | 2.6 | `frontend/src/app/profile/components/ChatPanel.tsx` 等 |
| 2.6b | Profile 预览面板组件（按 section_type 分区 + 实时更新） | 2.6 | `frontend/src/app/profile/components/ProfilePreview.tsx` |
| 2.7 | Optimize 页重构为三段式工作区 | 1.9 | `frontend/src/app/optimize/page.tsx` |
| 2.8 | Resume 页增加来源溯源标签 | 1.3 | `frontend/src/app/resume/page.tsx` |
| 2.9 | BatchOptimizeModal 迁移/复用（过渡期） | 2.7 | `frontend/src/components/jobs/BatchOptimizeModal.tsx` |
| 2.10 | 数据流统一（SWR mutate 跨页刷新策略） | 2.2-2.8 | `frontend/src/lib/hooks.ts` |

### Phase 3：UI 规范与设计令牌（**已砍——工时让给 Profile 对话引导**）

> Round 4 决策：Phase 3 不做或极简化，保留现有 Tailwind + NextUI 风格，仅做必要的语义色定义。

| # | 任务 | 文件改动 |
|---|------|---------|
| 3.1 | ~~语义色/状态色令牌定义~~ (延后) | — |
| 3.2 | ~~中文字体栈 + 字号层级 + 8pt 间距网格~~ (延后) | — |
| 3.3 | ~~组件规范~~ (延后) | — |
| 3.4 | ~~响应式规范~~ (延后) | — |

### Phase 4：AI 生成链路深化（第4~5周）

| # | 任务 | 依赖 | 文件改动 |
|---|------|------|---------|
| 4.1 | Profile Bullet 召回 + 相关性排序算法 | 1.6, 1.9 | 新建 `backend/app/agents/skills/profile_assembler.py` |
| 4.2 | 防虚构验证（生成后比对 Profile bullets，标记低置信度） | 4.1 | `profile_assembler.py`, `content_rewriter.py` |
| 4.3 | 生成解释输出（命中 bullets / 缺失能力） | 4.1 | `optimize.py` 路由 |
| 4.4 | 批量生成并发限制 + 失败重试 + 速率保护 | 1.9 | `optimize.py` |
| 4.5 | 多 Provider 路由增强（参考 Flovart 架构） | 0.1 | `backend/app/agents/llm.py`, `backend/app/config.py` |
| 4.6 | 对话引导 Prompt 模板优化（分主题追问策略+STAR引导） | 1.6a | `conversational_extractor.py` |
| 4.7 | 叙事生成 Prompt 优化（headline/exit_story 文风适配校招文科生） | 1.6b | `narrative_generator.py` |

### Phase 5：编码规范（第1周启动，持续执行）

- TypeScript 严格类型 + Pydantic 模型先行
- 领域词统一蛇形（后端）/驼峰（前端）
- feat/fix/refactor/test/docs 提交前缀
- 功能分支：feature/profile, feature/inbox-triage, feature/optimize-workspace

### Phase 6：验收（第5~6周）

| 周 | 里程碑 | 负责人 | 交付物 |
|----|--------|--------|--------|
| 1 | 后端模型+接口草案 + LLM跑通 | 后端+产品 | ER图, API草案, LLM成功截图 |
| 2 | Inbox分拣+批次能力 | 前端+后端 | Jobs新流程可跑通 |
| 3 | Profile对话引导+bullet确认 | 前端+后端 | Profile页面+对话引导链路+实时入库 |
| 4 | Optimize工作区重构 | 前端+后端 | 逐岗位/综合生成 |
| 5 | 池管理+Resume溯源 | 前端 | 池管理闭环+资产管理 |
| 6 | 全链路测试+验收 | 测试+产品 | 验收报告 |

---

## 8. 技术风险与防线

| 风险 | 严重度 | 防线 |
|------|--------|------|
| LLM 从未跑通过 | 🔴 致命 | Phase 0 第1天配阿里云百炼 Qwen Key 跑通（Key 已获得） |
| Profile AI 对话引导质量差 | 🟠 高 | 分主题引导（非自由聊天），预设追问模板，Bullet 用户逐条确认兜底 |
| 对话引导技术复杂（SSE+多轮状态） | 🟠 高 | 先做同步单轮问答 MVP，再升级 SSE 流式；服务端持久化 chat_session |
| 防虚构实现困难 | 🟠 高 | 生成后做 Profile 条目 diff 验证，低置信度进待确认区 |
| 两人6周做不完 | 🟡 中 | Phase 3 视进度决定简化，核心链路优先 |
| SWR 跨页一致性 | 🟡 中 | 统一 mutate key 映射表，关键操作后主动 refetch |
| 旧数据迁移破坏 | 🟢 低 | _auto_migrate 添加列默认值，旧数据全标已筛选 |

---

## 9. 验收标准

1. `/scraper` 导入后可生成批次并在 `/jobs` 未筛选中按批次看到岗位
2. `/jobs` 可完成 未筛选→已筛选/已忽略，已筛选支持分池+池管理
3. `/profile` 可完成对话引导→bullet 级条目确认→实时入库→手工修正（**核心验收项**）
3a. `/profile` 对话引导可覆盖 education/experience/project/activity/skill 五个主题
3b. `/profile` 可辅助导入 PDF/Word 简历并逐条确认
3c. `/profile` 每条 bullet 附 confidence 且低置信度有视觉标识
4. `/optimize` 可完成池选择→岗位选择→逐岗位/综合生成→解释输出
5. `/resume` 查看新增简历资产+来源溯源
6. LLM 端到端跑通（阿里云百炼 Qwen，可选 DeepSeek/Ollama）
7. 500 条岗位分页响应无明显卡顿
8. 批量生成 20 岗位 SSE 进度可见
9. `npm run build` + `npm run lint` 无阻塞错误
10. `uvicorn app.main:app --reload` 后 `/api/health` + `/docs` 可用
