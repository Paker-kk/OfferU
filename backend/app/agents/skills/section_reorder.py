# =============================================
# Skill 4: 模块重排建议器 (section_reorder)
# =============================================
# 功能:
#   根据 JD 分析结果，建议简历 section 的最佳排列顺序。
#   例如: 如果 JD 强调技术能力，建议把「技能」提到「教育」前面。
#
# 设计决策:
#   1. 独立 Skill，轻量级单次 LLM 调用（输出短小）
#   2. 只输出排序建议 + 理由，不直接修改简历结构
#   3. 校招专精: 教育/GPA 通常排前；但技术岗可能技能优先
#   4. 配合 HITL: 前端展示建议排序，用户一键确认
#
# 输出 Schema:
#   {
#     "current_order": ["教育背景", "实习经历", "项目经历", "技能清单"],
#     "suggested_order": ["技能清单", "项目经历", "实习经历", "教育背景"],
#     "reason": "该岗位强调技术能力，建议技能和项目经历前置",
#     "changes": [
#       {
#         "section": "技能清单",
#         "action": "move_up",
#         "reason": "JD 必须技能占比高，前置可提升 ATS 命中率"
#       }
#     ]
#   }
# =============================================

from app.agents.llm import chat_completion, extract_json
from app.agents.skills.base import BaseSkill


SYSTEM_PROMPT = """你是一名简历排版策略师，专注于中国校招场景。你的任务是根据目标岗位要求，建议简历各模块的最佳排列顺序。

## 排序原则

### 通用规则
1. 与 JD 最相关的内容排在最前面
2. ATS 系统从上到下扫描，前置重点内容可提升命中率
3. 保持逻辑连贯性（不要把联系方式移到中间）

### 校招特殊规则
1. 如果是校招岗，「教育背景」通常保持在前 2 位（GPA 重要）
2. 技术类岗位: 技能/项目 > 实习 > 教育 > 社团/其他
3. 非技术类岗位: 实习/教育 > 项目 > 技能 > 社团/其他
4. 研究类岗位: 教育/论文 > 项目 > 技能 > 实习

### 非校招规则
1. 工作经历永远排第一（after 个人信息）
2. 技能紧跟工作经历
3. 教育放最后

## 输入
你会收到:
1. 候选人简历全文（从中识别当前模块顺序）
2. JD 分析结果（岗位要求、是否校招等）

## 输出要求
返回严格 JSON:
{
  "current_order": ["当前识别到的模块顺序"],
  "suggested_order": ["建议的模块顺序"],
  "reason": "整体调整理由（1-2句中文）",
  "changes": [
    {
      "section": "需要移动的模块名",
      "action": "move_up 或 move_down 或 keep",
      "reason": "调整理由（1句话）"
    }
  ]
}

注意:
- 如果当前顺序已是最优，suggested_order 与 current_order 相同，changes 为空数组
- current_order 从简历文本中识别，按出现先后排列
- 模块名使用简历中的原始标题（如"教育背景""项目经历"等）
- 「个人信息/联系方式」始终保持在第一位，不要移动"""


class SectionReorderSkill(BaseSkill):
    """模块重排 — 根据 JD 优先级建议简历 section 最佳排序"""

    @property
    def name(self) -> str:
        return "section_reorder"

    async def execute(self, context: dict) -> dict:
        """
        分析简历模块顺序，给出重排建议

        context 需要:
          - resume_text: 简历纯文本
          - jd_analysis: Skill 1 的输出

        返回: 排序建议
        """
        resume_text = context.get("resume_text", "")
        jd_analysis = context.get("jd_analysis", {})

        if not resume_text.strip():
            return {"error": "简历文本为空"}

        # 构建 JD 摘要
        jd_summary = self._format_jd(jd_analysis)

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"## 候选人简历\n\n{resume_text}\n\n"
                    f"## 岗位分析\n\n{jd_summary}"
                ),
            },
        ]

        raw = await chat_completion(
            messages=messages,
            temperature=0.1,  # 排序建议需要高确定性
            json_mode=True,
            max_tokens=1024,  # 排序输出较短
        )

        if not raw:
            return {"error": "LLM 调用失败"}

        result = extract_json(raw)
        if not result or "suggested_order" not in result:
            return {"error": "LLM 返回格式异常", "raw": raw[:500]}

        return result

    def _format_jd(self, jd: dict) -> str:
        """格式化 JD 分析结果"""
        if not jd or "error" in jd:
            return "（JD 分析不可用）"

        parts = []
        if jd.get("job_title"):
            parts.append(f"岗位: {jd['job_title']}")
        if jd.get("is_campus") is not None:
            parts.append(f"校招岗: {'是' if jd['is_campus'] else '否'}")
        if jd.get("experience_level"):
            parts.append(f"经验要求: {jd['experience_level']}")
        if jd.get("required_skills"):
            parts.append(f"必须技能: {', '.join(jd['required_skills'][:8])}")
        if jd.get("responsibilities"):
            parts.append(f"核心职责: {', '.join(jd['responsibilities'][:5])}")
        if jd.get("industry_tags"):
            parts.append(f"行业: {', '.join(jd['industry_tags'])}")

        return "\n".join(parts) if parts else "（无 JD 分析数据）"
