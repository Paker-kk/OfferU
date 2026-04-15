# =============================================
# Skill: 职业叙事生成器
# =============================================
# 根据用户已有的 Profile Bullets 自动生成：
# - headline: 一句话定位
# - exit_story: 为什么选这个方向
# - cross_cutting_advantage: 核心超能力
# =============================================

from typing import Optional
from app.agents.llm import chat_completion, extract_json
from app.agents.skills.base import BaseSkill


SYSTEM_PROMPT = """你是 OfferU 求职助手，专注帮文科生大学生定位职业方向。

## 任务
根据用户的经历条目和目标岗位，生成3段职业叙事：

1. **headline**: 一句话职业定位（如"有数据思维的内容运营人"，不超过20字）
2. **exit_story**: 为什么选这个方向的故事（2-3句话，从经历中提炼转折点）
3. **cross_cutting_advantage**: 超能力/核心优势（1-2句话，跨领域迁移能力）

## 规则
- 必须基于用户实际经历，不能编造
- 文风自然、有个性，不要模板化
- 适合校招场景，避免过于老练的表达
- headline 要有记忆点，不要用"XXX专业毕业生"这种

## 输出 JSON
{
  "headline": "一句话定位",
  "exit_story": "方向选择故事",
  "cross_cutting_advantage": "核心超能力描述"
}"""


class NarrativeGeneratorSkill(BaseSkill):
    """职业叙事生成 — 从 bullets 生成 headline/exit_story"""

    @property
    def name(self) -> str:
        return "narrative_generator"

    async def execute(self, context: dict) -> dict:
        """
        生成职业叙事

        context 需要:
          - bullets_summary: 已有 profile 条目的摘要文本
          - target_roles: 目标岗位列表
          - basic_info: 基础信息（学校/专业等）

        返回: {headline, exit_story, cross_cutting_advantage}
        """
        bullets_summary = context.get("bullets_summary", "")
        target_roles = context.get("target_roles", [])
        basic_info = context.get("basic_info", "")

        if not bullets_summary:
            return {
                "headline": "",
                "exit_story": "",
                "cross_cutting_advantage": "",
                "error": "档案条目为空，无法生成叙事",
            }

        roles_str = "、".join(target_roles) if target_roles else "通用方向"

        user_content = f"""目标岗位：{roles_str}

基础信息：{basic_info}

已有经历条目：
{bullets_summary}"""

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_content},
        ]

        raw = await chat_completion(
            messages=messages,
            temperature=0.6,
            json_mode=True,
            max_tokens=1024,
            tier="standard",
        )

        if not raw:
            return {
                "headline": "",
                "exit_story": "",
                "cross_cutting_advantage": "",
                "error": "AI 生成失败",
            }

        parsed = extract_json(raw)
        if not parsed:
            return {
                "headline": "",
                "exit_story": "",
                "cross_cutting_advantage": "",
                "error": "AI 输出解析失败",
            }

        return {
            "headline": parsed.get("headline", ""),
            "exit_story": parsed.get("exit_story", ""),
            "cross_cutting_advantage": parsed.get("cross_cutting_advantage", ""),
        }
