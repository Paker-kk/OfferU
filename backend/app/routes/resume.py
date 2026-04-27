# =============================================
# Resume 路由 — 简历管理 API（v2 重构版）
# =============================================
# 完整 CRUD + 段落管理 + 文件上传 + PDF 导出
# =============================================
# 数据模型：
#   Resume         → 简历主表（元信息 + 样式配置）
#   ResumeSection  → 段落通用块表（教育/经历/技能/项目/自定义）
#   ResumeTemplate → 模板表（CSS 变量 + HTML 布局）
# =============================================
# API 端点概览：
#   GET    /api/resume/                            获取简历列表
#   POST   /api/resume/                            创建新简历
#   GET    /api/resume/templates                   模板列表
#   GET    /api/resume/{id}                        获取完整简历（含所有段落）
#   PUT    /api/resume/{id}                        更新简历主信息
#   DELETE /api/resume/{id}                        删除简历（级联删段落）
#   POST   /api/resume/{id}/sections               添加段落
#   PUT    /api/resume/{id}/sections/{sid}          更新段落
#   DELETE /api/resume/{id}/sections/{sid}          删除段落
#   PUT    /api/resume/{id}/sections/reorder        段落排序
#   POST   /api/resume/{id}/photo                  上传头像
#   POST   /api/resume/{id}/export/pdf             导出 PDF
#   POST   /api/resume/parse                       Agent 解析简历（TODO）
# =============================================

from __future__ import annotations

import os
import time
import threading
from pathlib import Path

import re
import uuid
from io import BytesIO
from typing import Optional, Any

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
import anyio
from pydantic import BaseModel, Field
from jinja2 import Template
from sse_starlette import EventSourceResponse, ServerSentEvent

from app.database import get_db
from app.models.models import Resume, ResumeSection, ResumeTemplate, Job, Profile
from app.services.application_workspace import auto_write_job_to_total

router = APIRouter()

_EXPORT_IMAGE_CACHE_TTL_SECONDS = 120
_EXPORT_IMAGE_CACHE_MAX_ENTRIES = 8
_export_image_cache: dict[tuple[int, str, str], tuple[float, bytes]] = {}
_export_image_cache_lock = threading.Lock()


# =============================================
# Pydantic 请求/响应模型
# =============================================
# 严格定义 API 的输入输出结构，
# 前端按此契约传参，后端做类型校验。
# =============================================


class ResumeCreate(BaseModel):
    """创建简历的请求体"""
    user_name: str = ""
    title: str = "未命名简历"
    summary: str = ""
    contact_json: dict = Field(default_factory=dict)
    template_id: Optional[int] = None
    style_config: dict = Field(default_factory=dict)
    language: str = "zh"
    source_mode: str = "manual"
    source_job_ids: list[int] = Field(default_factory=list)
    source_profile_snapshot: dict = Field(default_factory=dict)


class ResumeUpdate(BaseModel):
    """更新简历的请求体（所有字段可选）"""
    user_name: Optional[str] = None
    title: Optional[str] = None
    summary: Optional[str] = None
    contact_json: Optional[dict] = None
    template_id: Optional[int] = None
    style_config: Optional[dict] = None
    is_primary: Optional[bool] = None
    language: Optional[str] = None
    source_mode: Optional[str] = None
    source_job_ids: Optional[list[int]] = None
    source_profile_snapshot: Optional[dict] = None


class SectionCreate(BaseModel):
    """创建段落的请求体"""
    section_type: str  # education / experience / skill / project / certificate / custom
    title: str = ""
    sort_order: int = 0
    visible: bool = True
    content_json: list = Field(default_factory=list)


class SectionUpdate(BaseModel):
    """更新段落的请求体（所有字段可选）"""
    title: Optional[str] = None
    sort_order: Optional[int] = None
    visible: Optional[bool] = None
    content_json: Optional[list] = None


class ReorderItem(BaseModel):
    """排序请求中的单个条目"""
    id: int
    sort_order: int


class SectionReorder(BaseModel):
    """段落排序请求体"""
    items: list[ReorderItem]


# =============================================
# 辅助函数
# =============================================


def _serialize_resume_brief(r: Resume, source_jobs_map: dict[int, dict] | None = None) -> dict:
    """序列化简历列表项（不含段落详情）"""
    source_ids = _normalize_source_job_ids(r.source_job_ids)
    source_jobs = _source_jobs_from_map(source_ids, source_jobs_map)
    return {
        "id": r.id,
        "user_name": r.user_name,
        "title": r.title,
        "photo_url": r.photo_url,
        "template_id": r.template_id,
        "is_primary": r.is_primary,
        "language": r.language,
        "source_mode": r.source_mode,
        "source_job_ids": source_ids,
        "source_jobs": source_jobs,
        "source_profile_snapshot": r.source_profile_snapshot or {},
        "created_at": str(r.created_at),
        "updated_at": str(r.updated_at),
    }


def _serialize_section(s: ResumeSection) -> dict:
    """序列化单个段落"""
    return {
        "id": s.id,
        "resume_id": s.resume_id,
        "section_type": s.section_type,
        "sort_order": s.sort_order,
        "title": s.title,
        "visible": s.visible,
        "content_json": s.content_json,
    }


def _normalize_source_job_ids(source_job_ids: Any) -> list[int]:
    if not isinstance(source_job_ids, list):
        return []
    normalized: list[int] = []
    for item in source_job_ids:
        if isinstance(item, int) and item > 0:
            normalized.append(item)
            continue
        if isinstance(item, str) and item.isdigit():
            normalized.append(int(item))
    return normalized


def _source_jobs_from_map(source_ids: list[int], source_jobs_map: dict[int, dict] | None) -> list[dict]:
    if not source_jobs_map:
        return []
    return [source_jobs_map[job_id] for job_id in source_ids if job_id in source_jobs_map]


async def _load_source_jobs_map(db: AsyncSession, source_job_ids: list[int]) -> dict[int, dict]:
    if not source_job_ids:
        return {}
    result = await db.execute(select(Job).where(Job.id.in_(source_job_ids)))
    jobs = result.scalars().all()
    return {
        job.id: {
            "id": job.id,
            "title": job.title,
            "company": job.company,
        }
        for job in jobs
    }


def _serialize_resume_full(r: Resume, source_jobs_map: dict[int, dict] | None = None) -> dict:
    """
    序列化完整简历（含所有段落），用于编辑器页面。
    前端根据此结构渲染左侧编辑区和右侧 A4 预览。
    """
    source_ids = _normalize_source_job_ids(r.source_job_ids)
    source_jobs = _source_jobs_from_map(source_ids, source_jobs_map)
    return {
        "id": r.id,
        "user_name": r.user_name,
        "title": r.title,
        "photo_url": r.photo_url,
        "summary": r.summary,
        "contact_json": r.contact_json,
        "template_id": r.template_id,
        "style_config": r.style_config,
        "is_primary": r.is_primary,
        "language": r.language,
        "source_mode": r.source_mode,
        "source_job_ids": source_ids,
        "source_jobs": source_jobs,
        "source_profile_snapshot": r.source_profile_snapshot or {},
        "sections": [_serialize_section(s) for s in r.sections],
        "created_at": str(r.created_at),
        "updated_at": str(r.updated_at),
    }


