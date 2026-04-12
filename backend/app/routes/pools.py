# =============================================
# Pools 路由 — 岗位池（文件夹）管理 API
# =============================================
# GET    /api/pools/         获取池列表
# POST   /api/pools/         创建池
# PUT    /api/pools/{id}     重命名池
# DELETE /api/pools/{id}     删除池（岗位转为未分组）
# =============================================

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import Job, Pool

router = APIRouter()
POOL_SCOPES = {"inbox", "picked", "ignored"}


class PoolCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    scope: str = Field(default="picked", max_length=20)


class PoolUpdateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)


def _serialize_pool(pool: Pool, job_count: int = 0) -> dict:
    return {
        "id": pool.id,
        "name": pool.name,
        "scope": pool.scope,
        "job_count": job_count,
        "created_at": str(pool.created_at),
        "updated_at": str(pool.updated_at),
    }


@router.get("/")
async def list_pools(
    scope: Optional[str] = Query(default=None, description="inbox / picked / ignored"),
    db: AsyncSession = Depends(get_db),
):
    """获取岗位池列表及每个池的岗位数量"""
    if scope and scope not in POOL_SCOPES:
        raise HTTPException(status_code=400, detail="invalid pool scope")

    counts_subquery = (
        select(
            Job.pool_id.label("pool_id"),
            func.count(Job.id).label("job_count"),
        )
        .where(Job.pool_id.is_not(None))
        .group_by(Job.pool_id)
        .subquery()
    )

    if scope:
        counts_subquery = (
            select(
                Job.pool_id.label("pool_id"),
                func.count(Job.id).label("job_count"),
            )
            .where(Job.pool_id.is_not(None), Job.triage_status == scope)
            .group_by(Job.pool_id)
            .subquery()
        )

    query = (
        select(Pool, func.coalesce(counts_subquery.c.job_count, 0).label("job_count"))
        .outerjoin(counts_subquery, counts_subquery.c.pool_id == Pool.id)
        .order_by(Pool.created_at.desc())
    )
    if scope:
        query = query.where(Pool.scope == scope)

    result = await db.execute(query)
    rows = result.all()
    return [_serialize_pool(pool, job_count or 0) for pool, job_count in rows]


@router.post("/")
async def create_pool(data: PoolCreateRequest, db: AsyncSession = Depends(get_db)):
    """创建岗位池（名称大小写不敏感）"""
    name = data.name.strip()
    scope = (data.scope or "picked").strip().lower()
    if not name:
        raise HTTPException(status_code=400, detail="Pool name is required")
    if scope not in POOL_SCOPES:
        raise HTTPException(status_code=400, detail="invalid pool scope")

    existing = (
        await db.execute(
            select(Pool).where(
                func.lower(Pool.name) == name.lower(),
                Pool.scope == scope,
            )
        )
    ).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Pool name already exists")

    pool = Pool(name=name, scope=scope)
    db.add(pool)
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Pool name already exists") from exc
    await db.refresh(pool)
    return _serialize_pool(pool, 0)


@router.put("/{pool_id}")
async def update_pool(
    pool_id: int,
    data: PoolUpdateRequest,
    scope: Optional[str] = Query(default=None, description="inbox / picked / ignored"),
    db: AsyncSession = Depends(get_db),
):
    """重命名岗位池"""
    if scope and scope not in POOL_SCOPES:
        raise HTTPException(status_code=400, detail="invalid pool scope")

    name = data.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Pool name is required")

    query = select(Pool).where(Pool.id == pool_id)
    if scope:
        query = query.where(Pool.scope == scope)
    pool = (await db.execute(query)).scalar_one_or_none()
    if not pool:
        raise HTTPException(status_code=404, detail="Pool not found")

    conflict = (
        await db.execute(
            select(Pool).where(
                func.lower(Pool.name) == name.lower(),
                Pool.id != pool_id,
                Pool.scope == pool.scope,
            )
        )
    ).scalar_one_or_none()
    if conflict:
        raise HTTPException(status_code=409, detail="Pool name already exists")

    pool.name = name
    try:
        await db.commit()
    except IntegrityError as exc:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Pool name already exists") from exc
    await db.refresh(pool)

    job_count = (
        await db.execute(
            select(func.count(Job.id)).where(
                Job.pool_id == pool_id,
                Job.triage_status == pool.scope,
            )
        )
    ).scalar() or 0
    return _serialize_pool(pool, job_count)


@router.delete("/{pool_id}")
async def delete_pool(
    pool_id: int,
    scope: Optional[str] = Query(default=None, description="inbox / picked / ignored"),
    db: AsyncSession = Depends(get_db),
):
    """删除岗位池，池内岗位转为未分组（pool_id=null）"""
    if scope and scope not in POOL_SCOPES:
        raise HTTPException(status_code=400, detail="invalid pool scope")

    query = select(Pool).where(Pool.id == pool_id)
    if scope:
        query = query.where(Pool.scope == scope)

    pool = (await db.execute(query)).scalar_one_or_none()
    if not pool:
        raise HTTPException(status_code=404, detail="Pool not found")

    jobs = (await db.execute(select(Job).where(Job.pool_id == pool_id))).scalars().all()
    for job in jobs:
        job.pool_id = None

    await db.delete(pool)
    await db.commit()

    return {"deleted": True, "moved_to_ungrouped": len(jobs)}
