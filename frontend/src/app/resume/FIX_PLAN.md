# 简历编辑三问题修复计划

> **重要规则**：每完成一个问题后，派子代理审查代码；若子代理发现bug则修复后再次审查，循环直到子代理确认完全修复。完成任务或上下文压缩后，第一件事用 AskUserQuestion 向用户确认。

---

## 问题1：档案导入简历抬头显示异常

### 目标
从档案导入的经历条目在简历预览中正确显示抬头（如"字节跳动"），而非"Item 1"。

### 根因
`ResumePreview.tsx` 的 `normalizeSectionItem` 函数只匹配旧版 section_type（`experience`/`project`/`skill`/`certificate`），不匹配新版（`workExperiences`/`internshipExperiences`/`projects`/`skills`/`certificates`/`awards`/`personalExperiences`），导致落入默认分支显示"Item N"。

### 修改文件
- `e:\work\Projects\OfferU\OfferU\frontend\src\app\resume\components\ResumePreview.tsx`

### 具体修改
在 `normalizeSectionItem` 函数中：
1. `"experience"` → 增加匹配 `"workExperiences"`
2. 新增 `"internshipExperiences"` 分支（title=`item.position || item.company`, organization=`item.company`）
3. `"project"` → 增加匹配 `"projects"`
4. `"skill"` → 增加匹配 `"skills"`
5. `"certificate"` → 增加匹配 `"certificates"`
6. 新增 `"awards"` 分支（title=`item.awardName`, subtitle=`item.issuer`, date=`item.awardedAt`）
7. 新增 `"personalExperiences"` 分支（title=`item.experienceTitle`, date=`dateRange(item.startDate, item.endDate)`）

### 预期完成结果
- 所有8种section_type在预览中都能正确显示抬头
- 工作经历显示公司名+职位
- 实习经历显示公司名+岗位
- 项目经历显示项目名
- 获奖经历显示奖项名
- 个人经历显示经历标题

### 审查要点
- 每种section_type的字段名是否与SectionEditor中的数据模型一致
- 默认分支是否仍能兜底处理未知类型
- 是否有编译错误

---

## 问题2：简历编辑器加粗/斜体功能失效

### 目标
在简历编辑器中使用加粗/斜体等格式后，预览中能正确显示这些格式。

### 根因
预览渲染管道中 `textFromHtml` 剥离所有HTML标签，`ResumeItem` 只渲染纯文本 `bullets` 忽略 `descriptionHtml`。

### 修改文件
1. `e:\work\Projects\OfferU\OfferU\frontend\src\app\resume\components\templates\shared.tsx` — `ResumeItem` 组件
2. `e:\work\Projects\OfferU\OfferU\frontend\src\app\resume\components\ResumePreview.tsx` — summary字段
3. `e:\work\Projects\OfferU\OfferU\frontend\src\app\resume\components\templates\resumeTemplate.css` — 添加富文本CSS样式
4. `e:\work\Projects\OfferU\OfferU\frontend\src\app\resume\components\templates\ResumeReference.tsx` — 扩展格式检测

### 具体修改

#### shared.tsx — ResumeItem
- 新增 `hasRichHtml` 检测逻辑：检查 `descriptionHtml` 是否包含 `<strong|b|em|i|u|s|strike|ul|ol|li|a>` 标签
- 当 `hasRichHtml` 为true时，使用 `dangerouslySetInnerHTML={{ __html: cleanRichHtml(item.descriptionHtml) }}` 渲染
- 否则回退到现有纯文本 bullets 渲染
- 同样处理 summary 字段

#### ResumePreview.tsx
- `summary: textFromHtml(props.summary)` → 保留原始HTML，新增 `summaryHtml` 字段

#### resumeTemplate.css
- 添加 `.resume-rich-description` 样式（列表、加粗、斜体、下划线、删除线）

#### ResumeReference.tsx
- 扩展 `hasStructuredHtml` 检测，增加行内格式标签检测

