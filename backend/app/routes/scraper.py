# =============================================
# 爬虫管理路由 — 数据源控制面板 API
# =============================================
# GET  /api/scraper/sources      获取所有数据源状态
# POST /api/scraper/run          手动触发爬取任务
# GET  /api/scraper/tasks        获取任务列表
# =============================================

import asyncio
import hashlib
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import Job, Batch
from app.services.scrapers.base import get_all_scrapers, get_scraper
from app.services.campus_detector import detect_campus

router = APIRouter()
logger = logging.getLogger(__name__)


# ---- 内存中的任务状态（轻量实现，后续可换 Redis / DB） ----
_tasks: list[dict] = []


class RunRequest(BaseModel):
    """爬取任务请求"""
    source: str  # boss / zhilian / linkedin / shixiseng / maimai / corporate
    keywords: list[str] = ["校招"]
    location: str = ""
    max_results: int = 50


# ---- 数据源定义（含未实现的占位） ----
AVAILABLE_SOURCES = [
    {"key": "shixiseng", "name": "实习僧", "status": "ready", "description": "实习/校招垂直平台，反爬友好，数据丰富"},
    {"key": "boss", "name": "BOSS直聘", "status": "ready", "description": "国内主流招聘平台，需在设置中配置 Cookie"},
    {"key": "zhilian", "name": "智联招聘", "status": "ready", "description": "老牌招聘平台，支持 Cookie 认证（可选）"},
    {"key": "jobspy", "name": "JobSpy 聚合", "status": "ready", "description": "一键聚合 LinkedIn / Indeed / Google 国际岗位"},
    {"key": "linkedin", "name": "领英 (Apify)", "status": "skeleton", "description": "通过 Apify API 抓取，需配置 API Key"},
    {"key": "bytedance", "name": "字节跳动", "status": "skeleton", "description": "字节跳动官网招聘 (jobs.bytedance.com)"},
    {"key": "alibaba", "name": "阿里巴巴", "status": "skeleton", "description": "阿里巴巴人才官网 (talent.alibaba.com)"},
    {"key": "tencent", "name": "腾讯", "status": "skeleton", "description": "腾讯招聘官网 (careers.tencent.com)"},
    {"key": "maimai", "name": "脉脉", "status": "unsupported", "description": "脉脉无公开岗位接口，暂不支持"},
]


@router.get("/sources")
async def list_sources():
    """获取所有数据源及其状态"""
    registered = get_all_scrapers()
    result = []
    for src in AVAILABLE_SOURCES:
        is_registered = src["key"] in registered
        result.append({
            **src,
            "registered": is_registered,
            # 仅 status=ready 的源在注册后显示 ready，skeleton/planned 保持原状
            "status": src["status"] if src["status"] != "ready" and not is_registered else src["status"],
        })
    return result


@router.post("/run")
async def run_scraper(req: RunRequest, db: AsyncSession = Depends(get_db)):
    """
    手动触发爬取任务
    创建 Batch 记录追踪采集批次，返回 task_id + batch_id
    """
    scraper = get_scraper(req.source)
    if not scraper:
        raise HTTPException(
            status_code=400,
            detail=f"数据源 '{req.source}' 尚未实现，当前为骨架/计划状态"
        )

    task_id = hashlib.md5(f"{req.source}-{datetime.utcnow().isoformat()}".encode()).hexdigest()[:12]

    # 创建 Batch 记录
    batch = Batch(
        source=req.source,
        keywords=",".join(req.keywords),
        location=req.location,
        max_results=req.max_results,
        status="running",
    )
    db.add(batch)
    await db.commit()
    await db.refresh(batch)

    task_info = {
        "id": task_id,
        "source": req.source,
        "keywords": req.keywords,
        "location": req.location,
        "status": "running",
        "created_at": datetime.utcnow().isoformat(),
        "result": None,
        "batch_id": batch.id,
    }
    _tasks.append(task_info)

    # 异步执行爬虫任务
    asyncio.create_task(_execute_scraper(task_info, scraper, req, batch.id, db))

    return {"task_id": task_id, "status": "running", "batch_id": batch.id}


async def _execute_scraper(task_info: dict, scraper, req: RunRequest, batch_id: int, db: AsyncSession):
    """异步执行爬取 + 数据入库，新岗位关联 batch_id"""
    try:
        items = await scraper.search(
            keywords=req.keywords,
            location=req.location,
            max_results=req.max_results,
        )
        logger.info("[scraper] search returned %s items for source=%s", len(items), req.source)

        # Cookie 过期警告：BOSS/智联返回空结果 + Cookie 已配置 → 可能过期
        warning = ""
        if not items:
            if req.source == "boss":
                from app.routes.config import _current_config
                if _current_config.boss_cookie:
                    warning = "Cookie 可能已过期，请重新登录 zhipin.com 并更新 Cookie"
                else:
                    warning = "未配置 Cookie，请在设置页粘贴 BOSS直聘 Cookie"
            elif req.source == "zhilian":
                from app.routes.config import _current_config
                if not _current_config.zhilian_cookie:
                    warning = "未获取到数据，可尝试在设置页配置智联招聘 Cookie"

        created = 0
        skipped = 0
        for item in items:
            # 生成 hash_key 用于去重
            if not item.hash_key:
                raw = f"{item.title}-{item.company}-{item.url}"
                item.hash_key = hashlib.md5(raw.encode()).hexdigest()

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
                source=item.source or scraper.source_name,
                raw_description=item.raw_description,
                hash_key=item.hash_key,
                salary_text=item.salary,
                job_type=item.employment_type,
                company_industry=item.industries,
                triage_status="unscreened",
                batch_id=batch_id,
                is_campus=detect_campus(
                    title=item.title,
                    source=item.source or scraper.source_name,
                    experience="",
                    job_type=item.employment_type,
                    raw_description=item.raw_description,
                ),
            )
            db.add(job)
            created += 1

        await db.commit()
        task_info["status"] = "completed"
        task_info["result"] = {
            "created": created,
            "skipped": skipped,
            "total": len(items),
            "warning": warning,
        }

        # 更新 Batch 记录状态
        batch_result = await db.execute(select(Batch).where(Batch.id == batch_id))
        batch = batch_result.scalar_one_or_none()
        if batch:
            batch.job_count = created
            batch.status = "completed"
            await db.commit()

    except Exception as e:
        logger.error("[scraper] task failed: %s", e)
        task_info["status"] = "failed"
        task_info["result"] = {"error": str(e)}

        # 更新 Batch 为失败
        try:
            batch_result = await db.execute(select(Batch).where(Batch.id == batch_id))
            batch = batch_result.scalar_one_or_none()
            if batch:
                batch.status = "failed"
                await db.commit()
        except Exception:
            pass


@router.get("/tasks")
async def list_tasks():
    """获取最近的爬取任务列表"""
    return list(reversed(_tasks[-50:]))
