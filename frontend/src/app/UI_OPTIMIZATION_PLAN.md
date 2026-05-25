# OfferU UI 优化计划

## 调研日期
2026-05-18

---

## 一、问题总览

本次优化涉及三大类问题：
1. **未改造页面改造**：多个页面仍使用英文界面和旧UI风格（高饱和三原色）
2. **AI优化页布局问题**：三个统计卡片在宽屏下竖排导致页面过长
3. **投递页底部操作条高度问题**：操作条距离底部过远，视觉不协调

---

## 二、问题一：未改造页面改造

### 2.1 已改造页面的风格标准（参考基准）

已采用新 Bauhaus 风格的页面包括：
- **Dashboard** (`page.tsx`)
- **简历列表** (`resume/page.tsx`)
- **简历编辑器** (`resume/[id]/page.tsx`)
- **档案页** (`profile/page.tsx`)
- **岗位列表** (`jobs/page.tsx`)
- **投递管理** (`applications/page.tsx`)
- **设置页** (`settings/page.tsx`)
- **AI优化** (`optimize/page.tsx`)

**新风格核心特征**：
- 中文界面（标题、标签、按钮全部中文）
- 柔和大地色系，低饱和度
- CSS变量：`--background: #f6f3eb`, `--surface: #fdfbf7`, `--surface-muted: #f2ede4`
- 柔和强调色：`--primary-red: #c95548`, `--primary-yellow: #e4c46a`, `--auxiliary-blue: #6f8396`, `--auxiliary-green: #7a8f7e`
- 卡片类名：`bauhaus-panel`, `bauhaus-panel-sm`, `bauhaus-chip`
- 无高饱和硬编码色（禁用 `#1040C0` 纯蓝、`#D02020` 纯红、`#F0C020` 亮黄）

### 2.2 未改造页面清单

#### P0 - 日程页 (`calendar/page.tsx`)
**英文内容**：
- Chip: `Interview Calendar` → `日程日历`
- Label: `Schedule Board` → `日程面板`
- 大标题: `Plan / Time / Move` → `规划 / 时间 / 行动`
- 统计卡标签: `Events` → `事件`, `Modes` → `模式`, `Capture` → `收录`
- 空状态: `No Events Yet` → `暂无日程`

**旧颜色风格**：
- `bg-[#F0C020]` 亮黄 → `bg-[#f3ead2]` 或 `bg-[#e4c46a]`
- `bg-[#1040C0]` 纯蓝 → `bg-[#6f8396]`
- `bg-[#D02020]` 纯红 → `bg-[#c95548]`
- 事件类型色: `#1040C0`, `#D02020`, `#F0C020` → 新色系
- Modal头部 `bg-[#F0C020]` → 新色系

#### P0 - 面试页 (`interview/page.tsx`)
**英文内容**：
- Chip: `Interview Library` → `面试题库`
- Label: `Question Board` → `题目面板`
- 大标题: `Collect / Extract / Answer` → `收集 / 提取 / 作答`
- 统计卡标签: `Questions` → `题目`, `Experiences` → `经验`, `Action` → `行动`
- 空状态: `Question Bank Empty` → `题库为空`, `No Experiences Yet` → `暂无经验`

**旧颜色风格**：
- `bg-[#F0C020]` 亮黄 → 新色系
- `bg-[#1040C0]` 纯蓝 → 新色系
- `bg-[#D02020]` 纯红 → 新色系
- 分类chip硬编码高饱和色 → 新色系
- Modal头部 `bg-[#F0C020]` → 新色系
- 空状态卡片 `bg-[#1040C0]` → 新色系

#### P0 - 邮件页 (`email/page.tsx`)
**英文内容**：
- Chip: `Mail Intake` → `邮件接入`
- Label: `Inbox Parser` → `收件箱解析`
- 大标题: `Read / Parse / Route` → `读取 / 解析 / 路由`
- 统计卡标签: `Gmail` → `Gmail`, `IMAP` → `IMAP`, `Parsed` → `已解析`
- 状态文字: `Linked` → `已连接`, `Pending` → `待连接`