### 预期完成结果
- 编辑器中加粗的文字在预览中显示加粗
- 编辑器中斜体的文字在预览中显示斜体
- 编辑器中列表在预览中正确渲染
- 纯文本描述仍以bullet列表形式渲染（向后兼容）
- 关键词高亮在纯文本模式下仍正常工作

### 审查要点
- `cleanRichHtml` 是否正确过滤了危险标签（script、事件处理器）
- `dangerouslySetInnerHTML` 使用是否安全
- 纯文本bullet渲染是否仍正常
- 关键词高亮功能是否受影响
- PDF导出是否受影响

---

## 问题3：档案描述字段改为微缩版word编辑器

### 目标
档案页面的描述字段从多条Textarea改为RichTextEditor，与简历编辑页面保持一致。

### 根因
档案使用 `descriptions: string[]` + `DescriptionArrayEditor`（多条纯文本），简历编辑器使用 `description: string` + `RichTextEditor`（HTML富文本），两者不一致。

### 修改文件
1. `e:\work\Projects\OfferU\OfferU\frontend\src\lib\personalArchive.ts` — 数据模型
2. `e:\work\Projects\OfferU\OfferU\frontend\src\app\profile\components\archive\ResumeArchiveEditor.tsx` — UI

### 具体修改

#### personalArchive.ts — 数据模型
1. 6个接口 `descriptions: string[]` → `description: string`
   - ResumeEducationItem
   - ResumeWorkItem
   - ResumeInternshipItem
   - ResumeProjectItem
   - ResumeAwardItem
   - ResumePersonalExperienceItem
2. `normalizeDescriptions()` → 改为返回 `string`，内部处理旧格式兼容
3. 6个 `createEmpty*()` 工厂函数：`descriptions: [""]` → `description: ""`
4. `normalizeResumeArchiveCandidate()` 中所有描述字段处理改为新函数
5. `buildFromLegacySections()` 中描述字段处理
6. `buildResumeArchiveSyntheticSections()` 中 `listToBullet(item.descriptions)` → 直接使用 `item.description`
7. `sanitizePersonalArchive()` 中 `hasAnyText(item.descriptions)` → `!!asString(item.description).trim()`
8. 向后兼容：在 `normalizeResumeArchiveCandidate()` 中自动迁移旧数据（`string[]` → HTML）

#### ResumeArchiveEditor.tsx — UI
1. 导入 `RichTextEditor`
2. 删除 `DescriptionArrayEditor` 组件
3. 6个ItemEditor中替换为 `RichTextEditor`
4. 清理不再使用的图标导入

### 向后兼容策略
旧数据 `descriptions: ["描述1", "描述2"]` 在加载时自动迁移：
- 单条：`<p>描述1</p>`
- 多条：`<ul><li>描述1</li><li>描述2</li></ul>`

### 预期完成结果
- 档案页面描述字段使用RichTextEditor
- 支持加粗/斜体/列表/换行等富文本编辑
- 旧数据自动迁移，不丢失内容
- 档案→简历导入数据流正常

### 审查要点
- 旧数据迁移是否正确（单条/多条/空值）
- `descriptions` 旧字段是否被正确排除（不残留到新对象中）
- 档案→简历导入数据流是否正常
- 档案→ProfileSection导出是否正常
- 是否有编译错误

---

## 执行流程

```
问题1修复 → 子代理审查 → (有bug? → 修复 → 再审查) → 确认完成
    ↓
问题2修复 → 子代理审查 → (有bug? → 修复 → 再审查) → 确认完成
    ↓
问题3修复 → 子代理审查 → (有bug? → 修复 → 再审查) → 确认完成
    ↓
向用户确认全部完成
```

## 关键提醒
- 完成任务或上下文压缩后，第一件事用 AskUserQuestion 向用户确认
- 子代理审查循环直到确认完全修复才进入下一阶段
