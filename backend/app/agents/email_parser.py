# =============================================
# 邮件解析 Agent — 从邮件中提取面试通知
# =============================================
# 输入：邮件正文
# 输出：公司、职位、面试时间、地点
# =============================================

import json
from typing import Optional

from openai import AsyncOpenAI

from app.config import get_settings

PARSE_PROMPT = """You are an AI assistant that extracts interview information from emails.

Given the following email content, extract:
1. Company name
2. Position/role title
3. Interview date and time (ISO format if possible)
4. Interview location (or "online" if virtual)

Return STRICT JSON:
{{
  "company": "",
  "position": "",
  "interview_time": "",
  "location": ""
}}

If any field cannot be determined, use empty string.

Email subject:
{email_subject}

Email body:
{email_body}"""


async def parse_interview_email(email_subject: str, email_body: str) -> Optional[dict]:
    """
    用 LLM 从邮件主题+正文中提取面试信息
    参数：
      email_subject: 邮件主题
      email_body: 邮件正文（纯文本）
    返回：
      { company, position, interview_time, location } 或 None
    """
    settings = get_settings()
    if not settings.openai_api_key:
        return None

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    prompt = PARSE_PROMPT.format(email_subject=email_subject, email_body=email_body[:3000])

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content or ""
    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return None
