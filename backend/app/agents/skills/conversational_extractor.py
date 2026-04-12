# =============================================
# Skill: 对话引导 Bullet 提取器
# =============================================
# 按主题 (education/internship/project/activity/skill/general)
# 与用户多轮对话，从自然语言中提取结构化 Bullet 条目。
#
# 核心规则：
# 1. 只提取用户明确提到的事实，严禁凭空生成
# 2. 用 STAR 法引导追问（Situation-Task-Action-Result）
# 3. 每轮提取后给出 bullet candidates，等用户确认
# 4. 低置信度标记提醒用户核实
# =============================================

from typing import Optional
from app.agents.llm import chat_completion, extract_json
from app.agents.skills.base import BaseSkill


# ---- 主题引导 Prompt ----

TOPIC_PROMPTS = {
    "education": "教育经历（学校、专业、GPA、课程、毕业论文）",
    "internship": "实习经历（公司、岗位、时长、具体做了什么、成果数据）",
    "project": "项目经历（项目名、你的角色、用了什么方法/工具、成果）",
    "activity": "社团/志愿者/学生组织经历（组织名、职务、做了什么、影响了多少人）",
    "competition": "比赛/竞赛经历（比赛名、获奖情况、你的贡献）",
    "skill": "技能与证书（硬技能、软技能、语言能力、证书）",
    "general": "其他经历（任何你想补充的成就或经历）",
}

SYSTEM_PROMPT = """你是 OfferU 求职助手的档案引导 AI。你正在帮一个文科生大学生构建个人档案。

## 你的角色
- 你是一个温暖、专业的求职顾问
- 你要像朋友一样自然地聊天，同时专业地引导用户回忆经历
- 你的目标是从用户的话中提取可以写进简历的「Bullet Point」

## 当前对话主题
{topic_description}

## 对话策略
1. **第一轮**：如果用户刚进入主题，用轻松的问题开场引导
2. **追问**：对模糊描述追问具体数据和结果（STAR法）
   - "做了多少？""影响了多少人？""持续多久？""有什么可量化的成果？"
3. **提取**：当用户给出足够细节后，立即提取 Bullet
4. **鼓励**：文科生可能觉得自己没什么，要善于发现亮点

## 输出格式
你的每次回复必须是如下 JSON:
{{
  "reply": "你对用户说的话（自然对话风格，不要太机械）",
  "bullets": [
    {{
      "section_type": "internship|project|education|activity|competition|skill|certificate|honor|language",
      "title": "条目标题（如职位名/项目名/技能名）",
      "content_json": {{
        "organization": "公司/学校/组织名",
        "role": "你的角色/职务",
        "start_date": "开始时间（如有）",
        "end_date": "结束时间（如有）",
        "description": "一句话 Bullet Point 描述（STAR格式，含数据）",
        "highlights": ["亮点1", "亮点2"]
      }},
      "confidence": 0.9
    }}
  ],
  "topic_complete": false,
  "next_question_hint": "下一个追问方向（内部参考，不展示给用户）"
}}

## 规则
- bullets 为空数组表示本轮不提取（仍需追问更多细节）
- confidence: 1.0=用户明确说了, 0.7=从上下文推断, 0.5以下=需用户确认
- topic_complete: 用户明确说"没了""就这些"时才为 true
- description 中的数字必须来自用户原话，不能编造
- 如果用户说的太模糊无法提取，reply 中友好地追问具体信息"""


class ConversationalExtractorSkill(BaseSkill):
    """对话引导 Bullet 提取器"""

    @property
    def name(self) -> str:
        return "conversational_extractor"

    async def execute(self, context: dict) -> dict:
        """
        执行一轮对话引导

        context 需要:
          - topic: 当前主题 (education/internship/project/...)
          - user_message: 用户本轮消息
          - history: 消息历史 [{role, content}, ...]
          - target_roles: 用户的目标岗位列表（用于引导方向）
          - profile_summary: 已有 profile 条目的简述（避免重复）

        返回:
          {reply, bullets: [...], topic_complete, raw_response}
        """
        topic = context.get("topic", "general")
        user_message = context.get("user_message", "")
        history = context.get("history", [])
        target_roles = context.get("target_roles", [])
        profile_summary = context.get("profile_summary", "")

        topic_desc = TOPIC_PROMPTS.get(topic, TOPIC_PROMPTS["general"])

        system_content = SYSTEM_PROMPT.format(topic_description=topic_desc)

        # 补充上下文
        if target_roles:
            roles_str = "、".join(target_roles)
            system_content += f"\n\n## 用户目标岗位\n{roles_str}（请围绕这些方向引导）"
        if profile_summary:
            system_content += f"\n\n## 已有档案条目\n{profile_summary}\n（避免重复提取已有内容）"

        # 构建消息列表
        messages = [{"role": "system", "content": system_content}]
        messages.extend(history)
        messages.append({"role": "user", "content": user_message})

        raw = await chat_completion(
            messages=messages,
            temperature=0.4,
            json_mode=True,
            max_tokens=2048,
        )

        if not raw:
            return {
                "reply": "抱歉，我暂时无法回应，请再试一次。",
                "bullets": [],
                "topic_complete": False,
                "raw_response": None,
            }

        parsed = extract_json(raw)
        if not parsed:
            # LLM 没返回合法 JSON，把原文当普通回复
            return {
                "reply": raw,
                "bullets": [],
                "topic_complete": False,
                "raw_response": raw,
            }

        return {
            "reply": parsed.get("reply", ""),
            "bullets": parsed.get("bullets", []),
            "topic_complete": parsed.get("topic_complete", False),
            "raw_response": raw,
        }


# ---- 即时价值钩子 (Step 2.5) ----

INSTANT_VALUE_PROMPT = """你是 OfferU 求职助手。用户刚刚告诉了你他的3段核心经历名称和目标岗位。
请根据这些信息，快速生成一份简历框架草稿。

## 规则
1. 基于用户提供的经历名称，为每段经历生成 1-2 个 Bullet Point 占位符
2. Bullet 内容用「待补充」标注具体数据位（如"负责XXX，[具体成果待补充]"）
3. 根据目标岗位调整用词方向
4. 输出完整的简历框架 JSON

## 输出格式
{{
  "headline": "一句话职业定位",
  "sections": [
    {{
      "section_type": "internship|project|activity|...",
      "title": "经历标题",
      "bullets": [
        "Bullet 1（含占位符）",
        "Bullet 2（含占位符）"
      ]
    }}
  ],
  "missing_hints": ["建议补充的内容1", "建议补充的内容2"],
  "encouragement": "对用户的鼓励语（一句话）"
}}"""


async def generate_instant_draft(
    experiences: list[str],
    target_roles: list[str],
) -> Optional[dict]:
    """
    即时价值钩子 — 3句话生成简历草稿框架
    Step 2.5: 用户告诉3段经历名称 → 秒出草稿 → 激励继续填充
    """
    roles_str = "、".join(target_roles) if target_roles else "通用"
    exp_str = "\n".join(f"- {e}" for e in experiences)

    messages = [
        {"role": "system", "content": INSTANT_VALUE_PROMPT},
        {"role": "user", "content": f"我的目标岗位：{roles_str}\n\n我的3段经历：\n{exp_str}"},
    ]

    raw = await chat_completion(
        messages=messages,
        temperature=0.5,
        json_mode=True,
        max_tokens=2048,
    )

    if not raw:
        return None
    return extract_json(raw)
