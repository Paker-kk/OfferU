# =============================================
# OfferU MCP Server — 全流程 AI Agent Tools
# =============================================
# 挂载路径: /mcp (Streamable HTTP)
# 连接方式: claude mcp add --transport http offeru http://localhost:8000/mcp
# =============================================

import json
from typing import Optional

from mcp.server.fastmcp import FastMCP
from sqlalchemy import select, func, update

from app.database import async_session
from app.models.models import (
    Profile, ProfileSection, ProfileTargetRole,
    Job, Pool, Resume, ResumeSection,
    Application,
)

mcp = FastMCP(
    "OfferU Resume AI",
    instructions=(
        "OfferU 是面向中国文科生校招的 AI 求职助手。"
        "你可以通过这些工具帮用户完成：查看个人资料、浏览岗位、筛选分拣、"
        "AI 生成定制简历、管理投递记录等全流程操作。"
    ),
    stateless_http=True,
    json_response=True,
)


def _to_internal_status(status: str) -> str:
    value = (status or "").strip().lower()
    if value in {"unscreened", "inbox"}:
        return "inbox"
    if value in {"screened", "picked"}:
        return "picked"
    if value == "ignored":
        return "ignored"
    return value


def _status_filter_values(status: str) -> list[str]:
    internal = _to_internal_status(status)
    if internal == "inbox":
        return ["inbox", "unscreened"]
    if internal == "picked":
        return ["picked", "screened"]
    if internal == "ignored":
        return ["ignored"]
    return [status]


# =============================================
# Helper: 获取数据库会话
# =============================================

def _serialize_profile(profile: Profile, sections: list, roles: list) -> dict:
    return {
        "id": profile.id,
        "name": profile.name,
        "school": profile.school,
        "major": profile.major,
        "degree": profile.degree,
        "gpa": profile.gpa,
        "email": profile.email,
        "phone": profile.phone,
        "headline": profile.headline,
        "exit_story": profile.exit_story,
        "onboarding_step": profile.onboarding_step,
        "target_roles": [
            {"role_name": r.role_name, "fit": r.fit} for r in roles
        ],
        "sections_count": len(sections),
        "sections_by_type": {},
    }


def _serialize_job(job: Job) -> dict:
    internal = _to_internal_status(job.triage_status or "inbox")
    outward = "unscreened" if internal == "inbox" else ("screened" if internal == "picked" else "ignored")
    return {
        "id": job.id,
        "title": job.title,
        "company": job.company,
        "location": job.location or "",
        "salary_text": job.salary_text or "",
        "triage_status": outward,
        "pool_id": job.pool_id,
        "is_campus": job.is_campus,
        "source": job.source or "",
        "keywords": job.keywords or [],
        "summary": (job.summary or "")[:200],
    }


def _serialize_resume_brief(r: Resume) -> dict:
    return {
        "id": r.id,
        "title": r.title,
        "user_name": r.user_name,
        "source_mode": getattr(r, "source_mode", "manual") or "manual",
        "source_job_ids": getattr(r, "source_job_ids", []) or [],
        "is_primary": r.is_primary,
        "created_at": str(r.created_at) if r.created_at else None,
    }


# =============================================
# Tool 1: 查看个人资料
# =============================================

@mcp.tool()
async def get_profile() -> dict:
    """获取用户的个人资料概览，包括基本信息、目标岗位、经历条目数量。
    适用场景：了解用户背景，为简历生成做准备。"""
    async with async_session() as db:
        result = await db.execute(
            select(Profile).where(Profile.is_default == True)
        )
        profile = result.scalar_one_or_none()
        if not profile:
            return {"error": "未找到个人资料，请先完成 Profile 引导"}

        secs = await db.execute(
            select(ProfileSection).where(ProfileSection.profile_id == profile.id)
        )
        sections = secs.scalars().all()

        roles_r = await db.execute(
            select(ProfileTargetRole).where(ProfileTargetRole.profile_id == profile.id)
        )
        roles = roles_r.scalars().all()

        data = _serialize_profile(profile, sections, roles)
        # 按类型聚合
        by_type: dict[str, int] = {}
        for s in sections:
            by_type[s.section_type] = by_type.get(s.section_type, 0) + 1
        data["sections_by_type"] = by_type
        return data


