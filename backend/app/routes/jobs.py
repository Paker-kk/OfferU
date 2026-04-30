# =============================================
# Jobs 路由 — 岗位管理 API
# =============================================
# GET  /api/jobs/          岗位列表（排序、筛选、分页）
# GET  /api/jobs/batches   批次列表（Inbox 分区）
# GET  /api/jobs/stats     统计汇总（日/周）
# GET  /api/jobs/trend     每日趋势
# PATCH /api/jobs/batch-update 批量更新分拣/分池
# PATCH /api/jobs/{id}      更新单个岗位分拣状态
# GET  /api/jobs/{id}      岗位详情
# POST /api/jobs/ingest    批量写入岗位数据
# GET  /api/jobs/weekly-report  周报分析
# =============================================

from __future__ import annotations

from datetime import datetime, timedelta
import re
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, desc, case, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import Job, Pool, Batch
from app.services.campus_detector import detect_campus
from pydantic import BaseModel, Field

router = APIRouter()

TRIAGE_STATUSES = {"inbox", "picked", "ignored"}
ALLOWED_SORT_FIELDS = {"created_at", "posted_at", "title", "company"}
TRIAGE_ALIAS_GROUPS = {
    "inbox": {"inbox", "unscreened"},
    "picked": {"picked", "screened"},
    "ignored": {"ignored"},
}


def _to_internal_status(status: str) -> str:
    value = (status or "").strip().lower()
    if value in TRIAGE_ALIAS_GROUPS["inbox"]:
        return "inbox"
    if value in TRIAGE_ALIAS_GROUPS["picked"]:
        return "picked"
    if value in TRIAGE_ALIAS_GROUPS["ignored"]:
        return "ignored"
    return value


def _status_filter_values(status: str) -> list[str]:
    internal = _to_internal_status(status)
    if internal == "inbox":
        return list(TRIAGE_ALIAS_GROUPS["inbox"])
    if internal == "picked":
        return list(TRIAGE_ALIAS_GROUPS["picked"])
    if internal == "ignored":
        return ["ignored"]
    return [status]


def _parse_posted_at(value: Optional[str]) -> Optional[datetime]:
    text = (value or "").strip()
    if not text:
        return None

    # 去掉常见中文前缀，兼容“发布时间：2026-04-16”这类格式。
    text = re.sub(r"^(发布时间|更新时间|发布于|更新于|发布|更新)[:：\s]*", "", text)

    iso_candidates = [text, text.replace("Z", "+00:00"), text.replace("/", "-")]
    for candidate in iso_candidates:
        try:
            return datetime.fromisoformat(candidate)
        except ValueError:
            continue

    full_date = re.search(r"(20\d{2})[年\-/.](\d{1,2})[月\-/.](\d{1,2})", text)
    if full_date:
        try:
            year, month, day = map(int, full_date.groups())
            return datetime(year, month, day)
        except ValueError:
            return None

    month_day = re.search(r"(\d{1,2})月(\d{1,2})日", text)
    if month_day:
        try:
            month, day = map(int, month_day.groups())
            now = datetime.utcnow()
            return datetime(now.year, month, day)
        except ValueError:
            return None

    return None


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
    batch_id: Optional[str] = Field(default=None, max_length=64)
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
    batch_id: Optional[str] = Field(default=None, max_length=64)
    source: str = "manual"
    keywords: list[str] = []
    location: str = ""


class JobPatchRequest(BaseModel):
    """单岗位分拣更新请求"""

    triage_status: Optional[str] = None
    pool_id: Optional[int] = None
    clear_pool: bool = False


class JobBatchPatchRequest(BaseModel):
    """批量岗位分拣更新请求"""

    job_ids: list[int]
    triage_status: Optional[str] = None
    pool_id: Optional[int] = None
    clear_pool: bool = False


class JobBatchDeleteRequest(BaseModel):
    """批量岗位彻底删除请求（仅允许回收站岗位）"""

    job_ids: list[int]


class BatchTriageRequest(BaseModel):
    """兼容新接口的批量分拣请求（pool_id=0 表示清空）。"""

    job_ids: list[int]
    triage_status: Optional[str] = None
    pool_id: Optional[int] = None


# ---- Routes ----

