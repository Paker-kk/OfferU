# =============================================
# Profile 路由 — 个人档案与对话引导 API
# =============================================
# GET    /api/profile/                     获取默认档案
# PUT    /api/profile/                     更新档案主信息
# GET    /api/profile/target-roles         获取目标岗位
# POST   /api/profile/target-roles         创建目标岗位
# DELETE /api/profile/target-roles/{id}    删除目标岗位
# POST   /api/profile/sections             手动新增条目
# PUT    /api/profile/sections/{id}        更新条目
# DELETE /api/profile/sections/{id}        删除条目
# POST   /api/profile/chat                 SSE 对话引导并产出 bullet 候选
# GET    /api/profile/chat/sessions        会话列表
# GET    /api/profile/chat/sessions/{id}   会话详情
# POST   /api/profile/chat/confirm         确认候选并入库
# POST   /api/profile/import-resume        上传简历并提取候选条目
# POST   /api/profile/generate-narrative   生成叙事字段
# =============================================

import json
from typing import Any, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.agents.llm import chat_completion, extract_json
from app.database import get_db
from app.models.models import (
    Profile,
    ProfileChatSession,
    ProfileSection,
    ProfileTargetRole,
)
from app.services.profile_schema import (
    PROFILE_BUILTIN_SECTION_TYPES,
    canonicalize_profile_section_payload,
    get_category_label,
    is_custom_category_key,
    is_valid_profile_section_type,
    normalize_base_info_payload,
    normalize_section_type_alias,
)

router = APIRouter()

VALID_TOPICS = {"education", "experience", "project", "activity", "skill", "general"}
VALID_FITS = {"primary", "secondary", "adjacent"}
VALID_SECTION_TYPES = set(PROFILE_BUILTIN_SECTION_TYPES).union(
    {"general", "custom", "internship", "activity", "competition", "honor", "language"}
)
PROFILE_CATEGORY_ORDER = ["education", "experience", "project", "skill", "certificate"]
ALLOWED_RESUME_IMPORT_EXTENSIONS = {".pdf", ".docx"}
MAX_RESUME_IMPORT_FILE_SIZE = 10 * 1024 * 1024


class ProfileUpdateRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    headline: Optional[str] = Field(default=None, max_length=300)
    exit_story: Optional[str] = None
    cross_cutting_advantage: Optional[str] = None
    base_info_json: Optional[dict] = None


class TargetRoleCreateRequest(BaseModel):
    role_name: str = Field(..., min_length=1, max_length=120)
    role_level: str = Field(default="", max_length=60)
    fit: str = Field(default="primary")


class ProfileSectionCreateRequest(BaseModel):
    section_type: str = Field(..., min_length=1, max_length=60)
    category_label: Optional[str] = Field(default=None, max_length=80)
    title: str = Field(default="", max_length=220)
    sort_order: int = 0
    content_json: dict = Field(default_factory=dict)
    source: str = Field(default="manual", max_length=30)
    confidence: float = Field(default=1.0, ge=0, le=1)


class ProfileSectionUpdateRequest(BaseModel):
    section_type: Optional[str] = Field(default=None, min_length=1, max_length=60)
    category_label: Optional[str] = Field(default=None, max_length=80)
    title: Optional[str] = Field(default=None, max_length=220)
    sort_order: Optional[int] = None
    content_json: Optional[dict] = None
    source: Optional[str] = Field(default=None, max_length=30)
    confidence: Optional[float] = Field(default=None, ge=0, le=1)


class ProfileChatRequest(BaseModel):
    topic: str = Field(default="general")
    message: str = Field(..., min_length=1)
    session_id: Optional[int] = None


class ProfileChatConfirmRequest(BaseModel):
    session_id: int
    bullet_index: int = Field(..., ge=0)
    edits: Optional[dict] = None


