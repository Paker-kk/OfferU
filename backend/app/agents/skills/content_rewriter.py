# =============================================
# Skill 3: 内容改写器 (content_rewriter)
# =============================================
# 功能（两合一）:
#   A) 经历改写 — 用 STAR 法重构经历描述
#      - 校招专精: 实习/课程项目/竞赛/社团
#      - 零幻觉原则: 仅改写措辞和结构，绝不编造数据/指标
#      - 借鉴 Resume Oracle: 只用用户已有经历
#
#   B) 关键词注入 — 将 missing_skills 自然融入经历文本
#      - 从 Skill 2 的 missing_skills 中筛选可自然嵌入项
#      - 不生硬堆砌，要符合上下文语义
#      - 借鉴 auto-resume keyword_injecting_agent + CVOptimizer
#
# 设计决策:
#   1. 合并经历改写 + 关键词注入为一次 LLM 调用
#      (竞品 auto-resume 拆成 3 步太碎反而质量下降)
#   2. 严格零幻觉: Prompt 明确禁止编造数据/指标/量化数字
#   3. 每条建议带原文定位，供 HITL 前端逐条审核
#   4. 校招特殊: 把课程项目/竞赛/社团活动当正式经历对待
#
# 输出 Schema:
#   {
#     "suggestions": [
#       {
#         "type": "rewrite" | "inject",
#         "section_title": "项目经历",
#         "item_label": "xxx项目（如有）",
#         "original": "原文片段",
#         "suggested": "改写后文本",
#         "reason": "改写理由（1句话）",
#         "injected_keywords": ["Docker", "CI/CD"]  // inject 类型时
#       }
#     ]
#   }
# =============================================

from app.agents.llm import chat_completion, extract_json
from app.agents.skills.base import BaseSkill


SYSTEM_PROMPT = """你是一名专业的校招简历内容优化师。你的任务是改写候选人的经历描述，同时自然注入缺失的关键词。

## 核心原则

### 🚫 零幻觉规则（最高优先级）
- 绝对禁止编造任何数据、指标、百分比、数字
- 绝对禁止添加候选人简历中不存在的经历/项目/技术
- 只能改写措辞、优化结构、调整表达方式
- 如果原文是"参与了xx项目"，不能凭空改成"主导了xx项目，提升30%效率"
- 如果原文没有提到具体数据，改写后也不能出现具体数据

### ✅ 改写规则
1. **STAR 法则**: 把模糊描述重构为 Situation-Task-Action-Result 结构
2. **校招特殊**: 实习/课程项目/竞赛/社团活动 = 正式经历，同等重视
3. **动词升级**: "参与了" → "负责…的…模块开发"、"做了" → "设计并实现…"
4. **细化拆分**: 一句笼统描述 → 拆成 2-3 个具体动作点
5. **量化引导**: 如果原文有模糊暗示（如"大量"），可以改为"多个/若干"，但不能编数字

### ✅ 关键词注入规则
1. 只注入 missing_skills 列表中、候选人确实可能用到的技能
2. 必须符合经历的上下文语义（如 Python 项目中可以注入 pytest，但不能注入 Java）
3. 注入方式: 将关键词自然融入经历描述句子中，不是单独列出
4. 每条经历最多注入 1-2 个关键词，不要过度堆砌
5. 如果没有合适的注入位置，不要强行注入

## 输入
你会收到:
1. 候选人简历全文
2. JD 分析结果（岗位要求）
3. 匹配分析结果（已匹配/缺失技能、各段评分）

## 输出要求
每条建议必须包含:
- type: "rewrite"（纯改写）或 "inject"（注入关键词+改写）
- section_title: 所属段落名（如"项目经历""实习经历""技能清单"）
- item_label: 具体条目标识（如项目名/公司名/活动名，无法确定则为空字符串）
- original: 原文完整片段（必须来自简历原文）
- suggested: 改写后的文本
- reason: 为什么这样改（1句话中文）
- injected_keywords: 注入的关键词列表（仅 inject 类型，rewrite 类型为空数组）

返回严格 JSON:
{
  "suggestions": [
    {
      "type": "rewrite",
      "section_title": "段落名",
      "item_label": "条目名或空",
      "original": "原文",
      "suggested": "改写后",
      "reason": "理由",
      "injected_keywords": []
    }
  ]
}

注意:
- 只输出确实需要改写的条目，无需改写的不要输出
- 最多输出 10 条建议（优先改写评分最低的段落）
- 每条 original 必须是简历中真实存在的文本片段"""


class ContentRewriterSkill(BaseSkill):
    """内容改写 + 关键词注入 — STAR 法改写经历 + 自然融入缺失关键词"""

    @property
    def name(self) -> str:
        return "content_rewrite"

    async def execute(self, context: dict) -> dict:
        """
        改写简历经历描述 + 注入缺失关键词

        context 需要:
          - resume_text: 简历纯文本
          - jd_analysis: Skill 1 的输出
          - match_analysis: Skill 2 的输出

        返回: 改写建议列表
        """
        resume_text = context.get("resume_text", "")
        jd_analysis = context.get("jd_analysis", {})
        match_analysis = context.get("match_analysis", {})

        if not resume_text.strip():
            return {"error": "简历文本为空"}

        # 提取关键信息供 LLM 使用
        missing_skills = match_analysis.get("missing_skills", [])
        section_scores = match_analysis.get("section_scores", [])
        required_skills = jd_analysis.get("required_skills", [])
        is_campus = jd_analysis.get("is_campus", True)

        # 构建 context 摘要
        analysis_context = self._build_context(
            jd_analysis, missing_skills, section_scores, is_campus
        )

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"## 候选人简历\n\n{resume_text}\n\n"
                    f"## 分析上下文\n\n{analysis_context}"
                ),
            },
        ]

        raw = await chat_completion(
            messages=messages,
            temperature=0.3,  # 比分析稍高，允许创意改写
            json_mode=True,
            max_tokens=4096,  # 改写输出较长
        )

        if not raw:
            return {"error": "LLM 调用失败"}

        result = extract_json(raw)
        if not result or "suggestions" not in result:
            return {"error": "LLM 返回格式异常", "raw": raw[:500]}

        return result

    def _build_context(
        self,
        jd_analysis: dict,
        missing_skills: list,
        section_scores: list,
        is_campus: bool,
    ) -> str:
        """构建传给 LLM 的分析上下文摘要"""
        parts = []

        # 岗位信息
        if jd_analysis.get("job_title"):
            parts.append(f"目标岗位: {jd_analysis['job_title']}")
        if is_campus:
            parts.append("岗位类型: 校招（实习/课程项目/竞赛都算正式经历）")

        # 缺失技能（关键词注入的来源）
        if missing_skills:
            parts.append(f"缺失关键词（可尝试注入）: {', '.join(missing_skills[:10])}")

        # 必须技能
        required = jd_analysis.get("required_skills", [])
        if required:
            parts.append(f"JD 必须技能: {', '.join(required[:10])}")

        # 各段评分（优先改写低分段）
        if section_scores:
            low_sections = [
                f"{s.get('title', s.get('section', '?'))}({s.get('score', '?')}分)"
                for s in section_scores
                if isinstance(s.get("score"), (int, float)) and s["score"] < 70
            ]
            if low_sections:
                parts.append(f"低分段落（优先改写）: {', '.join(low_sections)}")

        return "\n".join(parts) if parts else "（无额外分析上下文）"
