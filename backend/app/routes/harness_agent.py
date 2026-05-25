from __future__ import annotations

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.harness_agent import run_harness_agent_turn
from app.services.harness_history import (
    delete_conversation,
    get_conversation,
    list_conversations,
    save_conversation_messages,
)
from app.services.harness_memory import (
    export_agent_memory_markdown,
    import_agent_memory_payload,
    load_agent_memory,
    save_agent_memory,
)

router = APIRouter()


class HarnessAgentMessage(BaseModel):
    role: str
    content: str


class HarnessAgentChatRequest(BaseModel):
    messages: list[HarnessAgentMessage] = Field(default_factory=list)
    confirmed_action_ids: list[str] = Field(default_factory=list)
    memory: dict[str, Any] | None = None
    conversation_id: str | None = None


class HarnessAgentMemoryImportRequest(BaseModel):
    content: dict[str, Any] | str


@router.post("/chat")
async def chat(body: HarnessAgentChatRequest) -> dict[str, Any]:
    response = await run_harness_agent_turn(
        messages=[message.model_dump() for message in body.messages],
        confirmed_action_ids=body.confirmed_action_ids,
        memory=body.memory,
    )
    next_messages = [message.model_dump() for message in body.messages]
    assistant_text = str(response.get("assistant_message") or "").strip()
    if assistant_text:
        next_messages.append({"role": "assistant", "content": assistant_text})
    conversation = save_conversation_messages(
        conversation_id=body.conversation_id,
        messages=next_messages,
    )
    response["conversation_id"] = conversation["id"]
    response["conversation_title"] = conversation["title"]
    return response


@router.get("/conversations")
async def conversations() -> dict[str, Any]:
    return {"conversations": list_conversations()}


@router.get("/conversations/{conversation_id}")
async def conversation_detail(conversation_id: str) -> dict[str, Any]:
    conversation = get_conversation(conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return conversation


@router.delete("/conversations/{conversation_id}")
async def remove_conversation(conversation_id: str) -> dict[str, Any]:
    return {"ok": delete_conversation(conversation_id)}


@router.get("/memory/export")
async def export_memory(format: str = "json") -> dict[str, Any]:
    memory = load_agent_memory()
    if format.lower() in {"md", "markdown"}:
        return {"format": "markdown", "content": export_agent_memory_markdown(memory), "memory": memory}
    return {"format": "json", "content": memory, "memory": memory}


@router.post("/memory/import")
async def import_memory(body: HarnessAgentMemoryImportRequest) -> dict[str, Any]:
    memory = import_agent_memory_payload(body.content)
    saved = save_agent_memory(memory)
    return {"ok": True, "memory": saved}