def _serialize_target_role(role: ProfileTargetRole) -> dict:
    return {
        "id": role.id,
        "profile_id": role.profile_id,
        "role_name": role.role_name,
        "role_level": role.role_level,
        "fit": role.fit,
        "created_at": str(role.created_at),
    }


def _serialize_section(section: ProfileSection) -> dict:
    content_json = section.content_json if isinstance(section.content_json, dict) else {}
    category_key = normalize_section_type_alias(section.section_type)
    if category_key in {"general", "activity", "competition"} or not is_valid_profile_section_type(category_key):
        category_key = "custom:c_legacy"
    category_label = get_category_label(category_key, content_json)
    field_values = content_json.get("field_values") if isinstance(content_json.get("field_values"), dict) else {}
    normalized = content_json.get("normalized") if isinstance(content_json.get("normalized"), dict) else {}

    return {
        "id": section.id,
        "profile_id": section.profile_id,
        "section_type": category_key,
        "raw_section_type": section.section_type,
        "category_key": category_key,
        "category_label": category_label,
        "is_custom_category": is_custom_category_key(category_key),
        "parent_id": section.parent_id,
        "title": section.title,
        "sort_order": section.sort_order,
        "content_json": content_json,
        "field_values": field_values,
        "normalized": normalized,
        "source": section.source,
        "confidence": section.confidence,
        "created_at": str(section.created_at),
        "updated_at": str(section.updated_at),
    }


def _serialize_profile(profile: Profile, roles: list[ProfileTargetRole], sections: list[ProfileSection]) -> dict:
    base_info_json = normalize_base_info_payload(profile.base_info_json)
    return {
        "id": profile.id,
        "name": profile.name,
        "headline": profile.headline,
        "exit_story": profile.exit_story,
        "cross_cutting_advantage": profile.cross_cutting_advantage,
        "base_info_json": base_info_json,
        "is_default": profile.is_default,
        "created_at": str(profile.created_at),
        "updated_at": str(profile.updated_at),
        "target_roles": [_serialize_target_role(item) for item in roles],
        "sections": [_serialize_section(item) for item in sections],
    }


def _serialize_chat_session(session: ProfileChatSession) -> dict:
    return {
        "id": session.id,
        "profile_id": session.profile_id,
        "topic": session.topic,
        "status": session.status,
        "extracted_bullets_count": session.extracted_bullets_count,
        "created_at": str(session.created_at),
        "updated_at": str(session.updated_at),
    }


def _sse(event: str, payload: dict[str, Any]) -> str:
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _extract_last_candidates(messages_json: list[Any]) -> list[dict[str, Any]]:
    for item in reversed(messages_json or []):
        if isinstance(item, dict) and item.get("kind") == "bullet_candidates":
            candidates = item.get("candidates")
            if isinstance(candidates, list):
                return candidates
    return []


async def _get_or_create_default_profile(db: AsyncSession) -> Profile:
    existing = (
        await db.execute(
            select(Profile).where(Profile.is_default == True).order_by(Profile.id.asc())
        )
    ).scalars().first()
    if existing:
        return existing

    profile = Profile(
        name="默认档案",
        is_default=True,
        base_info_json=normalize_base_info_payload({"name": ""}),
    )
    db.add(profile)
    await db.flush()
    return profile


async def _load_profile_bundle(db: AsyncSession, profile_id: int) -> tuple[Profile, list[ProfileTargetRole], list[ProfileSection]]:
    profile = (
        await db.execute(select(Profile).where(Profile.id == profile_id))
    ).scalar_one_or_none()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")

    roles = (
        await db.execute(
            select(ProfileTargetRole)
            .where(ProfileTargetRole.profile_id == profile_id)
            .order_by(ProfileTargetRole.created_at.desc())
        )
    ).scalars().all()

    sections = (
        await db.execute(
            select(ProfileSection)
            .where(ProfileSection.profile_id == profile_id)
            .order_by(ProfileSection.sort_order.asc(), ProfileSection.created_at.asc())
        )
    ).scalars().all()

    return profile, roles, sections


