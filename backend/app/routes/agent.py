# =============================================
# OfferU Agent Chat — LLM + MCP Tool 调用编排
# =============================================
# POST /api/agent/chat  (SSE)
# 用户消息 → LLM 判断需要哪些 Tools → 调用 → 组装结果 → 回复
# =============================================

from __future__ import annotations

import json
import traceback
from typing import Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from app.agents.llm import chat_completion, extract_json
from app.database import get_db
from app.mcp_server import (
    get_profile,
    list_pools,
    list_jobs,
    get_job,
    triage_job,
    batch_triage,
    generate_resume,
    list_resumes,
    get_resume,
    list_applications,
    create_application,
    generate_cover_letter,
    job_stats,
)

router = APIRouter()

# ---- MCP Tool Registry (name → callable + schema) ----

TOOL_REGISTRY: dict[str, dict] = {
    "get_profile": {
        "fn": get_profile,
        "description": "获取用户个人资料（基本信息、目标岗位、经历统计）",
        "parameters": {},
    },
    "list_pools": {
        "fn": list_pools,
        "description": "获取岗位池列表",
        "parameters": {},
    },
    "list_jobs": {
        "fn": list_jobs,
        "description": "分页浏览岗位列表，支持筛选",
        "parameters": {
            "triage_status": "str? (unscreened|screened|ignored)",
            "pool_id": "int?",
            "keyword": "str?",
            "page": "int=1",
            "page_size": "int=20",
        },
    },
    "get_job": {
        "fn": get_job,
        "description": "查看单个岗位详情（含完整岗位描述JD）",
        "parameters": {"job_id": "int"},
    },
    "triage_job": {
        "fn": triage_job,
        "description": "将岗位分拣为 screened/ignored，可分配到池",
        "parameters": {"job_id": "int", "status": "str", "pool_id": "int?"},
    },
    "batch_triage": {
        "fn": batch_triage,
        "description": "批量分拣多个岗位",
        "parameters": {"job_ids": "list[int]", "status": "str", "pool_id": "int?"},
    },
    "generate_resume": {
        "fn": generate_resume,
        "description": "为单个岗位AI生成定制简历",
        "parameters": {"job_id": "int", "reference_resume_id": "int?"},
    },
    "list_resumes": {
        "fn": list_resumes,
        "description": "查看所有简历列表（含AI溯源标签）",
        "parameters": {},
    },
    "get_resume": {
        "fn": get_resume,
        "description": "查看简历完整内容",
        "parameters": {"resume_id": "int"},
    },
    "list_applications": {
        "fn": list_applications,
        "description": "查看投递记录列表",
        "parameters": {"status": "str?", "page": "int=1"},
    },
    "create_application": {
        "fn": create_application,
        "description": "为岗位创建投递记录",
        "parameters": {"job_id": "int", "notes": "str?"},
    },
    "generate_cover_letter": {
        "fn": generate_cover_letter,
        "description": "为岗位和简历AI生成求职信",
        "parameters": {"job_id": "int", "resume_id": "int"},
    },
    "job_stats": {
        "fn": job_stats,
        "description": "获取岗位统计数据",
        "parameters": {},
    },
}

# ---- Build Tool descriptions for LLM system prompt ----

def _build_tools_description() -> str:
    lines = []
    for name, info in TOOL_REGISTRY.items():
        params = info["parameters"]
        param_str = ", ".join(f"{k}: {v}" for k, v in params.items()) if params else "无参数"
        lines.append(f"- {name}({param_str}): {info['description']}")
    return "\n".join(lines)


SYSTEM_PROMPT = f"""你是 OfferU AI 助手，帮助中国文科生校招求职。你可以调用以下工具完成用户请求：

{_build_tools_description()}

工作流程：
1. 理解用户意图
2. 决定需要调用哪些工具（可以多步）
3. 返回 JSON 格式的工具调用指令

如果需要调用工具，返回：
{{"action": "tool_call", "tool": "工具名", "args": {{参数字典}}}}

如果需要连续调用多个工具，返回：
{{"action": "multi_tool", "calls": [{{"tool": "工具名1", "args": {{...}}}}, {{"tool": "工具名2", "args": {{...}}}}]}}

如果可以直接回答（不需要工具），返回：
{{"action": "reply", "message": "你的回答"}}

注意：
- 始终返回合法 JSON
- 参数类型要匹配（int 不要传 string）
- 如果用户要求模糊，先用查询工具获取信息再行动
- 回复使用中文，语气亲切自然"""


