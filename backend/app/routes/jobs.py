# =============================================
# Jobs 路由 — 岗位管理 API
# =============================================
# GET   /api/jobs/              岗位列表（排序、筛选、分页 + triage/pool/batch）
# GET   /api/jobs/stats         统计汇总（日/周）
# GET   /api/jobs/trend         每日趋势
# GET   /api/jobs/batches       批次列表统计
# GET   /api/jobs/{id}          岗位详情
# POST  /api/jobs/ingest        批量写入岗位数据
# PATCH /api/jobs/batch-triage  批量分拣（状态/池）
# PATCH /api/jobs/{id}          单个岗位分拣
# GET   /api/jobs/weekly-report 周报分析
# =============================================

from datetime import datetime, timedelta
from typing import Optional, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, desc, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import Job, Batch
from app.services.campus_detector import detect_campus
from pydantic import BaseModel

router = APIRouter()


# ---- Pydantic Schemas ----

class JobPayload(BaseModel):
    """单个岗位数据"""
    title: str
    company: str
    location: str = ""
    url: str = ""
    apply_url: str = ""
    source: str = "linkedin"
    raw_description: str = ""
    posted_at: Optional[str] = None
    hash_key: str
    summary: str = ""
    keywords: list[str] = []
    # ---- 新增校招字段 ----
    salary_min: Optional[int] = None
    salary_max: Optional[int] = None
    salary_text: str = ""
    education: str = ""
    experience: str = ""
    job_type: str = ""
    company_size: str = ""
    company_industry: str = ""
    company_logo: str = ""
    is_campus: bool = False


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
    keyword: Optional[str] = Query(None, description="标题/公司关键词搜索"),
    job_type: Optional[str] = Query(None, description="岗位类型: 全职/实习/校招"),
    education: Optional[str] = Query(None, description="学历要求: 本科/硕士/博士"),
    is_campus: Optional[bool] = Query(None, description="仅校招岗位"),
    triage_status: Optional[str] = Query(None, description="分拣状态: unscreened/screened/ignored"),
    pool_id: Optional[str] = Query(None, description="池ID，'null'表示未分组"),
    batch_id: Optional[int] = Query(None, description="采集批次ID"),
    db: AsyncSession = Depends(get_db),
):
    """
    获取岗位列表（分页 + 筛选 + 排序）
    - period: today=今日, week=本周, month=本月
    - sort_by: created_at / posted_at / title
    - keyword: 模糊匹配标题或公司名
    - job_type / education / is_campus: 精确筛选
    - triage_status: 分拣状态 (unscreened/screened/ignored)
    - pool_id: 池ID筛选，传 'null' 表示未分组
    - batch_id: 按采集批次筛选
    """
    query = select(Job)

    # 数据源筛选
    if source:
        query = query.where(Job.source == source)

    # 关键词搜索（标题或公司名）
    if keyword:
        like_pattern = f"%{keyword}%"
        query = query.where(
            (Job.title.ilike(like_pattern)) | (Job.company.ilike(like_pattern))
        )

    # 岗位类型筛选
    if job_type:
        query = query.where(Job.job_type == job_type)

    # 学历要求筛选
    if education:
        query = query.where(Job.education == education)

    # 校招筛选
    if is_campus is not None:
        query = query.where(Job.is_campus == is_campus)

    # ---- P1 新增筛选 ----

    # 分拣状态
    if triage_status:
        query = query.where(Job.triage_status == triage_status)

    # 池筛选：传 "null" 表示未分组
    if pool_id is not None:
        if pool_id == "null":
            query = query.where(Job.pool_id.is_(None))
        else:
            query = query.where(Job.pool_id == int(pool_id))

    # 批次筛选
    if batch_id is not None:
        query = query.where(Job.batch_id == batch_id)

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


# =============================================
# 分拣计数（用于 Tab 徽章，必须在 /{job_id} 之前注册）
# =============================================

@router.get("/triage-counts")
async def triage_counts(db: AsyncSession = Depends(get_db)):
    """
    获取三种分拣状态的岗位计数 — 供前端 Tab 徽章展示
    返回: {unscreened: N, screened: N, ignored: N}
    """
    counts = {}
    for status in ("unscreened", "screened", "ignored"):
        q = select(func.count(Job.id)).where(Job.triage_status == status)
        counts[status] = (await db.execute(q)).scalar() or 0
    return counts