def _normalize_candidate(topic: str, candidate: dict[str, Any]) -> dict[str, Any]:
    raw_section_type = (candidate.get("section_type") or topic or "general").strip().lower()
    section_type = normalize_section_type_alias(raw_section_type)
    category_label: Optional[str] = None

    if section_type in {"general", "activity", "competition"}:
        section_type = "custom"
        category_label = "自定义分类"

    if not is_valid_profile_section_type(section_type):
        section_type = "custom"
        category_label = "自定义分类"

    title = (candidate.get("title") or "未命名条目").strip()[:220]
    content_json = candidate.get("content_json")
    if not isinstance(content_json, dict):
        raw = str(candidate.get("content") or candidate.get("bullet") or "").strip()
        content_json = {"bullet": raw}

    try:
        category_key, resolved_label, _, canonical_content_json = canonicalize_profile_section_payload(
            section_type=section_type,
            category_label=category_label,
            title=title,
            raw_content_json=content_json,
        )
    except ValueError:
        category_key, resolved_label, _, canonical_content_json = canonicalize_profile_section_payload(
            section_type="custom",
            category_label="自定义分类",
            title=title,
            raw_content_json=content_json,
        )

    confidence = candidate.get("confidence", 0.7)
    try:
        confidence = float(confidence)
    except Exception:
        confidence = 0.7
    confidence = min(max(confidence, 0.0), 1.0)

    return {
        "section_type": category_key,
        "category_label": resolved_label,
        "title": title,
        "content_json": canonical_content_json,
        "confidence": confidence,
    }


def _fallback_chat_payload(topic: str, user_message: str) -> dict[str, Any]:
    normalized_topic = normalize_section_type_alias(topic)
    if normalized_topic in {"general", "activity", "competition"}:
        normalized_topic = "custom"
    if not is_valid_profile_section_type(normalized_topic):
        normalized_topic = "custom"

    return {
        "assistant_message": "我先帮你整理出一条可确认的档案条目，你可以直接编辑后确认入库。",
        "bullet_candidates": [
            {
                "section_type": normalized_topic,
                "title": "待确认经历条目",
                "content_json": {"bullet": user_message.strip()},
                "confidence": 0.6,
            }
        ],
        "topic_complete": False,
    }


async def _generate_chat_payload(topic: str, user_message: str) -> dict[str, Any]:
    prompt = (
        "你是求职档案构建助手。"
        "请根据用户输入，输出严格 JSON，不要输出其他文字。"
        "JSON 格式: {\"assistant_message\": string, \"bullet_candidates\": "
        "[{\"section_type\": string, \"title\": string, \"content_json\": object, \"confidence\": number}],"
        "\"topic_complete\": boolean}."
        "要求: 1) 不得编造事实；2) 候选条目 1-3 条；3) confidence 在 0-1。"
    )

    try:
        llm_result = await chat_completion(
            messages=[
                {"role": "system", "content": prompt},
                {
                    "role": "user",
                    "content": f"topic={topic}\nuser_input={user_message}",
                },
            ],
            temperature=0.2,
            json_mode=True,
            max_tokens=1000,
        )
    except Exception:
        return _fallback_chat_payload(topic, user_message)

    parsed = extract_json(llm_result or "")
    if not isinstance(parsed, dict):
        return _fallback_chat_payload(topic, user_message)

    assistant_message = str(parsed.get("assistant_message") or "我已整理候选条目，请确认。")
    raw_candidates = parsed.get("bullet_candidates")
    if not isinstance(raw_candidates, list) or len(raw_candidates) == 0:
        return _fallback_chat_payload(topic, user_message)

    candidates = [_normalize_candidate(topic, item) for item in raw_candidates[:3] if isinstance(item, dict)]
    if not candidates:
        return _fallback_chat_payload(topic, user_message)

    return {
        "assistant_message": assistant_message,
        "bullet_candidates": candidates,
        "topic_complete": bool(parsed.get("topic_complete", False)),
    }


