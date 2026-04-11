# =============================================
# Profile 路由 — 个人档案 CRUD + AI 对话引导
# =============================================
# PRD v2.1 核心新接口：
#   GET    /api/profile          — 获取 Profile 全量数据
#   PUT    /api/profile          — 更新基础信息 + 叙事字段
#   POST   /api/profile/target-roles     — 新增目标岗位
#   DELETE /api/profile/target-roles/{id} — 删除目标岗位
#   POST   /api/profile/sections         — 手动新增条目
#   PUT    /api/profile/sections/{id}    — 编辑单条 bullet
#   DELETE /api/profile/sections/{id}    — 删除条目
#   POST   /api/profile/chat             — AI 对话引导 SSE ★
#   POST   /api/profile/chat/confirm     — Bullet 确认入库
#   POST   /api/profile/generate-narrative — AI 生成职业叙事
#   POST   /api/profile/instant-draft    — 即时价值钩子 Step 2.5
# =============================================

import json
import asyncio
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sse_starlette import EventSourceResponse

from app.database import get_db
from app.models.models import (
    Profile, ProfileSection, ProfileTargetRole, ProfileChatSession,
)
from app.agents.skills.conversational_extractor import (
    ConversationalExtractorSkill, generate_instant_draft,
)
from app.agents.skills.narrative_generator import NarrativeGeneratorSkill

router = APIRouter()


# =============================================
# Pydantic 请求/响应模型
# =============================================

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    school: Optional[str] = None
    major: Optional[str] = None
    degree: Optional[str] = None
    gpa: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    wechat: Optional[str] = None
    headline: Optional[str] = None
    exit_story: Optional[str] = None
    cross_cutting_advantage: Optional[str] = None
    onboarding_step: Optional[int] = None


class TargetRoleCreate(BaseModel):
    role_name: str
    role_level: str = ""
    fit: str = "primary"  # primary / secondary / adjacent


class SectionCreate(BaseModel):
    section_type: str
    title: str = ""
    sort_order: int = 0
    content_json: dict = Field(default_factory=dict)
    source: str = "manual"
    confidence: float = 1.0


class SectionUpdate(BaseModel):
    title: Optional[str] = None
    sort_order: Optional[int] = None
    content_json: Optional[dict] = None


class ChatRequest(BaseModel):
    topic: str = "general"  # education/internship/project/activity/skill/general
    message: str
    session_id: Optional[int] = None


class BulletConfirm(BaseModel):
    session_id: int
    bullet_index: int
    edits: Optional[dict] = None  # {title?, content_json?}


class InstantDraftRequest(BaseModel):
    experiences: list[str]  # 3 段经历名称
    target_roles: list[str] = []


# =============================================
# 辅助函数
# =============================================

async def _get_or_create_profile(db: AsyncSession) -> Profile:
    """获取默认 Profile，不存在则自动创建"""
    result = await db.execute(
        select(Profile)
        .where(Profile.is_default == True)
        .options(
            selectinload(Profile.sections),
            selectinload(Profile.target_roles),
            selectinload(Profile.chat_sessions),
        )
    )
    profile = result.scalar_one_or_none()
    if not profile:
        profile = Profile(is_default=True)
        db.add(profile)
        await db.commit()
        await db.refresh(profile, attribute_names=["sections", "target_roles", "chat_sessions"])
    return profile


