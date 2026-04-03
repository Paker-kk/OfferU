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

import os
import re
import uuid
from io import BytesIO
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from pydantic import BaseModel, Field
from jinja2 import Template

from app.database import get_db
from app.models.models import Resume, ResumeSection, ResumeTemplate, Job

router = APIRouter()


# =============================================
# Pydantic 请求/响应模型
# =============================================
# 严格定义 API 的输入输出结构，
# 前端按此契约传参，后端做类型校验。
# =============================================


class ResumeCreate(BaseModel):
    """创建简历的请求体"""
    user_name: str
    title: str = "未命名简历"
    summary: str = ""
    contact_json: dict = Field(default_factory=dict)
    template_id: Optional[int] = None
    style_config: dict = Field(default_factory=dict)
    language: str = "zh"


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


def _serialize_resume_brief(r: Resume) -> dict:
    """序列化简历列表项（不含段落详情）"""
    return {
        "id": r.id,
        "user_name": r.user_name,
        "title": r.title,
        "photo_url": r.photo_url,
        "template_id": r.template_id,
        "is_primary": r.is_primary,
        "language": r.language,
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


def _serialize_resume_full(r: Resume) -> dict:
    """
    序列化完整简历（含所有段落），用于编辑器页面。
    前端根据此结构渲染左侧编辑区和右侧 A4 预览。
    """
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
    return [_serialize_resume_brief(r) for r in resumes]


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
    resume = Resume(
        user_name=data.user_name,
        title=data.title,
        summary=data.summary,
        contact_json=data.contact_json,
        template_id=data.template_id,
        style_config=data.style_config,
        language=data.language,
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
    return _serialize_resume_full(
        await _get_resume_or_404(resume.id, db, load_sections=True)
    )


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
    return _serialize_resume_full(resume)


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
    return _serialize_resume_full(
        await _get_resume_or_404(resume.id, db, load_sections=True)
    )


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
UPLOAD_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(__file__))),
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