def _fallback_resume_candidates(resume_text: str) -> list[dict[str, Any]]:
    lines: list[str] = []
    seen: set[str] = set()
    for raw in (resume_text or "").splitlines():
        line = raw.strip().lstrip("-*• ").strip()
        if len(line) < 10:
            continue
        key = line.lower()
        if key in seen:
            continue
        seen.add(key)
        lines.append(line)
        if len(lines) >= 8:
            break

    if not lines and (resume_text or "").strip():
        snippet = " ".join((resume_text or "").split())
        lines = [snippet[:180]]

    candidates = []
    for idx, line in enumerate(lines):
        candidates.append(
            _normalize_candidate(
                "custom",
                {
                    "section_type": "custom",
                    "title": f"导入经历条目 {idx + 1}",
                    "content_json": {"bullet": line},
                    "confidence": 0.55,
                },
            )
        )
    return candidates


async def _extract_resume_candidates(resume_text: str) -> list[dict[str, Any]]:
    prompt = (
        "你是求职档案结构化助手。"
        "请从简历文本中抽取 3-12 条可入库的事实 bullet，并输出严格 JSON。"
        "JSON 格式: {\"bullets\": ["
        "{\"section_type\": string, \"title\": string, \"content_json\": object, \"confidence\": number}]}."
        "section_type 仅允许 education/experience/project/activity/skill/certificate/honor/language/general。"
        "要求: 1) 只改写不编造；2) confidence 在 0-1；3) 内容尽量可量化。"
    )

    try:
        llm_result = await chat_completion(
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": resume_text[:12000]},
            ],
            temperature=0.2,
            json_mode=True,
            max_tokens=1800,
        )
        parsed = extract_json(llm_result or "")
    except Exception:
        parsed = None

    if not isinstance(parsed, dict):
        return _fallback_resume_candidates(resume_text)

    raw_candidates = parsed.get("bullets")
    if not isinstance(raw_candidates, list) or len(raw_candidates) == 0:
        raw_candidates = parsed.get("bullet_candidates")

    if not isinstance(raw_candidates, list) or len(raw_candidates) == 0:
        return _fallback_resume_candidates(resume_text)

    candidates = [
        _normalize_candidate("general", item)
        for item in raw_candidates[:12]
        if isinstance(item, dict)
    ]
    if not candidates:
        return _fallback_resume_candidates(resume_text)
    return candidates


@router.get("/")
async def get_profile(db: AsyncSession = Depends(get_db)):
    profile = await _get_or_create_default_profile(db)
    normalized_base_info = normalize_base_info_payload(profile.base_info_json)
    if profile.base_info_json != normalized_base_info:
        profile.base_info_json = normalized_base_info
    await db.commit()

    profile, roles, sections = await _load_profile_bundle(db, profile.id)
    return _serialize_profile(profile, roles, sections)


@router.get("/categories")
async def list_profile_categories(db: AsyncSession = Depends(get_db)):
    profile = await _get_or_create_default_profile(db)
    sections = (
        await db.execute(
            select(ProfileSection)
            .where(ProfileSection.profile_id == profile.id)
            .order_by(ProfileSection.updated_at.desc(), ProfileSection.id.desc())
        )
    ).scalars().all()

    custom_map: dict[str, str] = {}
    for section in sections:
        category_key = normalize_section_type_alias(section.section_type)
        if category_key in {"general", "activity", "competition"} or not is_valid_profile_section_type(category_key):
            category_key = "custom:c_legacy"
        if category_key in PROFILE_BUILTIN_SECTION_TYPES:
            continue
        if not is_custom_category_key(category_key):
            continue
        if category_key in custom_map:
            continue
        content_json = section.content_json if isinstance(section.content_json, dict) else {}
        custom_map[category_key] = get_category_label(category_key, content_json)

    builtin = [
        {
            "key": key,
            "label": get_category_label(key),
            "is_custom": False,
        }
        for key in PROFILE_CATEGORY_ORDER
    ]
    custom = [
        {"key": key, "label": label, "is_custom": True}
        for key, label in sorted(custom_map.items(), key=lambda item: item[1])
    ]

    return {
        "builtin": builtin,
        "custom": custom,
        "all": [*builtin, *custom],
    }


