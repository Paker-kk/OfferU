# OfferU 简历优化功能重构 — 实施计划

## 背景

参考 JadeAI 开源项目，对 OfferU 的简历优化功能进行重构。
核心问题：当前优化生成效果差强人意，改写内容泛泛而谈，缺乏针对性。

## 5 个核心差距

1. Skills Pipeline 未接入主流程（skills/ 目录有 4 个 Skill 但 optimize 路由没用）
2. 改写 Prompt 过于简陋（6 行规则 vs JadeAI 的上下文注入 + 工具驱动）
3. 缺少"先分析再改写"的两步流程
4. JSON 提取和输出校验不够健壮
5. 缺少交互式迭代优化能力

## 实施步骤

### P0（最高优先级 — 直接影响生成效果）

#### P0-1: Skills Pipeline 接入 optimize 主流程
- 文件：`backend/app/routes/optimize.py`
- 内容：将 `_llm_rewrite_sections()` 替换为 Skills Pipeline 调用链
  - Step 1: JDAnalyzerSkill — JD 智能解析
  - Step 2: ResumeMatcherSkill — 简历-JD 匹配分析
  - Step 3: ContentRewriterSkill — 内容改写 + 关键词注入
  - Step 4: SectionReorderSkill — 模块重排建议
- 保留现有批量生成 API 兼容性，新增 Skills 分析结果到 SSE 事件中

#### P0-2: 改写 Prompt 重写
- 文件：`backend/app/agents/skills/content_rewriter.py`
- 内容：
  - 增加 section 类型区分指导（experience/project/skill/education/summary 各有策略）
  - 增加面经参考信息注入模板
  - 增加上下文注入（JD 分析结果 + 匹配分析结果 + 面经数据）
  - 新增 `execute_single_section()` 方法支持逐 section 改写
- 文件：`backend/app/agents/skills/jd_analyzer.py`
  - 优化 Prompt，增加输出字段的详细说明
- 文件：`backend/app/agents/skills/resume_matcher.py`
  - 优化 Prompt，增加评分标准的详细说明

### P1（高优先级 — 交互体验提升）

#### P1-1: 新建 OptimizeAgent + 对话式 API
- 新建文件：`backend/app/agents/optimize_agent.py`
- 修改文件：`backend/app/routes/optimize.py`
- 内容：
  - 状态机驱动的对话式优化 Agent
  - 4 阶段工作流：确认 → 分析+框架 → 逐段改写 → 完成
  - 新增 API 端点：`/agent/start`, `/agent/chat`, `/agent/session/{id}`, `/agent/sessions`

#### P1-2: 前端第三栏改造为对话区
- 修改文件：`frontend/src/app/optimize/components/OptimizeWorkspace.tsx`
- 新增文件：`frontend/src/app/optimize/components/OptimizeChatPanel.tsx`
- 内容：
  - 将"结果列表"改造为 AI 对话区
  - 消息气泡（用户/AI）
  - 确认卡片（框架确认、section 改写确认）
  - 文件卡片（完成后展示简历链接）
  - 输入栏 + 发送按钮
  - 复用现有 ProfileAgentDock 的对话模式

### P2（中优先级 — 增强功能）

#### P2-1: 面经集成
- 修改文件：`backend/app/agents/optimize_agent.py`
- 内容：
  - 在框架阶段自动查找相关面经
  - Agent 告知用户正在参考哪些面经
  - 面经高频考察点影响改写方向

#### P2-2: OptimizeSession 持久化
- 新增数据库表：`optimize_sessions`
- 内容：
  - 存储优化会话状态（phase, messages, framework, sections 等）
  - 支持历史会话和断点续做

## 工作规范

1. 每完成一个步骤，使用子 Agent 进行代码审查
2. 子 Agent 检查：代码规范是否符合项目、功能是否正确、是否有遗漏
3. 如果子 Agent 发现问题，修改后重新审查，直到通过
4. 每个步骤完成前，向用户提问确认
5. 压缩上下文时，将工作规范和进度写入下一段对话

## 进度追踪

- [ ] P0-1: Skills Pipeline 接入
- [ ] P0-2: 改写 Prompt 重写
- [ ] P1-1: OptimizeAgent + 对话式 API
- [ ] P1-2: 前端对话区改造
- [ ] P2-1: 面经集成
- [ ] P2-2: OptimizeSession 持久化
