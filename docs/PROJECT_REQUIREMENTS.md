# OfferU 项目需求表

> 项目简介：AI 驱动的校招智能求职助手
> 技术栈：FastAPI + Next.js 14 + SQLite + DeepSeek/OpenAI/Ollama
> 最后更新：2025-07

## 功能清单

| 序号 | 类别 | 任务名称 | 详细描述 | 执行级别 | 执行人 | 已完成情况 | 测试 | 测试情况说明 |
|------|------|---------|---------|---------|--------|-----------|------|------------|
| 1 | 岗位管理 | 岗位列表查询 | GET /api/jobs 分页 + 9维筛选（关键词/来源/时间/类型/学历/校招等）；前端卡片布局 + debounce搜索 | P0 | 开发 | ✅ 完成 | 待测 | 前后端对接完整，支持全部筛选维度 |
| 2 | 岗位管理 | 岗位详情页 | GET /api/jobs/{id} 完整岗位信息 + AI摘要 + 关键词 + 一键投递按钮 | P0 | 开发 | ✅ 完成 | 待测 | 动画进场，UI 美观 |
| 3 | 岗位管理 | 岗位统计汇总 | GET /api/jobs/stats 按 period 分组统计总数与来源分布；集成 Dashboard | P1 | 开发 | ✅ 完成 | 待测 | today/week/month 三种周期 |
| 4 | 岗位管理 | 岗位采集趋势 | GET /api/jobs/trend 按日期分组；TrendChart.tsx 折线图可视化 | P1 | 开发 | ✅ 完成 | 待测 | 周/月两种视图 |
| 5 | 岗位管理 | 岗位批量入库 | POST /api/jobs/ingest 爬虫回调，自动去重(hash_key) + 校招检测 + 写入 200+ 行逻辑 | P0 | 开发 | ✅ 完成 | 待测 | 去重 + 校招识别引擎 |
| 6 | 岗位管理 | 周报分析 | GET /api/jobs/weekly-report 本周/上周对比 + 来源分布 + Top20关键词 | P2 | 开发 | ✅ 完成 | 待测 | 数据粒度丰富 |
| 7 | 简历管理 | 简历列表 | GET /api/resume 所有简历卡片网格；新建对话框 + 删除确认 | P0 | 开发 | ✅ 完成 | 待测 | 含更新时间、目标岗位标签 |
| 8 | 简历管理 | 创建简历 | POST /api/resume 自动创建默认段落（教育/经历/技能）；前端 Modal 表单 | P0 | 开发 | ✅ 完成 | 待测 | 新建后自动跳编辑器 |
| 9 | 简历管理 | 简历编辑器 | Canva 风格：左编辑面板(360px) + 右 A4 实时预览；Undo/Redo + 拖拽排序 + 多段落类型 + 样式控制 + 模板 | P0 | 开发 | ✅ 完成 | 待测 | 700+ 行代码，Ctrl+Z 快捷键 |
| 10 | 简历管理 | 段落管理 | POST/PUT/DELETE /api/resume/{id}/sections/* CRUD + 排序；@dnd-kit 拖拽 | P0 | 开发 | ✅ 完成 | 待测 | 6种段落类型（教育/经历/技能/项目/证书/自定义） |
| 11 | 简历管理 | 模板系统 | GET /templates + POST /apply-template；编辑器工具栏集成 | P1 | 开发 | ⚠️ 部分 | 待测 | 后端完整，前端集成需完善 |
| 12 | 简历管理 | 头像上传 | POST /api/resume/{id}/photo 文件上传；编辑器内嵌上传控件 | P1 | 开发 | ✅ 完成 | 待测 | JPG/PNG/WebP 5MB |
| 13 | 简历管理 | PDF 导出 | 前端 html2canvas + jsPDF 截取 A4 预览生成 PDF | P0 | 开发 | ✅ 完成 | 待测 | 前端实现完整，后端接口仅声明 |
| 14 | 简历管理 | 简历文件解析 | POST /api/resume/parse 上传 PDF/Word → 提取文本 | P1 | 开发 | ⚠️ 部分 | 待测 | 前端 UI 完成，后端 TODO |
| 15 | 简历管理 | 自动保存 | 编辑器 debounce 3秒自动保存；手动保存按钮 | P0 | 开发 | ✅ 完成 | 待测 | ref 持有最新 handleSave 避循环 |
| 16 | 简历管理 | 智能合一页 | 自动调整 sectionGap/lineHeight/bodySize/headingSize/margin 使内容恰好一页 | P2 | 开发 | ✅ 完成 | 待测 | 最大60轮迭代 + rAF 等浏览器布局 |
| 17 | AI 智能 | AI 简历分析（深度） | Skill Pipeline：JD 解析 → ATS 评分 → 逐段匹配 → 风险检测；4 个 Skill 编排 | P0 | 开发 | ✅ 完成 | 待测 | 需配置 API Key 才能使用 |
| 18 | AI 智能 | AI 简历优化建议 | optimize_resume / optimize_resume_with_context；关键词匹配 + STAR 改写 + 量化建议 | P0 | 开发 | ✅ 完成 | 待测 | HITL 逐条采纳/拒绝 |
| 19 | AI 智能 | AI 求职信生成 | POST /applications/generate 调用 cover_letter Agent；前端 Modal 编辑器 | P1 | 开发 | ✅ 完成 | 待测 | 可编辑后保存 |
| 20 | AI 智能 | API Key 预检测 | 前端检测 config 中 API Key 是否为空，未配置时显示黄色提示 + 禁用按钮 | P0 | 开发 | ✅ 完成 | 待测 | optimize 页 + 简历编辑器 AI Modal |
| 21 | AI 智能 | PII 脱敏保护 | 云端 LLM 调用前自动脱敏（电话/邮箱/身份证号），返回后还原 | P1 | 开发 | ✅ 完成 | 待测 | 仅 Ollama(本地) 跳过脱敏 |
| 22 | 投递管理 | 投递记录列表 | GET /api/applications 按状态筛选 + 分页；卡片列表 + Tabs 筛选 | P0 | 开发 | ✅ 完成 | 待测 | N+1 优化，批量加载 Job |
| 23 | 投递管理 | 创建投递记录 | POST /api/applications 关联 job_id；「一键投递」按钮 | P0 | 开发 | ✅ 完成 | 待测 | 岗位详情页一键发起 |
| 24 | 投递管理 | 投递状态追踪 | PUT /api/applications/{id} 状态流转：待投→已投→面试→Offer→拒绝 | P0 | 开发 | ✅ 完成 | 待测 | 含 submitted_at 时间戳 |
| 25 | 投递管理 | 投递统计 | GET /api/applications/stats 按 status 分组计数；顶部 Chip 展示 | P1 | 开发 | ✅ 完成 | 待测 | 实时更新 |
| 26 | 爬虫系统 | 数据源管理 | GET /api/scraper/sources 9个源状态(5 ready / 3 skeleton / 1 unsupported) | P0 | 开发 | ✅ 完成 | 待测 | 状态卡片 UI |
| 27 | 爬虫系统 | 一键爬取任务 | POST /api/scraper/run 异步执行，内存记录状态 | P0 | 开发 | ✅ 完成 | 待测 | 支持关键词 + 城市 + 数量配置 |
| 28 | 爬虫系统 | 实习僧爬虫 | shixiseng.py httpx + BS4，PUA 字体解码 + U+E000-F8FF 过滤 | P0 | 开发 | ✅ 完成 | ✅ 已测 | 实际抓取 5 条已入库验证 |
| 29 | 爬虫系统 | BOSS 直聘爬虫 | boss.py Cookie 认证 + wapi 接口 + 详情页 + 分页 | P0 | 开发 | ✅ 完成 | 待测 | Cookie 脱敏显示，过期提示 |
| 30 | 爬虫系统 | 智联招聘爬虫 | zhilian.py fe-api + Cookie + proxy bypass + 并发详情页 | P0 | 开发 | ✅ 完成 | 待测 | 30 城市编码，5页 × 90 条 |
| 31 | 爬虫系统 | LinkedIn/JobSpy聚合 | jobspy.py wrapper 聚合 LinkedIn/Indeed/Google；需 Python ≥3.10 | P1 | 开发 | ⚠️ 部分 | 待测 | Docker 环境可用，本地 3.9 有兼容问题 |
| 32 | 爬虫系统 | 字节/阿里/腾讯爬虫 | 3 个 skeleton 占位文件 | P2 | 开发 | ❌ 未开始 | - | 规划中 |
| 33 | 爬虫系统 | Cookie 管理 | 设置页 BOSS/智联 Cookie 输入 + 密码框 + 脱敏存储 | P0 | 开发 | ✅ 完成 | 待测 | 可视化切换 |
| 34 | 爬虫系统 | 合规免责声明 | 爬虫控制台橙色 Banner + 用户责任声明 | P0 | 开发 | ✅ 完成 | 待测 | 明确个人学习用途 |
| 35 | 日程管理 | 日程列表 | GET /api/calendar/events 时间范围筛选；FullCalendar 月/周/日 + 列表视图 | P1 | 开发 | ✅ 完成 | 待测 | 事件色彩分类 |
| 36 | 日程管理 | 创建日程 | POST /api/calendar/events；Modal 表单 + 日期点击快速创建 | P1 | 开发 | ✅ 完成 | 待测 | UI 友好 |
| 37 | 日程管理 | 面试日程自动填充 | 邮件解析面试时间 → 自动写入日历 | P2 | 开发 | ❌ 未开始 | - | 需从邮件通知触发 |
| 38 | 邮件通知 | Gmail OAuth 授权 | GET /auth-url + GET /callback；完整 OAuth2 流程 + refresh_token | P1 | 开发 | ✅ 完成 | 待测 | 需真实 Google 凭证测试 |
| 39 | 邮件通知 | 邮件同步解析 | POST /api/email/sync Gmail API 拉 7天邮件 → AI 解析面试通知 | P1 | 开发 | ✅ 完成 | 待测 | 依赖 LLM 解析准确度 |
| 40 | 邮件通知 | 通知列表展示 | GET /notifications 已解析面试通知（公司/岗位/时间/地点） | P1 | 开发 | ✅ 完成 | 待测 | 卡片列表 |
| 41 | 系统设置 | 多 LLM Provider | DeepSeek / OpenAI / Ollama 三选一；前端卡片选择器 + 模型下拉 | P0 | 开发 | ✅ 完成 | 待测 | 动态渲染模型列表 |
| 42 | 系统设置 | API Key 管理 | 脱敏存储 config.json；前端密码框 + 可见性切换 | P0 | 开发 | ✅ 完成 | 待测 | 安全性：不进 Git |
| 43 | 系统设置 | 搜索配置 | 关键词 / 城市 / 屏蔽词 / Top N 等配置项 | P1 | 开发 | ✅ 完成 | 待测 | 影响爬虫行为 |
| 44 | 系统设置 | 数据源开关 | sources_enabled Toggle 矩阵 | P1 | 开发 | ✅ 完成 | 待测 | 控制爬虫启用源 |
| 45 | 数据分析 | Dashboard 总览 | 动画卡片（岗位总数/源数/今日新增/关键词）+ 趋势图 + 最新岗位预览 | P0 | 开发 | ✅ 完成 | 待测 | 支持 3 种时间周期 |
| 46 | 数据分析 | 周报分析页 | 本周/上周对比 + 环比率 + 来源饼图 + 趋势图 + 关键词 Top20 | P1 | 开发 | ✅ 完成 | 待测 | Recharts 可视化 |
| 47 | 用户体验 | 侧边导航栏 | 10 个导航项 + 收缩模式（简历编辑页） + 移动端底部导航 | P0 | 开发 | ✅ 完成 | 待测 | 已移除悬浮 overlay |
| 48 | 用户体验 | 全局动画系统 | Framer Motion：stagger 进场 + spring 交互 + hover 反馈 | P1 | 开发 | ✅ 完成 | 待测 | 统一动画语言 |
| 49 | 用户体验 | 深色主题 | 全局暗色设计，NextUI dark mode | P0 | 开发 | ✅ 完成 | 待测 | WCAG 对比度达标 |
| 50 | 用户体验 | 性能优化 | SWR 全局配置（关闭 revalidateOnFocus）+ loading.tsx 骨架屏 + layoutId 优化 | P1 | 开发 | ✅ 完成 | 待测 | 页面切换更流畅 |
| 51 | 用户体验 | 新用户引导 Onboarding | 首次打开空数据时的引导流程：配置 Key → 创建简历 → 采集岗位 | P0 | 开发 | ❌ 未开始 | - | 本次需实现 |
| 52 | 部署运维 | Docker 部署 | docker-compose.yml 前后端 + Dockerfile | P1 | 开发 | ✅ 完成 | 待测 | standalone 输出 |
| 53 | 部署运维 | 操作部署文档 | README.md 安装 / 配置 / 运行指南 | P1 | 开发 | ✅ 完成 | 待测 | 中英文双语 |

## 统计

| 状态 | 数量 |
|------|------|
| ✅ 完成 | 47 |
| ⚠️ 部分 | 3 |
| ❌ 未开始 | 3 |
| **合计** | **53** |

## 优先待办 (P0 未完成)

1. **新用户 Onboarding 引导流程** — Dashboard 空数据引导 + 首次配置向导
2. **简历文件解析后端** — POST /api/resume/parse PDF/Word → 文本提取
3. **面试日程自动填充** — 邮件解析 → 日历事件自动写入
