# =============================================
# AI 简历优化 Agent — 多 LLM 支持
# =============================================
# 核心 Flow:
#   1. 接收简历文本 + 目标 JD
#   2. LLM 分析差距（关键词匹配、技能缺失、bullet改写）
#   3. 输出结构化优化建议（Diff 式逐条）
#
# 支持的 LLM Provider（通过 llm.py 抽象层）:
#   - DeepSeek（推荐，中国用户友好）
#   - OpenAI（GPT-4o 系列）
#   - Ollama（本地部署，完全免费）
#
# 输出 JSON Schema:
#   {
#     "keyword_match": { "matched": [...], "missing": [...], "score": 0-100 },
#     "suggestions": [
#       { "type": "...", "original": "...", "suggested": "...", "reason": "..." }
#     ],
#     "summary": "整体分析"
#   }
# =============================================

import json
from typing import Optional

from app.agents.llm import chat_completion, extract_json
from app.agents.desensitize import desensitize, restore
from app.config import get_settings


# =============================================
# 简历优化 System Prompt
# =============================================
# 编码了完整的分析策略：
#   - ATS 关键词匹配分析
#   - 技能差距识别
#   - Bullet Point 改写建议（STAR 方法）
#   - 模块排序建议
# =============================================
SYSTEM_PROMPT = """你是一位资深 HR 顾问和 ATS（申请者追踪系统）专家。
你的任务是分析用户的简历和目标岗位描述（JD），生成具体的优化建议。

## 分析框架

### 1. 关键词匹配分析
- 从 JD 中提取所有必需的技能、技术、认证关键词
- 与简历内容对比，找出已匹配和缺失的关键词
- 计算匹配率（0-100）

### 2. 逐条优化建议
为简历中每一段需要改进的内容，生成具体的修改建议：

**bullet_rewrite** — 经历/项目描述改写：
- 用 STAR 方法重写（Situation → Task → Action → Result）
- 添加量化数据（数字、百分比、规模）
- 保持原意，增强表达力

**keyword_add** — 技能关键词补充：
- 将 JD 要求但简历缺失的关键词建议补充到技能列表

**section_reorder** — 模块排序调整：
- 根据 JD 优先级建议最优模块排序

## 输出要求
返回严格的 JSON，不要输出其他内容：
{
  "keyword_match": {
    "matched": ["已匹配的关键词数组"],
    "missing": ["缺失的关键词数组"],
    "score": 75
  },
  "suggestions": [
    {
      "type": "bullet_rewrite",
      "section_title": "工作经历/项目经历等",
      "item_label": "具体条目标识（如公司名+职位）",
      "original": "原始描述文本",
      "suggested": "优化后的描述文本，包含量化指标",
      "reason": "优化理由（中文）"
    },
    {
      "type": "keyword_add",
      "original": ["现有技能列表"],
      "suggested": ["补充后的技能列表"],
      "reason": "JD 要求这些技能"
    },
    {
      "type": "section_reorder",
      "original_order": ["当前模块顺序"],
      "suggested_order": ["建议模块顺序"],
      "reason": "排序理由"
    }
  ],
  "summary": "整体分析总结（2-3句话中文）"
}

## 规则
- 输出语言与简历语言一致（中文简历用中文）
- 保留原意，增强而非捏造经历
- 每条建议必须有 reason
- suggestions 至少 3 条，最多 15 条
- 优先处理影响最大的问题"""


async def optimize_resume(
    resume_text: str,
    jd_text: str,
) -> Optional[dict]:
    """
    简历优化入口
    ─────────────────────────────────────────────
    接收简历文本和 JD 文本，通过 LLM 抽象层
    自动选择配置的 Provider 进行分析。

    参数:
      resume_text: 简历全文（纯文本或 Markdown）
      jd_text: 目标岗位描述全文

    返回: 结构化优化建议 dict，失败返回 None
    """
    # 截断过长内容防止 token 爆炸
    resume_safe = resume_text[:12000]
    jd_safe = jd_text[:6000]

    # 云端 Provider 自动脱敏 PII（Ollama 本地不需要）
    pii_mapping: dict = {}
    settings = get_settings()
    if settings.llm_provider != "ollama":
        resume_safe, pii_mapping = desensitize(resume_safe)

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"## 我的简历\n\n{resume_safe}\n\n## 目标岗位描述\n\n{jd_safe}"},
    ]

    raw = await chat_completion(
        messages=messages,
        temperature=0.3,
        json_mode=True,
        max_tokens=4096,
        tier="premium",
    )

    if not raw:
        return None

    result = extract_json(raw)

    # 基本校验
    if result and "suggestions" in result and "keyword_match" in result:
        # 还原脱敏占位符（suggestions 中的 original/suggested 可能包含占位符）
        if pii_mapping:
            result_str = json.dumps(result, ensure_ascii=False)
            result_str = restore(result_str, pii_mapping)
            result = json.loads(result_str)
        return result

    return None


async def optimize_resume_with_context(
    resume_data: dict,
    jd_text: str,
) -> Optional[dict]:
    """
    带完整简历结构的优化入口（从简历编辑器调用）
    ─────────────────────────────────────────────
    接收结构化简历 JSON（含段落信息），
    自动展平为文本后调用优化。

    参数:
      resume_data: 简历结构化 JSON（含 sections）
      jd_text: 目标岗位描述

    返回: 优化建议 dict
    """
    # 将结构化简历展平为可读文本
    parts = []
    if resume_data.get("user_name"):
        parts.append(f"姓名: {resume_data['user_name']}")
    if resume_data.get("summary"):
        parts.append(f"个人简介: {resume_data['summary']}")

    for section in resume_data.get("sections", []):
        title = section.get("title", section.get("section_type", ""))
        parts.append(f"\n## {title}")
        for item in section.get("content_json", []):
            if isinstance(item, dict):
                # 结构化条目（经历/教育等）
                label = item.get("title", item.get("company", item.get("school", "")))
                if label:
                    parts.append(f"### {label}")
                desc = item.get("description", "")
                if desc:
                    parts.append(desc)
                items = item.get("items", [])
                if items:
                    parts.append(", ".join(items) if isinstance(items, list) else str(items))
            elif isinstance(item, str):
                parts.append(item)

    resume_text = "\n".join(parts)
    return await optimize_resume(resume_text, jd_text)