def _profile_to_dict(profile: Profile) -> dict:
    """Profile ORM → API 响应字典"""
    return {
        "id": profile.id,
        "name": profile.name,
        "school": profile.school,
        "major": profile.major,
        "degree": profile.degree,
        "gpa": profile.gpa,
        "email": profile.email,
        "phone": profile.phone,
        "wechat": profile.wechat,
        "headline": profile.headline,
        "exit_story": profile.exit_story,
        "cross_cutting_advantage": profile.cross_cutting_advantage,
        "onboarding_step": profile.onboarding_step,
        "sections": [
            {
                "id": s.id,
                "section_type": s.section_type,
                "title": s.title,
                "sort_order": s.sort_order,
                "content_json": s.content_json,
                "source": s.source,
                "confidence": s.confidence,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in profile.sections
        ],
        "target_roles": [
            {
                "id": r.id,
                "role_name": r.role_name,
                "role_level": r.role_level,
                "fit": r.fit,
            }
            for r in profile.target_roles
        ],
        "stats": {
            "total_bullets": len(profile.sections),
            "by_type": _count_by_type(profile.sections),
        },
    }


def _count_by_type(sections: list) -> dict:
    counts = {}
    for s in sections:
        counts[s.section_type] = counts.get(s.section_type, 0) + 1
    return counts


def _bullets_summary(sections: list) -> str:
    """将已有 bullets 转为文本摘要，传给 AI 避免重复提取"""
    if not sections:
        return ""
    lines = []
    for s in sections:
        desc = s.content_json.get("description", "") if isinstance(s.content_json, dict) else ""
        lines.append(f"- [{s.section_type}] {s.title}: {desc}")
    return "\n".join(lines[:30])  # 限制长度


# =============================================
# Profile CRUD
# =============================================

@router.get("/")
async def get_profile(db: AsyncSession = Depends(get_db)):
    """获取当前 Profile 全量数据（含所有 sections + target_roles）"""
    profile = await _get_or_create_profile(db)
    return _profile_to_dict(profile)


@router.put("/")
async def update_profile(body: ProfileUpdate, db: AsyncSession = Depends(get_db)):
    """更新基础信息 + 叙事字段"""
    profile = await _get_or_create_profile(db)

    for field in [
        "name", "school", "major", "degree", "gpa", "email", "phone",
        "wechat", "headline", "exit_story", "cross_cutting_advantage",
        "onboarding_step",
    ]:
        val = getattr(body, field, None)
        if val is not None:
            setattr(profile, field, val)

    await db.commit()
    await db.refresh(profile, attribute_names=["sections", "target_roles", "chat_sessions"])
    return _profile_to_dict(profile)


# =============================================
# Target Roles
# =============================================

@router.get("/target-roles")
async def list_target_roles(db: AsyncSession = Depends(get_db)):
    profile = await _get_or_create_profile(db)
    return [
        {"id": r.id, "role_name": r.role_name, "role_level": r.role_level, "fit": r.fit}
        for r in profile.target_roles
    ]


@router.post("/target-roles", status_code=201)
async def create_target_role(body: TargetRoleCreate, db: AsyncSession = Depends(get_db)):
    profile = await _get_or_create_profile(db)
    role = ProfileTargetRole(
        profile_id=profile.id,
        role_name=body.role_name,
        role_level=body.role_level,
        fit=body.fit,
    )
    db.add(role)
    await db.commit()
    await db.refresh(role)
    return {"id": role.id, "role_name": role.role_name, "role_level": role.role_level, "fit": role.fit}


@router.delete("/target-roles/{role_id}", status_code=204)
async def delete_target_role(role_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ProfileTargetRole).where(ProfileTargetRole.id == role_id))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(404, "目标岗位不存在")
    await db.delete(role)
    await db.commit()


# =============================================
# Profile Sections (Bullet CRUD)
# =============================================

@router.post("/sections", status_code=201)
async def create_section(body: SectionCreate, db: AsyncSession = Depends(get_db)):
    """手动新增 Bullet 条目"""
    profile = await _get_or_create_profile(db)
    section = ProfileSection(
        profile_id=profile.id,
        section_type=body.section_type,
        title=body.title,
        sort_order=body.sort_order,
        content_json=body.content_json,
        source=body.source,
        confidence=body.confidence,
    )
    db.add(section)
    await db.commit()
    await db.refresh(section)
    return {
        "id": section.id,
        "section_type": section.section_type,
        "title": section.title,
        "content_json": section.content_json,
        "source": section.source,
        "confidence": section.confidence,
    }


@router.put("/sections/{section_id}")
async def update_section(section_id: int, body: SectionUpdate, db: AsyncSession = Depends(get_db)):
    """编辑单条 Bullet"""
    result = await db.execute(select(ProfileSection).where(ProfileSection.id == section_id))
    section = result.scalar_one_or_none()
    if not section:
        raise HTTPException(404, "条目不存在")

    if body.title is not None:
        section.title = body.title
    if body.sort_order is not None:
        section.sort_order = body.sort_order
    if body.content_json is not None:
        section.content_json = body.content_json

    await db.commit()
    await db.refresh(section)
    return {
        "id": section.id,
        "section_type": section.section_type,
        "title": section.title,
        "content_json": section.content_json,
        "source": section.source,
        "confidence": section.confidence,
    }


@router.delete("/sections/{section_id}", status_code=204)
async def delete_section(section_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ProfileSection).where(ProfileSection.id == section_id))
    section = result.scalar_one_or_none()
    if not section:
        raise HTTPException(404, "条目不存在")
    await db.delete(section)
    await db.commit()


# =============================================
# AI 对话引导 — SSE 流式
# =============================================

