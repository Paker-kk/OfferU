# =============================================
# Jobs 路由 — 岗位管理 API
# =============================================
# GET  /api/jobs/          岗位列表（排序、筛选、分页）
# GET  /api/jobs/stats     统计汇总（日/周）
# GET  /api/jobs/trend     每日趋势
# GET  /api/jobs/{id}      岗位详情
# POST /api/jobs/ingest    批量写入岗位数据
# GET  /api/jobs/weekly-report  周报分析
# =============================================

from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import Job
from pydantic import BaseModel

router = APIRouter()


# ---- Pydantic Schemas ----

class JobPayload(BaseModel):
    """单个岗位数据"""
    title: str
    company: str
    location: str = ""
    url: str = ""
    source: str = "linkedin"
    raw_description: str = ""
    posted_at: Optional[str] = None
    hash_key: str
    summary: str = ""
    keywords: list[str] = []


class IngestRequest(BaseModel):
    """批量数据写入请求体"""
    jobs: list[JobPayload]


# ---- Routes ----

@router.get("/")
async def list_jobs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    source: Optional[str] = None,
    period: Optional[str] = Query(None, description="today / week / month"),
    sort_by: str = Query("created_at", description="排序字段"),
    db: AsyncSession = Depends(get_db),
):
    """
    获取岗位列表（分页 + 筛选 + 排序）
    - period: today=今日, week=本周, month=本月
    - sort_by: created_at / posted_at / title
    """
    query = select(Job)

    # 数据源筛选
    if source:
        query = query.where(Job.source == source)

    # 时间范围筛选
    if period == "today":
        query = query.where(Job.created_at >= datetime.utcnow().replace(hour=0, minute=0, second=0))
    elif period == "week":
        query = query.where(Job.created_at >= datetime.utcnow() - timedelta(days=7))
    elif period == "month":
        query = query.where(Job.created_at >= datetime.utcnow() - timedelta(days=30))

    # 排序
    sort_col = getattr(Job, sort_by, Job.created_at)
    query = query.order_by(desc(sort_col))

    # 分页
    total_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(total_q)).scalar() or 0

    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    jobs = result.scalars().all()

    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "items": [_job_to_dict(j) for j in jobs],
    }


@router.get("/stats")
async def job_stats(
    period: str = Query("week", description="today / week / month"),
    db: AsyncSession = Depends(get_db),
):
    """统计汇总：岗位数、来源分布"""
    since = datetime.utcnow()
    if period == "today":
        since = since.replace(hour=0, minute=0, second=0)
    elif period == "week":
        since -= timedelta(days=7)
    else:
        since -= timedelta(days=30)

    # 总数
    stats_q = select(
        func.count(Job.id).label("total"),
    ).where(Job.created_at >= since)
    row = (await db.execute(stats_q)).one()

    # 来源分布
    source_q = (
        select(Job.source, func.count(Job.id).label("count"))
        .where(Job.created_at >= since)
        .group_by(Job.source)
    )
    sources = (await db.execute(source_q)).all()

    return {
        "period": period,
        "total_jobs": row.total,
        "source_distribution": {s.source: s.count for s in sources},
    }


@router.get("/trend")
async def job_trend(
    period: str = Query("week", description="week / month"),
    db: AsyncSession = Depends(get_db),
):
    """每日趋势数据：按天分组返回岗位数"""
    days = 7 if period == "week" else 30
    since = datetime.utcnow() - timedelta(days=days)

    date_col = func.date(Job.created_at).label("date")
    trend_q = (
        select(
            date_col,
            func.count(Job.id).label("count"),
        )
        .where(Job.created_at >= since)
        .group_by(date_col)
        .order_by(date_col)
    )
    rows = (await db.execute(trend_q)).all()

    return [
        {
            "date": str(r.date),
            "count": r.count,
        }
        for r in rows
    ]


@router.get("/weekly-report")
async def weekly_report(db: AsyncSession = Depends(get_db)):
    """周报分析接口 — 汇总本周数据供 Analytics Dashboard 使用"""
    now = datetime.utcnow()
    this_week_start = now - timedelta(days=7)
    last_week_start = now - timedelta(days=14)

    # --- 本周汇总 ---
    tw_q = select(
        func.count(Job.id).label("total"),
    ).where(Job.created_at >= this_week_start)
    tw = (await db.execute(tw_q)).one()

    # --- 上周汇总（用于环比） ---
    lw_q = select(
        func.count(Job.id).label("total"),
    ).where(Job.created_at >= last_week_start, Job.created_at < this_week_start)
    lw = (await db.execute(lw_q)).one()

    # --- 来源分布 ---
    source_q = (
        select(Job.source, func.count(Job.id).label("count"))
        .where(Job.created_at >= this_week_start)
        .group_by(Job.source)
    )
    sources = (await db.execute(source_q)).all()

    # --- 热门关键词 ---
    kw_q = select(Job.keywords).where(
        Job.created_at >= this_week_start, Job.keywords.isnot(None)
    )
    kw_rows = (await db.execute(kw_q)).scalars().all()
    kw_counter: dict[str, int] = {}
    for kw_list in kw_rows:
        if isinstance(kw_list, list):
            for kw in kw_list:
                kw_str = str(kw).strip().lower()
                if kw_str:
                    kw_counter[kw_str] = kw_counter.get(kw_str, 0) + 1
    top_keywords = sorted(kw_counter.items(), key=lambda x: -x[1])[:20]

    return {
        "this_week": {"total": tw.total},
        "last_week": {"total": lw.total},
        "source_distribution": [{"name": s.source, "value": s.count} for s in sources],
        "top_keywords": [{"keyword": k, "count": c} for k, c in top_keywords],
    }


@router.get("/{job_id}")
async def get_job(job_id: int, db: AsyncSession = Depends(get_db)):
    """获取单个岗位详情"""
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return _job_to_dict(job)


@router.post("/ingest")
async def ingest_jobs(req: IngestRequest, db: AsyncSession = Depends(get_db)):
    """
    批量写入岗位数据（爬虫回调接口）
    自动跳过已存在的 hash_key（去重）
    """
    created = 0
    skipped = 0
    for item in req.jobs:
        existing = await db.execute(select(Job).where(Job.hash_key == item.hash_key))
        if existing.scalar_one_or_none():
            skipped += 1
            continue

        job = Job(
            title=item.title,
            company=item.company,
            location=item.location,
            url=item.url,
            source=item.source,
            raw_description=item.raw_description,
            hash_key=item.hash_key,
            summary=item.summary,
            keywords=item.keywords,
        )
        db.add(job)
        created += 1

    await db.commit()
    return {"created": created, "skipped": skipped}


def _job_to_dict(job: Job) -> dict:
    """将 ORM 对象序列化为字典"""
    return {
        "id": job.id,
        "title": job.title,
        "company": job.company,
        "location": job.location,
        "url": job.url,
        "source": job.source,
        "posted_at": str(job.posted_at) if job.posted_at else None,
        "summary": job.summary,
        "keywords": job.keywords or [],
        "created_at": str(job.created_at),
    }
