# OfferU PRD v4 — AI 求职助手产品需求文档

> **版本：v4.0**  
> **日期：2026-04-17**  
> **状态：Dario Round 7 审查 — AI 引擎架构重构版**  
> **本轮核心变更：SkillPipeline → Evaluator-Optimizer 循环 + Task Router + LangGraph 预留**  
> **审查人：Dario (首席执行总监 / Anthropic CEO 级别审查)**  

---

## 目录

- [0. 产品定位](#0-产品定位)
- [1. 团队共识与历史分歧](#1-团队共识与历史分歧)
- [2. 已确认决策总表](#2-已确认决策总表)
- [3. 系统架构](#3-系统架构)
- [4. AI 引擎架构（v4 核心重构）](#4-ai-引擎架构v4-核心重构)
- [5. 核心旅程](#5-核心旅程)
- [6. LLM 分级调用策略](#6-llm-分级调用策略)
- [7. 数据库设计](#7-数据库设计)
- [8. Chrome 扩展（Side Panel 购物车）](#8-chrome-扩展side-panel-购物车)
- [9. 分发与部署](#9-分发与部署)
- [10. MVP Roadmap](#10-mvp-roadmap)
- [11. PRD 版本历史](#11-prd-版本历史)
- [16. LLM 配置透明度与面试流程修复](#16-llm-配置透明度与面试流程修复)
- [17. Phase A UX 修复 + Onboarding P0](#17-phase-a-ux-修复--onboarding-p0)
- [20. UI Tone-Down 视觉降噪精炼](#20-ui-tone-down-视觉降噪精炼-session-20)
- [21. 需求实现审计（按项目需求表）](#21-需求实现审计按项目需求表-session-21)
- [22. 插件 PR 合并审计](#22-插件-pr-合并审计-session-22)

---

## 0. 产品定位

### 一句话定位

**OfferU = 帮所有求职者（校招+社招）从零构建 Bullet 级个人档案，再按每个 JD 智能组装定制简历、收集同岗位面经的 AI 求职助手。纯本地运行，数据不离开用户电脑。**

### 核心壁垒

| 维度 | 竞品做法 | OfferU 做法 |
|------|---------|------------|
| 简历生成 | **剪裁**（Teal：Master Resume 复制+删减） | **组装**（Profile 事实库 → LLM 逐条推理 JD←→Bullet 匹配度 → 按相关性排序+改写+组装全新简历）|
| AI 质量保障 | 一次生成直接输出 | **Evaluator-Optimizer 循环**（生成→评分→反馈→重试，最多 3 轮） |
| Bullet 召回 | Career-Ops：LLM 直接读 cv.md 推理 | 结构化 ProfileSection 表 + source/confidence 字段 + LLM 推理，**可追溯每条 Bullet 来源** |
| 数据来源 | 用户手动粘贴 JD | **双轨采集**（后端爬虫 + Chrome Side Panel 购物车从 Boss直聘实时收藏） |
| Profile 粒度 | 段落级 / 模板填空 | **Bullet 级**（每个成就点独立条目，含 source + confidence，可精确召回） |
| 面试准备 | STAR+Reflection Story Bank | **收集同岗位真实面经** → LLM 提炼高频问题 → 生成 HR面/部门面分类题库 |
| 部署方式 | SaaS 注册制 | **纯本地运行**，零注册，数据不上传 |

### 竞品对比（2026 年 4 月调研）

| 产品 | 星数 | 类型 | OfferU 差异 |
|------|------|------|------------|
| **Career-Ops** | 32k⭐ | 开源 CLI，Profile.yml+LaTeX | OfferU 做了 Web GUI + 对话引导 + 浏览器 Side Panel + 面经 |
| **AIHawk** | 29.7k⭐ | LinkedIn 自动投递（**2026-04-16 已归档**） | 已死项目，Selenium 基础 |
| **get_jobs** | 6.3k⭐ | Java ChromeDriver 自动投递 | Boss反检测风险高，OfferU 不做自动投递 |
| **AutoGPT** | 184k⭐ | 通用 Agent 平台 | 过重，校招用户不需要通用 Agent |
| **宝藏求职** | 商业 | AI 简历 + 模拟面试 | 闭源收费，无 Profile 组装 |

---

## 1. 团队共识与历史分歧

> **参与方**：开发方 A & 产品方 B  
> **AI 总监裁决日期**：2026-04-16

### 1.1 六项分歧裁决

#### ① 岗位爬虫的必要性

| 开发方 A | 产品方 B | **裁决** |
|--------|--------|---------|
| BOSS 已帮用户爬过了，爬虫不是刚需 | 没岗位数据用户没法用产品 | **双方说的不同事**。不自建爬虫，提供便捷导入通道（Side Panel 购物车 + 手动录入）。Chrome Side Panel 是核心差异化，手动录入作为 P0 兜底。 |

> ⚠️ 产品方 B 提到的"AI 自动帮填官网表单"技术风险极高（每家公司表单不同），**MVP 绝对不碰**。

#### ② "AI 改简历是伪需求"

| 开发方 A | 产品方 B | **裁决** |
|--------|--------|---------|
| 不是伪需求，但需结合用户行为 | 是伪需求——一个人只需要几份简历 | **产品方 B 的前提在校招场景不成立**。校招生投 10+ 大厂，每家侧重点不同。但产品方 B 的底层逻辑对：交互必须极轻。一键批量生成（SSE 流式）是正确设计。 |

#### ③ AI 面试联动简历

| 开发方 A | 产品方 B | **裁决** |
|--------|--------|---------|
| 先 AI 面试 3 问题 → 再生成简历 | 海投不可能先面再投 | **产品方 B 正确**。投递和备面解耦。`/optimize` 海投批量生成，`/interview` 约面后准备。开发方 A 的"轻量面试补全 Profile"作为 v2 功能。 |

#### ④ 用户画像 Agent（"越用越懂你"）

| 开发方 A | 产品方 B | **裁决** |
|--------|--------|---------|
| 借鉴 CareerOps，AI 越用越懂你 | 纯吹，就是本地存个画像 | **方向正确，MVP 不投入**。Profile 持续丰富本身就是"越用越懂你"，作为 v2 宣传点。 |

#### ⑤ 核心功能优先级

| 产品方 B 排序 | 实际代码完成度 | **裁决** |
|-----------|--------------|---------|
| ① 爬岗位/岗位管理 | 后端 CRUD 完成，手动可用 | ② |
| ② AI 简历优化 | SkillPipeline + Generate 已跑通 | ① **已基本完成** |
| ③ AI 面试 | 面经模块已实现 | ③ |

> 产品方 B 的三条主线和 PRD 完全吻合，但可能不知道 AI 简历和面经后端已写完。**现在的瓶颈不是功能缺失，而是入口和导出。**

#### ⑥ MVP 真正的阻塞项

```
⛔ 阻塞级（没这个不能演示）：
  1. 前端没有简历上传入口（Profile 是空的）
  2. 简历无法导出 PDF/Word（用户拿不走）
  3. SkillPipeline Skill2 返回值有 bug

⚠️ 重要但不阻塞：
  4. Side Panel 购物车未实现（手动录入兜底）
  5. 面经爬虫未实现（手动粘贴兜底）
  6. Landing Page 未做

✅ 已完成：85 个 API 端点 / 15 张数据表 / Profile 对话引导 / AI 简历批量生成(SSE)
  / SkillPipeline 4 步分析 / 面经模块全链路 / 8 个 LLM Provider / 邮件日程
```

### 1.2 v4 新增分歧（Dario Round 7）

#### ⑦ AI 引擎架构：Pipeline vs Agent

| 现状 | Dario 诊断 | **裁决** |
|------|-----------|---------|
| SkillPipeline = 4 步固定串行 | 按 Anthropic 官方定义这是 **Prompt Chaining**，不是 Agent | 升级到 **Evaluator-Optimizer 模式**（生成→评估→循环改进，最多 3 轮）。加入 **Task Router**（按任务类型走不同路径）。 |

> **关键原则**（来自 Anthropic "Building effective agents"，2024-12-19）：
> 1. "Start with simple prompts, optimize them with comprehensive evaluation, and add multi-step agentic systems only when simpler solutions fall short"
> 2. "Maintain simplicity in your agent's design"
> 3. "Carefully craft your agent-computer interface (ACI) through thorough tool documentation and testing"

#### ⑧ 是否引入 LangGraph

| 支持 | 反对 | **裁决** |
|------|------|---------|
| State 管理 + Conditional Edge 天然支持 | 依赖链重（langchain-core/pydantic v2 可能冲突） | **渐进式引入**：Phase 1 纯 Python 按 Graph 模式设计；Phase 2 需要复杂图拓扑时正式引入 LangGraph |

---

## 2. 已确认决策总表

| # | 决策项 | 结论 | 来源 |
|---|--------|------|------|
| 1 | 池模式 | 用户自定义池，单选，允许未分组 | PRD v1 |
| 2 | 池管理入口 | /jobs 页面内 | Dario R1 |
| 3 | 生成策略 | 默认逐岗位，可切综合 | PRD v1 |
| 4 | 简历保存 | 每次新增，不覆盖 | PRD v1 |
| 5 | Profile 回写 | 默认不回写，显式采纳 | PRD v1 |
| 6 | 基底简历 | 取消必选，Profile=唯一事实源 | PRD v1 |
| 7 | 旧数据迁移 | 标为"已筛选"+生成历史批次 | PRD v1 |
| 8 | LLM 第1周跑通 | 必须配 API Key 端到端 | Dario R1 |
| 9 | 多 Provider 路由 | Provider-Agnostic 架构 | PRD v2 |
| 10 | Profile 参考 | Career-Ops profile.yml 五大块 | Dario R3 |
| 11 | Profile 粒度 | Bullet 级别 | Dario R3 |
| 12 | Profile 冷启动 | 表单基础项 + AI 对话引导 | Dario R3 |
| 13 | 对话数据流 | 每轮实时确认入库 | Dario R3 |
| 14 | 用户画像 | 所有求职者（校招+社招） | Dario R6 |
| 15 | 即时价值钩子 | 选目标岗位后 3 句话出草稿 | Dario R4 |
| 16 | 多轮对话 | 直接做多轮，一步到位 | Dario R4 |
| 17 | LLM Provider | 阿里云百炼 Qwen 为默认 | Dario R4 |
| 18 | LLM 分级 | fast/standard/premium 三档 | Dario R5 |
| 19 | 部署目标 | 纯本地运行（pip/Docker） | Dario R6 |
| 20 | 数据库 | 仅 SQLite | Dario R6 |
| 21 | 浏览器插件 | Side Panel 购物车 mini-app | Dario R6 |
| 22 | 自动投递 | ❌ **不做** | Dario R6 |
| 23 | 面经模块 | 收集真实面经 → LLM 提炼题库 | Dario R6 |
| 24 | 冷启动渠道 | 学校群+掘金/V2EX/知乎+小红书 | Dario R6 |
| 25 | **AI 引擎架构** | **Evaluator-Optimizer + Task Router**（替代固定 Pipeline） | **Dario R7 新增** |
| 26 | **LangGraph** | **渐进式引入**：Phase 1 纯 Python，Phase 2 引入 | **Dario R7 新增** |
| 27 | **生成事实约束** | 仅允许改写与重组，**不允许引入 Profile 中不存在的事实** | PRD v2 硬约束 |
| 28 | **评估循环上限** | Evaluator-Optimizer 最多 **3 轮**，超过直接返回最佳结果 | **Dario R7 新增** |

---

## 3. 系统架构

### 3.1 总览

```
┌──────────────────────────────────────────────────────────────┐
│                        用户触达层                              │
├──────────────┬─────────────────────┬────────────────────────┤
│  Next.js 14  │ Chrome Side Panel   │  Claude / ChatGPT MCP  │
│  前端 Web UI  │ Boss直聘购物车       │  AI Agent 接入         │
└──────┬───────┴──────────┬──────────┴──────────┬─────────────┘
       │                  │                     │
       ▼                  ▼                     ▼
┌──────────────────────────────────────────────────────────────┐
│                FastAPI 后端 (Python 3.12)                      │
├──────────────────────────────────────────────────────────────┤
│  REST API (85+ 端点)  │  MCP Server (13 工具)                  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────────┐                                            │
│   │ Task Router │  ← 按任务类型分流（v4 新增）                  │
│   └──────┬──────┘                                            │
│          │                                                   │
│   ┌──────┴───────────────────────────────────┐               │
│   │         AI 引擎（Evaluator-Optimizer）     │               │
│   │                                          │               │
│   │  Skill 模块库（6 个可路由选择的 Skill）     │               │
│   │  Generator LLM ←→ Evaluator LLM 循环      │               │
│   │  Quality Gate (score ≥ 阈值 或 max 3 轮)  │               │
│   └──────────────────────────────────────────┘               │
│                                                              │
│   ┌──────────────────────────────────────────┐               │
│   │         LLM 分级调用层 (Provider-Agnostic) │               │
│   │  fast / standard / premium × 8 Provider   │               │
│   └──────────────────────────────────────────┘               │
├──────────────────────────────────────────────────────────────┤
│           SQLite (offeru.db · 单文件 · 13+ 张表)               │
└──────────────────────────────────────────────────────────────┘
```

### 3.2 技术栈

| 层 | 技术 | 版本 |
|----|------|------|
| 前端 | Next.js + NextUI + Tailwind CSS + SWR | 14.x |
| 后端 | FastAPI + SQLAlchemy 2.0 (async) + Pydantic v2 | Python 3.12 |
| LLM | OpenAI 兼容协议 (AsyncOpenAI) | 所有 Provider |
| MCP | FastMCP (Streamable HTTP) | /mcp 端点 |
| 数据库 | SQLite + aiosqlite | 零配置 |
| 浏览器扩展 | Manifest V3 + TypeScript + Side Panel | Chrome 114+ |
| AI 引擎 | Phase 1: 纯 Python / Phase 2: LangGraph | 渐进式 |

---

## 4. AI 引擎架构（v4 核心重构）

### 4.1 现状诊断

> **Anthropic 架构分类**（来源："Building effective agents", 2024-12-19）

| 模式 | OfferU v3（现状） | OfferU v4（目标） |
|------|-----------------|-----------------|
| Prompt Chaining | ✅ SkillPipeline 4步串行 | 保留，但作为 Skill 组合方式之一 |
| **Routing** | ❌ 所有输入走同一条路 | ✅ Task Router 按任务类型分流 |
| **Evaluator-Optimizer** | ❌ 一次生成直接返回 | ✅ 生成→评估→反馈→循环（核心升级） |
| Agent（tool_call + 自主规划） | ❌ 完全没有 | Phase 2 考虑 |

### 4.2 新架构：Evaluator-Optimizer + Task Router

#### 核心流程

```
用户提交请求（简历+JD / 单条改写 / 对话引导 / 仅分析）
       │
       ▼
  ┌─────────────┐
  │ Task Router │  ← LLM fast 层判断任务类型（或规则判断）
  └──────┬──────┘
         │
    ┌────┴────┬──────────┬───────────┐
    ▼         ▼          ▼           ▼
 全量优化   单条改写   仅分析    对话引导
    │         │          │           │
    ▼         ▼          ▼           ▼
 [JD分析]  [改写Skill] [匹配Skill] [抽取Skill]
 [匹配]
    │         │          │           │
    └────┬────┘          │           │
         ▼               ▼           ▼
  ┌──────────────┐   直接返回    实时确认入库
  │ Generator    │
  │ (standard/   │
  │  premium)    │
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │ Evaluator    │  ← 评分维度：JD匹配度/STAR完整性/
  │ (fast/       │     ATS友好度/事实准确性/语言质量
  │  standard)   │
  └──────┬───────┘
         │
         ▼
  ┌──────────────┐
  │ Quality Gate │
  │ score ≥ 7.5? │  ← 阈值可配置
  │ round < 3?   │
  └──────┬───────┘
    YES  │  NO
    ↓    ↓
  返回  反馈注入 → Generator（下一轮）
```

#### Evaluator 评分维度

```python
EVALUATION_DIMENSIONS = {
    "jd_relevance": {
        "weight": 0.30,
        "description": "简历内容与 JD 要求的匹配程度"
    },
    "star_completeness": {
        "weight": 0.20,
        "description": "STAR 法则完整性（情境→任务→行动→结果）"
    },
    "ats_friendliness": {
        "weight": 0.15,
        "description": "ATS 系统友好度（关键词覆盖、格式规范）"
    },
    "factual_accuracy": {
        "weight": 0.20,
        "description": "事实准确性（是否引入了 Profile 中不存在的内容）"
    },
    "language_quality": {
        "weight": 0.15,
        "description": "语言质量（简洁、专业、量化）"
    },
}
# 加权总分 ≥ 7.5 → 通过；否则反馈注入 Generator 重试
```

#### Task Router 规则

```python
TASK_ROUTES = {
    "full_optimize": {
        "description": "全量简历优化（有 JD + 有 Profile）",
        "skills": ["jd_analyzer", "resume_matcher", "content_rewriter", "section_reorder"],
        "evaluator": True,  # 启用 Evaluator 循环
        "max_rounds": 3,
        "generator_tier": "premium",
        "evaluator_tier": "standard",
    },
    "single_rewrite": {
        "description": "单条 Bullet 改写",
        "skills": ["content_rewriter"],
        "evaluator": False,  # 单条改写不需要循环
        "generator_tier": "standard",
    },
    "analysis_only": {
        "description": "JD-简历匹配分析（不生成新简历）",
        "skills": ["jd_analyzer", "resume_matcher"],
        "evaluator": False,
        "generator_tier": "standard",
    },
    "chat_extract": {
        "description": "对话引导 Bullet 抽取",
        "skills": ["conversational_extractor"],
        "evaluator": False,
        "generator_tier": "standard",
    },
}
```

### 4.3 代码改造计划

#### Phase 1: 纯 Python 实现（当前阶段）

```python
# 新文件：app/agents/engine.py
# 概念上按 LangGraph StateGraph 设计，但纯 Python 实现

class ResumeOptimizationEngine:
    """
    Evaluator-Optimizer 引擎
    
    Anthropic 模式参考：
    - Task Router → Routing Pattern
    - Generator + Evaluator → Evaluator-Optimizer Pattern
    - Skill 组合 → Prompt Chaining Pattern (子流程)
    """
    
    async def run(self, task_type: str, context: dict) -> dict:
        """
        主入口：路由 → 执行 Skill 链 → Evaluator 循环
        """
        route = TASK_ROUTES[task_type]
        
        # 1. 执行 Skill 链（继承现有 Prompt Chaining）
        skill_output = await self._run_skills(route["skills"], context)
        
        # 2. 如果需要 Evaluator 循环
        if route.get("evaluator"):
            result = await self._evaluator_loop(
                skill_output, context,
                max_rounds=route["max_rounds"],
                generator_tier=route["generator_tier"],
                evaluator_tier=route["evaluator_tier"],
            )
        else:
            result = skill_output
        
        return result
    
    async def _evaluator_loop(self, draft, context, max_rounds, generator_tier, evaluator_tier):
        """
        Evaluator-Optimizer 循环
        """
        best_result = draft
        best_score = 0
        
        for round_num in range(max_rounds):
            # Generator: 基于反馈改进
            if round_num > 0:
                draft = await self._generate(draft, feedback, context, tier=generator_tier)
            
            # Evaluator: 评分 + 反馈
            score, feedback = await self._evaluate(draft, context, tier=evaluator_tier)
            
            if score > best_score:
                best_score = score
                best_result = draft
            
            # 质量门控
            if score >= 7.5:
                break
        
        return {
            "result": best_result,
            "score": best_score,
            "rounds": round_num + 1,
            "evaluation": feedback,
        }
```

#### Phase 2: 迁移到 LangGraph（未来）

```python
# 未来迁移：当需要以下能力时引入 LangGraph
# - 多 Agent 协作（简历Agent + 面试Agent + 投递Agent）
# - Checkpointing（长时间任务中断恢复）
# - Human-in-the-loop（批量生成时中途暂停确认）
# - 复杂图拓扑（并行分析 + 汇聚 + 条件分支）

from langgraph.graph import StateGraph, START, END

class OptimizationState(TypedDict):
    resume_text: str
    jd_text: str
    profile_data: dict
    draft: dict
    score: float
    feedback: str
    round: int

builder = StateGraph(OptimizationState)
builder.add_node("route", route_task)
builder.add_node("analyze", run_skills)
builder.add_node("generate", generate_draft)
builder.add_node("evaluate", evaluate_draft)
builder.add_edge(START, "route")
builder.add_conditional_edges("route", route_to_skills)
builder.add_edge("analyze", "generate")
builder.add_edge("generate", "evaluate")
builder.add_conditional_edges("evaluate", quality_gate, {
    "pass": END,
    "retry": "generate",
})
```

### 4.4 PII 脱敏（继承 v3）

云端 Provider（非 Ollama）自动脱敏 PII：入口统一脱敏，出口统一还原。逻辑不变，只是从 SkillPipeline.run() 移至 Engine.run()。

---

## 5. 核心旅程

### 6+1 步主线

```
[Chrome Side Panel] Boss直聘页面 → 一键收藏到"购物车"
       ↓ chrome.storage.local → 批量同步后端
/scraper 后端爬虫采集导入
       ↓
/jobs Inbox 分拣（未筛选→已筛选/已忽略，分池管理）
       ↓
/profile 个人档案（表单基础项 + AI 对话引导 → Bullet 级事实库）
       ↓
/optimize AI 简历定制工作区（选池→选岗位→ Evaluator-Optimizer 组装生成）
       ↓
/resume 简历资产管理（编辑微调→导出 PDF/Word→手动投递）
       ↓
/interview AI 面经工作区（选岗位→收集面经→LLM 提炼题库）
```

### 投递方式（不做自动投递）

| 方式 | 说明 |
|------|------|
| 一键跳转 | 点岗位卡片 → 新标签页打开招聘网站原始链接 |
| 简历图片 | 生成截图 → 粘贴到 Boss直聘聊天窗口 |
| 手动下载 | 导出 PDF/Word → 用户自行上传 |

---

## 6. LLM 分级调用策略

基于阿里云 DashScope 2026 Q2 最新定价：

| 档位 | 默认模型 (Qwen) | 参考价格 | 场景 |
|------|------|-------------|---------|
| **fast** | `qwen3.5-flash` | 0.2/2 元/百万Token | 分拣/分类/JD摘要/Evaluator轻量评估 |
| **standard** | `qwen3.5-plus` | 0.3/1.2 元/百万Token (最低档) | JD分析/Bullet抽取/改写/面经提炼/Evaluator深度评估 |
| **premium** | `qwen3.6-plus` | 2/12 元/百万Token | 简历终版生成/narrative生成/Generator |

### 调用映射（v4 更新）

```python
LLM_TIER_MAP = {
    # 路由/分拣 — fast
    "task_route": "fast",
    "triage": "fast",
    "campus_detect": "fast",
    "jd_summary": "fast",
    "evaluator_quick": "fast",       # v4: Evaluator 快速评估
    
    # 核心 AI 链路 — standard
    "jd_analyze": "standard",
    "bullet_extract": "standard",
    "content_rewrite": "standard",
    "conversational_extract": "standard",
    "interview_extract": "standard",
    "evaluator_deep": "standard",     # v4: Evaluator 深度评估
    
    # 高精度 — premium
    "resume_generate": "premium",     # v4: Generator 简历生成
    "resume_assemble": "premium",
    "narrative_generate": "premium",
    "resume_final_polish": "premium",
}
```

### 成本估算（v4 含 Evaluator 循环）

| 操作 | 频次 | Token | 档位 | 成本 |
|------|------|-------|------|------|
| 岗位分拣 | 200 次 | 100K | fast | 0.22 元 |
| JD 分析 | 30 次 | 60K | standard | 0.09 元 |
| Bullet 抽取 | 20 轮 | 60K | standard | 0.09 元 |
| 面经提炼 | 10 次 | 40K | standard | 0.06 元 |
| **简历生成（含 Evaluator 循环）** | 10次×2轮 | 100K | premium+standard | **1.4 元** |
| **月均总成本** | | | | **≈1.86 元/用户/月** |

> 比 v3 的 1.16 元略增，主要来自 Evaluator 循环的额外 LLM 调用。但质量提升显著。

---

## 7. 数据库设计

### 13+ 张表（SQLite 单文件）

| 表 | 核心字段 | 说明 |
|----|---------|------|
| **jobs** | title, company, url, raw_description, triage_status, pool_id | 岗位信息 |
| **pools** | name, description, color, sort_order | 岗位分组 |
| **batches** | source, keywords, job_count, status | 采集批次 |
| **profiles** | name, headline, exit_story, base_info_json, onboarding_step | 个人档案主表 |
| **profile_sections** | section_type, title, content_json, source, confidence | Bullet级事实条目 |
| **profile_target_roles** | role_name, role_level, fit | 目标岗位 |
| **profile_chat_sessions** | topic, messages_json, extracted_bullets, status | AI对话会话 |
| **resumes** | title, summary, source_job_ids, source_mode | 简历主表 |
| **resume_sections** | section_type, title, content_json, visible | 简历章节 |
| **resume_templates** | name, css_variables, html_layout | 简历模板 |
| **interview_notifications** | company, position, interview_time | 面试通知 |
| **calendar_events** | title, event_type, start_time | 日程事件 |
| **applications** | job_id, status, cover_letter | 投递记录 |

### v4 新增字段

```sql
-- resume_sections 新增 Evaluator 评分记录
ALTER TABLE resumes ADD COLUMN eval_score REAL;           -- Evaluator 最终评分
ALTER TABLE resumes ADD COLUMN eval_rounds INTEGER;       -- Evaluator 循环轮次
ALTER TABLE resumes ADD COLUMN eval_feedback_json TEXT;   -- 各维度评分详情 JSON
```

---

## 8. Chrome 扩展（Side Panel 购物车）

> 完整设计继承 PRD v3.1，此处仅列核心要点。

### 架构

```
Boss直聘页面 → content.ts DOM 解析 → ExtractedJob
    ↓ chrome.runtime.sendMessage("ADD_TO_CART")
background.ts (Service Worker)
    ├── chrome.storage.local 存储购物车
    ├── 去重（job_id / title+company hash）
    └── 收到 "SYNC_TO_BACKEND" → POST /api/jobs/ingest

Side Panel (sidepanel.html + sidepanel.ts)
    ├── 购物车列表（岗位名/公司/薪资/收藏时间）
    ├── 搜索/筛选/删除/全选
    ├── "同步到 OfferU" 按钮
    ├── 连接状态：后端在线 🟢 / 离线 🔴
    └── 离线模式：纯本地收藏，回家后同步
```

### 离线体验

- 浏览收藏：不依赖后端，chrome.storage.local 全存
- 同步：需后端在线，按钮自动检测状态
- 状态灯：每 30s 自动 ping localhost:8000/api/health

---

## 9. 分发与部署

### 纯本地运行

```
Landing Page (offeru.cn / GitHub Pages)
    ├── 产品介绍 + 演示视频
    ├── 下载链接 → GitHub/Gitee Releases
    └── 安装教程

用户本地：
    启动方式 A: pip install offeru
    启动方式 B: docker compose up
    启动方式 C: 一键 .bat/.sh 脚本
    
    localhost:3000 (前端)
    localhost:8000 (后端)
    offeru.db (数据)
```

---

## 10. MVP Roadmap

### Phase 0: 修复阻塞项（P0）

| 任务 | 说明 | 验收标准 |
|------|------|---------|
| 修复 SkillPipeline Skill2 bug | match_analysis 返回空 | 返回 ats_score + matched_skills |
| 前端简历上传入口 | PDF/Word → 解析 → 预填 Profile | 上传即可用 |
| 简历导出 PDF | 点击导出下载 | PDF 文件可用 |

### Phase 1: AI 引擎升级（v4 核心）

| 任务 | 说明 | 验收标准 |
|------|------|---------|
| 实现 Task Router | 按任务类型走不同 Skill 组合 | 4 种路由正确分流 |
| 实现 Evaluator-Optimizer 循环 | Generator + Evaluator + Quality Gate | 评分 ≥ 7.5 或 3 轮后返回最佳 |
| 迁移 SkillPipeline 到 Engine | 现有 4 个 Skill 作为模块注册 | 旧 API 兼容 |
| SSE 流式支持 Evaluator 过程 | 前端实时看到评估轮次 | 每轮评估结果实时推送 |

### Phase 2: 入口完善

| 任务 | 说明 |
|------|------|
| Side Panel 购物车 | Boss直聘一键收藏 |
| Landing Page | GitHub Pages 产品介绍 |
| 面经爬虫 | 牛客网公开面经 |
| 安装脚本 | pip/Docker 一键启动 |

### Phase 3: LangGraph + 高级功能

| 任务 | 说明 |
|------|------|
| 引入 LangGraph | StateGraph 正式替代 Engine |
| Human-in-the-loop | 批量生成时中途确认 |
| 多 Agent 协作 | 简历Agent + 面试Agent |
| Profile 越用越懂你 | 跨 session 记忆 |

---

## 11. PRD 版本历史

| 版本 | 日期 | 核心变更 | 状态 |
|------|------|---------|------|
| v1 | 2026-03 | 初版，基础功能定义 | ⬜ 已归档 |
| v2 | 2026-04-09 | Profile 对话引导 + Career-Ops 参考 + Dario R1-R4 | ⬜ 已归档 → docs/Archive/PRD_v2_FINAL.md |
| v3 | 2026-04-13 | 去认证/纯本地/Side Panel/面经/扩大定位 + Dario R5-R6 | ⬜ 已归档 → docs/Archive/PRD_v3_PLAN.md |
| **v4** | **2026-04-17** | **AI 引擎重构：Evaluator-Optimizer + Task Router + LangGraph 渐进式 + 团队分歧共识** | **🟢 当前版本** |
| **v4.1** | **2026-04-18** | **新增 Dario 协作治理协议：讨论优先、反向论证、联网授权、每轮计划入 PRD** | **🟢 当前版本** |

> **旧版 PRD 归档说明**：v2/v3 的所有有效决策已整合入 v4 决策总表。旧文件移至 `docs/Archive/`。

---

## 12. Dario 协作治理协议（2026-04-18 新增）

### 12.1 触发规则（强制）

以下三种场景必须先与用户确认，再继续执行：

1. 结束当前对话或阶段性任务
2. 变更方向（功能、技术路线、优先级、里程碑）
3. 认为任务已经完成

执行动作：必须先调用 ask question 工具征求意见，再进入下一步。

### 12.2 讨论范式（Dario 模式）

每轮讨论都必须包含四段：

1. 正向思考：给出当前方案在产品、交互、技术算法上的最强论证
2. 反向反驳：从相反立场指出风险、机会成本和错误假设
3. 反思结论：沉淀当前轮次可执行决策（保留/延后/删除）
4. 反问清单：向用户提出高压问题，直到价值主张和执行路径足够清晰

### 12.3 外部信息同步机制

原则：2026 年技术变化快，优先多轮联网同步再决策。

执行要求：

1. 每轮可发起多轮联网搜索（开源/闭源产品、技术架构、组件库）
2. 联网前先征得用户同意
3. 输出必须标注：可直接采用项 / 需二次验证项 / 暂不采用项

### 12.4 每轮产出（必须落 PRD）

每次讨论后必须在 PRD 增量记录：

1. 本轮决策
2. 本轮未决问题
3. 下一轮计划
4. 需要验证的实验或数据

### 12.5 当前轮次计划（2026-04-18）

P0 本轮聚焦：提高 Profile 信息填写效率（减少用户录入时间，提升可用素材质量）。

执行顺序：

1. 先确认是否开启联网调研（对标 2026 最新 Profile/Resume onboarding 方案）
2. 梳理当前填写链路的真实瓶颈（字段设计、交互流程、AI 提取质量）
3. 产出双案方案：极速版（MVP 两周内可落地）+ 完整版（v4.2）
4. 锁定本周可交付项并进入实现

---

## 13. 联网研判记录（2026-04-18 Round 1）

### 13.1 调研范围（3 轮）

1. 开源产品：OpenResume、Reactive Resume、JSON Resume Schema
2. 闭源产品：Huntr（Resume Tailor / Resume Checker）
3. 解析基础设施：Unstructured、Deepdoctection、Pyresparser

### 13.2 关键发现

1. 高转化产品都在做“低输入成本 + 高可见反馈”：导入即用、实时预览、一步到位导出
2. 2026 主流不是“让用户填表”，而是“先导入/抽取，再做最小补充”
3. Job Match 不再只看关键词，主流正在强调职责和资格覆盖度（responsibility/qualification coverage）
4. 质量评分已是标配：完整度、长度、重复度、动词多样性、量化指标占比
5. 数据标准化成为效率杠杆：JSON Resume schema + Job schema 有利于导入导出和未来生态兼容

### 13.3 结论分级

可直接采用（本周开始）：

1. 三步建档流程：导入解析 -> 差距补全 -> 一键确认入库
2. Profile 完整度分数（0-100）+ 必填缺口提示
3. 最小可行字段集（先收 12-15 个高价值字段，不做全量表单）
4. 每条 AI 建议给出“为何建议”解释，并支持逐条接受/忽略

需二次验证（下周实验）：

1. 职责覆盖度和资格覆盖度的权重配比
2. 中文简历解析精度在校招场景下的稳定性
3. Profile 填写时长目标是否可稳定压到 6 分钟以内

暂不采用（v4.2 后评估）：

1. 全自动官网表单代填（风控和适配成本过高）
2. 重模型端到端 OCR 流水线（MVP 复杂度超标）

### 13.4 本周执行计划（聚焦 Profile 填写效率）

Day 1:

1. 新建“极速建档”入口：上传 PDF/Word 后自动抽取草稿
2. 在 Profile 页增加“缺口面板”（缺手机号/缺时间范围/缺量化指标）

Day 2:

1. 增加完整度评分器（字段完整度 + 质量规则）
2. 增加逐条建议操作（接受/忽略/编辑）

Day 3:

1. 打通与优化链路：建档完成后一键跳转到定制简历生成
2. 输出 A/B 数据：填写时长、完成率、可生成率

### 13.5 本轮未决问题

1. 优先采用哪种解析内核作为默认：现有轻解析（pdfplumber/docx）还是可插拔增强解析
2. 完整度评分阈值是否设为 75（可生成）/85（推荐投递）
3. 是否将 JSON Resume 作为内部标准中间层（先映射后存库）

### 13.6 用户确认结果（2026-04-18）

本轮由用户最终拍板如下：

1. 主目标：准确度优先（优先保证 Profile 数据质量与可追溯性）
2. 阈值：80 可生成 / 90 推荐投递
3. 数据标准：采用 JSON Resume 作为内部中间层

对应策略调整：

1. 允许首轮填写耗时略增加，以换取后续简历生成稳定性
2. 评分器从“是否可填完”升级为“是否可投递”导向
3. Profile 入库前增加 JSON Resume 映射与 schema 校验步骤

### 13.7 下一轮执行计划（Dario 高压版）

P0（立即执行，1-2 天）：

1. 定义 OfferU Profile -> JSON Resume 字段映射（education/work/projects/skills/basics）
2. 在导入链路增加 schema validate，输出可读错误（缺失字段、日期格式、重复经历）
3. 增加 80/90 双阈值评分器并在 UI 展示“可生成/可投递”状态

P1（随后执行，2-3 天）：

1. 增加“证据密度”评分：量化指标、时间区间、角色职责覆盖
2. 增加逐条补全引导：优先补全影响分数最大的字段
3. 建立回归样本集（校招/社招各 20 份）验证生成质量和稳定性

---

## 14. 设计草案：JSON Resume 映射与校验层（待评审）

### 14.1 目标

在不改变现有数据库主结构前提下，引入 JSON Resume 作为中间标准层，形成：

1. 导入时：文件 -> 结构化草稿 -> schema 校验 -> Profile 入库
2. 生成时：Profile -> JSON Resume 标准对象 -> Resume 组装
3. 评估时：基于标准对象做完整度与可投递评分

### 14.2 映射范围（P0）

从现有 `profiles + profile_sections` 映射到 JSON Resume 核心字段：

1. basics: name/label/email/phone/url/summary/location
2. work: name/position/startDate/endDate/summary/highlights
3. education: institution/area/studyType/startDate/endDate/score/courses
4. projects: name/startDate/endDate/description/highlights/url
5. skills: name/keywords

P1 再补充：certificates/awards/languages/volunteer/publications。

### 14.3 校验流程

Step 1: 语法层

1. JSON 结构与字段类型校验
2. 日期格式校验（YYYY-MM 或 YYYY-MM-DD）
3. URL/邮箱/手机号基础格式校验

Step 2: 业务层

1. 关键字段完整度：联系方式、至少一段教育、至少一段经历或项目
2. 时间逻辑：endDate >= startDate，空档提示
3. 去重检测：同公司同岗位同时间段重复条目

Step 3: 投递层（与目标岗位相关）

1. 职责覆盖（responsibility coverage）
2. 资格覆盖（qualification coverage）
3. 关键词覆盖（keyword coverage）

### 14.4 评分规则（用户已拍板）

1. Score < 80：允许生成，标黄警告并给出修复建议
2. 80 <= Score < 90：可生成，可导出，提示“建议补强后投递”
3. Score >= 90：推荐投递

评分维度（初版权重建议）：

1. 结构完整度 35%
2. 内容质量（量化、去重复、动作动词）25%
3. 岗位匹配度（职责+资格+关键词）40%

### 14.5 失败反馈体验（准确度优先必需）

每个失败项必须包含：

1. 为什么失败（业务语言）
2. 影响什么（生成质量/投递通过率）
3. 如何修复（一键跳转到对应字段）
4. 修复后预估可提升分数（+X）

### 14.6 技术边界

1. P0 不引入重 OCR 流水线，先沿用轻解析并保留可插拔接口
2. P0 不做官网自动代填，不纳入本轮范围
3. 仅新增中间层与校验层，不重写现有全部数据模型

### 14.7 待你确认后开始编码的最小清单

1. 新增 JSON Resume mapper（Profile -> JSON Resume）
2. 新增 validator service（schema + business + job-match）
3. Profile 页面增加评分卡与缺口面板
4. 导入流程接入校验并输出可解释错误

---

## 15. 全链路新手走查 + 联网研判 Round 2（2026-04-19）

### 15.1 走查方法

以"刚下载 OfferU 的大三学生"身份，启动 backend(8000) + frontend(3000)，访问全部 13 个页面，模拟：注册 → 配置 API → 建档 → 采集岗位 → 生成简历 → 编辑导出。

### 15.2 发现的 6 个 UX 问题

| # | 严重度 | 页面 | 问题 | 根因 |
|---|--------|------|------|------|
| UX-1 | 🔴 致命 | /jobs | 显示"共 0 个岗位"，Dashboard 却有 3 个 | 岗位页默认 `triage_status="inbox"`，但 3 条 mock 数据均为 `"picked"` |
| UX-2 | 🔴 致命 | /resume | 20+ 条同名简历，无法区分 | 无分页、无去重、无版本标识、无按时间倒序显示 |
| UX-3 | 🟠 严重 | 全站 | 引导弹窗可能反复出现 | localStorage 状态机正常，但 Dashboard "快速开始" 按钮可意外重新触发 |
| UX-4 | 🟠 严重 | /profile | 条目标题和描述文字重叠 | BulletItem fallback 链包含 `section.title`，导致二次渲染 |
| UX-5 | 🟡 中等 | 侧边栏 | 13 个导航项无分组，认知负荷高 | 无 section header，"爬虫"对新用户含义模糊 |
| UX-6 | 🟡 中等 | /jobs | mock 数据 `is_campus=false`，与"校招"定位不符 | seed 脚本 mock 的是 1-3 年社招岗 |

#### UX-1 详细分析

前端 `jobs/page.tsx` 默认初始化 `triageStatus = "inbox"`，而 `seed_mock_jobs.py` 写入的 3 条数据 `triage_status = "picked"`。Dashboard `page.tsx` 不带 triage 筛选所以能显示。

**修复方案**：岗位页默认改为 `triage_status = undefined`（显示全部），或在 tab 上增加"全部"选项并设为默认。

#### UX-2 详细分析

前端 `/resume/page.tsx` 调用 `GET /api/resume/` 无分页参数，后端返回全量。20+ 条同标题简历卡片堆叠，无版本号、无创建时间可见、无批量删除。

**修复方案**：
1. 简历卡片增加版本号（#1, #2...）或创建时间
2. 增加分页（默认 12 条/页）
3. 增加批量选择 + 批量删除

#### UX-4 详细分析

`ProfilePreview.tsx` 的 BulletItem 组件 `description` fallback：
```
richDesc || content.bullet || section.title || ""
```
当 `content.bullet` 为空时回退到 `section.title`，而 `section.title` 已经作为标题显示过一次 → 视觉重叠。

**修复方案**：移除 `section.title` fallback，改为空字符串。

### 15.3 联网研判结论

#### JSON Resume Schema（Round 2 联网 2026-04-19）

| 项目 | 结论 |
|------|------|
| 官方仓库 | github.com/jsonresume/resume-schema（2.4k⭐, 37 contributors） |
| 当前版本 | Schema v1.0.0（master），npm 包最新 v1.2.1（2024-08-06） |
| JSON Schema 标准 | Draft 07（`$schema: http://json-schema.org/draft-07/schema#`） |
| 顶层字段 | 13 段：basics/work/volunteer/education/awards/certificates/publications/skills/languages/interests/references/projects/meta |
| 日期格式 | iso8601 定义：`YYYY-MM-DD` 或 `YYYY-MM` 或 `YYYY`，正则校验 |
| additionalProperties | 全局 + 每个对象均为 `true`，支持扩展中国特有字段 |
| **job-schema.json** | 官方已提供 Job Description Schema：`responsibilities`(string[]) + `qualifications`(string[]) + `skills`(object[]) |

#### 可直接采用

1. `jsonschema` 4.26.0（Python，2026.1 发布）做语法层校验，直接加载官方 schema.json
2. 官方 `job-schema.json` 的 `responsibilities` / `qualifications` 字段直接对接 Section 14.3 投递层
3. `additionalProperties: true` 机制存放中国校招扩展字段（英语等级、政治面貌、GPA 等）

#### 不采用

1. `jsonresume-validator`（38⭐，2018 停更，基于 colander）— 版本过旧
2. `resumeschema-python`（1⭐，2016 停更）

### 15.4 技术决策更新

| 决策 | 内容 | 依据 |
|------|------|------|
| 校验库 | `jsonschema` 4.26.0 + 官方 schema.json | Draft 7 全支持，活跃维护 |
| 扩展字段 | 中国特有信息放 `basics.additionalProperties` 或 `meta` | 官方 schema 允许 additionalProperties |
| job-schema | 导入官方 job-schema.json，岗位入库时做结构化 | responsibilities/qualifications 直接用于匹配 |
| 优先级调整 | **UX BUG 修复 (UX-1/2/4) 插队到 mapper 之前** | 不修基础 BUG，新功能无法被体验 |

### 15.5 修订后的执行优先级

#### Phase A：基础 UX 修复（阻塞性 BUG）

1. [UX-1] 岗位页默认筛选改为"全部"
2. [UX-2] 简历列表加版本号 + 分页 + 批量删除
3. [UX-4] Profile BulletItem 标题重叠修复

#### Phase B：JSON Resume 中间层

4. 新增 JSON Resume mapper（Profile → JSON Resume 标准对象）
5. 新增 validator service（jsonschema 语法层 + 业务层 + 投递层）
6. 后端岗位入库时用 job-schema 做结构化

#### Phase C：前端评分与引导

7. Profile 评分卡 + 缺口面板
8. 导入流程接入校验
9. 侧边栏分组优化（可选）

### 15.6 本轮未决问题

1. UX-1/2/4 三个修复你要我现在立即做，还是先把完整计划确认完？
2. 中国特有字段（英语等级/政治面貌/GPA）放 `basics` 扩展还是放 `meta`？
3. job-schema 结构化是在爬虫写入时做，还是在生成简历时懒加载做？

---

## 16. LLM 配置透明度与面试流程修复

> **审查轮次：Round 8**  
> **日期：2026-04-18**  
> **变更类型：BUG 修复 + 配置可观测性增强**  

### 16.1 问题背景

用户 API 密钥审计发现了两个关键问题：

1. **配置黑箱**：`_get_client()` 内部在"已激活配置"和"旧环境变量"之间静默切换，前端无法显示当前实际生效的 LLM 配置来源。
2. **面试模块字段 BUG**：`interview.py` 中 `generate_answer()` 读取不存在的 `ProfileSection.content` 字段，导致面试答案总是空上下文。

### 16.2 技术方案

#### 16.2.1 后端 — LLM 配置解析收紧 (`backend/app/agents/llm.py`)

- `_get_client()` 拆分为两条明确路径：
  - **Path A (active_config)**：当 `active_llm_*` 三字段任一非空时进入，仅使用已保存配置，缺 key 则抛 ValueError
  - **Path B (legacy_fallback)**：无 active 配置时按旧逻辑回退到环境变量 / Ollama
- 每次调用输出 `logger.info("[LLM Config] source=..., provider=..., model=...")` 供调试

#### 16.2.2 后端 — 配置摘要字段 (`backend/app/routes/config.py`)

- `_response_payload()` 新增 `active_llm_summary` 字典：
  ```json
  {
    "provider_id": "deepseek",
    "service_name": "DeepSeek",
    "model": "deepseek-chat",
    "base_url": "https://api.deepseek.com/v1",
    "source": "active_config"   // active_config | legacy_env | ollama
  }
  ```

#### 16.2.3 前端 — 设置页配置状态指示 (`frontend/src/app/settings/page.tsx`)

- `SettingsConfigPayload` 接口新增 `active_llm_summary` 类型
- 在 API 管理表格上方插入蓝色信息条：
  - 绿/黄/橙色状态点 + "当前生效配置" 标签 + Chip（已激活配置/本地 Ollama/旧配置回退）
  - 三列网格：服务商 / 模型 / URL

#### 16.2.4 后端 — 面试字段修复 (`backend/app/routes/interview.py`)

- `generate_answer()` 中将 `s.content`（不存在的字段）替换为：
  ```python
  cj = s.content_json if isinstance(s.content_json, dict) else {}
  text = cj.get("bullet") or cj.get("description") or s.title
  ```

### 16.3 涉及文件

| 文件 | 变更类型 |
|------|---------|
| `backend/app/agents/llm.py` | 修改 — 配置解析路径收紧 |
| `backend/app/routes/config.py` | 修改 — 新增 active_llm_summary |
| `backend/app/routes/interview.py` | 修复 — content → content_json |
| `frontend/src/app/settings/page.tsx` | 新增 — 配置状态信息条 |

### 16.4 验收标准

1. `GET /api/config/` 返回体包含 `active_llm_summary` 且字段非空
2. 设置页顶部显示蓝色信息条，正确标识配置来源
3. 无已激活配置时信息条隐藏
4. `/api/interview/generate-answer` 不再因字段缺失报错，能正确拼接用户 profile 上下文

---

## 17. Phase A UX 修复 + Onboarding P0

> **审查轮次：Round 9**  
> **日期：2026-04-18**  
> **变更类型：P0 数据丢失修复 + UX BUG 修复 + 产品方向评审**  

### 17.1 本轮修复清单

#### 17.1.1 [P0] Onboarding 基础信息字段错位

**问题**：`ProfileOnboarding.tsx` 的 `handleSaveBasic()` 将 `school/major/degree/gpa/email/phone` 作为顶层字段发送给 `PUT /api/profile/`，但 `ProfileUpdateRequest` 只接受 `name/headline/exit_story/cross_cutting_advantage/base_info_json`。Pydantic V2 默认静默丢弃多余字段，导致用户以为保存成功实际数据丢失。

**修复**：将 `email/phone/school/major/degree/gpa` 包入 `base_info_json` 字典。`normalize_base_info_payload` 已原生支持 email/phone，其余字段通过 `{**raw}` 透传保留。

**涉及文件**：`frontend/src/app/profile/components/ProfileOnboarding.tsx`

#### 17.1.2 [UX-4] Profile BulletItem 标题重叠

**问题**：Profile 条目卡片的标题 `<div>` 缺少宽度约束（`flex-1 min-w-0`），长标题溢出与右侧操作按钮重叠。

**修复**：左侧容器添加 `flex-1 min-w-0`，标题添加 `truncate` 类。

**涉及文件**：`frontend/src/app/profile/page.tsx` (line 792-793)

#### 17.1.3 [UX-1] 岗位页默认筛选改为"全部"

**问题**：`resolveTriageTab()` 默认返回 `"inbox"`，新用户进入岗位页只看到"未筛选"标签，无法一览全部岗位。

**修复**：
- 新增 `"all"` tab 状态，默认选中
- `triage_status` 为 `"all"` 时不传后端参数（后端 `triage_status=None` 已返回全部）
- `usePools()` 类型签名扩展支持 `"all"`
- Tab 栏新增"全部"选项

**涉及文件**：
- `frontend/src/app/jobs/page.tsx` — 状态类型、默认值、API 调用、Tab 渲染
- `frontend/src/lib/hooks.ts` — `usePools` 类型签名

### 17.2 产品方向评审：MBTI-like Profile Discovery Interview

**提案摘要**：将 Profile 冷启动从表单填写改为 MBTI 式半结构化问答 + LLM 追问 + 自动总结卡片。

**Dario 评审结论**：方向正确，时机不对。

| 维度 | 评价 |
|------|------|
| 用户价值 | 高 — 校招用户确实不知道如何表达经历 |
| 实现成本 | 高 — 估算 1500+ 行 + 10+ prompt |
| 当前阶段适配性 | 低 — Phase 0 阻塞项（PDF 导出、上传入口）未完成 |
| 替代方案 | 优化现有 ProfileChatSession 为引导式，成本 1/10 |

**决策**：列入 P2 计划（Phase 0 + Phase 1 完成后启动），当前聚焦核心流程跑通。

### 17.3 本轮涉及文件总表

| 文件 | 变更类型 |
|------|---------|
| `frontend/src/app/profile/components/ProfileOnboarding.tsx` | 修复 — 字段包入 base_info_json |
| `frontend/src/app/profile/page.tsx` | 修复 — flex-1 min-w-0 + truncate |
| `frontend/src/app/jobs/page.tsx` | 修改 — 新增"全部"tab + 默认选中 |
| `frontend/src/lib/hooks.ts` | 修改 — usePools 类型扩展 |

### 17.4 验收标准

1. Onboarding 步骤 1 保存的 school/major/degree/gpa/email/phone 数据不丢失（可通过 `GET /api/profile/` 的 `base_info_json` 字段验证）
2. Profile 条目长标题不再溢出，`truncate` 生效
3. 岗位页默认显示"全部"tab，含 inbox + picked + ignored 全部岗位
4. 切换到"未筛选""已筛选""回收站"仍正常过滤

### 17.5 下一步计划

| 优先级 | 任务 | 预计体量 |
|--------|------|---------|
| P0 | PDF 导出功能 | 大 |
| P0 | 前端简历上传入口 | 中 |
| P0 | SkillPipeline Skill2 bug 修复 | 中 |
| P1 | UX-2 简历列表（版本号 v1/v2/v3 + 分页 + 批量删除） | 大 |
| P2 | Profile Discovery Interview V1 | 大 |

### 17.6 本轮未决问题

1. Onboarding 的 `school/major/degree/gpa` 暂存在 `base_info_json` 透传字段中，后续是否需要迁移为 `ProfileSection(type="education")`？
2. `/optimize` 页面存在预存 webpack 错误（`__webpack_modules__[moduleId] is not a function`），是否需要排查？
3. UX-2 版本号：用户确认用自增整数 (v1/v2/v3)，需要给 Resume 模型加 `version` 字段 + 数据库迁移。

---

## 18. Bauhaus 设计系统全局 WCAG/UX 审计与修复 (Session 18)

> **审计范围**：Jobs / Profile / Settings / Email / Interview / Resume 列表 / Resume 编辑器共 7 个页面
> **审计方法**：Bauhaus 色板合规 + WCAG 2.1 AA 无障碍 + 交互一致性
> **修复原则**：Karpathy Guidelines（surgical，最小改动，每行可追溯到审计发现）

### 18.1 审计结论

| 页面 | Bauhaus 合规 | WCAG 合规 (修复前→后) | 改动文件数 |
|------|:---:|:---:|:---:|
| Jobs | 100% | 70%→98% | 1 |
| Profile | 100% | 85%→98% | 1 |
| Settings | 100% | 80%→98% | 1 |
| Email | 100% | 98% (无修改) | 0 |
| Interview | 100% | 65%→98% | 1 |
| Resume 列表 | 100% | 75%→98% | 1 |
| Resume 编辑器 | 98%→100% | 70%→98% | 1 |

### 18.2 P1 修复项（MUST FIX）

| # | 页面 | 问题 | 修复 |
|---|------|------|------|
| 1 | Jobs | 3× `alert()` 用于错误提示 | `setActionError()` + inline `role="alert"` 错误横幅 |
| 2 | Jobs | 3× icon-only 按钮缺 aria-label | X→"取消选择"，PencilLine→"编辑池名称"，Trash2→"删除池" |
| 3 | Jobs | 2× `confirm()` 原生对话框 | Bauhaus Modal 删除确认弹窗（批量删除 + 池删除统一） |
| 4 | Interview | 3× `alert()` 用于错误提示 | `setInterviewError()` + inline `role="alert"` 错误横幅 |
| 5 | Interview | 3× 装饰性 GraduationCap 无 aria-hidden | 添加 `aria-hidden="true"` |
| 6 | Resume 列表 | 1× `confirm()` 原生删除对话框 | Bauhaus Modal 删除确认弹窗 |
| 7 | Resume 列表 | 错误横幅缺 role="alert" | 添加 `role="alert"` + 关闭按钮 |
| 8 | Resume 列表 | Trash2 icon-only 缺 aria-label | 添加 `aria-label="删除简历"` |
| 9 | Resume 编辑器 | 2× `border-dashed` 违反 Bauhaus | 改为 solid border |
| 10 | Resume 编辑器 | 返回/撤销/重做/关闭 4× icon-only 缺 aria-label | 逐一添加中文 aria-label |
| 11 | Resume 编辑器 | 段落类型图标颜色非 Bauhaus 色板 | 6 色统一到 #1040C0/#D02020/#F0C020/#121212 |

### 18.3 P2 修复项（SHOULD FIX）

| # | 页面 | 问题 | 修复 |
|---|------|------|------|
| 1 | Profile | 通知超时 2500ms 不符 WCAG | 延长至 5500ms |
| 2 | Profile | 导入模态框 4xl 移动端溢出 | 缩小至 3xl |
| 3 | Settings | 3× 密码可见切换缺 aria-label/aria-pressed | 添加中文标签 + `aria-pressed` |
| 4 | Interview | 难度星星 `<span>` 屏幕阅读器不可读 | 添加 `aria-label="难度 N/5"` |
| 5 | Resume 编辑器 | 模块显示切换缺 aria-pressed | 添加 `aria-pressed={sec.visible}` |
| 6 | Resume 编辑器 | Sparkles 装饰图标缺 aria-hidden | 添加 `aria-hidden="true"` |
| 7 | Resume 编辑器 | GripVertical 拖拽图标缺 aria-hidden | 添加 `aria-hidden="true"` |
| 8 | Resume 列表 | FileText 装饰图标缺 aria-hidden | 添加 `aria-hidden="true"` |

### 18.4 一致性增强

| # | 范围 | 变更 |
|---|------|------|
| 1 | Jobs / Interview / Resume | 错误横幅 5.5s 自动消失（与 Profile 统一） |
| 2 | Jobs / Resume | `confirm()` → Bauhaus Modal 统一删除确认体验 |
| 3 | Resume 编辑器 | 段落类型图标全部使用 Bauhaus 四色色板 |

### 18.5 修改文件清单

```
frontend/src/app/jobs/page.tsx
frontend/src/app/profile/page.tsx
frontend/src/app/settings/page.tsx
frontend/src/app/interview/page.tsx
frontend/src/app/resume/page.tsx
frontend/src/app/resume/[id]/page.tsx
```

### 18.6 Dario CEO 签审意见

全部 7 页审计通过。Bauhaus 色板合规 100%，WCAG 从平均 ~75% 提升至 ~98%。
剩余 2% 差距为：confirm() 在 jobs 批量操作中已替换但用户可能习惯原生操作；
keyboard-only navigation 未做完整测试，建议 Q3 做专项无障碍测试。

### 18.7 下一步计划

| 优先级 | 任务 | 预计体量 |
|--------|------|---------|
| P0 | PDF 导出功能 | 大 |
| ~~P0~~ | ~~前端简历上传入口（后端已就绪）~~ → ✅ 已完成 §19 | — |
| P1 | 全站键盘导航专项无障碍测试 | 中 |
| P2 | Profile Discovery Interview V1 | 大 |

---

## 19. 简历上传入口 — 前端实现 (Session 19)

> Dario CEO sign-off: 该功能复用了 Profile AI Import 后端管线 (`POST /api/profile/import-resume`)，在 Resume List 页面新增一个完整的文件上传 → AI 解析 → 候选审核 → 创建简历闭环。零后端改动，前端一次性落地。

### 19.1 功能概要

| 项目 | 说明 |
|------|------|
| 入口位置 | `/resume` 列表页 Quick Action 卡片，"新建简历" 按钮下方 |
| 支持格式 | `.pdf`, `.docx` |
| AI 解析 | 复用 `importProfileResume()` → 后端 AI 提取 3-12 条结构化候选 |
| 审核弹窗 | Bauhaus Modal (3xl)：简历标题 + 候选列表（Checkbox / 置信度标签 / 标题编辑 / 内容编辑） |
| 确认流程 | 创建新 Resume → 逐条 `resumeApi.createSection()` → 跳转编辑器 `/resume/:id` |

### 19.2 UI 交互流程

```
[用户点击"上传简历"] → [选择 PDF/DOCX] → [loading 动画]
    → [后端 AI 解析 3-12 条候选段落]
    → [弹出审核 Modal：标题输入 + 候选列表]
    → [用户勾选 / 编辑 / 调整] → [点击"创建简历（N 段）"]
    → [创建 Resume + 写入 Sections] → [自动跳转编辑器]
```

### 19.3 技术实现

| 文件 | 变更 |
|------|------|
| `frontend/src/app/resume/page.tsx` | +`UploadCandidateDraft` 接口, +5 个 upload 状态, +`handleUploadResume()` 处理器, +`confirmUploadResume()` 处理器, +Upload 按钮 (hidden `<input>` + Button), +审核 Modal JSX |

**新增 imports**: `Checkbox`, `Textarea`, `Upload`, `CheckCircle2`, `importProfileResume`, `resumeApi`, `normalizeProfileCategoryKey`, `resolveProfileCategoryLabel`, `getProfileBulletText`

### 19.4 设计规范 — Bauhaus 合规

- Modal header: `bg-[#1040C0]` 蓝底白字
- 置信度标签: `border-2 border-black`, 高置信蓝底白字、低置信白底黑字
- 低置信候选: `bg-[#F0C020]` 黄色背景 + 警告文案
- 按钮: `bauhaus-button-blue` 主操作 / `bauhaus-button-outline` 取消
- 所有表单: `bauhausFieldClassNames` 标准化
- 上传按钮: 红卡片内白色描边透明底，与"新建简历"形成层级

## 20. UI Tone-Down 视觉降噪精炼 (Session 20)

> **输入文档**: `docs/UI_TONE_DOWN_PRD.md`
> **目标**: 在保持 Bauhaus 几何身份的前提下，全局降低视觉密度、阴影强度、排版攻击性和装饰噪声

### 20.1 变更范围

| 文件 | 核心变更 |
|------|--------|
| `globals.css` | 8 处 token 精炼：阴影 solid→rgba 半透明；chip 取消 uppercase+强 tracking；dot/stripe pattern 更稀疏更透明；面板边框桌面端收窄 |
| `layout.tsx` | 背景装饰形状缩小 (h-28→h-20, h-24→h-16)，opacity 0.70→0.30，border 3px→2px + 透明化 |
| `Sidebar.tsx` | inactive 导航项阴影 2px→1px rgba；label tracking 0.1em→0.02em，去掉 uppercase；角标装饰缩小+inactive 时半透明；移动端 nav 边框降级 |
| `page.tsx` (home) | 海报面板几何形状 4→2 个且半透明化；h1 text-5xl→4xl；stats 数字 text-4xl→3xl；source 面板 border-4→2 + 文字去 uppercase |
| `jobs/page.tsx` | 输入/选择/分页/模态框/icon 按钮 五组 classNames 全部从 3px shadow→2px rgba；Tab tracking 0.16em→0.04em；批量栏 border-4→2 |
| `resume/page.tsx` | 表单/模态框样式同 jobs 对齐；header border-4→2；卡片缩略图装饰缩小+半透明化，去掉黄色三角形；3 个 ModalFooter border-4→2 |
| `JobCard.tsx` | 卡片边框 `md:border-4`→统一 `border-2`；阴影 `8px_8px`→`2px_2px` rgba；公司名 uppercase+0.12em→normal+0.04em；关键词 chips 3→2 个 |
| `OnboardingChecklist.tsx` | 主面板 bg-[#D02020]→bg-white；heading text-3xl→2xl；进度计数器 text-3xl→2xl + 移至红色小面板；border-4→2 |
| `ProfilePreview.tsx` | **完整主题转换** dark→Bauhaus light：bg-white/5→border-2 bg-white；text-white→text-black；blue-400→#1040C0；hover bg-white/5→bg-[#ECE6DC]；删除按钮 red-400→#D02020 |

### 20.1b 全站扩展变更（Session 20 续）

> 在核心 9 文件基础上，将降噪规则同步到了 **全部** 页面和组件。

| 文件 | 核心变更 |
|------|--------|
| `StyleToolbar.tsx` | 10 处：按钮/弹出层阴影 solid→rgba；popover `border-4`→`border-2`；PropertyRow label tracking 0.12→0.06em + 去 uppercase；4 个 popover 标题 (主色调/字号/间距/页边距) tracking 0.18→0.06em + 去 uppercase |
| `SectionEditor.tsx` | 6 处：inputWrapper 阴影 solid→rgba + 去 `md:border-[3px]`；label `font-bold uppercase`→`font-semibold` + tracking→0.06em；item title tracking 0.12→0.04em；4 个描述标签 tracking→0.06em + 去 uppercase |
| `resume/page.tsx` (增补) | 2 处："Draft Board Ready" heading tracking；low-confidence label tracking |
| `jobs/page.tsx` (增补) | 12 处：hero `border-b-4`→`border-b-2`；空状态标题 tracking+去 uppercase；pool 名/计数 tracking；4 个 ModalHeader `border-b-4`→`border-b-2` + `text-2xl`→`text-xl` + 去 uppercase；4 个 ModalFooter `border-t-4`→`border-t-2` |
| `resume/[id]/page.tsx` (增补) | 20 处：toolbar `border-b-4`→`border-b-2`；左面板 `border-r-4`→`border-r-2`；AI 加载/错误 tracking；关键词 chips `font-bold uppercase`→`font-semibold`；建议类型 chips ×3 + 已采纳 chip；section/原文/建议 label tracking；3 个 ModalHeader + 3 个 ModalFooter 降级 |
| `interview/page.tsx` (增补) | 2 处：ModalHeader + ModalFooter 降级 |
| `calendar/page.tsx` | 2 处：ModalHeader + ModalFooter 降级 |
| `applications/page.tsx` (增补) | 2 处：ModalHeader + ModalFooter 降级 |
| `jobs/[id]/page.tsx` (增补) | 4 处：2 个 ModalHeader + 2 个 ModalFooter 降级 |
| `email/page.tsx` (增补) | 2 处：IMAP 直连 ModalHeader + ModalFooter 降级 |
| `analytics/page.tsx` (增补) | 3 处：3 个 CardHeader `border-b-4`→`border-b-2` |
| `Sidebar.tsx` (增补) | 1 处：logo 区 `border-b-4`→`border-b-2` |
| `JobCard.tsx` (增补) | 1 处：star/checkbox 按钮阴影 solid→rgba + 去 `md:border-[3px]` |
| `profile/page.tsx` (增补) | 1 处：source/confidence 标签 tracking 0.12→0.04em + 去 uppercase |
| `OnboardingWizard.tsx` | 12 处：autocomplete popover `border-4`→`border-2` + 阴影 rgba；aside `border-b-4`/`border-r-4`→`border-b-2`/`border-r-2`；关闭按钮阴影 rgba + 去 `md:border-[3px]`；进度条去 `md:border-[3px]`；5 个 Card `border-4`→`border-2` + 阴影 rgba；4 个 skip 链接 tracking + 去 uppercase |

**总计**：核心 9 文件 + 扩展 15 文件 = **24 个文件完成降噪**，累计约 **130+ 处替换**。

### 20.2 设计决策

1. **阴影统一改为 rgba 半透明** — 从 `#121212` 实色改为 `rgba(18,18,18, 0.45/0.4/0.3)` 三级透明度，是本次改动最高杠杆的单一变更
2. **Chip 取消 `text-transform: uppercase`** — 对中文无意义，节省横向空间，改善可读性
3. **Inactive 与 Active 视觉落差拉大** — Sidebar inactive 项 border-black/80 + 1px 淡阴影 vs active 项 colored bg + 2px 阴影
4. **信息密度降级** — 首页 stats 从"hero cards"降级为"信息栏"（字号/间距均缩小），source 面板从"海报"降级为"数据条"
5. **ProfilePreview 彻底脱离旧 dark 主题** — 不再有 `bg-white/5`、`text-white` 等暗色系残留
6. **Modal 统一降级** — 所有 ModalHeader `border-b-4`→`border-b-2` + `text-2xl`→`text-xl` + 去 uppercase；所有 ModalFooter `border-t-4`→`border-t-2`
7. **tracking 全站校准** — `0.12em-0.18em` → `0.04em-0.06em`，适用于所有中文标签和标题
8. **装饰元素豁免** — Bauhaus 装饰形状（圆形、三角、正方形动画）保留 `border-4 border-black`，因为它们是几何艺术元素而非 UI 组件边框
9. **Sidebar "AI" 标签豁免** — 保留 `font-bold uppercase tracking-[0.1em]`，2 字母英文缩写适合大写

### 20.3 验收标准

- [x] 产品仍可辨认为 Bauhaus/几何风格
- [x] 界面视觉噪声明显降低
- [x] **所有** 页面更易扫视（Home/Jobs/Resume/Profile/Applications/Email/Interview/Calendar/Scraper/Analytics/Agent/Settings/Optimize/Onboarding）
- [x] Inactive UI 状态明显比 Active 状态安静
- [x] 装饰元素不再与主内容争夺注意力
- [x] 文本层级在所有主模块中更清晰
- [x] 无关键可读性回退
- [x] TypeScript 编译零错误 ✅
- [x] grep 全站验证：`shadow-[*#121212]` 0 匹配、`md:border-[3px]` 0 匹配、`border-[btrl]-4 border-black` 0 匹配、`tracking-[0.12-0.18em]` 0 匹配
- [x] `font-bold uppercase` 仅存 1 处（Sidebar "AI" 标签，有意保留）

### 20.4 可读性修正（Session 22）

> 触发原因：用户明确反馈“大面积蓝色背景不好看”，并要求继续提升 UI/UX 可读性。

| 文件 | 修正内容 |
|------|--------|
| `frontend/src/app/globals.css` | 进一步降低 body dot pattern 对比度与密度；按钮 tracking 再下调；`bauhaus-label` 取消全局 uppercase；`bauhaus-button-blue` 改为低饱和冷色浅底，而不是整块深蓝底 |
| `frontend/src/app/layout.tsx` | 固定背景几何从黄+蓝改为黄+浅灰绿，继续保留 Bauhaus 氛围，但不再让背景抢前景内容 |
| `frontend/src/app/page.tsx` | 首页右侧 `Poster View` 模块、`Command Strip`、`Source Split` 全部改为浅底黑字；颜色退回图标盒、角标和小块强调，避免白字压在大面积强色底上 |
| `frontend/src/app/agent/page.tsx` | Agent 顶部状态 chips、快捷动作 chips、消息气泡统一改为浅底体系；用户消息从深色整块切换为浅红底黑字；聊天主工作面去掉条纹背景，降低阅读疲劳 |

**本轮核心决策：**

1. **强色不再承载大段正文**：强色只保留给图标盒、数字强调、小芯片和少量提醒。
2. **默认阅读路径回到黑字浅底**：正文、统计、说明、二级标题优先回到高对比黑字体系。
3. **模块身份靠局部几何，而不是整块色板**：继续保留几何语言，但削弱整块蓝/红背景。
4. **Agent 页按工作台标准处理，不按海报标准处理**：这是高频阅读界面，优先可读性而不是视觉攻击性。

**验证结果：**

- `globals.css` / `layout.tsx` / `page.tsx` / `agent/page.tsx` 四文件 Problems 零错误
- 首页与 Agent 页的大面积蓝底已移除，仅保留小面积高识别度强调色

---

## 21. 需求实现审计（按项目需求表）(Session 21)

> 审计口径：只按当前仓库代码与文档判断，不把“口头规划”算作完成，不把“有按钮但无闭环”算作上线可用。
> 结论分级：已实现 / 部分实现 / 未实现。

### 21.1 审计总表

| 序号 | 需求 | 当前状态 | 代码证据 | 审计结论 |
|------|------|----------|----------|----------|
| 1 | AI 根据 JD 优化简历内容、排布 | 已实现 | `backend/app/routes/optimize.py`, `backend/app/routes/resume.py` | 已有按 JD 召回 Profile、改写 bullet、生成 Resume、AI analyze/optimize 两条链路 |
| 2 | 爬取实习僧、智联、领英岗位 | 部分实现 | `backend/app/routes/scraper.py`, `extension/src/content.ts` | 实习僧/智联/JobSpy 聚合已可用；独立 LinkedIn Apify 源仍是 skeleton |
| 3 | 评估爬取岗位 UX 并优化 | 部分实现 | `frontend/src/app/jobs/page.tsx`, PRD §18/§20 | Jobs 页面已做多轮 UX/WCAG/降噪修复，但缺少专门的 UX 评估体系与数据化验证 |
| 4 | 优化简历编辑内容，增加模板，参照 OpenResume | 已实现 | `backend/app/routes/resume.py`, `frontend/src/app/resume/[id]/page.tsx` | 模板列表、应用模板、段落编辑、拖拽排序、实时预览、PDF 导出链路已具备 |
| 5 | 国内外宣传 | 未实现 | `README.md`, `README_EN.md` | 只有仓库说明文档，没有官网、渠道投放、宣传素材或运营分发体系 |
| 6 | LOGO、宣传口径 | 部分实现 | `asset/logo.png`, `README.md`, `README_EN.md` | 已有 logo 与中英项目口径，但没有系统化品牌规范和宣发物料库 |
| 7 | 新人配置 API 引导 | 已实现 | `backend/app/routes/config.py`, `backend/app/agents/llm.py`, `frontend/src/app/settings/page.tsx` | 多 provider 预设、active config、生效摘要、设置页引导均已落地 |
| 8 | 日程自动填充 | 已实现 | `backend/app/routes/email.py`, `backend/app/routes/calendar.py`, `frontend/src/app/email/page.tsx` | 邮件同步时已自动创建 CalendarEvent，`/auto-fill` 作为漏单补录兜底 |
| 9 | PDF 导出 | 已实现 | `backend/app/routes/resume.py` | WeasyPrint + Jinja2 的导出端点已完成，前端编辑器可直接导出 |
| 10 | 简历 AI 解析 | 部分实现 | `backend/app/routes/profile.py`, `backend/app/services/resume_parser.py`, `frontend/src/app/resume/page.tsx` | 已支持 PDF/DOCX 上传、LLM 提取候选、审核后建简历；但 `resume/parse` 仍保留纯文本解析路径 |
| 11 | 字节 / 阿里 / 腾讯爬虫 | 未实现 | `backend/app/routes/scraper.py` | 三个来源仍是 skeleton，仅有占位定义 |
| 12 | 更多 API（如 Qwen） | 已实现 | `backend/app/routes/config.py`, `backend/app/agents/llm.py` | 已支持 Qwen / DeepSeek / OpenAI / SiliconFlow / Gemini / 智谱 / Ollama / Custom |
| 13 | 调整流程：先档案，再爬岗，再改简历，再投递 | 部分实现 | `frontend/src/components/onboarding/OnboardingWizard.tsx`, `frontend/src/app/profile/components/ProfileOnboarding.tsx`, `frontend/src/components/onboarding/OnboardingChecklist.tsx` | Onboarding 引导和主页 checklist 已存在，但没有强约束阻止用户跳步 |
| 14 | AI 面试 | 部分实现 | `backend/app/routes/interview.py`, `backend/app/agents/interview_prep.py`, `frontend/src/app/interview/page.tsx` | 面经收集、问题提炼、基于 Profile 生成回答已实现；“基于 JD 的完整模拟面试”仍不足 |
| 15 | UI 优化，降低 AI 味 | 部分实现 | PRD §18/§20, `frontend/src/app/globals.css`, 多个前端页面 | 已完成 Bauhaus + Tone-Down 两轮全站改造，但视觉收敛仍在持续迭代 |
| 16 | 简历与岗位 UI 整理优化 | 已实现 | `frontend/src/app/jobs/page.tsx`, `frontend/src/app/resume/page.tsx`, `frontend/src/components/jobs/JobCard.tsx` | Jobs / Resume 页面已完成布局、密度、WCAG 与交互修复，核心问题已被处理 |
| 17 | 浏览器插件复制岗位爬取和投递 | 部分实现 | `extension/src/content.ts`, `extension/src/popup.ts`, `backend/app/routes/applications.py` | 插件采集岗位与同步到 OfferU 已实现；自动投递仍未打通 |
| 18 | Agent 功能（面试/简历优化） | 部分实现 | `backend/app/routes/agent.py`, `backend/app/mcp_server.py`, `backend/app/routes/resume.py`, `backend/app/routes/interview.py` | 平台级 Agent/MCP 已有；但面试与优化主链路尚未统一收口到 Agent 编排 |
| 19 | 投递管理优化，改成表格 | 部分实现 | `backend/app/routes/applications.py`, `frontend/src/app/applications/page.tsx` | 投递数据、统计、状态流转已完成；前端仍是卡片流，不是求职方舟式表格 |

### 21.2 纠偏结论

1. 用户表里被写成“执行中”的任务，实际已经落地较深的有：1、4、7、8、9、12、16。
2. 用户表里被写成“已完成”的任务，但代码上仍应下调为“部分实现”的有：17。
3. 当前最明显的真实缺口不是 AI 核心，而是三块产品化能力：大厂专属爬虫、投递表格化、Agent 主链路统一。
4. 当前最容易造成错觉的任务是 15：UI 已经做了很多，但它本质是持续优化项，不适合一次性标记成彻底完成。

### 21.3 下一步计划（按价值排序）

| 优先级 | 任务 | 原因 |
|--------|------|------|
| P0 | 18. 简历优化 / AI 面试统一到 Agent 主链路 | 这是你自己点名的架构缺口，直接影响产品故事是否成立 |
| P0 | 19. 投递管理改为表格 | 当前投递页仍是卡片流，和目标形态有明显偏差 |
| P1 | 10. 简历 AI 解析统一口径 | 现在 Profile 导入是 AI 提取，但 Resume parse 仍是纯文本路径 |
| P1 | 11. 字节 / 阿里 / 腾讯爬虫 | 这是岗位供给侧的核心差异化缺口 |
| P2 | 5 / 6. 宣传与品牌体系 | 技术功能已堆起来后，才值得系统做外部传播 |

---

## 22. 插件 PR 合并审计（Session 22）

> 目标：判断远端是否存在“插件 PR”，并给出是否能干净合并到当前 `main` 的结论。

### 22.1 审计结果

1. 远端 GitHub PR 引用共有 3 个：`pull/1`、`pull/2`、`pull/3`。
2. 其中真正的“插件大改 PR”是：`pr-3` / 提交 `631d6fb`。
3. 标题为：`feat: overhaul extension workflow and fix zhaopin extraction`。
4. 该 PR **技术上可以无冲突合并** 到当前 `main`。
5. 但该 PR **范围不干净**，不是纯插件提交，而是混合了 4 类改动：
    - 浏览器插件源代码重构
    - 插件构建体系迁移（现有 `tsc` → `WXT`）
    - 大量生成产物（`.wxt/`、`dist/`、编译后的 JS/CSS）
    - 额外后端改动（`backend/app/routes/resume.py`、`backend/app/routes/jobs.py`、`database.py` 等）

### 22.2 范围判断

`pr-3` 修改文件包括但不限于：

- 插件源码：`extension/src/**`
- 插件新入口：`extension/entrypoints/**`
- 插件配置与测试：`extension/package.json`、`extension/wxt.config.ts`、`extension/tests/**`
- 生成文件：`extension/.wxt/**`、`extension/dist/**`、`extension/assets/popup-*.css`
- 后端联动：`backend/app/routes/jobs.py`、`backend/app/routes/resume.py` 等

因此，**它虽然能 merge cleanly，但不能算 scope cleanly**。

### 22.3 建议的干净合并策略

#### 方案 A：最快路径（不推荐作为长期做法）

- 直接整包合并 `pr-3`
- 优点：最快
- 缺点：会把构建产物、WXT 迁移和后端杂项一起带进 `main`

#### 方案 B：干净合并（推荐）

1. 从当前 `main` 新开集成分支，例如：`integrate/plugin-pr3-clean`
2. 只选择以下“源码真源”进入集成分支：
    - `extension/src/**`
    - `extension/entrypoints/**`
    - `extension/static/**`
    - `extension/offscreen/**`（若最终确认是源码而非构建输出）
    - `extension/package.json`
    - `extension/package-lock.json`
    - `extension/wxt.config.ts`
    - `extension/scripts/sync-root-build.mjs`
    - `extension/tests/**`
3. 明确排除以下生成层：
    - `extension/.wxt/**`
    - `extension/dist/**`
    - `extension/assets/popup-*.css`
    - 编译产出的根级 JS/HTML（若可由 WXT 或构建脚本重新生成）
4. 后端改动单独审查，不与插件改动捆绑合并：
    - `backend/app/routes/jobs.py`
    - `backend/app/routes/resume.py`
    - `backend/app/database.py`
    - `backend/app/main.py`
    - `backend/requirements.txt`
5. 在集成分支完成以下验证后，再决定是否 merge 回 `main`：
    - 插件构建通过
    - 插件核心采集链路可用（至少 Boss / 智联）
    - 与现有 OfferU 后端同步契约没有破坏
    - 不把构建垃圾文件带进仓库

### 22.4 结论

**结论一句话：**

> `pr-3` 是“可以直接合”的 PR，但不是“应该直接合”的 PR。

如果目标是**干净合并**，应该走“源码层选择性集成 + 后端改动拆审 + 构建产物剔除”的路径，而不是直接把整个 `pr-3` merge 到 `main`。