**旧颜色风格**：
- `bg-[#F0C020]` 亮黄 → 新色系
- `bg-[#1040C0]` 纯蓝 → 新色系
- `bg-[#D02020]` 纯红 → 新色系
- 分类chip硬编码高饱和色 → 新色系
- Modal头部 `bg-[#1040C0]` → 新色系
- 空状态卡片 `bg-[#1040C0]` → 新色系

#### P1 - 分析页 (`analytics/page.tsx`)
**英文内容**：较少，主要是统计卡标签已是中文

**旧颜色风格**（问题较严重）：
- `bg-[#D02020]` 纯红 → `bg-[#c95548]`
- `bg-[#1040C0]` 纯蓝 → `bg-[#6f8396]`
- `bg-[#F0C020]` 亮黄 → `bg-[#e4c46a]`
- 图表颜色数组 `COLORS` 包含高饱和色 → 调整为新色系
- CardHeader 高饱和色背景 + `border-b-2 border-black` → 新风格

#### P1 - Agent页 (`agent/page.tsx`)
**英文内容**：
- Label: `Harness Workspace` → `全局助手工作台`
- Chip显示 `latestMode`（英文模式名: `ready` 等）→ 中文映射
- 消息气泡内 `Next steps` 标签 → `下一步`

**旧颜色风格**：
- `bg-[#F0C020]` 亮黄 → 新色系
- `bg-[#D02020]` 纯红 → 新色系
- `bg-[#F7E4E1]` 浅红 → 保留或调整为 `bg-[#f7ece9]`
- 快捷操作chip使用 `#F0C020` / `#F7E4E1` / `white` → 新色系

#### P2 - 岗位详情页 (`jobs/[id]/page.tsx`)
**英文内容**：
- Chip: `Job Profile` → `岗位档案`
- Label: `Detail Sheet` → `详情表`
- 统计卡标签: `Source` → `来源`, `Keywords` → `关键词`, `Actions` → `操作`

**旧颜色风格**：
- `bg-[#F0C020]` 亮黄 → 新色系
- `bg-[#1040C0]` 纯蓝 → 新色系
- `bg-[#D02020]` 纯红 → 新色系

---

## 三、问题二：AI优化页布局问题

### 3.1 问题描述
AI优化页 (`optimize/components/OptimizeWorkspace.tsx`) 中，左侧"步骤一"面板顶部的三个统计卡片（档案条目 / 已选岗位 / 生成方式）在宽屏（xl断点，>=1280px）下被强制垂直排列，导致：
- 左侧面板高度被大幅拉长
- 整个页面纵向延伸过多
- 用户需要大量滚动才能看到下方内容

### 3.2 根因分析
代码第312行：
```tsx
<div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
```

响应式行为：
- 默认（<640px）：1列，垂直排列
- sm（>=640px）：3列，水平排列
- **xl（>=1280px）：1列，垂直排列** ← 问题所在

设计初衷：xl断点下左侧面板较窄（约0.95fr），水平排列会导致卡片拥挤。但实际效果是垂直排列让页面过长。

### 3.3 解决方案

**推荐方案A：调整断点，让xl也保持水平排列**

将 `xl:grid-cols-1` 移除，改为：
```tsx
<div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
```

这样三个卡片将在所有屏幕宽度下保持水平排列，仅在手机端（<640px）垂直堆叠。

**需要修改的文件**：
1. `optimize/components/OptimizeWorkspace.tsx` 第312行
2. `optimize/page.tsx` 第52行（同样的问题）

**优点**：改动极小，效果显著
**缺点**：xl断点下左侧面板较窄，卡片内容可能略显拥挤。可通过微调内边距适配。

---

## 四、问题三：投递页底部操作条高度问题

### 4.1 问题描述
投递页面 (`applications/page.tsx`) 底部，当用户勾选记录后出现的批量操作条，距离页面底部过远，造成视觉阻碍。