@router.put("/")
async def update_profile(data: ProfileUpdateRequest, db: AsyncSession = Depends(get_db)):
    profile = await _get_or_create_default_profile(db)

    payload = data.model_dump(exclude_none=True)
    if "base_info_json" in payload:
        payload["base_info_json"] = normalize_base_info_payload(payload["base_info_json"])

    for key, value in payload.items():
        setattr(profile, key, value)

    await db.commit()
    await db.refresh(profile)

    profile, roles, sections = await _load_profile_bundle(db, profile.id)
    return _serialize_profile(profile, roles, sections)


@router.get("/target-roles")
async def list_target_roles(db: AsyncSession = Depends(get_db)):
    profile = await _get_or_create_default_profile(db)
    roles = (
        await db.execute(
            select(ProfileTargetRole)
            .where(ProfileTargetRole.profile_id == profile.id)
            .order_by(ProfileTargetRole.created_at.desc())
        )
    ).scalars().all()
    await db.commit()
    return [_serialize_target_role(item) for item in roles]


@router.post("/target-roles")
async def create_target_role(data: TargetRoleCreateRequest, db: AsyncSession = Depends(get_db)):
    fit = data.fit.strip().lower()
    if fit not in VALID_FITS:
        raise HTTPException(status_code=400, detail="fit must be primary/secondary/adjacent")

    profile = await _get_or_create_default_profile(db)

    role = ProfileTargetRole(
        profile_id=profile.id,
        role_name=data.role_name.strip(),
        role_level=data.role_level.strip(),
        fit=fit,
    )
    db.add(role)
    await db.commit()
    await db.refresh(role)
    return _serialize_target_role(role)


@router.delete("/target-roles/{role_id}")
async def delete_target_role(role_id: int, db: AsyncSession = Depends(get_db)):
    profile = await _get_or_create_default_profile(db)
    role = (
        await db.execute(
            select(ProfileTargetRole).where(
                ProfileTargetRole.id == role_id,
                ProfileTargetRole.profile_id == profile.id,
            )
        )
    ).scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Target role not found")

    await db.delete(role)
    await db.commit()
    return {"deleted": True}


@router.post("/sections")
async def create_profile_section(data: ProfileSectionCreateRequest, db: AsyncSession = Depends(get_db)):
    profile = await _get_or_create_default_profile(db)

    try:
        normalized_section_type = normalize_section_type_alias(data.section_type)
        if normalized_section_type in {"general", "activity", "competition"}:
            normalized_section_type = "custom"
        if not is_valid_profile_section_type(normalized_section_type):
            normalized_section_type = "custom"

        section_type, _, _, canonical_content_json = canonicalize_profile_section_payload(
            section_type=normalized_section_type,
            category_label=data.category_label,
            title=data.title.strip(),
            raw_content_json=data.content_json,
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="invalid section_type")

    sort_order = data.sort_order
    if sort_order <= 0:
        max_sort = (
            await db.execute(
                select(func.max(ProfileSection.sort_order)).where(ProfileSection.profile_id == profile.id)
            )
        ).scalar()
        sort_order = int(max_sort or 0) + 1

    section = ProfileSection(
        profile_id=profile.id,
        section_type=section_type,
        title=data.title.strip() or get_category_label(section_type, canonical_content_json),
        sort_order=sort_order,
        content_json=canonical_content_json,
        source=data.source,
        confidence=data.confidence,
    )
    db.add(section)
    await db.commit()
    await db.refresh(section)
    return _serialize_section(section)


