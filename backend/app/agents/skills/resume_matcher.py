# =============================================
# Skill 2: 简历-JD 匹配分析器 (resume_matcher)
# =============================================
# 功能:
#   将简历内容与 Skill 1 的 JD 分析结果对比:
#   - ATS 关键词匹配度评分 (0-100)
#   - 逐段匹配分析（哪段强/哪段弱）
#   - 缺失技能清单
#   - ATS 风险检测（校招减分项）
#
# 核心逻辑:
#   先用本地 NLP（正则+集合运算）做初步匹配，
#   再用 LLM 做语义级别的深度分析:
#   - "熟悉 FastAPI" vs JD 要求 "Python Web框架" → 语义匹配
#   - "参与xx项目" 缺少量化数据 → 改进建议
#
# 校招专精:
#   - 无工作经验不扣分，但实习/项目经历匹配度权重高
#   - 检测校招减分项: 照片过大/简历超1页/无联系方式/没有GPA
#
# 输出 Schema:
#   {
#     "ats_score": 72,
#     "matched_skills": ["Python", "React", ...],
#     "missing_skills": ["Docker", "K8s", ...],
#     "section_scores": [
#       { "title": "技能", "score": 85, "feedback": "..." },
#       { "title": "项目经历", "score": 60, "feedback": "..." }
#     ],
#     "risk_items": [
#       { "type": "no_gpa", "severity": "medium", "message": "..." }
#     ],
#     "summary": "整体分析（2-3句话）"
#   }
# =============================================

from app.agents.llm import chat_completion, extract_json
from app.agents.skills.base import BaseSkill

import re


SYSTEM_PROMPT = """你是一名专业的 ATS（申请者追踪系统）分析师，专注于中国校招场景。
你的任务是对比候选人简历与目标岗位要求，给出精准的匹配分析。

## 输入
你会收到:
1. 候选人简历全文
2. 从 JD 中提取的结构化要求（技能、职责等）

## 分析框架

### ATS 匹配评分 (0-100)
评分标准:
- 必须技能匹配: 占 50 分（每个技能等权）
- 加分技能匹配: 占 15 分
- 职责关键词覆盖: 占 20 分
- 经历相关性: 占 15 分

校招特别规则:
- 如果是校招岗位且候选人无全职工作经验，不扣分
- 实习经历等同于相关工作经验
- 课程项目/竞赛获奖/开源贡献 可作为技能佐证

### 逐段分析
对简历的每个主要段落（教育/技能/实习/项目/社团等）:
- 打分 0-100
- 给出 1 句话反馈（中文）

### 校招风险项检测
检查以下常见问题:
- no_contact: 缺少手机号或邮箱
- no_gpa: 缺少 GPA/成绩排名（校招重要）
- too_long: 超过 1 页内容量
- no_quantified: 经历描述没有任何数字/量化
- vague_description: 经历描述过于模糊（如"参与了...""负责了..."）

## 输出要求
返回严格的 JSON:
{
  "ats_score": 72,
  "matched_skills": ["已在简历中出现的JD要求技能"],
  "missing_skills": ["JD要求但简历缺失的技能"],
  "section_scores": [
    {
      "title": "段落标题",
      "score": 85,
      "feedback": "1句话中文反馈"
    }
  ],
  "risk_items": [
    {
      "type": "风险类型标识",
      "severity": "high/medium/low",
      "message": "中文描述"
    }
  ],
  "summary": "整体分析（2-3句话中文，包含总分和核心改进方向）"
}"""


class ResumeMatcherSkill(BaseSkill):
    """简历-JD 匹配分析 — ATS 评分 + 缺口分析 + 风险检测"""

    @property
    def name(self) -> str:
        return "match_analysis"

    async def execute(self, context: dict) -> dict:
        """
        分析简历与 JD 的匹配度

        context 需要:
          - resume_text: 简历纯文本
          - jd_text: JD 原文
          - jd_analysis: Skill 1 的输出（JD 结构化分析）

        返回: ATS 评分 + 逐段分析 + 风险项
        """
        resume_text = context.get("resume_text", "")
        jd_text = context.get("jd_text", "")
        jd_analysis = context.get("jd_analysis", {})

        if not resume_text.strip():
            return {"error": "简历文本为空"}

        # 将 JD 分析结果格式化为 LLM 可读的文本
        jd_summary = self._format_jd_analysis(jd_analysis)

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"## 候选人简历\n\n{resume_text}\n\n"
                    f"## 岗位要求分析\n\n{jd_summary}\n\n"
                    f"## 岗位描述原文\n\n{jd_text}"
                ),
            },
        ]

        raw = await chat_completion(
            messages=messages,
            temperature=0.2,
            json_mode=True,
            max_tokens=3072,
            tier="standard",
        )

        if not raw:
            return {"error": "LLM 调用失败"}

        result = extract_json(raw)
        if not result or "ats_score" not in result:
            return {"error": "LLM 返回格式异常", "raw": raw[:500]}

        return result

    def _format_jd_analysis(self, jd: dict) -> str:
        """将 Skill 1 的 JD 分析结果格式化为可读文本"""
        if not jd or "error" in jd:
            return "（JD 分析不可用）"

        parts = []
        if jd.get("job_title"):
            parts.append(f"岗位: {jd['job_title']}")
        if jd.get("company"):
            parts.append(f"公司: {jd['company']}")
        if jd.get("is_campus") is not None:
            parts.append(f"校招岗: {'是' if jd['is_campus'] else '否'}")
        if jd.get("experience_level"):
            parts.append(f"经验要求: {jd['experience_level']}")
        if jd.get("required_skills"):
            parts.append(f"必须技能: {', '.join(jd['required_skills'])}")
        if jd.get("preferred_skills"):
            parts.append(f"加分技能: {', '.join(jd['preferred_skills'])}")
        if jd.get("responsibilities"):
            parts.append(f"核心职责: {', '.join(jd['responsibilities'])}")
        if jd.get("industry_tags"):
            parts.append(f"行业: {', '.join(jd['industry_tags'])}")

        return "\n".join(parts) if parts else "（无 JD 分析数据）"