async def _get_resume_or_404(
    resume_id: int, db: AsyncSession, *, load_sections: bool = False
) -> Resume:
    """
    根据 ID 获取简历，不存在则抛 404。
    load_sections=True 时 eager load 段落列表，避免 N+1 查询。
    """
    stmt = select(Resume).where(Resume.id == resume_id)
    if load_sections:
        stmt = stmt.options(selectinload(Resume.sections))
    result = await db.execute(stmt)
    resume = result.scalar_one_or_none()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
    return resume


# =============================================
# 简历 CRUD 端点
# =============================================


@router.get("/")
async def list_resumes(db: AsyncSession = Depends(get_db)):
    """获取所有简历（列表概览，不含段落详情）"""
    result = await db.execute(select(Resume).order_by(Resume.updated_at.desc()))
    resumes = result.scalars().all()
    source_job_ids = sorted({
        job_id
        for resume in resumes
        for job_id in _normalize_source_job_ids(resume.source_job_ids)
    })
    source_jobs_map = await _load_source_jobs_map(db, source_job_ids)
    return [_serialize_resume_brief(r, source_jobs_map) for r in resumes]


@router.post("/")
async def create_resume(data: ResumeCreate, db: AsyncSession = Depends(get_db)):
    """
    创建新简历
    ─────────────────────────────────────────────
    流程：
    1. 根据请求体创建 Resume 主记录
    2. 自动创建默认段落（教育、经历、技能），方便用户直接编辑
    3. 返回完整简历（含段落）
    """
    requested_user_name = (data.user_name or "").strip()
    contact_json = {
        str(key): value
        for key, value in dict(data.contact_json or {}).items()
        if isinstance(value, str) and value.strip()
    }

    # 新建简历时优先从默认档案补齐基础信息，避免用户重复填写
    if not requested_user_name or not contact_json:
        profile_result = await db.execute(
            select(Profile).order_by(Profile.is_default.desc(), Profile.updated_at.desc())
        )
        profile = profile_result.scalars().first()
        if profile:
            base_info = profile.base_info_json if isinstance(profile.base_info_json, dict) else {}
            if not requested_user_name:
                requested_user_name = str(base_info.get("name") or profile.name or "").strip()

            for field in ("phone", "email", "linkedin", "github", "website", "wechat"):
                value = str(base_info.get(field, "")).strip()
                if value and not str(contact_json.get(field, "")).strip():
                    contact_json[field] = value

    if not requested_user_name:
        requested_user_name = "默认候选人"

    resume = Resume(
        user_name=requested_user_name,
        title=data.title,
        summary=data.summary,
        contact_json=contact_json,
        template_id=data.template_id,
        style_config=data.style_config,
        language=data.language,
        source_mode=data.source_mode,
        source_job_ids=data.source_job_ids,
        source_profile_snapshot=data.source_profile_snapshot,
    )
    db.add(resume)
    await db.flush()  # 获取 resume.id，但不提交事务

    # 自动创建默认段落，让新简历不是空白页
    default_sections = [
        ResumeSection(
            resume_id=resume.id, section_type="education",
            title="教育经历", sort_order=0, content_json=[],
        ),
        ResumeSection(
            resume_id=resume.id, section_type="experience",
            title="工作经历", sort_order=1, content_json=[],
        ),
        ResumeSection(
            resume_id=resume.id, section_type="skill",
            title="技能", sort_order=2, content_json=[],
        ),
    ]
    db.add_all(default_sections)
    await db.commit()
    await db.refresh(resume)

    # 重新加载含段落的完整数据
    fresh_resume = await _get_resume_or_404(resume.id, db, load_sections=True)
    source_jobs_map = await _load_source_jobs_map(db, _normalize_source_job_ids(fresh_resume.source_job_ids))
    return _serialize_resume_full(fresh_resume, source_jobs_map)


@router.get("/templates")
async def list_templates(db: AsyncSession = Depends(get_db)):
    """获取所有可用模板"""
    result = await db.execute(select(ResumeTemplate).order_by(ResumeTemplate.id))
    templates = result.scalars().all()
    return [
        {
            "id": t.id,
            "name": t.name,
            "thumbnail_url": t.thumbnail_url,
            "css_variables": t.css_variables,
            "is_builtin": t.is_builtin,
        }
        for t in templates
    ]


@router.post("/{resume_id}/apply-template/{template_id}")
async def apply_template(resume_id: int, template_id: int, db: AsyncSession = Depends(get_db)):
    """
    应用模板到简历 — 将模板的 css_variables 合并到简历的 style_config
    关联 template_id 到简历，并用模板的 CSS 变量覆盖当前样式
    """
    resume = await _get_resume_or_404(resume_id, db)
    tpl_result = await db.execute(select(ResumeTemplate).where(ResumeTemplate.id == template_id))
    template = tpl_result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="模板不存在")

    resume.template_id = template_id
    # 将模板 CSS 变量合并到 style_config（模板值覆盖当前值）
    merged = {**(resume.style_config or {}), **(template.css_variables or {})}
    resume.style_config = merged
    await db.commit()
    await db.refresh(resume)
    return {"ok": True, "style_config": merged}


@router.get("/{resume_id}")
async def get_resume(resume_id: int, db: AsyncSession = Depends(get_db)):
    """获取完整简历详情（含所有段落），用于编辑器页面"""
    resume = await _get_resume_or_404(resume_id, db, load_sections=True)
    source_jobs_map = await _load_source_jobs_map(db, _normalize_source_job_ids(resume.source_job_ids))
    return _serialize_resume_full(resume, source_jobs_map)


@router.put("/{resume_id}")
async def update_resume(
    resume_id: int, data: ResumeUpdate, db: AsyncSession = Depends(get_db)
):
    """
    更新简历主信息（不含段落）
    ─────────────────────────────────────────────
    只更新请求体中非 None 的字段，实现 PATCH 语义。
    段落的增删改通过独立端点操作。
    """
    resume = await _get_resume_or_404(resume_id, db)
    update_data = data.model_dump(exclude_none=True)
    for key, value in update_data.items():
        setattr(resume, key, value)
    await db.commit()
    await db.refresh(resume)
    fresh_resume = await _get_resume_or_404(resume.id, db, load_sections=True)
    source_jobs_map = await _load_source_jobs_map(db, _normalize_source_job_ids(fresh_resume.source_job_ids))
    return _serialize_resume_full(fresh_resume, source_jobs_map)


@router.delete("/{resume_id}")
async def delete_resume(resume_id: int, db: AsyncSession = Depends(get_db)):
    """删除简历（ORM cascade 自动删除关联段落）"""
    resume = await _get_resume_or_404(resume_id, db)
    await db.delete(resume)
    await db.commit()
    return {"message": "Resume deleted"}


# =============================================
# 段落 CRUD 端点
# =============================================