@router.put("/sections/{section_id}")
async def update_profile_section(
    section_id: int,
    data: ProfileSectionUpdateRequest,
    db: AsyncSession = Depends(get_db),
):
    profile = await _get_or_create_default_profile(db)

    section = (
        await db.execute(
            select(ProfileSection).where(
                ProfileSection.id == section_id,
                ProfileSection.profile_id == profile.id,
            )
        )
    ).scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=404, detail="Profile section not found")

    payload = data.model_dump(exclude_none=True)

    next_section_type = normalize_section_type_alias(str(payload.get("section_type") or section.section_type))
    if next_section_type in {"general", "activity", "competition"}:
        next_section_type = "custom"
    if not is_valid_profile_section_type(next_section_type):
        next_section_type = "custom"
    next_title = str(payload.get("title") or section.title or "").strip()
    next_content_json = payload.get("content_json") if "content_json" in payload else section.content_json
    next_category_label = payload.get("category_label")

    try:
        resolved_section_type, _, _, canonical_content_json = canonicalize_profile_section_payload(
            section_type=next_section_type,
            category_label=next_category_label,
            title=next_title,
            raw_content_json=next_content_json,
        )
    except ValueError:
        raise HTTPException(status_code=400, detail="invalid section_type")

    if not next_title:
        next_title = get_category_label(resolved_section_type, canonical_content_json)

    section.section_type = resolved_section_type
    section.title = next_title
    section.content_json = canonical_content_json

    if "sort_order" in payload and payload["sort_order"] is not None:
        section.sort_order = int(payload["sort_order"])
    if "source" in payload and payload["source"] is not None:
        section.source = str(payload["source"])
    if "confidence" in payload and payload["confidence"] is not None:
        section.confidence = float(payload["confidence"])

    await db.commit()
    await db.refresh(section)
    return _serialize_section(section)


@router.delete("/sections/{section_id}")
async def delete_profile_section(section_id: int, db: AsyncSession = Depends(get_db)):
    profile = await _get_or_create_default_profile(db)

    section = (
        await db.execute(
            select(ProfileSection).where(
                ProfileSection.id == section_id,
                ProfileSection.profile_id == profile.id,
            )
        )
    ).scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=404, detail="Profile section not found")

    await db.delete(section)
    await db.commit()
    return {"deleted": True}


@router.post("/chat")
async def profile_chat(data: ProfileChatRequest, db: AsyncSession = Depends(get_db)):
    topic = data.topic.strip().lower()
    if topic not in VALID_TOPICS:
        raise HTTPException(status_code=400, detail="invalid topic")

    user_message = data.message.strip()
    if not user_message:
        raise HTTPException(status_code=400, detail="message is required")

    async def event_stream():
        try:
            profile = await _get_or_create_default_profile(db)

            if data.session_id is not None:
                session = (
                    await db.execute(
                        select(ProfileChatSession).where(
                            ProfileChatSession.id == data.session_id,
                            ProfileChatSession.profile_id == profile.id,
                        )
                    )
                ).scalar_one_or_none()
                if not session:
                    yield _sse("error", {"message": "chat session not found"})
                    return
            else:
                session = ProfileChatSession(
                    profile_id=profile.id,
                    topic=topic,
                    status="active",
                    messages_json=[],
                    extracted_bullets_count=0,
                )
                db.add(session)
                await db.flush()
                await db.commit()

            messages_json = list(session.messages_json or [])
            messages_json.append({"role": "user", "topic": topic, "content": user_message})

            payload = await _generate_chat_payload(topic, user_message)
            assistant_message = payload["assistant_message"]
            candidates = payload["bullet_candidates"]
            topic_complete = bool(payload.get("topic_complete", False))

            messages_json.append({"role": "assistant", "topic": topic, "content": assistant_message})
            messages_json.append({"kind": "bullet_candidates", "topic": topic, "candidates": candidates})

            session.topic = topic
            session.messages_json = messages_json
            session.extracted_bullets_count = int(session.extracted_bullets_count or 0) + len(candidates)

            await db.commit()

            yield _sse("ai_message", {"content": assistant_message, "session_id": session.id})
            for idx, candidate in enumerate(candidates):
                event_payload = {"index": idx, "session_id": session.id, **candidate}
                yield _sse("bullet_candidate", event_payload)

            if topic_complete:
                yield _sse("topic_complete", {"topic": topic, "bullets_extracted": len(candidates)})

            yield _sse("done", {"session_id": session.id})
        except Exception:
            await db.rollback()
            yield _sse("error", {"message": "profile chat failed"})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/chat/sessions")
