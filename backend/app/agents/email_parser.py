# =============================================
# 邮件解析 Agent — 从邮件中提取校招通知
# =============================================
# 使用统一 LLM 接口 (Qwen) 解析邮件，提取：
#   category: 8 种中国校招状态分类
#   company / position / interview_time / location / action_required
# 中文校招链路：网申确认→笔试→测评→一面→二面→HR面→offer→拒信
# =============================================

from __future__ import annotations

import json
from typing import Optional

from app.agents.llm import chat_completion

# ---- 中国校招邮件分类体系 (8 种) ----
# 参考 apply-potato 分类 + 中国化扩展
CAMPUS_CATEGORIES = [
    "application",   # 网申确认
    "written_test",  # 笔试通知
    "assessment",    # 在线测评
    "interview_1",   # 一面（初面/技术面）
    "interview_2",   # 二面（复面/交叉面）
    "interview_hr",  # HR面/终面
    "offer",         # offer / 录用通知
    "rejection",     # 拒信 / 感谢参与
]

# ---- LLM 提示词：中英文校招邮件通用 ----
PARSE_PROMPT = """你是一个专门解析校招邮件的 AI 助手。

请从以下邮件中提取：
1. **category** — 邮件类型，必须是以下 8 种之一：
   - application: 网申确认（"感谢投递"、"简历已收到"、"已成功提交"）
   - written_test: 笔试通知（"笔试"、"在线笔试"、"编程测试"）
   - assessment: 在线测评（"测评"、"性格测试"、"行为测评"、"SHL"、"assessment"）
   - interview_1: 初面/技术面（"一面"、"初面"、"技术面试"、"电话面试"、"视频面试"）
   - interview_2: 复面/交叉面（"二面"、"复面"、"交叉面试"、"现场面试"、"终面"不含HR）
   - interview_hr: HR面/终面（"HR面"、"综合面试"、"终面"含HR或综合）
   - offer: 录用通知（"offer"、"录用"、"录取"、"恭喜"、"入职"）
   - rejection: 拒信（"遗憾"、"感谢参与"、"未通过"、"不合适"、"unfortunately"）
   如果无法确定，返回 "unknown"

2. **company** — 公司名称（如"华为"、"腾讯"、"字节跳动"）
3. **position** — 岗位名称
4. **interview_time** — 面试/笔试/测评时间（ISO 格式 YYYY-MM-DD HH:MM，无法确定则为空）
5. **location** — 地点（"线上"、"视频面试"、"深圳总部"等，无法确定则为空）
6. **action_required** — 需要用户做什么（如"请在XX前确认"、"请点击链接参加笔试"等）

返回严格 JSON（字段不确定时用空字符串）：
{{
  "category": "",
  "company": "",
  "position": "",
  "interview_time": "",
  "location": "",
  "action_required": ""
}}

邮件主题：
{email_subject}

发件人：
{email_from}

邮件正文：
{email_body}"""


async def parse_interview_email(
    email_subject: str,
    email_body: str,
    email_from: str = "",
) -> Optional[dict]:
    """
    用统一 LLM 接口（Qwen）从邮件主题+正文中提取校招通知信息。
    返回:
      { category, company, position, interview_time, location, action_required }
      或 None（LLM 调用失败时）
    """
    prompt = PARSE_PROMPT.format(
        email_subject=email_subject,
        email_from=email_from,
        email_body=email_body[:3000],  # 截断防止 token 过长
    )

    raw = await chat_completion(
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
        json_mode=True,
        max_tokens=500,
        tier="fast",  # 邮件分类不需要高端模型
    )

    if not raw:
        return None

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return None

    # 规范化 category
    cat = data.get("category", "unknown")
    if cat not in CAMPUS_CATEGORIES:
        data["category"] = "unknown"

    return data