# =============================================
# Tool 2: 查看岗位池列表
# =============================================

@mcp.tool()
async def list_pools() -> list[dict]:
    """获取所有岗位池（Pool），每个池包含名称、颜色和已筛选岗位数。
    适用场景：帮用户了解岗位分组情况。"""
    async with async_session() as db:
        result = await db.execute(select(Pool).order_by(Pool.sort_order))
        pools = result.scalars().all()

        out = []
        for p in pools:
            cnt_r = await db.execute(
                select(func.count(Job.id)).where(
                    Job.pool_id == p.id,
                    Job.triage_status.in_(_status_filter_values("screened")),
                )
            )
            cnt = cnt_r.scalar() or 0
            out.append({
                "id": p.id,
                "name": p.name,
                "color": p.color,
                "job_count": cnt,
            })
        return out


# =============================================
# Tool 3: 浏览岗位列表
# =============================================

@mcp.tool()
async def list_jobs(
    triage_status: Optional[str] = None,
    pool_id: Optional[int] = None,
    keyword: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    """分页浏览岗位列表，支持按分拣状态/池/关键词筛选。
    triage_status: unscreened | screened | ignored
    返回岗位摘要列表和总数。"""
    async with async_session() as db:
        q = select(Job)
        if triage_status:
            q = q.where(Job.triage_status.in_(_status_filter_values(triage_status)))
        if pool_id:
            q = q.where(Job.pool_id == pool_id)
        if keyword:
            kw = f"%{keyword}%"
            q = q.where(
                Job.title.ilike(kw) | Job.company.ilike(kw)
            )

        # count
        cnt_q = select(func.count()).select_from(q.subquery())
        total = (await db.execute(cnt_q)).scalar() or 0

        # paginate
        q = q.order_by(Job.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        rows = (await db.execute(q)).scalars().all()

        return {
            "total": total,
            "page": page,
            "page_size": page_size,
            "jobs": [_serialize_job(j) for j in rows],
        }


# =============================================
# Tool 4: 查看岗位详情
# =============================================

@mcp.tool()
async def get_job(job_id: int) -> dict:
    """获取单个岗位的完整信息，包括岗位描述、关键词、薪资等。"""
    async with async_session() as db:
        job = (await db.execute(select(Job).where(Job.id == job_id))).scalar_one_or_none()
        if not job:
            return {"error": f"岗位 #{job_id} 不存在"}
        d = _serialize_job(job)
        d["raw_description"] = job.raw_description or ""
        d["apply_url"] = job.apply_url or ""
        d["education"] = job.education or ""
        d["experience"] = job.experience or ""
        return d


# =============================================
# Tool 5: 分拣岗位
# =============================================

@mcp.tool()
async def triage_job(
    job_id: int,
    status: str,
    pool_id: Optional[int] = None,
) -> dict:
    """将岗位分拣为 screened（已筛选）/ ignored（忽略），可同时分配到某个池。
    status: screened | ignored | unscreened"""
    internal = _to_internal_status(status)
    if internal not in ("inbox", "picked", "ignored"):
        return {"error": "status 必须是 screened/unscreened/ignored（兼容 picked/inbox）"}

    async with async_session() as db:
        job = (await db.execute(select(Job).where(Job.id == job_id))).scalar_one_or_none()
        if not job:
            return {"error": f"岗位 #{job_id} 不存在"}

        job.triage_status = internal
        if pool_id is not None:
            job.pool_id = pool_id
        await db.commit()
        return {"ok": True, "job_id": job_id, "status": _serialize_job(job)["triage_status"], "pool_id": job.pool_id}


# =============================================
# Tool 6: 批量分拣
# =============================================

@mcp.tool()
async def batch_triage(
    job_ids: list[int],
    status: str,
    pool_id: Optional[int] = None,
) -> dict:
    """批量分拣多个岗位。"""
    internal = _to_internal_status(status)
    if internal not in ("inbox", "picked", "ignored"):
        return {"error": "status 必须是 screened/unscreened/ignored（兼容 picked/inbox）"}

    async with async_session() as db:
        values: dict = {"triage_status": internal}
        if pool_id is not None:
            values["pool_id"] = pool_id
        await db.execute(
            update(Job).where(Job.id.in_(job_ids)).values(**values)
        )
        await db.commit()
        outward = "unscreened" if internal == "inbox" else ("screened" if internal == "picked" else "ignored")
        return {"ok": True, "updated": len(job_ids), "status": outward}


# =============================================
# Tool 7: AI 生成定制简历（同步版·单岗位）
# =============================================

@mcp.tool()
async def generate_resume(
    job_id: int,
    reference_resume_id: Optional[int] = None,
) -> dict:
    """为指定岗位 AI 生成一份定制简历。
    会基于用户 Profile 中的经历 Bullet 自动召回匹配、组装简历。
    返回生成结果（含 resume_id、匹配率、缺失能力等）。"""
    # 延迟导入避免循环
    from app.routes.optimize import _generate_for_job

    async with async_session() as db:
        # 获取 profile
        profile = (await db.execute(
            select(Profile).where(Profile.is_default == True)
        )).scalar_one_or_none()
        if not profile:
            return {"error": "未找到 Profile"}

        # 获取 job
        job = (await db.execute(select(Job).where(Job.id == job_id))).scalar_one_or_none()
        if not job:
            return {"error": f"岗位 #{job_id} 不存在"}

        # 获取 profile sections
        secs = (await db.execute(
            select(ProfileSection).where(ProfileSection.profile_id == profile.id)
        )).scalars().all()

        try:
            result = await _generate_for_job(profile, job, list(secs), db)
            return result
        except Exception as e:
            return {"error": str(e)}


# =============================================
# Tool 8: 查看简历列表
# =============================================

@mcp.tool()
async def list_resumes() -> list[dict]:
    """获取所有简历列表，包含溯源标签（AI 生成来源或手动创建）。"""
    async with async_session() as db:
        rows = (await db.execute(
            select(Resume).order_by(Resume.created_at.desc())
        )).scalars().all()

        # 批量获取 source job titles
        all_job_ids = set()
        for r in rows:
            ids = getattr(r, "source_job_ids", None) or []
            all_job_ids.update(ids)

        job_titles: dict[int, str] = {}
        if all_job_ids:
            jrows = (await db.execute(
                select(Job.id, Job.title, Job.company).where(Job.id.in_(all_job_ids))
            )).all()
            for jid, jtitle, jcomp in jrows:
                job_titles[jid] = f"{jcomp}-{jtitle}"

        out = []
        for r in rows:
            d = _serialize_resume_brief(r)
            ids = d.get("source_job_ids", [])
            if ids:
                labels = [job_titles.get(i, f"#{i}") for i in ids[:3]]
                d["source_label"] = "、".join(labels)
                if len(ids) > 3:
                    d["source_label"] += f" 等{len(ids)}个岗位"
            else:
                d["source_label"] = "手动创建"
            out.append(d)
        return out


# =============================================
# Tool 9: 查看简历详情
# =============================================

@mcp.tool()
async def get_resume(resume_id: int) -> dict:
    """获取简历完整内容，包括所有段落的详细信息。"""
    async with async_session() as db:
        r = (await db.execute(select(Resume).where(Resume.id == resume_id))).scalar_one_or_none()
        if not r:
            return {"error": f"简历 #{resume_id} 不存在"}

        secs = (await db.execute(
            select(ResumeSection)
            .where(ResumeSection.resume_id == resume_id)
            .order_by(ResumeSection.sort_order)
        )).scalars().all()

        return {
            "id": r.id,
            "title": r.title,
            "user_name": r.user_name,
            "summary": r.summary or "",
            "contact_json": r.contact_json,
            "source_mode": getattr(r, "source_mode", "manual") or "manual",
            "sections": [
                {
                    "id": s.id,
                    "section_type": s.section_type,
                    "title": s.title,
                    "sort_order": s.sort_order,
                    "visible": s.visible,
                    "content_json": s.content_json,
                }
                for s in secs
            ],
        }


# =============================================
# Tool 10: 投递管理 — 查看投递列表
# =============================================

@mcp.tool()
async def list_applications(
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    """查看投递记录列表，可按状态筛选。
    status: pending | submitted | rejected | interview | offer"""
    async with async_session() as db:
        q = select(Application)
        if status:
            q = q.where(Application.status == status)

        cnt = (await db.execute(
            select(func.count()).select_from(q.subquery())
        )).scalar() or 0

        q = q.order_by(Application.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
        rows = (await db.execute(q)).scalars().all()

        return {
            "total": cnt,
            "page": page,
            "applications": [
                {
                    "id": a.id,
                    "job_id": a.job_id,
                    "status": a.status,
                    "notes": a.notes or "",
                    "cover_letter": (a.cover_letter or "")[:100] + "..." if a.cover_letter and len(a.cover_letter) > 100 else (a.cover_letter or ""),
                    "created_at": str(a.created_at) if a.created_at else None,
                }
                for a in rows
            ],
        }


# =============================================
# Tool 11: 创建投递记录
# =============================================

@mcp.tool()
async def create_application(job_id: int, notes: str = "") -> dict:
    """为指定岗位创建一条投递记录。"""
    async with async_session() as db:
        job = (await db.execute(select(Job).where(Job.id == job_id))).scalar_one_or_none()
        if not job:
            return {"error": f"岗位 #{job_id} 不存在"}

        app = Application(job_id=job_id, status="pending", notes=notes, apply_url=job.apply_url or "")
        db.add(app)
        await db.commit()
        await db.refresh(app)
        return {"id": app.id, "job_id": job_id, "status": "pending"}


# =============================================
# Tool 12: 生成求职信
# =============================================

@mcp.tool()
async def generate_cover_letter(job_id: int, resume_id: int) -> dict:
    """为指定岗位和简历生成 AI 求职信。"""
    from app.agents.cover_letter import generate_cover_letter as _gen

    async with async_session() as db:
        job = (await db.execute(select(Job).where(Job.id == job_id))).scalar_one_or_none()
        if not job:
            return {"error": f"岗位 #{job_id} 不存在"}

        resume = (await db.execute(select(Resume).where(Resume.id == resume_id))).scalar_one_or_none()
        if not resume:
            return {"error": f"简历 #{resume_id} 不存在"}

        # 获取简历文本
        secs = (await db.execute(
            select(ResumeSection)
            .where(ResumeSection.resume_id == resume_id)
            .order_by(ResumeSection.sort_order)
        )).scalars().all()

        resume_text = f"{resume.user_name}\n{resume.summary or ''}\n"
        for s in secs:
            resume_text += f"\n{s.title or s.section_type}:\n"
            if isinstance(s.content_json, list):
                for item in s.content_json:
                    if isinstance(item, dict):
                        resume_text += f"  - {item.get('subtitle', '')} {item.get('description', '')}\n"

        jd = job.raw_description or job.summary or ""
        result = await _gen(jd, resume_text)
        return result if result else {"error": "求职信生成失败"}


# =============================================
# Tool 13: 岗位统计
# =============================================

@mcp.tool()
async def job_stats() -> dict:
    """获取岗位数据统计：各分拣状态计数、来源分布等。"""
    async with async_session() as db:
        # 分拣状态计数
        counts: dict[str, int] = {}
        for st in ("unscreened", "screened", "ignored"):
            cnt = (await db.execute(
                select(func.count(Job.id)).where(Job.triage_status == st)
            )).scalar() or 0
            counts[st] = cnt

        # 来源分布
        source_rows = (await db.execute(
            select(Job.source, func.count(Job.id)).group_by(Job.source)
        )).all()
        sources = {s or "unknown": c for s, c in source_rows}

        return {
            "triage_counts": counts,
            "total": sum(counts.values()),
            "sources": sources,
        }


# =============================================
# Resource: 当前用户资料
# =============================================

@mcp.resource("profile://current")
async def resource_profile() -> str:
    """当前用户的个人资料摘要"""
    data = await get_profile()
    return json.dumps(data, ensure_ascii=False, indent=2)