@router.get("/")
async def list_jobs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    source: Optional[str] = None,
    triage_status: Optional[str] = Query(None, description="分拣状态: inbox/picked/ignored"),
    pool_id: Optional[str] = Query(None, description="岗位池 ID，传 ungrouped 表示未分组"),
    batch_id: Optional[str] = Query(None, description="采集批次 ID"),
    period: Optional[str] = Query(None, description="today / week / month"),
    sort_by: str = Query("created_at", description="排序字段"),
    keyword: Optional[str] = Query(None, description="标题/公司关键词搜索"),
    job_type: Optional[str] = Query(None, description="岗位类型: 全职/实习/校招"),
    education: Optional[str] = Query(None, description="学历要求: 本科/硕士/博士"),
    is_campus: Optional[bool] = Query(None, description="仅校招岗位"),
    db: AsyncSession = Depends(get_db),
):
    """
    获取岗位列表（分页 + 筛选 + 排序）
    - period: today=今日, week=本周, month=本月
    - sort_by: created_at / posted_at / title
    - keyword: 模糊匹配标题或公司名
    - job_type / education / is_campus: 精确筛选
    """
    query = select(Job)

    # 数据源筛选
    if source:
        query = query.where(Job.source == source)

    # 分拣状态筛选
    if triage_status:
        normalized = _to_internal_status(triage_status)
        if normalized not in TRIAGE_STATUSES:
            raise HTTPException(status_code=400, detail="invalid triage_status")
        query = query.where(Job.triage_status.in_(_status_filter_values(triage_status)))

    # 池筛选（ungrouped = pool_id is null）
    if pool_id:
        if pool_id == "ungrouped":
            query = query.where(Job.pool_id.is_(None))
        else:
            try:
                pool_numeric_id = int(pool_id)
            except ValueError as exc:
                raise HTTPException(status_code=400, detail="invalid pool_id") from exc

            pool = (
                await db.execute(select(Pool).where(Pool.id == pool_numeric_id))
            ).scalar_one_or_none()
            if not pool:
                raise HTTPException(status_code=404, detail="Pool not found")
            if triage_status and pool.scope != triage_status:
                raise HTTPException(status_code=400, detail="pool scope does not match triage_status")

            query = query.where(Job.pool_id == pool_numeric_id)

    # 批次筛选
    if batch_id:
        query = query.where(Job.batch_id == batch_id)

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

    # 时间范围筛选
    if period == "today":
        query = query.where(Job.created_at >= datetime.utcnow().replace(hour=0, minute=0, second=0))
    elif period == "week":
        query = query.where(Job.created_at >= datetime.utcnow() - timedelta(days=7))
    elif period == "month":
        query = query.where(Job.created_at >= datetime.utcnow() - timedelta(days=30))

    # 排序
    sort_col = Job.created_at if sort_by not in ALLOWED_SORT_FIELDS else getattr(Job, sort_by)
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