class ChatMessage(BaseModel):
    role: str  # user / assistant / system
    content: str


class AgentChatRequest(BaseModel):
    messages: list[ChatMessage]


@router.post("/chat")
async def agent_chat(body: AgentChatRequest):
    """Agent chat endpoint — SSE stream"""

    async def event_generator():
        messages = [{"role": "system", "content": SYSTEM_PROMPT}]
        for m in body.messages:
            messages.append({"role": m.role, "content": m.content})

        max_rounds = 5  # 防止无限循环
        for round_idx in range(max_rounds):
            # 调用 LLM 获取决策
            yield {"event": "thinking", "data": json.dumps(
                {"round": round_idx + 1, "status": "thinking"},
                ensure_ascii=False
            )}

            llm_response = await chat_completion(
                messages=messages,
                temperature=0.3,
                json_mode=True,
                max_tokens=2048,
                tier="standard",
            )

            if not llm_response:
                yield {"event": "message", "data": json.dumps(
                    {"content": "抱歉，AI 暂时无法响应，请稍后重试。"},
                    ensure_ascii=False
                )}
                return

            # 解析 LLM 输出
            parsed = extract_json(llm_response)
            if not parsed:
                # LLM 直接返回文本
                yield {"event": "message", "data": json.dumps(
                    {"content": llm_response},
                    ensure_ascii=False
                )}
                return

            action = parsed.get("action", "reply")

            if action == "reply":
                yield {"event": "message", "data": json.dumps(
                    {"content": parsed.get("message", llm_response)},
                    ensure_ascii=False
                )}
                return

            elif action == "tool_call":
                tool_name = parsed.get("tool", "")
                tool_args = parsed.get("args", {})
                result = await _execute_tool(tool_name, tool_args)

                yield {"event": "tool_call", "data": json.dumps(
                    {"tool": tool_name, "args": tool_args, "result": result},
                    ensure_ascii=False
                )}

                # 把工具结果追加到消息历史，让 LLM 基于结果回复
                messages.append({"role": "assistant", "content": llm_response})
                messages.append({"role": "user", "content": f"工具 {tool_name} 返回结果：\n{json.dumps(result, ensure_ascii=False)[:3000]}\n\n请根据工具结果回复用户。"})

            elif action == "multi_tool":
                calls = parsed.get("calls", [])
                all_results = []
                for call in calls:
                    tn = call.get("tool", "")
                    ta = call.get("args", {})
                    r = await _execute_tool(tn, ta)
                    all_results.append({"tool": tn, "result": r})

                    yield {"event": "tool_call", "data": json.dumps(
                        {"tool": tn, "args": ta, "result": r},
                        ensure_ascii=False
                    )}

                messages.append({"role": "assistant", "content": llm_response})
                summary = json.dumps(all_results, ensure_ascii=False)[:4000]
                messages.append({"role": "user", "content": f"工具调用结果：\n{summary}\n\n请根据结果综合回复用户。"})

            else:
                yield {"event": "message", "data": json.dumps(
                    {"content": parsed.get("message", llm_response)},
                    ensure_ascii=False
                )}
                return

        # max_rounds reached
        yield {"event": "message", "data": json.dumps(
            {"content": "操作完成。如需进一步帮助请继续提问。"},
            ensure_ascii=False
        )}

    return EventSourceResponse(event_generator())


async def _execute_tool(tool_name: str, args: dict) -> dict:
    """执行 MCP Tool"""
    if tool_name not in TOOL_REGISTRY:
        return {"error": f"未知工具: {tool_name}"}

    fn = TOOL_REGISTRY[tool_name]["fn"]
    try:
        # 过滤掉 None 值参数
        clean_args = {k: v for k, v in args.items() if v is not None}
        result = await fn(**clean_args)
        return result
    except Exception as e:
        return {"error": str(e)}