@router.post("/{resume_id}/sections")
async def create_section(
    resume_id: int, data: SectionCreate, db: AsyncSession = Depends(get_db)
):
    """向指定简历添加一个新段落"""
    await _get_resume_or_404(resume_id, db)  # 确认简历存在
    section = ResumeSection(
        resume_id=resume_id,
        section_type=data.section_type,
        title=data.title,
        sort_order=data.sort_order,
        visible=data.visible,
        content_json=data.content_json,
    )
    db.add(section)
    await db.commit()
    await db.refresh(section)
    return _serialize_section(section)


@router.put("/{resume_id}/sections/{section_id}")
async def update_section(
    resume_id: int,
    section_id: int,
    data: SectionUpdate,
    db: AsyncSession = Depends(get_db),
):
    """更新指定段落（只更新非 None 字段）"""
    result = await db.execute(
        select(ResumeSection).where(
            ResumeSection.id == section_id,
            ResumeSection.resume_id == resume_id,
        )
    )
    section = result.scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")

    update_data = data.model_dump(exclude_none=True)
    for key, value in update_data.items():
        setattr(section, key, value)
    await db.commit()
    await db.refresh(section)
    return _serialize_section(section)


@router.delete("/{resume_id}/sections/{section_id}")
async def delete_section(
    resume_id: int, section_id: int, db: AsyncSession = Depends(get_db)
):
    """删除指定段落"""
    result = await db.execute(
        select(ResumeSection).where(
            ResumeSection.id == section_id,
            ResumeSection.resume_id == resume_id,
        )
    )
    section = result.scalar_one_or_none()
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    await db.delete(section)
    await db.commit()
    return {"message": "Section deleted"}


@router.put("/{resume_id}/sections/reorder")
async def reorder_sections(
    resume_id: int, data: SectionReorder, db: AsyncSession = Depends(get_db)
):
    """
    批量更新段落排序
    ─────────────────────────────────────────────
    前端拖拽排序后，一次性提交所有段落的新 sort_order。
    """
    await _get_resume_or_404(resume_id, db)
    for item in data.items:
        result = await db.execute(
            select(ResumeSection).where(
                ResumeSection.id == item.id,
                ResumeSection.resume_id == resume_id,
            )
        )
        section = result.scalar_one_or_none()
        if section:
            section.sort_order = item.sort_order
    await db.commit()
    return {"message": "Sections reordered"}


# =============================================
# 文件上传端点
# =============================================

# 头像存储目录（后端本地），生产环境可替换为云存储
BACKEND_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
)

UPLOAD_DIR = os.path.join(
    BACKEND_DIR,
    "uploads", "photos",
)