# =============================================
# 批次统计（必须在 /{job_id} 之前注册，否则被 path param 拦截）
# =============================================

@router.get("/batches")
async def list_batches(db: AsyncSession = Depends(get_db)):
    """获取采集批次列表（含岗位计数）"""
    result = await db.execute(
        select(Batch).order_by(desc(Batch.created_at))
    )
    batches = result.scalars().all()
    return [
        {
            "id": b.id,
            "source": b.source,
            "keywords": b.keywords,
            "location": b.location,
            "job_count": b.job_count,
            "status": b.status,
            "created_at": b.created_at.isoformat() if b.created_at else None,
        }
        for b in batches
    ]


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
            apply_url=item.apply_url,
            source=item.source,
            raw_description=item.raw_description,
            hash_key=item.hash_key,
            summary=item.summary,
            keywords=item.keywords,
            salary_min=item.salary_min,
            salary_max=item.salary_max,
            salary_text=item.salary_text,
            education=item.education,
            experience=item.experience,
            job_type=item.job_type,
            company_size=item.company_size,
            company_industry=item.company_industry,
            company_logo=item.company_logo,
            is_campus=item.is_campus or detect_campus(
                title=item.title,
                source=item.source,
                experience=item.experience,
                job_type=item.job_type,
                raw_description=item.raw_description,
            ),
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
        "apply_url": job.apply_url or "",
        "source": job.source,
        "raw_description": job.raw_description or "",
        "posted_at": str(job.posted_at) if job.posted_at else None,
        "summary": job.summary,
        "keywords": job.keywords or [],
        "salary_min": job.salary_min,
        "salary_max": job.salary_max,
        "salary_text": job.salary_text or "",
        "education": job.education or "",
        "experience": job.experience or "",
        "job_type": job.job_type or "",
        "company_size": job.company_size or "",
        "company_industry": job.company_industry or "",
        "company_logo": job.company_logo or "",
        "is_campus": job.is_campus or False,
        "triage_status": job.triage_status or "unscreened",
        "pool_id": job.pool_id,
        "batch_id": job.batch_id,
        "created_at": str(job.created_at),
    }


# =============================================
# 分拣操作 — PATCH 端点
# =============================================

class TriageUpdate(BaseModel):
    """单岗位分拣请求"""
    triage_status: Optional[str] = None  # unscreened / screened / ignored
    pool_id: Optional[int] = None  # 设为 0 表示清除池


class BatchTriageRequest(BaseModel):
    """批量分拣请求"""
    job_ids: List[int]
    triage_status: Optional[str] = None
    pool_id: Optional[int] = None


VALID_TRIAGE = {"unscreened", "screened", "ignored"}


@router.patch("/batch-triage")
async def batch_triage(body: BatchTriageRequest, db: AsyncSession = Depends(get_db)):
    """
    批量分拣 — 批量修改岗位状态/池归属
    pool_id=0 表示清除池归属 (set null)
    """
    if body.triage_status and body.triage_status not in VALID_TRIAGE:
        raise HTTPException(400, f"无效的 triage_status: {body.triage_status}")
    if not body.job_ids:
        raise HTTPException(400, "job_ids 不能为空")

    values = {}
    if body.triage_status:
        values["triage_status"] = body.triage_status
    if body.pool_id is not None:
        values["pool_id"] = None if body.pool_id == 0 else body.pool_id

    if not values:
        raise HTTPException(400, "至少需要提供 triage_status 或 pool_id")

    stmt = update(Job).where(Job.id.in_(body.job_ids)).values(**values)
    result = await db.execute(stmt)
    await db.commit()

    return {"updated": result.rowcount}


@router.patch("/{job_id}")
async def triage_job(job_id: int, body: TriageUpdate, db: AsyncSession = Depends(get_db)):
    """
    单个岗位分拣 — 修改状态/池归属
    pool_id=0 表示清除池归属
    """
    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(404, "岗位不存在")

    if body.triage_status:
        if body.triage_status not in VALID_TRIAGE:
            raise HTTPException(400, f"无效的 triage_status: {body.triage_status}")
        job.triage_status = body.triage_status

    if body.pool_id is not None:
        job.pool_id = None if body.pool_id == 0 else body.pool_id

    await db.commit()
    await db.refresh(job)
    return _job_to_dict(job)