async def list_profile_chat_sessions(
    limit: int = Query(default=20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    profile = await _get_or_create_default_profile(db)
    sessions = (
        await db.execute(
            select(ProfileChatSession)
            .where(ProfileChatSession.profile_id == profile.id)
            .order_by(ProfileChatSession.updated_at.desc(), ProfileChatSession.id.desc())
            .limit(limit)
        )
    ).scalars().all()
    await db.commit()
    return [_serialize_chat_session(item) for item in sessions]


@router.get("/chat/sessions/{session_id}")
async def get_profile_chat_session(session_id: int, db: AsyncSession = Depends(get_db)):
    profile = await _get_or_create_default_profile(db)
    session = (
        await db.execute(
            select(ProfileChatSession).where(
                ProfileChatSession.id == session_id,
                ProfileChatSession.profile_id == profile.id,
            )
        )
    ).scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="chat session not found")

    messages_json = list(session.messages_json or [])
    return {
        **_serialize_chat_session(session),
        "messages_json": messages_json,
        "latest_candidates": _extract_last_candidates(messages_json),
    }


@router.post("/chat/confirm")
async def confirm_profile_bullet(data: ProfileChatConfirmRequest, db: AsyncSession = Depends(get_db)):
    profile = await _get_or_create_default_profile(db)

    session = (
        await db.execute(
            select(ProfileChatSession).where(
                ProfileChatSession.id == data.session_id,
                ProfileChatSession.profile_id == profile.id,
            )
        )
    ).scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="chat session not found")

    candidates = _extract_last_candidates(session.messages_json or [])
    if data.bullet_index >= len(candidates):
        raise HTTPException(status_code=400, detail="bullet_index out of range")

    candidate = dict(candidates[data.bullet_index])
    if data.edits:
        for key in ("section_type", "title", "content_json", "confidence"):
            if key in data.edits:
                candidate[key] = data.edits[key]

    candidate = _normalize_candidate(session.topic or "general", candidate)

    # 幂等保护：同一档案下若已存在同类型+同标题+同内容条目，则直接返回，避免重复入库
    existing_sections = (
        await db.execute(
            select(ProfileSection)
            .where(
                ProfileSection.profile_id == profile.id,
                ProfileSection.section_type == candidate["section_type"],
                ProfileSection.title == candidate["title"],
            )
            .order_by(ProfileSection.id.desc())
        )
    ).scalars().all()
    for existing in existing_sections:
        if (existing.content_json or {}) == candidate["content_json"]:
            return _serialize_section(existing)

    max_sort = (
        await db.execute(
            select(func.max(ProfileSection.sort_order)).where(ProfileSection.profile_id == profile.id)
        )
    ).scalar()
    next_sort = int(max_sort or 0) + 1

    section = ProfileSection(
        profile_id=profile.id,
        section_type=candidate["section_type"],
        title=candidate["title"],
        sort_order=next_sort,
        content_json=candidate["content_json"],
        source="ai_chat",
        confidence=candidate["confidence"],
    )
    db.add(section)
    await db.commit()
    await db.refresh(section)

    return _serialize_section(section)


