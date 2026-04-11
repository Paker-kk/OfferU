# =============================================
# Pool 路由 — 岗位分组池 CRUD
# =============================================

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.database import get_db
from app.models.models import Pool, Job
from sqlalchemy import func as sa_func

router = APIRouter()


# ---- Request / Response 模型 ----

class PoolCreate(BaseModel):
    name: str
    description: str = ""
    color: str = "#3B82F6"

class PoolUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    color: Optional[str] = None
    sort_order: Optional[int] = None

class PoolOut(BaseModel):
    id: int
    name: str
    description: str
    color: str
    sort_order: int
    job_count: int = 0

    model_config = {"from_attributes": True}


# ---- CRUD ----

@router.get("/", response_model=list[PoolOut])
async def list_pools(db: AsyncSession = Depends(get_db)):
    """获取所有池（含各池已筛选岗位计数 — 只统计 triage_status=screened）"""
    result = await db.execute(select(Pool).order_by(Pool.sort_order, Pool.id))
    pools = result.scalars().all()

    # 批量查询所有池的计数，避免 N+1
    count_q = (
        select(Job.pool_id, sa_func.count(Job.id).label("cnt"))
        .where(Job.pool_id.isnot(None), Job.triage_status == "screened")
        .group_by(Job.pool_id)
    )
    count_result = await db.execute(count_q)
    count_map = {row.pool_id: row.cnt for row in count_result}

    out = []
    for p in pools:
        out.append(PoolOut(
            id=p.id, name=p.name, description=p.description,
            color=p.color, sort_order=p.sort_order,
            job_count=count_map.get(p.id, 0)
        ))
    return out


@router.post("/", response_model=PoolOut, status_code=201)
async def create_pool(body: PoolCreate, db: AsyncSession = Depends(get_db)):
    """创建新池"""
    pool = Pool(name=body.name, description=body.description, color=body.color)
    db.add(pool)
    await db.commit()
    await db.refresh(pool)
    return PoolOut(
        id=pool.id, name=pool.name, description=pool.description,
        color=pool.color, sort_order=pool.sort_order, job_count=0
    )


@router.put("/{pool_id}", response_model=PoolOut)
async def update_pool(pool_id: int, body: PoolUpdate, db: AsyncSession = Depends(get_db)):
    """更新池属性"""
    result = await db.execute(select(Pool).where(Pool.id == pool_id))
    pool = result.scalar_one_or_none()
    if not pool:
        raise HTTPException(404, "池不存在")

    if body.name is not None:
        pool.name = body.name
    if body.description is not None:
        pool.description = body.description
    if body.color is not None:
        pool.color = body.color
    if body.sort_order is not None:
        pool.sort_order = body.sort_order

    await db.commit()
    await db.refresh(pool)

    count_result = await db.execute(
        select(sa_func.count(Job.id)).where(Job.pool_id == pool.id, Job.triage_status == "screened")
    )
    job_count = count_result.scalar() or 0

    return PoolOut(
        id=pool.id, name=pool.name, description=pool.description,
        color=pool.color, sort_order=pool.sort_order, job_count=job_count
    )


@router.delete("/{pool_id}", status_code=204)
async def delete_pool(pool_id: int, db: AsyncSession = Depends(get_db)):
    """删除池，池内岗位归为未分组 (pool_id=null)"""
    result = await db.execute(select(Pool).where(Pool.id == pool_id))
    pool = result.scalar_one_or_none()
    if not pool:
        raise HTTPException(404, "池不存在")

    # 归零关联岗位的 pool_id
    await db.execute(
        update(Job).where(Job.pool_id == pool_id).values(pool_id=None)
    )
    await db.delete(pool)
    await db.commit()