@router.post("/chat")
async def profile_chat(body: ChatRequest, db: AsyncSession = Depends(get_db)):
    """
    AI 对话引导 — SSE 流式端点
    events: ai_message / bullet_candidate / topic_complete / error / heartbeat
    """
    profile = await _get_or_create_profile(db)

    # 获取或新建 chat session
    if body.session_id:
        result = await db.execute(
            select(ProfileChatSession).where(ProfileChatSession.id == body.session_id)
        )
        session = result.scalar_one_or_none()
        if not session:
            raise HTTPException(404, "对话会话不存在")
    else:
        session = ProfileChatSession(
            profile_id=profile.id,
            topic=body.topic,
            messages_json=[],
            extracted_bullets=[],
        )
        db.add(session)
        await db.commit()
        await db.refresh(session)

    # 目标岗位列表
    target_roles = [r.role_name for r in profile.target_roles]
    # 已有条目摘要
    summary = _bullets_summary(profile.sections)

    async def event_generator():
        try:
            # 添加用户消息到历史
            history = list(session.messages_json or [])
            history.append({"role": "user", "content": body.message})

            # 调用 AI Skill
            extractor = ConversationalExtractorSkill()
            result = await extractor.execute({
                "topic": session.topic,
                "user_message": body.message,
                "history": history[:-1],  # 不含当前消息（Skill内部会添加）
                "target_roles": target_roles,
                "profile_summary": summary,
            })

            # AI 回复
            ai_reply = result.get("reply", "")
            yield json.dumps({
                "event": "ai_message",
                "data": {"content": ai_reply, "session_id": session.id},
            })

            # 更新消息历史（用户消息 + AI 回复）
            history.append({"role": "assistant", "content": ai_reply})
            session.messages_json = history

            # Bullet candidates
            bullets = result.get("bullets", [])
            existing_bullets = list(session.extracted_bullets or [])
            for i, bullet in enumerate(bullets):
                global_index = len(existing_bullets) + i
                bullet["index"] = global_index
                yield json.dumps({
                    "event": "bullet_candidate",
                    "data": bullet,
                })
            existing_bullets.extend(bullets)
            session.extracted_bullets = existing_bullets
            session.extracted_bullets_count = len(existing_bullets)

            # 主题完成
            if result.get("topic_complete"):
                session.status = "completed"
                yield json.dumps({
                    "event": "topic_complete",
                    "data": {
                        "topic": session.topic,
                        "bullets_extracted": len(existing_bullets),
                    },
                })

            await db.commit()

        except Exception as e:
            yield json.dumps({"event": "error", "data": {"message": str(e)}})

    return EventSourceResponse(event_generator())


# =============================================
# Bullet 确认入库
# =============================================

@router.post("/chat/confirm")
async def confirm_bullet(body: BulletConfirm, db: AsyncSession = Depends(get_db)):
    """
    用户确认 AI 提取的 Bullet → 写入 profile_sections
    支持先编辑再确认（通过 edits 参数）
    """
    result = await db.execute(
        select(ProfileChatSession).where(ProfileChatSession.id == body.session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(404, "对话会话不存在")

    bullets = session.extracted_bullets or []
    if body.bullet_index < 0 or body.bullet_index >= len(bullets):
        raise HTTPException(400, f"bullet_index {body.bullet_index} 超出范围 (0-{len(bullets)-1})")

    bullet = bullets[body.bullet_index]

    # 应用用户编辑
    title = bullet.get("title", "")
    content_json = bullet.get("content_json", {})
    section_type = bullet.get("section_type", "custom")
    confidence = bullet.get("confidence", 0.8)

    if body.edits:
        if "title" in body.edits:
            title = body.edits["title"]
        if "content_json" in body.edits:
            content_json = body.edits["content_json"]

    section = ProfileSection(
        profile_id=session.profile_id,
        section_type=section_type,
        title=title,
        content_json=content_json,
        source="ai_chat",
        confidence=confidence,
    )
    db.add(section)
    await db.commit()
    await db.refresh(section)

    return {
        "id": section.id,
        "section_type": section.section_type,
        "title": section.title,
        "content_json": section.content_json,
        "source": section.source,
        "confidence": section.confidence,
    }


# =============================================
# 职业叙事生成
# =============================================

@router.post("/generate-narrative")
async def generate_narrative(db: AsyncSession = Depends(get_db)):
    """AI 根据已有 Bullets 生成 headline + exit_story + cross_cutting_advantage"""
    profile = await _get_or_create_profile(db)

    if not profile.sections:
        raise HTTPException(400, "档案条目为空，请先填写经历后再生成叙事")

    target_roles = [r.role_name for r in profile.target_roles]
    bullets_text = _bullets_summary(profile.sections)
    basic_info = f"{profile.school} {profile.major} {profile.degree}".strip()

    generator = NarrativeGeneratorSkill()
    result = await generator.execute({
        "bullets_summary": bullets_text,
        "target_roles": target_roles,
        "basic_info": basic_info,
    })

    if result.get("error"):
        raise HTTPException(500, result["error"])

    return result


# =============================================
# 即时价值钩子 (Step 2.5)
# =============================================

@router.post("/instant-draft")
async def instant_draft(body: InstantDraftRequest, db: AsyncSession = Depends(get_db)):
    """
    Step 2.5: 用户给出 3 段经历名称 → AI 秒出简历草稿框架
    让用户立刻看到产出，激励继续填充细节
    """
    if not body.experiences:
        raise HTTPException(400, "请至少提供一段经历名称")

    result = await generate_instant_draft(
        experiences=body.experiences,
        target_roles=body.target_roles,
    )

    if not result:
        raise HTTPException(500, "草稿生成失败，请重试")

    return result
