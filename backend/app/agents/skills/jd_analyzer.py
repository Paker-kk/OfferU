# =============================================
# Skill 1: JD 智能解析器 (jd_analyzer)
# =============================================
# 功能:
#   解析岗位描述(JD)文本，提取结构化信息:
#   - 岗位名称、公司名
#   - 必须技能 vs 加分技能
#   - 核心职责关键词
#   - 校招特征检测（是否接受应届/实习/无经验）
#   - 行业标签
#
# 设计决策:
#   1. 独立 LLM 调用，Prompt 专注 JD 解析一件事
#   2. 校招专精: 识别"应届生""实习""0-1年"等信号
#   3. 输出严格 JSON Schema，供下一步 Skill 直接消费
#
# 输出 Schema:
#   {
#     "job_title": "岗位名称",
#     "company": "公司名（如可识别）",
#     "is_campus": true/false,
#     "required_skills": ["Python", "FastAPI", ...],
#     "preferred_skills": ["Docker", "K8s", ...],
#     "responsibilities": ["核心职责关键词1", ...],
#     "experience_level": "应届/1-3年/3-5年/...",
#     "industry_tags": ["互联网", "AI", ...],
#     "culture_keywords": ["创新", "快节奏", ...]
#   }
# =============================================

from app.agents.llm import chat_completion, extract_json
from app.agents.skills.base import BaseSkill


SYSTEM_PROMPT = """你是一名资深校招 HR 分析师。你的唯一任务是解析岗位描述（JD），提取关键信息。

## 提取规则

1. **岗位名称**: 识别 JD 中的正式职位名
2. **公司名**: 如果 JD 中提到公司名就提取，否则返回空字符串
3. **校招标识**: 检测以下信号判断是否校招岗位:
   - 关键词: "应届生""校招""实习""graduate""intern""campus""0-1年""无经验要求"
   - 如果 JD 要求 3年+ 经验，则 is_campus = false
4. **必须技能 vs 加分技能**:
   - "要求""必须""need""require" → required_skills
   - "优先""加分""preferred""nice to have" → preferred_skills
   - 如果无法区分，默认放入 required_skills
5. **核心职责**: 提取 3-5 个职责关键词（非完整句子）
6. **经验等级**: "应届""1-3年""3-5年""5-10年""10年+"
7. **行业标签**: 互联网/AI/金融/电商/游戏/制造/教育等
8. **文化关键词**: 如"扁平化""快节奏""创新""远程"等

## 输出要求
返回严格的 JSON，不要输出其他内容:
{
  "job_title": "字符串",
  "company": "字符串或空",
  "is_campus": true或false,
  "required_skills": ["最多15个"],
  "preferred_skills": ["最多10个"],
  "responsibilities": ["3-5个关键词"],
  "experience_level": "字符串",
  "industry_tags": ["1-3个"],
  "culture_keywords": ["0-5个"]
}"""


class JDAnalyzerSkill(BaseSkill):
    """JD 智能解析 — 从岗位描述中提取结构化信息"""

    @property
    def name(self) -> str:
        return "jd_analysis"

    async def execute(self, context: dict) -> dict:
        """
        解析 JD 文本，提取岗位要求的结构化信息

        context 需要:
          - jd_text: JD 原文

        返回: 结构化的 JD 分析结果
        """
        jd_text = context.get("jd_text", "")
        if not jd_text.strip():
            return {"error": "JD 文本为空"}

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"请分析以下岗位描述:\n\n{jd_text}"},
        ]

        raw = await chat_completion(
            messages=messages,
            temperature=0.1,  # JD 解析需要高确定性
            json_mode=True,
            max_tokens=2048,
            tier="fast",
        )

        if not raw:
            return {"error": "LLM 调用失败"}

        result = extract_json(raw)
        if not result or "required_skills" not in result:
            return {"error": "LLM 返回格式异常", "raw": raw[:500]}

        return result
