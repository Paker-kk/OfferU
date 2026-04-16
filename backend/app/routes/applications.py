# =============================================
# Applications 路由 — 投递管理 API
# =============================================
# GET    /api/applications/           投递记录列表
# POST   /api/applications/           创建投递记录
# PUT    /api/applications/{id}       更新投递状态
# POST   /api/applications/generate   AI 生成求职信
# GET    /api/applications/stats      投递统计
# =============================================
# 自动投递流程：
#   1. 用户选择高分岗位，点击"一键投递"
#   2. 后端调 cover_letter Agent 生成求职信
#   3. 创建投递记录（status=pending）
#   4. 未来扩展：自动填写各平台申请表单
# =============================================

from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.models.models import Application, Job, Resume
from app.agents.cover_letter import generate_cover_letter

router = APIRouter()


class ApplicationCreate(BaseModel):
    job_id: int
    notes: str = ""


class ApplicationUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    cover_letter: Optional[str] = None


class GenerateRequest(BaseModel):
    job_id: int
    resume_id: int


@router.get("/")
async def list_applications(
    status: Optional[str] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """获取投递记录列表，支持按状态筛选"""
    query = select(Application).order_by(desc(Application.created_at))

    if status:
        query = query.where(Application.status == status)

    total_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(total_q)).scalar() or 0

    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    apps = result.scalars().all()

    # 批量加载关联岗位，避免 N+1 查询
    job_ids = list({app.job_id for app in apps if app.job_id})
    jobs_map: dict[int, Job] = {}
    if job_ids:
        job_result = await db.execute(select(Job).where(Job.id.in_(job_ids)))
        jobs_map = {j.id: j for j in job_result.scalars().all()}

    items = []
    for app in apps:
        job = jobs_map.get(app.job_id)
        items.append({
            "id": app.id,
            "job_id": app.job_id,
            "job_title": job.title if job else "",
            "job_company": job.company if job else "",
            "status": app.status,
            "cover_letter": app.cover_letter,
            "apply_url": app.apply_url,
            "notes": app.notes,
            "submitted_at": app.submitted_at.isoformat() if app.submitted_at else None,
            "created_at": str(app.created_at),
        })

    return {"total": total, "page": page, "page_size": page_size, "items": items}


@router.post("/")
async def create_application(data: ApplicationCreate, db: AsyncSession = Depends(get_db)):
    """创建投递记录"""
    # 获取岗位的 apply_url
    job_result = await db.execute(select(Job).where(Job.id == data.job_id))
    job = job_result.scalar_one_or_none()

    app = Application(
        job_id=data.job_id,
        apply_url=job.apply_url if job else "",
        notes=data.notes,
        status="pending",
    )
    db.add(app)
    await db.commit()
    await db.refresh(app)
    return {"id": app.id, "message": "Application created"}


@router.post("/generate")
async def generate(data: GenerateRequest, db: AsyncSession = Depends(get_db)):
    """
    AI 生成求职信
    传入 job_id + resume_id，调 LLM Agent 生成定制求职信
    """
    job_result = await db.execute(select(Job).where(Job.id == data.job_id))
    job = job_result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    resume_result = await db.execute(select(Resume).where(Resume.id == data.resume_id))
    resume = resume_result.scalar_one_or_none()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    # 从简历 JSON 构造文本
    content = resume.content_json or {}
    resume_text = f"姓名: {content.get('name', '')}\n"
    resume_text += f"技能: {content.get('skills', '')}\n"
    for exp in content.get("experience", []):
        resume_text += f"工作经历: {exp.get('company', '')} - {exp.get('position', '')}\n"
        resume_text += f"  描述: {exp.get('description', '')}\n"

    result = await generate_cover_letter(
        jd=job.raw_description or job.summary,
        resume=resume_text,
    )

    return result


@router.get("/stats")
async def application_stats(db: AsyncSession = Depends(get_db)):
    """投递统计：按状态分组计数"""
    stats_q = (
        select(Application.status, func.count(Application.id).label("count"))
        .group_by(Application.status)
    )
    rows = (await db.execute(stats_q)).all()
    return {r.status: r.count for r in rows}


@router.put("/{app_id}")
async def update_application(app_id: int, data: ApplicationUpdate, db: AsyncSession = Depends(get_db)):
    """更新投递记录状态"""
    result = await db.execute(select(Application).where(Application.id == app_id))
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    if data.status is not None:
        app.status = data.status
        if data.status == "submitted":
            app.submitted_at = datetime.utcnow()
    if data.notes is not None:
        app.notes = data.notes
    if data.cover_letter is not None:
        app.cover_letter = data.cover_letter

    await db.commit()
    return {"id": app.id, "message": "Updated"}