@router.post("/{resume_id}/photo")
async def upload_photo(
    resume_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    上传简历头像
    ─────────────────────────────────────────────
    流程：
    1. 校验文件类型（仅允许 JPEG/PNG/WebP）
    2. 限制文件大小（最大 5MB）
    3. 生成唯一文件名，写入本地 uploads/photos 目录
    4. 更新 resume.photo_url 为相对路径
    5. 返回可访问的 URL
    """
    resume = await _get_resume_or_404(resume_id, db)

    # 安全校验：只允许图片类型
    allowed_types = {"image/jpeg", "image/png", "image/webp"}
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: {file.content_type}",
        )

    # 限制文件大小（5MB）
    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 5MB)")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = file.filename.rsplit(".", 1)[-1] if "." in (file.filename or "") else "jpg"
    # 使用 UUID 防止文件名冲突和路径遍历
    filename = f"{uuid.uuid4().hex}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)

    with open(filepath, "wb") as f:
        f.write(contents)

    photo_url = f"/uploads/photos/{filename}"
    resume.photo_url = photo_url
    await db.commit()

    return {"photo_url": photo_url}


# =============================================
# PDF 导出
# =============================================
# 流程：
#   1. 从 DB 读取简历 + 段落 + 模板
#   2. 合并模板 css_variables 与用户 style_config
#   3. 使用 Jinja2 渲染 HTML
#   4. WeasyPrint 将 HTML → PDF
#   5. StreamingResponse 返回二进制流
# =============================================

# 默认 HTML 模板：双栏专业简历（左侧深色栏 + 右侧主内容）
# 使用 CSS 变量实现样式可调，并与前端预览视觉保持一致
DEFAULT_HTML_TEMPLATE = Template("""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
    :root {
        --primary-color: {{ primary_color }};
        --accent-color: {{ accent_color }};
        --body-size: {{ body_size }};
        --heading-size: {{ heading_size }};
        --line-height: {{ line_height }};
        --page-margin: {{ page_margin }};
        --section-gap: {{ section_gap }};
        --font-family: {{ font_family }};
    }

    @page {
        size: A4;
        margin: 0;
    }

    html,
    body {
        margin: 0;
        padding: 0;
        width: 100%%;
        height: 100%%;
        background: #ffffff;
    }

    body {
        font-family: var(--font-family);
        font-size: var(--body-size);
        line-height: var(--line-height);
        color: #1f1f1f;
        background: #ffffff;
    }

    .page {
        width: 100%%;
        min-height: 297mm;
        display: flex;
    }

    .sidebar {
        width: 32%%;
        flex-shrink: 0;
        background: var(--primary-color);
        color: #ffffff;
        padding: 22pt 16pt;
        box-sizing: border-box;
        min-height: 297mm;
    }

    .photo-wrap {
        text-align: center;
        margin-top: 2pt;
    }

    .photo-wrap img {
        width: 72px;
        height: 72px;
        border-radius: 50%%;
        object-fit: cover;
        border: 2px solid rgba(255, 255, 255, 0.28);
    }

    .photo-fallback {
        width: 72px;
        height: 72px;
        border-radius: 50%%;
        border: 2px dashed rgba(255, 255, 255, 0.28);
        color: rgba(255, 255, 255, 0.35);
        margin: 0 auto;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 24px;
        font-weight: 500;
    }

    .name {
        margin-top: 8pt;
        text-align: center;
        font-size: 16pt;
        font-weight: 700;
        letter-spacing: 1px;
    }

    .sidebar-title {
        margin-top: 14pt;
        margin-bottom: 5pt;
        padding-bottom: 3pt;
        border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        font-size: max(8pt, calc(var(--heading-size) - 1pt));
        letter-spacing: 1px;
        font-weight: 700;
    }

    .contact-line {
        font-size: max(7pt, calc(var(--body-size) - 1.2pt));
        line-height: 1.55;
        opacity: 0.95;
        word-break: break-all;
        margin-bottom: 3pt;
    }

    .skill-group {
        margin-bottom: 5pt;
    }

    .skill-category {
        font-size: max(7pt, calc(var(--body-size) - 0.8pt));
        font-weight: 700;
        margin-bottom: 3pt;
        opacity: 0.9;
    }

    .skills-list {
        display: flex;
        flex-wrap: wrap;
        gap: 3pt;
    }

    .skill-tag {
        display: inline-block;
        background: rgba(255, 255, 255, 0.14);
        color: rgba(255, 255, 255, 0.9);
        border-radius: 3pt;
        padding: 1pt 6pt;
        font-size: max(6.5pt, calc(var(--body-size) - 2pt));
    }

    .main {
        flex: 1;
        background: #ffffff;
        color: #222;
        padding: 22pt 24pt;
        box-sizing: border-box;
        min-height: 297mm;
    }

    .section {
        margin-bottom: 11pt;
    }

    .section-title {
        margin: 0 0 5pt;
        padding-bottom: 2pt;
        border-bottom: 1.5px solid #333;
        font-size: var(--heading-size);
        font-weight: 700;
        color: #111;
        letter-spacing: 0.6px;
    }

    .summary {
        color: #4b4b4b;
        font-style: italic;
        font-size: max(8pt, calc(var(--body-size) - 0.3pt));
    }

    .entry {
        margin-bottom: 7pt;
    }

    .entry-head {
        display: flex;
        justify-content: space-between;
        gap: 8pt;
        align-items: baseline;
    }

    .entry-title {
        font-weight: 700;
        color: #1e1e1e;
    }

    .entry-meta {
        flex-shrink: 0;
        color: #6f6f6f;
        font-size: max(7pt, calc(var(--body-size) - 1.3pt));
    }

    .entry-sub {
        margin-top: 1pt;
        color: #5f5f5f;
        font-size: max(7.5pt, calc(var(--body-size) - 0.7pt));
    }

    .entry-desc {
        margin-top: 2pt;
        color: #333;
    }

    .entry-desc ul {
        padding-left: 15pt;
        margin: 2pt 0;
    }

    .entry-desc li {
        margin-bottom: 2pt;
    }
</style>
</head>
<body>
    {% set skill_sections = sections | selectattr("visible") | selectattr("section_type", "equalto", "skill") | list %}
    {% set main_sections = sections | selectattr("visible") | rejectattr("section_type", "equalto", "skill") | list %}

    <div class="page">
        <aside class="sidebar">
            <div class="photo-wrap">
                {% if photo_url %}
                    <img src="{{ photo_url }}" />
                {% else %}
                    <div class="photo-fallback">?</div>
                {% endif %}
            </div>
            <div class="name">{{ name }}</div>

            {% if contact_line %}
                <div class="sidebar-title">联系方式</div>
                {% for c in contact_line.split(" · ") %}
                    {% if c.strip() %}
                        <div class="contact-line">{{ c }}</div>
                    {% endif %}
                {% endfor %}
            {% endif %}

            {% for sec in skill_sections %}
                <div class="sidebar-title">{{ sec.title }}</div>
                {% for group in sec.content_json %}
                    <div class="skill-group">
                        {% if group.category %}<div class="skill-category">{{ group.category }}</div>{% endif %}
                        <div class="skills-list">
                            {% for s in group.items %}
                                <span class="skill-tag">{{ s }}</span>
                            {% endfor %}
                        </div>
                    </div>
                {% endfor %}
            {% endfor %}
        </aside>

        <main class="main">
            {% if summary %}
                <section class="section">
                    <h2 class="section-title">职业概述</h2>
                    <div class="summary">{{ summary }}</div>
                </section>
            {% endif %}

            {% for section in main_sections %}
            <section class="section">
                <h2 class="section-title">{{ section.title }}</h2>

                {% if section.section_type == "education" %}
                    {% for item in section.content_json %}
                    <div class="entry">
                        <div class="entry-head">
                            <div class="entry-title">{{ item.school }}{% if item.degree %} — {{ item.degree }}{% endif %}{% if item.major %}, {{ item.major }}{% endif %}</div>
                            <div class="entry-meta">{{ item.startDate }}{% if item.endDate %} - {{ item.endDate }}{% endif %}</div>
                        </div>
                        <div class="entry-sub">{% if item.gpa %}GPA: {{ item.gpa }}{% endif %}</div>
                        {% if item.description %}<div class="entry-desc">{{ item.description }}</div>{% endif %}
                    </div>
                    {% endfor %}

                {% elif section.section_type == "experience" %}
                    {% for item in section.content_json %}
                    <div class="entry">
                        <div class="entry-head">
                            <div class="entry-title">{{ item.position }}{% if item.company %} @ {{ item.company }}{% endif %}</div>
                            <div class="entry-meta">{{ item.startDate }}{% if item.endDate %} - {{ item.endDate }}{% endif %}</div>
                        </div>
                        {% if item.description %}<div class="entry-desc">{{ item.description }}</div>{% endif %}
                    </div>
                    {% endfor %}

                {% elif section.section_type == "project" %}
                    {% for item in section.content_json %}
                    <div class="entry">
                        <div class="entry-head">
                            <div class="entry-title">{{ item.name }}{% if item.role %} — {{ item.role }}{% endif %}</div>
                            <div class="entry-meta">{{ item.startDate }}{% if item.endDate %} - {{ item.endDate }}{% endif %}</div>
                        </div>
                        {% if item.url %}<div class="entry-sub">{{ item.url }}</div>{% endif %}
                        {% if item.description %}<div class="entry-desc">{{ item.description }}</div>{% endif %}
                    </div>
                    {% endfor %}

                {% elif section.section_type == "certificate" %}
                    {% for item in section.content_json %}
                    <div class="entry">
                        <div class="entry-head">
                            <div class="entry-title">{{ item.name }}{% if item.issuer %} — {{ item.issuer }}{% endif %}</div>
                            <div class="entry-meta">{{ item.date }}</div>
                        </div>
                        {% if item.url %}<div class="entry-sub">{{ item.url }}</div>{% endif %}
                    </div>
                    {% endfor %}

                {% else %}
                    {% for item in section.content_json %}
                    <div class="entry">
                        {% if item.subtitle %}<div class="entry-title">{{ item.subtitle }}</div>{% endif %}
                        {% if item.description %}<div class="entry-desc">{{ item.description }}</div>{% endif %}
                    </div>
                    {% endfor %}
                {% endif %}
            </section>
            {% endfor %}
        </main>
    </div>
</body>
</html>
""")

# 默认 CSS 变量值（用户未自定义时使用）
DEFAULT_STYLE = {
    "primaryColor": "#222222",
    "accentColor": "#666666",
    "bodySize": "10pt",
    "headingSize": "12pt",
    "lineHeight": "1.5",
    "pageMargin": "2cm",
    "sectionGap": "14pt",
    "fontFamily": '"Helvetica Neue", "PingFang SC", "Microsoft YaHei", sans-serif',
}


def _resolve_photo_url_for_render(photo_url: str) -> str:
    """
    将 /uploads/... 相对路径转换为本地 file:// URI，方便 WeasyPrint 读取头像。
    """
    if not photo_url:
        return ""

    if photo_url.startswith("/uploads/"):
        local_path = os.path.join(BACKEND_DIR, photo_url.lstrip("/"))
        if os.path.exists(local_path):
            return Path(local_path).as_uri()

    return photo_url


def _build_contact_line(contact_json: Optional[dict]) -> str:
    c = contact_json or {}
    contact_parts = [
        c.get("phone", ""),
        c.get("email", ""),
        c.get("linkedin", ""),
        c.get("website", ""),
    ]
    return " · ".join(str(p).strip() for p in contact_parts if str(p).strip())


def _serialize_export_sections(resume: Resume) -> list[dict]:
    return [
        {
            "title": s.title,
            "section_type": s.section_type,
            "visible": s.visible,
            "content_json": s.content_json or [],
        }
        for s in resume.sections
    ]


async def _resolve_export_style(resume: Resume, db: AsyncSession) -> dict:
    """
    合并样式优先级：默认 < 模板 < 用户覆盖。
    """
    style = {**DEFAULT_STYLE}

    if resume.template_id:
        tpl_result = await db.execute(
            select(ResumeTemplate).where(ResumeTemplate.id == resume.template_id)
        )
        tpl = tpl_result.scalar_one_or_none()
        if tpl and tpl.css_variables:
            style.update(tpl.css_variables)

    if resume.style_config:
        style.update(resume.style_config)

    return style


async def _render_resume_html_for_export(resume: Resume, db: AsyncSession) -> str:
    style = await _resolve_export_style(resume, db)

    return DEFAULT_HTML_TEMPLATE.render(
        name=resume.user_name,
        photo_url=_resolve_photo_url_for_render(resume.photo_url or ""),
        contact_line=_build_contact_line(resume.contact_json),
        summary=resume.summary or "",
        sections=_serialize_export_sections(resume),
        primary_color=style.get("primaryColor", "#222"),
        accent_color=style.get("accentColor", "#666"),
        body_size=style.get("bodySize", "10pt"),
        heading_size=style.get("headingSize", "12pt"),
        line_height=style.get("lineHeight", "1.5"),
        page_margin=style.get("pageMargin", "2cm"),
        section_gap=style.get("sectionGap", "14pt"),
        font_family=style.get("fontFamily", "sans-serif"),
    )


def _render_resume_png_from_pdf(pdf_bytes: bytes, scale: float) -> bytes:
    try:
        import fitz  # PyMuPDF
    except ImportError:
        raise HTTPException(status_code=500, detail="PyMuPDF not installed")

    safe_scale = _normalize_export_image_scale(scale)
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    try:
        if doc.page_count < 1:
            raise HTTPException(status_code=500, detail="Empty resume page")

        matrix = fitz.Matrix(safe_scale, safe_scale)
        pixmaps: list[Any] = [
            page.get_pixmap(matrix=matrix, alpha=False)
            for page in doc
        ]

        if len(pixmaps) == 1:
            return pixmaps[0].tobytes("png")

        max_width = max(pix.width for pix in pixmaps)
        total_height = sum(pix.height for pix in pixmaps)

        merged = fitz.Pixmap(fitz.csRGB, fitz.IRect(0, 0, max_width, total_height), False)
        merged.set_rect(merged.irect, (255, 255, 255))

        offset_y = 0
        for pix in pixmaps:
            offset_x = max(0, (max_width - pix.width) // 2)
            pix.set_origin(offset_x, offset_y)
            merged.copy(pix, pix.irect)
            offset_y += pix.height

        return merged.tobytes("png")
    finally:
        doc.close()


def _normalize_export_image_scale(scale: float) -> float:
    return max(1.0, min(scale, 2.2))


def _render_resume_pdf_bytes(html_str: str) -> bytes:
    try:
        from weasyprint import HTML
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"WeasyPrint unavailable: {exc}")

    try:
        return HTML(string=html_str).write_pdf()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to render PDF: {exc}")


def _build_export_image_cache_key(resume: Resume, scale: float) -> tuple[int, str, str]:
    return (resume.id, str(resume.updated_at or ""), f"{scale:.2f}")


def _get_cached_export_image(cache_key: tuple[int, str, str]) -> bytes | None:
    now = time.monotonic()
    with _export_image_cache_lock:
        cached = _export_image_cache.get(cache_key)
        if not cached:
            return None

        expires_at, png_bytes = cached
        if expires_at <= now:
            _export_image_cache.pop(cache_key, None)
            return None

        return png_bytes


def _set_cached_export_image(cache_key: tuple[int, str, str], png_bytes: bytes) -> None:
    now = time.monotonic()
    with _export_image_cache_lock:
        _export_image_cache[cache_key] = (now + _EXPORT_IMAGE_CACHE_TTL_SECONDS, png_bytes)

        expired_keys = [
            key
            for key, (expires_at, _) in _export_image_cache.items()
            if expires_at <= now
        ]
        for key in expired_keys:
            _export_image_cache.pop(key, None)

        overflow = len(_export_image_cache) - _EXPORT_IMAGE_CACHE_MAX_ENTRIES
        if overflow > 0:
            oldest_keys = sorted(_export_image_cache.items(), key=lambda item: item[1][0])[:overflow]
            for key, _ in oldest_keys:
                _export_image_cache.pop(key, None)


@router.post("/{resume_id}/export/pdf")
async def export_pdf(resume_id: int, db: AsyncSession = Depends(get_db)):
    """
    导出简历为 PDF
    ─────────────────────────────────────────────
    1. 读取简历 + 段落 + 模板
    2. 使用统一 HTML 渲染逻辑（与图片导出共用）
    3. WeasyPrint 转 PDF
    4. StreamingResponse 返回
    """
    resume = await _get_resume_or_404(resume_id, db, load_sections=True)
    html_str = await _render_resume_html_for_export(resume, db)
    pdf_bytes = await anyio.to_thread.run_sync(_render_resume_pdf_bytes, html_str)

    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="resume_{resume_id}.pdf"',
        },
    )


@router.get("/{resume_id}/export/image")
@router.post("/{resume_id}/export/image")
async def export_image(
    resume_id: int,
    db: AsyncSession = Depends(get_db),
    scale: float = 1.2,
):
    """
    导出完整简历为 PNG 图片
    ─────────────────────────────────────────────
    1. 复用与 PDF 相同的 HTML 模板渲染
    2. WeasyPrint 先生成 PDF（二进制）
    3. PyMuPDF 将所有页光栅化并纵向拼接成单张 PNG
    """
    resume = await _get_resume_or_404(resume_id, db, load_sections=True)
    html_str = await _render_resume_html_for_export(resume, db)
    safe_scale = _normalize_export_image_scale(scale)
    cache_key = _build_export_image_cache_key(resume, safe_scale)
    cached_png = _get_cached_export_image(cache_key)

    if cached_png is not None:
        return StreamingResponse(
            BytesIO(cached_png),
            media_type="image/png",
            headers={
                "Content-Disposition": f'inline; filename="resume_{resume_id}.png"',
                "Cache-Control": "private, max-age=120",
                "X-OfferU-Export-Cache": "hit",
            },
        )

    pdf_bytes = await anyio.to_thread.run_sync(_render_resume_pdf_bytes, html_str)

    try:
        png_bytes = await anyio.to_thread.run_sync(_render_resume_png_from_pdf, pdf_bytes, safe_scale)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to render image: {exc}")

    _set_cached_export_image(cache_key, png_bytes)

    return StreamingResponse(
        BytesIO(png_bytes),
        media_type="image/png",
        headers={
            "Content-Disposition": f'inline; filename="resume_{resume_id}.png"',
            "Cache-Control": "private, max-age=120",
            "X-OfferU-Export-Cache": "miss",
        },
    )


# =============================================
# =============================================
# AI 简历优化 — 多 LLM Provider 架构
# =============================================
# 端点：POST /api/resume/{id}/ai/optimize
#       POST /api/resume/ai/optimize-text
#
# 工作流：
#   1. 前端传入 JD（手动粘贴 或 job_id 从 DB 读取）
#   2. 后端读取简历数据 + JD
#   3. 调用 resume_optimizer agent（通过 llm.py 抽象层）
#   4. 返回关键词匹配 + 逐条优化建议
#   5. 前端 Diff 式逐条展示，用户 Accept / Reject
# =============================================


class AiOptimizeRequest(BaseModel):
    """AI 优化请求体 — 基于已有简历"""
    jd_text: Optional[str] = None
    job_id: Optional[int] = None


class AiOptimizeTextRequest(BaseModel):
    """AI 优化请求体 — 粘贴纯文本（无需预先创建简历）"""
    resume_text: str
    jd_text: str


@router.post("/{resume_id}/ai/optimize")
async def ai_optimize_resume(
    resume_id: int,
    data: AiOptimizeRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    AI 优化简历 — 对标 JD 生成优化建议
    ─────────────────────────────────────────────
    支持两种 JD 来源：
      1. jd_text: 用户手动粘贴的 JD 文本
      2. job_id: 从 jobs 表读取 raw_description
    至少提供其中一种，否则返回 400。

    响应：
      {
        "keyword_match": { "matched": [...], "missing": [...], "score": 75 },
        "suggestions": [
          { "type": "...", "original": "...", "suggested": "...", "reason": "..." }
        ],
        "summary": "整体分析"
      }
    """
    from app.agents.resume_optimizer import optimize_resume_with_context

    # ── 1. 获取简历数据 ──
    resume = await _get_resume_or_404(resume_id, db, load_sections=True)

    # ── 2. 获取 JD 文本 ──
    jd_text = ""
    if data.jd_text:
        jd_text = data.jd_text.strip()
    elif data.job_id:
        result = await db.execute(select(Job).where(Job.id == data.job_id))
        job = result.scalar_one_or_none()
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        jd_text = job.raw_description or ""

    if not jd_text:
        raise HTTPException(
            status_code=400,
            detail="请提供 JD 文本（jd_text）或选择岗位（job_id）",
        )

    # ── 3. 调用 AI Agent ──
    resume_data = _serialize_resume_full(resume)
    try:
        ai_result = await optimize_resume_with_context(resume_data, jd_text)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not ai_result:
        raise HTTPException(
            status_code=500,
            detail="AI 优化失败，请检查 LLM API Key 配置",
        )

    return ai_result


@router.post("/ai/optimize-text")
async def ai_optimize_text(data: AiOptimizeTextRequest):
    """
    粘贴文本快速优化 — 无需预先创建简历
    ─────────────────────────────────────────────
    前端「粘贴 JD」入口直接调用此端点，
    用户粘贴简历文本 + JD 文本，立即获取分析结果。
    """
    from app.agents.resume_optimizer import optimize_resume

    if not data.resume_text.strip() or not data.jd_text.strip():
        raise HTTPException(status_code=400, detail="简历和 JD 文本不能为空")

    try:
        ai_result = await optimize_resume(data.resume_text.strip(), data.jd_text.strip())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    if not ai_result:
        raise HTTPException(
            status_code=500,
            detail="AI 优化失败，请检查 LLM API Key 配置",
        )

    return ai_result


# =============================================
# AI Skill Pipeline — 模块化分步分析
# =============================================
# 新一代分析端点，使用 Skill Pipeline 架构：
#   Skill 1: JD 解析 → Skill 2: 匹配分析
# 相比旧的单次 optimize，更精准、更可控
# =============================================


class SkillAnalyzeRequest(BaseModel):
    """Skill Pipeline 分析请求体"""
    jd_text: Optional[str] = None
    job_id: Optional[int] = None


@router.post("/{resume_id}/ai/analyze")
async def ai_analyze_resume(
    resume_id: int,
    data: SkillAnalyzeRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    AI 深度分析 — Skill Pipeline 模块化架构
    ─────────────────────────────────────────────
    执行 JD 解析 + 简历匹配 分步分析:
      1. Skill 1 (JD Analyzer): 提取岗位要求结构化信息
      2. Skill 2 (Resume Matcher): ATS 评分 + 逐段匹配 + 风险检测

    响应:
      {
        "jd_analysis": { job_title, required_skills, is_campus, ... },
        "match_analysis": { ats_score, matched_skills, missing_skills, section_scores, risk_items, ... }
      }
    """
    from app.agents.skills import SkillPipeline

    # ── 1. 获取简历数据 ──
    resume = await _get_resume_or_404(resume_id, db, load_sections=True)

    # ── 2. 获取 JD 文本 ──
    jd_text = ""
    if data.jd_text:
        jd_text = data.jd_text.strip()
    elif data.job_id:
        result = await db.execute(select(Job).where(Job.id == data.job_id))
        job = result.scalar_one_or_none()
        if not job:
            raise HTTPException(status_code=404, detail="Job not found")
        jd_text = job.raw_description or ""

    if not jd_text:
        raise HTTPException(
            status_code=400,
            detail="请提供 JD 文本（jd_text）或选择岗位（job_id）",
        )

    # ── 3. 构建简历文本 ──
    resume_data = _serialize_resume_full(resume)
    resume_text = _flatten_resume_to_text(resume_data)

    # ── 4. 执行 Skill Pipeline ──
    pipeline = SkillPipeline()
    try:
        result = await pipeline.run(
            resume_text=resume_text,
            resume_data=resume_data,
            jd_text=jd_text,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # 检查是否有致命错误
    for key, val in result.items():
        if isinstance(val, dict) and "error" in val:
            if val["error"] == "LLM 调用失败":
                raise HTTPException(
                    status_code=500,
                    detail="AI 分析失败，请检查 LLM API Key 配置",
                )

    return result


@router.post("/ai/analyze-text")
async def ai_analyze_text(data: AiOptimizeTextRequest):
    """
    粘贴文本快速分析 — 无需预先创建简历
    ─────────────────────────────────────────────
    与 /ai/optimize-text 类似，但使用 Skill Pipeline 架构
    返回更精细的分步分析结果。
    """
    from app.agents.skills import SkillPipeline

    if not data.resume_text.strip() or not data.jd_text.strip():
        raise HTTPException(status_code=400, detail="简历和 JD 文本不能为空")

    pipeline = SkillPipeline()
    try:
        result = await pipeline.run(
            resume_text=data.resume_text.strip(),
            resume_data=None,
            jd_text=data.jd_text.strip(),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return result


def _flatten_resume_to_text(resume_data: dict) -> str:
    """将结构化简历 JSON 展平为可读纯文本（供 LLM 输入）"""
    parts = []
    if resume_data.get("user_name"):
        parts.append(f"姓名: {resume_data['user_name']}")
    if resume_data.get("summary"):
        parts.append(f"个人简介: {resume_data['summary']}")

    for section in resume_data.get("sections", []):
        title = section.get("title", section.get("section_type", ""))
        parts.append(f"\n## {title}")
        for item in section.get("content_json", []):
            if isinstance(item, dict):
                label = item.get("title", item.get("company", item.get("school", "")))
                if label:
                    parts.append(f"### {label}")
                desc = item.get("description", "")
                if desc:
                    parts.append(desc)
                items = item.get("items", [])
                if items:
                    parts.append(", ".join(items) if isinstance(items, list) else str(items))
            elif isinstance(item, str):
                parts.append(item)

    return "\n".join(parts)


@router.post("/{resume_id}/ai/apply")
async def ai_apply_suggestion(
    resume_id: int,
    suggestion: dict,
    db: AsyncSession = Depends(get_db),
):
    """
    应用单条 AI 优化建议
    ─────────────────────────────────────────────
    前端用户点击 Accept 后，将具体建议发回后端执行。
    支持的建议类型：
      - bullet_rewrite: 更新经历/项目描述
      - keyword_add: 更新技能列表
      - section_reorder: 更新段落排序
    """
    suggestion_type = suggestion.get("type")

    if suggestion_type == "bullet_rewrite":
        section_id = suggestion.get("section_id")
        item_index = suggestion.get("item_index", 0)
        suggested = suggestion.get("suggested")

        if not section_id or suggested is None:
            raise HTTPException(status_code=400, detail="Missing section_id or suggested")

        result = await db.execute(
            select(ResumeSection).where(
                ResumeSection.id == section_id,
                ResumeSection.resume_id == resume_id,
            )
        )
        section = result.scalar_one_or_none()
        if not section:
            raise HTTPException(status_code=404, detail="Section not found")

        content = list(section.content_json or [])
        if item_index < len(content):
            content[item_index]["description"] = suggested
            section.content_json = content
            await db.commit()

        return {"message": "Suggestion applied"}

    elif suggestion_type == "keyword_add":
        section_id = suggestion.get("section_id")
        suggested = suggestion.get("suggested")

        if not section_id or suggested is None:
            raise HTTPException(status_code=400, detail="Missing section_id or suggested")

        result = await db.execute(
            select(ResumeSection).where(
                ResumeSection.id == section_id,
                ResumeSection.resume_id == resume_id,
            )
        )
        section = result.scalar_one_or_none()
        if not section:
            raise HTTPException(status_code=404, detail="Section not found")

        content = list(section.content_json or [])
        # keyword_add 的 suggested 是完整的技能列表，直接替换第一个分组
        if content and isinstance(suggested, list):
            content[0]["items"] = suggested
            section.content_json = content
            await db.commit()

        return {"message": "Suggestion applied"}

    elif suggestion_type == "section_reorder":
        suggested_order = suggestion.get("suggested_order", [])
        for idx, section_id in enumerate(suggested_order):
            result = await db.execute(
                select(ResumeSection).where(
                    ResumeSection.id == section_id,
                    ResumeSection.resume_id == resume_id,
                )
            )
            section = result.scalar_one_or_none()
            if section:
                section.sort_order = idx
        await db.commit()
        return {"message": "Sections reordered"}

    else:
        raise HTTPException(status_code=400, detail=f"Unknown suggestion type: {suggestion_type}")


@router.post("/{resume_id}/ai/apply-batch")
async def ai_apply_batch(
    resume_id: int,
    payload: dict,
    db: AsyncSession = Depends(get_db),
):
    """
    批量应用 Skill Pipeline 的已采纳建议
    ─────────────────────────────────────────────
    前端 HITL: 用户逐条审核 → 点击「一键应用」→ 发送已采纳列表

    payload:
      {
        "suggestions": [
          { "type": "rewrite"/"inject", "section_title": "...", "original": "...", "suggested": "..." }
        ],
        "reorder": { "suggested_order": ["段落1", "段落2", ...] }  // 可选
      }
    """
    resume = await _get_resume_or_404(resume_id, db)
    applied = 0
    failed = 0

    # --- 1. 应用内容改写/注入建议 ---
    suggestions = payload.get("suggestions", [])
    for sug in suggestions:
        section_title = sug.get("section_title", "")
        original = sug.get("original", "")
        suggested = sug.get("suggested", "")

        if not section_title or not original or not suggested:
            failed += 1
            continue

        # 按 title 模糊匹配 section
        result = await db.execute(
            select(ResumeSection).where(
                ResumeSection.resume_id == resume_id,
                ResumeSection.title.icontains(section_title),
            )
        )
        section = result.scalar_one_or_none()
        if not section:
            failed += 1
            continue

        # 在 content_json 中查找包含 original 文本的条目
        content = list(section.content_json or [])
        matched = False
        for item in content:
            desc = item.get("description", "")
            if not desc:
                continue
            # 纯文本比较（去除 HTML 标签后匹配）
            plain_desc = re.sub(r"<[^>]+>", "", desc).strip()
            plain_original = re.sub(r"<[^>]+>", "", original).strip()
            if plain_original and plain_original in plain_desc:
                # 替换：将 original 片段替换为 suggested
                item["description"] = desc.replace(
                    original, suggested
                ) if original in desc else suggested
                matched = True
                break

        if matched:
            section.content_json = content
            applied += 1
        else:
            failed += 1

    # --- 2. 应用模块重排 ---
    reorder = payload.get("reorder")
    if reorder and reorder.get("suggested_order"):
        suggested_order = reorder["suggested_order"]
        for idx, sec_title in enumerate(suggested_order):
            result = await db.execute(
                select(ResumeSection).where(
                    ResumeSection.resume_id == resume_id,
                    ResumeSection.title.icontains(sec_title),
                )
            )
            section = result.scalar_one_or_none()
            if section:
                section.sort_order = idx

    await db.commit()
    return {
        "message": f"已应用 {applied} 条建议" + (f"，{failed} 条未匹配" if failed else ""),
        "applied": applied,
        "failed": failed,
    }


# =============================================
# 批量 AI 简历定制 — 核心差异化功能
# =============================================
# 用户选择一份基础简历 + 多个目标岗位 →
# 系统为每个岗位克隆一份简历副本 →
# SkillPipeline 逐份分析 + 自动应用优化建议 →
# 返回所有生成结果（ATS 评分、新简历 ID）
# =============================================


class BatchOptimizeRequest(BaseModel):
    """批量 AI 简历定制请求体"""
    job_ids: list[int] = Field(..., min_length=1, max_length=20)
    auto_apply: bool = True  # 是否自动应用 AI 建议


@router.post("/{resume_id}/ai/batch-optimize")
async def ai_batch_optimize(
    resume_id: int,
    data: BatchOptimizeRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    """
    批量 AI 简历定制 — SSE 流式版本
    ─────────────────────────────────────────────
        返回 text/event-stream，逐个岗位实时推送进度。
        兼容断连检测和心跳，提升长连接稳定性。
    """
    import copy
    import json as _json
    import logging
    from app.agents.skills import SkillPipeline

    logger = logging.getLogger(__name__)

    # ── 1. 预校验（在生成器外完成，否则异常无法正常返回 HTTP 错误） ──
    source = await _get_resume_or_404(resume_id, db, load_sections=True)
    source_data = _serialize_resume_full(source)

    result = await db.execute(select(Job).where(Job.id.in_(data.job_ids)))
    jobs_map = {j.id: j for j in result.scalars().all()}

    missing_ids = set(data.job_ids) - set(jobs_map.keys())
    if missing_ids:
        raise HTTPException(
            status_code=404,
            detail=f"以下岗位不存在: {list(missing_ids)}",
        )

    job_ids = list(data.job_ids)
    auto_apply = data.auto_apply

    # ── 2. SSE 生成器 ──
    async def _stream():
        pipeline = SkillPipeline()
        all_results = []
        event_id = 0

        event_id += 1
        yield ServerSentEvent(
            data=_json.dumps({"total": len(job_ids)}, ensure_ascii=False),
            event="started",
            id=str(event_id),
        )

        for idx, job_id in enumerate(job_ids):
            if await request.is_disconnected():
                logger.info("客户端已断开，停止批量优化，已处理 %s/%s", idx, len(job_ids))
                break

            job = jobs_map[job_id]
            jd_text = (job.raw_description or "").strip()

            entry = {
                "job_id": job_id,
                "job_title": job.title,
                "company": job.company,
                "new_resume_id": None,
                "ats_score": None,
                "suggestions_applied": 0,
                "status": "pending",
                "error": None,
                "index": idx,
                "total": len(job_ids),
            }

            event_id += 1
            yield ServerSentEvent(
                data=_json.dumps(
                    {
                        "index": idx,
                        "total": len(job_ids),
                        "job_id": job_id,
                        "job_title": job.title,
                        "company": job.company,
                    },
                    ensure_ascii=False,
                ),
                event="processing",
                id=str(event_id),
            )

            if not jd_text:
                entry["status"] = "skipped"
                entry["error"] = "岗位无 JD 文本"
                all_results.append(entry)
                event_id += 1
                yield ServerSentEvent(
                    data=_json.dumps(entry, ensure_ascii=False),
                    event="progress",
                    id=str(event_id),
                )
                continue

            try:
                # ── 克隆简历 ──
                new_resume = Resume(
                    user_name=source.user_name,
                    title=f"{source.title} - {job.company} {job.title}",
                    photo_url=source.photo_url,
                    summary=source.summary,
                    contact_json=copy.deepcopy(source.contact_json),
                    template_id=source.template_id,
                    style_config=copy.deepcopy(source.style_config),
                    is_primary=False,
                    language=source.language,
                )
                db.add(new_resume)
                await db.flush()

                for sec in source.sections:
                    new_section = ResumeSection(
                        resume_id=new_resume.id,
                        section_type=sec.section_type,
                        sort_order=sec.sort_order,
                        title=sec.title,
                        visible=sec.visible,
                        content_json=copy.deepcopy(sec.content_json),
                    )
                    db.add(new_section)

                await db.flush()
                entry["new_resume_id"] = new_resume.id

                # ── 运行 SkillPipeline ──
                cloned = await _get_resume_or_404(new_resume.id, db, load_sections=True)
                cloned_data = _serialize_resume_full(cloned)
                cloned_text = _flatten_resume_to_text(cloned_data)

                pipeline_result = await pipeline.run(
                    resume_text=cloned_text,
                    resume_data=cloned_data,
                    jd_text=jd_text,
                )

                match_analysis = pipeline_result.get("match_analysis", {})
                entry["ats_score"] = match_analysis.get("ats_score")

                # ── 自动应用建议 ──
                if auto_apply:
                    applied_count = 0

                    content_rewrite = pipeline_result.get("content_rewrite", {})
                    suggestions = content_rewrite.get("suggestions", [])
                    for sug in suggestions:
                        section_title = sug.get("section_title", "")
                        original = sug.get("original", "")
                        suggested = sug.get("suggested", "")
                        if not section_title or not suggested:
                            continue

                        sec_result = await db.execute(
                            select(ResumeSection).where(
                                ResumeSection.resume_id == new_resume.id,
                                ResumeSection.title.icontains(section_title),
                            )
                        )
                        section = sec_result.scalar_one_or_none()
                        if not section:
                            continue

                        content = list(section.content_json or [])
                        for item in content:
                            desc = item.get("description", "")
                            if not desc:
                                continue
                            plain_desc = re.sub(r"<[^>]+>", "", desc).strip()
                            plain_original = re.sub(r"<[^>]+>", "", original).strip()
                            if plain_original and plain_original in plain_desc:
                                item["description"] = desc.replace(
                                    original, suggested
                                ) if original in desc else suggested
                                applied_count += 1
                                break

                        section.content_json = content

                    section_reorder = pipeline_result.get("section_reorder", {})
                    suggested_order = section_reorder.get("suggested_order", [])
                    if suggested_order:
                        for sort_idx, sec_title in enumerate(suggested_order):
                            sec_result = await db.execute(
                                select(ResumeSection).where(
                                    ResumeSection.resume_id == new_resume.id,
                                    ResumeSection.title.icontains(sec_title),
                                )
                            )
                            section = sec_result.scalar_one_or_none()
                            if section:
                                section.sort_order = sort_idx

                    entry["suggestions_applied"] = applied_count

                entry["status"] = "success"
                await db.commit()
                try:
                    await auto_write_job_to_total(db, job_id=job_id)
                except Exception as auto_write_error:
                    logger.warning("auto write failed for job %s: %s", job_id, auto_write_error)
                    entry["error"] = (
                        f"{entry['error']}; 自动写入投递总表失败"
                        if entry["error"]
                        else "自动写入投递总表失败"
                    )

            except Exception as e:
                logger.error(f"批量优化岗位 {job_id} 失败: {e}")
                entry["status"] = "failed"
                entry["error"] = str(e)
                await db.rollback()

            all_results.append(entry)
            event_id += 1
            if entry["status"] == "failed":
                yield ServerSentEvent(
                    data=_json.dumps(entry, ensure_ascii=False),
                    event="error",
                    id=str(event_id),
                )
            else:
                yield ServerSentEvent(
                    data=_json.dumps(entry, ensure_ascii=False),
                    event="progress",
                    id=str(event_id),
                )

        # 全部完成后推送汇总
        success_count = sum(1 for r in all_results if r["status"] == "success")
        summary = {
            "total": len(job_ids),
            "success": success_count,
            "results": all_results,
        }
        event_id += 1
        yield ServerSentEvent(
            data=_json.dumps(summary, ensure_ascii=False),
            event="done",
            id=str(event_id),
        )

    return EventSourceResponse(
        _stream(),
        ping=15,
        send_timeout=60,
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # nginx 不缓冲
        },
    )


# =============================================
# 简历文件解析 — PDF / Word 上传提取文本
# =============================================

ALLOWED_EXTENSIONS = {".pdf", ".docx"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@router.post("/parse")
async def parse_resume_upload(file: UploadFile = File(...)):
    """
    上传 PDF 或 Word 简历文件，提取纯文本
    ─────────────────────────────────────────────
    支持 .pdf 和 .docx 格式。
    解析后返回文本内容，可直接用于 AI 分析或导入编辑器。
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="缺少文件名")

    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"不支持的文件格式 {ext}，仅支持 .pdf 和 .docx",
        )

    file_bytes = await file.read()
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="文件大小不能超过 10MB")

    from app.services.resume_parser import parse_resume_file

    text = await parse_resume_file(file.filename, file_bytes)
    if text is None:
        raise HTTPException(status_code=500, detail="文件解析失败")

    return {"filename": file.filename, "text": text, "length": len(text)}