@router.get("/batches")
async def list_batches(
    limit: int = Query(30, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """列出批次及其岗位数量，供 Inbox 未筛选分区使用"""
    batch_q = (
        select(
            Job.batch_id,
            func.count(Job.id).label("total"),
            func.sum(case((Job.triage_status.in_(_status_filter_values("inbox")), 1), else_=0)).label("inbox_count"),
            func.sum(case((Job.triage_status.in_(_status_filter_values("picked")), 1), else_=0)).label("picked_count"),
            func.sum(case((Job.triage_status == "ignored", 1), else_=0)).label("ignored_count"),
            func.max(Job.created_at).label("latest_created_at"),
        )
        .group_by(Job.batch_id)
        .order_by(desc(func.max(Job.created_at)))
        .limit(limit)
    )
    rows = (await db.execute(batch_q)).all()

    batch_ids = [r.batch_id for r in rows if r.batch_id]
    batch_meta: dict[str, Batch] = {}
    if batch_ids:
        meta_rows = await db.execute(select(Batch).where(Batch.id.in_(batch_ids)))
        for batch in meta_rows.scalars().all():
            batch_meta[batch.id] = batch

    return [
        {
            "batch_id": r.batch_id,
            "source": batch_meta[r.batch_id].source if r.batch_id in batch_meta else "",
            "keywords": batch_meta[r.batch_id].keywords if r.batch_id in batch_meta else [],
            "location": batch_meta[r.batch_id].location if r.batch_id in batch_meta else "",
            "total": r.total or 0,
            "inbox_count": r.inbox_count or 0,
            "picked_count": r.picked_count or 0,
            "ignored_count": r.ignored_count or 0,
            "latest_created_at": str(r.latest_created_at) if r.latest_created_at else None,
        }
        for r in rows
    ]


@router.patch("/batch-update")
async def patch_jobs_batch(data: JobBatchPatchRequest, db: AsyncSession = Depends(get_db)):
    """批量更新岗位分拣状态/池归属"""
    if not data.job_ids:
        raise HTTPException(status_code=400, detail="job_ids is required")

    if len(data.job_ids) > 500:
        raise HTTPException(status_code=400, detail="job_ids exceeds 500")

    if data.triage_status is None and data.pool_id is None and not data.clear_pool:
        raise HTTPException(status_code=400, detail="no update fields provided")

    triage_status = _to_internal_status(data.triage_status) if data.triage_status else None
    if triage_status and triage_status not in TRIAGE_STATUSES:
        raise HTTPException(status_code=400, detail="invalid triage_status")

    if data.pool_id is not None and data.clear_pool:
        raise HTTPException(status_code=400, detail="pool_id and clear_pool are mutually exclusive")

    if data.pool_id is not None and triage_status and triage_status != "picked":
        raise HTTPException(status_code=400, detail="pool_id can only be used with triage_status=picked")

    pool = None
    if data.pool_id is not None:
        pool = (
            await db.execute(select(Pool).where(Pool.id == data.pool_id))
        ).scalar_one_or_none()
        if not pool:
            raise HTTPException(status_code=404, detail="Pool not found")
        if pool.scope != "picked":
            raise HTTPException(status_code=400, detail="only picked scope pool can be assigned")

    result = await db.execute(select(Job).where(Job.id.in_(data.job_ids)))
    jobs = result.scalars().all()

    found_ids = {job.id for job in jobs}
    missing_ids = sorted(set(data.job_ids) - found_ids)
    if missing_ids:
        raise HTTPException(
            status_code=404,
            detail=f"some job_ids were not found: {missing_ids}",
        )

    updated = 0
    for job in jobs:
        if triage_status:
            job.triage_status = triage_status
            if triage_status != "picked":
                job.pool_id = None
            elif data.pool_id is None and not data.clear_pool:
                # 从未筛选流转到已筛选时，默认清空原池，避免跨分区残留关联
                job.pool_id = None

        if data.pool_id is not None:
            job.pool_id = data.pool_id
            if not data.triage_status:
                job.triage_status = "picked"

        if data.clear_pool:
            job.pool_id = None

        updated += 1

    await db.commit()
    return {"updated": updated, "pool_name": pool.name if pool else None}


@router.delete("/batch-delete")
async def delete_jobs_batch(data: JobBatchDeleteRequest, db: AsyncSession = Depends(get_db)):
    """批量彻底删除岗位（仅回收站 triage_status=ignored）"""
    if not data.job_ids:
        raise HTTPException(status_code=400, detail="job_ids is required")

    if len(data.job_ids) > 500:
        raise HTTPException(status_code=400, detail="job_ids exceeds 500")

    result = await db.execute(select(Job).where(Job.id.in_(data.job_ids)))
    jobs = result.scalars().all()

    found_ids = {job.id for job in jobs}
    missing_ids = sorted(set(data.job_ids) - found_ids)
    if missing_ids:
        raise HTTPException(status_code=404, detail=f"some job_ids were not found: {missing_ids}")

    non_ignored = [job.id for job in jobs if job.triage_status != "ignored"]
    if non_ignored:
        raise HTTPException(
            status_code=400,
            detail=f"only ignored jobs can be deleted permanently: {non_ignored}",
        )

    deleted = 0
    for job in jobs:
        await db.delete(job)
        deleted += 1

    await db.commit()
    return {"deleted": deleted}


@router.patch("/{job_id}")
async def patch_job(job_id: int, data: JobPatchRequest, db: AsyncSession = Depends(get_db)):
    """更新单个岗位的分拣状态与池归属"""
    if data.triage_status is None and data.pool_id is None and not data.clear_pool:
        raise HTTPException(status_code=400, detail="no update fields provided")

    triage_status = _to_internal_status(data.triage_status) if data.triage_status else None
    if triage_status and triage_status not in TRIAGE_STATUSES:
        raise HTTPException(status_code=400, detail="invalid triage_status")

    clear_pool = data.clear_pool or data.pool_id == 0
    pool_id = None if data.pool_id == 0 else data.pool_id

    if pool_id is not None and clear_pool:
        raise HTTPException(status_code=400, detail="pool_id and clear_pool are mutually exclusive")

    if pool_id is not None and triage_status and triage_status != "picked":
        raise HTTPException(status_code=400, detail="pool_id can only be used with triage_status=picked")

    result = await db.execute(select(Job).where(Job.id == job_id))
    job = result.scalar_one_or_none()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if triage_status is not None:
        job.triage_status = triage_status
        if triage_status != "picked":
            job.pool_id = None

    if pool_id is not None:
        pool = (await db.execute(select(Pool).where(Pool.id == pool_id))).scalar_one_or_none()
        if not pool:
            raise HTTPException(status_code=404, detail="Pool not found")
        if pool.scope != "picked":
            raise HTTPException(status_code=400, detail="only picked scope pool can be assigned")
        job.pool_id = pool_id
        if triage_status is None:
            job.triage_status = "picked"

    if clear_pool:
        job.pool_id = None

    await db.commit()
    await db.refresh(job)
    return _job_to_dict(job)


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


@router.get("/triage-counts")
async def triage_counts(db: AsyncSession = Depends(get_db)):
    """返回分拣状态计数（兼容旧状态和新状态命名）。"""
    unscreened = (
        await db.execute(
            select(func.count(Job.id)).where(Job.triage_status.in_(_status_filter_values("unscreened")))
        )
    ).scalar() or 0
    screened = (
        await db.execute(
            select(func.count(Job.id)).where(Job.triage_status.in_(_status_filter_values("screened")))
        )
    ).scalar() or 0
    ignored = (
        await db.execute(select(func.count(Job.id)).where(Job.triage_status == "ignored"))
    ).scalar() or 0

    return {
        "unscreened": unscreened,
        "screened": screened,
        "ignored": ignored,
        "inbox": unscreened,
        "picked": screened,
    }


@router.patch("/batch-triage")
async def batch_triage(data: BatchTriageRequest, db: AsyncSession = Depends(get_db)):
    """兼容新接口：批量分拣（pool_id=0 表示清空池）。"""
    triage_status = _to_internal_status(data.triage_status) if data.triage_status else None
    clear_pool = data.pool_id == 0
    pool_id = None if clear_pool else data.pool_id

    if not data.job_ids:
        raise HTTPException(status_code=400, detail="job_ids is required")
    if triage_status and triage_status not in TRIAGE_STATUSES:
        raise HTTPException(status_code=400, detail="invalid triage_status")

    values: dict = {}
    if triage_status:
        values["triage_status"] = triage_status
    if clear_pool:
        values["pool_id"] = None
    elif pool_id is not None:
        values["pool_id"] = pool_id
        if triage_status is None:
            values["triage_status"] = "picked"

    if not values:
        raise HTTPException(status_code=400, detail="no update fields provided")

    stmt = update(Job).where(Job.id.in_(data.job_ids)).values(**values)
    result = await db.execute(stmt)
    await db.commit()
    return {"updated": result.rowcount or 0}


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
    accepted_hash_keys: list[str] = []
    created_hash_keys: list[str] = []
    skipped_hash_keys: list[str] = []
    failed: list[dict[str, str]] = []

    def append_unique(target: list[str], value: str) -> None:
        key = (value or "").strip()
        if key and key not in target:
            target.append(key)

    ingest_batch_id = req.batch_id or f"manual-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
    await _ensure_batch(
        db,
        batch_id=ingest_batch_id,
        source=req.source,
        keywords=req.keywords,
        location=req.location,
    )

    for item in req.jobs:
        existing = await db.execute(select(Job).where(Job.hash_key == item.hash_key))
        if existing.scalar_one_or_none():
            skipped += 1
            append_unique(accepted_hash_keys, item.hash_key)
            append_unique(skipped_hash_keys, item.hash_key)
            continue

        job_batch_id = item.batch_id or ingest_batch_id
        await _ensure_batch(
            db,
            batch_id=job_batch_id,
            source=item.source,
            keywords=req.keywords,
            location=req.location,
        )

        job = Job(
            title=item.title,
            company=item.company,
            location=item.location,
            url=item.url,
            apply_url=item.apply_url,
            source=item.source,
            raw_description=item.raw_description,
            posted_at=_parse_posted_at(item.posted_at),
            batch_id=job_batch_id,
            triage_status="inbox",
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
        append_unique(accepted_hash_keys, item.hash_key)
        append_unique(created_hash_keys, item.hash_key)

    await db.flush()
    batch = (await db.execute(select(Batch).where(Batch.id == ingest_batch_id))).scalar_one_or_none()
    if batch:
        batch.total_fetched = (batch.total_fetched or 0) + created

    await db.commit()
    return {
        "created": created,
        "skipped": skipped,
        "batch_id": ingest_batch_id,
        "accepted_hash_keys": accepted_hash_keys,
        "created_hash_keys": created_hash_keys,
        "skipped_hash_keys": skipped_hash_keys,
        "failed": failed,
    }


async def _ensure_batch(
    db: AsyncSession,
    *,
    batch_id: str,
    source: str,
    keywords: list[str],
    location: str,
):
    """确保批次元数据存在；用于 Inbox 按批次分区展示"""
    if not batch_id:
        return

    result = await db.execute(select(Batch).where(Batch.id == batch_id))
    existing = result.scalar_one_or_none()
    if existing:
        return

    db.add(
        Batch(
            id=batch_id,
            source=source or "",
            keywords=keywords or [],
            location=location or "",
        )
    )


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
        "triage_status": job.triage_status,
        "pool_id": job.pool_id,
        "batch_id": job.batch_id,
        "created_at": str(job.created_at),
    }