@router.post("/import-resume")
async def import_profile_resume(file: UploadFile = File(...), db: AsyncSession = Depends(get_db)):
    if not file.filename:
        raise HTTPException(status_code=400, detail="missing filename")

    filename = file.filename.strip()
    lower = filename.lower()
    if not any(lower.endswith(ext) for ext in ALLOWED_RESUME_IMPORT_EXTENSIONS):
        raise HTTPException(status_code=400, detail="unsupported file type, only .pdf/.docx")

    file_bytes = await file.read()
    if not file_bytes:
        raise HTTPException(status_code=400, detail="empty file")
    if len(file_bytes) > MAX_RESUME_IMPORT_FILE_SIZE:
        raise HTTPException(status_code=400, detail="file too large (max 10MB)")

    from app.services.resume_parser import parse_resume_file

    parsed_text = await parse_resume_file(filename, file_bytes)
    if not parsed_text or not parsed_text.strip():
        raise HTTPException(status_code=400, detail="resume text is empty")

    profile = await _get_or_create_default_profile(db)
    candidates = await _extract_resume_candidates(parsed_text)

    session = ProfileChatSession(
        profile_id=profile.id,
        topic="general",
        status="completed",
        messages_json=[
            {
                "role": "assistant",
                "topic": "general",
                "content": "已从上传简历中提取候选条目，请逐条确认后入库。",
            },
            {
                "kind": "resume_import_meta",
                "filename": filename,
                "text_length": len(parsed_text),
            },
            {
                "kind": "bullet_candidates",
                "topic": "general",
                "candidates": candidates,
            },
        ],
        extracted_bullets_count=len(candidates),
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    bullets = [
        {
            "index": idx,
            "session_id": session.id,
            **candidate,
        }
        for idx, candidate in enumerate(candidates)
    ]

    return {
        "session_id": session.id,
        "filename": filename,
        "text_length": len(parsed_text),
        "bullets": bullets,
    }


@router.post("/generate-narrative")
async def generate_narrative(db: AsyncSession = Depends(get_db)):
    profile = await _get_or_create_default_profile(db)
    sections = (
        await db.execute(
            select(ProfileSection)
            .where(ProfileSection.profile_id == profile.id)
            .order_by(ProfileSection.sort_order.asc(), ProfileSection.created_at.asc())
        )
    ).scalars().all()

    section_texts = []
    for item in sections[:30]:
        section_texts.append(f"[{item.section_type}] {item.title} {json.dumps(item.content_json, ensure_ascii=False)}")

    context_text = "\n".join(section_texts) if section_texts else "暂无条目"

    prompt = (
        "你是求职档案叙事助手。根据给定档案条目，生成严格 JSON: "
        "{\"headline\": string, \"exit_story\": string, \"cross_cutting_advantage\": string}。"
        "不要编造事实，措辞简洁。"
    )

    try:
        llm_result = await chat_completion(
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": context_text},
            ],
            temperature=0.3,
            json_mode=True,
            max_tokens=800,
        )
        parsed = extract_json(llm_result or "")
    except Exception:
        parsed = None
    if not isinstance(parsed, dict):
        parsed = {
            "headline": profile.headline or "正在构建中的求职者",
            "exit_story": profile.exit_story or "基于现有经历，持续补全并打磨个人叙事。",
            "cross_cutting_advantage": profile.cross_cutting_advantage or "学习快、执行稳、可迁移能力强。",
        }

    profile.headline = str(parsed.get("headline") or profile.headline or "")
    profile.exit_story = str(parsed.get("exit_story") or profile.exit_story or "")
    profile.cross_cutting_advantage = str(
        parsed.get("cross_cutting_advantage") or profile.cross_cutting_advantage or ""
    )

    await db.commit()
    await db.refresh(profile)

    return {
        "headline": profile.headline,
        "exit_story": profile.exit_story,
        "cross_cutting_advantage": profile.cross_cutting_advantage,
    }