### 4.2 根因分析

**投递页面操作条**（第1143-1176行）：
```tsx
<div className="sticky bottom-4 z-40 mt-3 flex justify-center px-4 pb-3">
```
- 定位方式：`sticky`
- 距离底部：`bottom-4` (16px)
- 上边距：`mt-3` (12px)
- 底部内边距：`pb-3` (12px)

**岗位页面操作条**（第1101行附近）：
```tsx
<motion.div className="fixed bottom-6 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none md:left-64 md:right-auto md:w-[calc(100vw-16rem)]">
```
- 定位方式：`fixed`
- 距离底部：`bottom-6` (24px)
- 无额外边距

**核心差异**：
1. **定位方式不同**：投递页用 `sticky`，岗位页用 `fixed`
2. **`sticky` 受 `<main>` 容器底部内边距影响**：`layout.tsx` 中 `<main>` 有 `pb-28 md:pb-10`，导致投递页操作条被内边距推开
3. **`fixed` 脱离文档流**，不受 `<main>` 内边距影响，所以岗位页操作条紧贴底部

### 4.3 解决方案

**推荐方案：将投递页面操作条改为 `fixed` 定位**

与岗位页面保持一致：
```tsx
<div className="fixed bottom-6 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none md:left-64 md:right-auto md:w-[calc(100vw-16rem)]">
  <div className="pointer-events-auto bauhaus-panel flex w-full max-w-[980px] flex-nowrap items-center gap-3 overflow-x-auto bg-[var(--surface)] px-4 py-3">
    {/* 内容不变 */}
  </div>
</div>
```

**需要修改的文件**：
- `applications/page.tsx` 第1143-1176行

**优点**：
- 完全解决距离底部过远的问题
- 与岗位页面交互体验一致
- 不受 `<main>` 容器内边距影响

---

## 五、隐藏页面说明

以下页面当前在前端导航中**处于隐藏状态**（用户暂时无法直接访问），本次改造仅修改代码，**保持其隐藏状态不变**：

| 页面 | 文件路径 | 隐藏状态 |
|------|----------|----------|
| 日程 | `calendar/page.tsx` | 隐藏 |
| 面试 | `interview/page.tsx` | 隐藏 |
| 邮件 | `email/page.tsx` | 隐藏 |
| 分析 | `analytics/page.tsx` | 隐藏 |
| Agent | `agent/page.tsx` | 隐藏 |

> 这些页面改造后仍保持隐藏，后续调试完成后再决定是否开放访问。

## 六、改造优先级与工作量估算

| 优先级 | 任务 | 涉及文件 | 预估工作量 | 是否隐藏 |
|--------|------|----------|------------|----------|
| P0 | 日程页英文+颜色改造 | `calendar/page.tsx` | 中 | 是 |
| P0 | 面试页英文+颜色改造 | `interview/page.tsx` | 中 | 是 |
| P0 | 邮件页英文+颜色改造 | `email/page.tsx` | 中 | 是 |
| P0 | AI优化页布局修复 | `optimize/components/OptimizeWorkspace.tsx`, `optimize/page.tsx` | 小 | 否 |
| P0 | 投递页操作条高度修复 | `applications/page.tsx` | 小 | 否 |
| P1 | 分析页颜色改造 | `analytics/page.tsx` | 中 | 是 |
| P1 | Agent页英文+颜色改造 | `agent/page.tsx` | 中 | 是 |
| P2 | 岗位详情页英文+颜色改造 | `jobs/[id]/page.tsx` | 小 | 否 |

---

## 六、截图参考

截图存放在 `E:\work\Projects\OfferU\OfferU\references\png\`：
- `ai优化.png` - AI优化页布局问题（红框标注竖排卡片）
- `投递页面.png` - 投递页底部操作条高度问题
- `PixPin_2026-05-18_12-57-20.png` - 其他参考
- `PixPin_2026-05-18_12-58-41.png` - 其他参考
- `PixPin_2026-05-18_13-00-23.png` - 其他参考