# 默认 HTML 模板：简洁白底 A4 简历
# 使用 CSS 变量实现样式可调，前端预览和 PDF 导出共用同一套变量
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
  @page { size: A4; margin: var(--page-margin); }
  body {
    font-family: var(--font-family);
    font-size: var(--body-size);
    line-height: var(--line-height);
    color: #222;
    margin: 0;
    padding: 0;
  }
  .header { text-align: center; margin-bottom: var(--section-gap); }
  .header h1 { font-size: 22pt; margin: 0 0 4pt; color: var(--primary-color); }
  .header .contact { margin: 2pt 0; color: #555; font-size: 9pt; }
  .header .summary { margin-top: 6pt; font-size: 9.5pt; color: #444; font-style: italic; }
  .photo-wrap { text-align: center; margin-bottom: 8pt; }
  .photo-wrap img { width: 80px; height: 80px; border-radius: 50%%; object-fit: cover; }
  h2 {
    font-size: var(--heading-size);
    border-bottom: 1.5px solid var(--primary-color);
    padding-bottom: 3pt;
    margin: var(--section-gap) 0 6pt;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--primary-color);
  }
  .entry { margin-bottom: 8pt; }
  .entry-title { font-weight: bold; }
  .entry-meta { color: #666; font-size: 9pt; }
  .entry-desc { margin-top: 2pt; }
  .entry-desc ul { padding-left: 16pt; margin: 2pt 0; }
  .entry-desc li { margin-bottom: 2pt; }
  .skills-list { display: flex; flex-wrap: wrap; gap: 6pt; }
  .skill-tag { background: #f0f0f0; padding: 2pt 8pt; border-radius: 3pt; font-size: 9pt; }
  .skill-category { font-weight: bold; font-size: 9.5pt; margin-bottom: 3pt; }
</style>
</head>
<body>
  <div class="header">
    {% if photo_url %}<div class="photo-wrap"><img src="{{ photo_url }}" /></div>{% endif %}
    <h1>{{ name }}</h1>
    <p class="contact">{{ contact_line }}</p>
    {% if summary %}<div class="summary">{{ summary }}</div>{% endif %}
  </div>

  {% for section in sections %}
  {% if section.visible %}
  <h2>{{ section.title }}</h2>

  {% if section.section_type == "education" %}
    {% for item in section.content_json %}
    <div class="entry">
      <div class="entry-title">{{ item.school }}{% if item.degree %} — {{ item.degree }}{% endif %}{% if item.major %}, {{ item.major }}{% endif %}</div>
      <div class="entry-meta">{{ item.startDate }}{% if item.endDate %} ~ {{ item.endDate }}{% endif %}{% if item.gpa %} | GPA: {{ item.gpa }}{% endif %}</div>
      {% if item.description %}<div class="entry-desc">{{ item.description }}</div>{% endif %}
    </div>
    {% endfor %}

  {% elif section.section_type == "experience" %}
    {% for item in section.content_json %}
    <div class="entry">
      <div class="entry-title">{{ item.position }} @ {{ item.company }}</div>
      <div class="entry-meta">{{ item.startDate }}{% if item.endDate %} ~ {{ item.endDate }}{% endif %}</div>
      {% if item.description %}<div class="entry-desc">{{ item.description }}</div>{% endif %}
    </div>
    {% endfor %}

  {% elif section.section_type == "skill" %}
    {% for group in section.content_json %}
    {% if group.category %}<div class="skill-category">{{ group.category }}</div>{% endif %}
    <div class="skills-list">
      {% for s in group.items %}<span class="skill-tag">{{ s }}</span>{% endfor %}
    </div>
    {% endfor %}

  {% elif section.section_type == "project" %}
    {% for item in section.content_json %}
    <div class="entry">
      <div class="entry-title">{{ item.name }}{% if item.role %} — {{ item.role }}{% endif %}</div>
      <div class="entry-meta">{{ item.startDate }}{% if item.endDate %} ~ {{ item.endDate }}{% endif %}{% if item.url %} | <a href="{{ item.url }}">链接</a>{% endif %}</div>
      {% if item.description %}<div class="entry-desc">{{ item.description }}</div>{% endif %}
    </div>
    {% endfor %}

  {% elif section.section_type == "certificate" %}
    {% for item in section.content_json %}
    <div class="entry">
      <div class="entry-title">{{ item.name }}{% if item.issuer %} — {{ item.issuer }}{% endif %}</div>
      <div class="entry-meta">{{ item.date }}{% if item.url %} | <a href="{{ item.url }}">查看</a>{% endif %}</div>
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

  {% endif %}
  {% endfor %}
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


@router.post("/{resume_id}/export/pdf")
async def export_pdf(resume_id: int, db: AsyncSession = Depends(get_db)):
    """
    导出简历为 PDF
    ─────────────────────────────────────────────
    1. 读取简历 + 段落 + 模板
    2. 合并样式优先级：DEFAULT_STYLE → 模板 css_variables → 用户 style_config
    3. Jinja2 渲染 HTML
    4. WeasyPrint 转 PDF
    5. StreamingResponse 返回
    """
    resume = await _get_resume_or_404(resume_id, db, load_sections=True)

    # 合并样式优先级：默认 < 模板 < 用户覆盖
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

    # 构建联系方式行
    c = resume.contact_json or {}
    contact_parts = [
        c.get("phone", ""), c.get("email", ""),
        c.get("linkedin", ""), c.get("website", ""),
    ]
    contact_line = " · ".join(p for p in contact_parts if p)

    # 渲染 HTML
    html_str = DEFAULT_HTML_TEMPLATE.render(
        name=resume.user_name,
        photo_url=resume.photo_url or "",
        contact_line=contact_line,
        summary=resume.summary or "",
        sections=[
            {
                "title": s.title,
                "section_type": s.section_type,
                "visible": s.visible,
                "content_json": s.content_json or [],
            }
            for s in resume.sections
        ],
        primary_color=style.get("primaryColor", "#222"),
        accent_color=style.get("accentColor", "#666"),
        body_size=style.get("bodySize", "10pt"),
        heading_size=style.get("headingSize", "12pt"),
        line_height=style.get("lineHeight", "1.5"),
        page_margin=style.get("pageMargin", "2cm"),
        section_gap=style.get("sectionGap", "14pt"),
        font_family=style.get("fontFamily", "sans-serif"),
    )

    try:
        from weasyprint import HTML
    except ImportError:
        raise HTTPException(status_code=500, detail="WeasyPrint not installed")

    pdf_bytes = HTML(string=html_str).write_pdf()

    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="resume_{resume_id}.pdf"',
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
    ai_result = await optimize_resume_with_context(resume_data, jd_text)

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

    ai_result = await optimize_resume(data.resume_text.strip(), data.jd_text.strip())

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
    result = await pipeline.run(
        resume_text=resume_text,
        resume_data=resume_data,
        jd_text=jd_text,
    )

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
    result = await pipeline.run(
        resume_text=data.resume_text.strip(),
        resume_data=None,
        jd_text=data.jd_text.strip(),
    )

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
