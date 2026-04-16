# =============================================
# Optimize 路由 — Profile 驱动的简历生成工作区
# =============================================
# POST /api/optimize/generate
# 输入：job_ids + mode
# 输出：SSE progress/result/error/done
# =============================================

from __future__ import annotations

import json
import logging
import re
from collections import Counter, defaultdict
from typing import Iterable, Literal

import jieba
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.models import Job, Profile, ProfileSection, Resume, ResumeSection

router = APIRouter()
_logger = logging.getLogger(__name__)

STOPWORDS = {
    "and",
    "the",
    "for",
    "with",
    "you",
    "your",
    "that",
    "this",
    "have",
    "from",
    "will",
    "are",
    "was",
    "our",
    "职位",
    "岗位",
    "负责",
    "要求",
    "能力",
    "熟悉",
    "相关",
    "以上",
    "优先",
    "具备",
}

SECTION_TYPE_MAP = {
    "education": "education",
    "experience": "experience",
    "internship": "experience",
    "project": "project",
    "activity": "custom",
    "competition": "custom",
    "skill": "skill",
    "certificate": "skill",
    "language": "skill",
    "honor": "custom",
    "general": "custom",
    "custom": "custom",
}

SECTION_TITLE_MAP = {
    "education": "教育经历",
    "experience": "实践经历",
    "project": "项目经历",
    "skill": "技能清单",
    "custom": "补充亮点",
}

MAX_OPTIMIZE_JOB_COUNT = 20


class OptimizeGenerateRequest(BaseModel):
    job_ids: list[int] = Field(..., min_length=1, max_length=200)
    mode: Literal["per_job", "combined"] = "per_job"
    reference_resume_id: int | None = None


def _ordered_unique_ids(ids: list[int]) -> list[int]:
    seen: set[int] = set()
    ordered: list[int] = []
    for item in ids:
        if item in seen:
            continue
        seen.add(item)
        ordered.append(item)
    return ordered


def _to_tokens(text: str) -> list[str]:
    text = (text or "").lower()
    # 英文/数字词组（保持完整，如 "aigc", "comfyui"）
    en_words = re.findall(r"[a-zA-Z][a-zA-Z0-9]*", text)
    # 中文：jieba 分词
    cn_text = re.sub(r"[a-zA-Z0-9]+", " ", text)  # 去英文后分词
    cn_words = [w for w in jieba.cut(cn_text) if len(w) >= 2]
    words = en_words + cn_words
    return [w for w in words if w not in STOPWORDS]


def _bullet_text(section: ProfileSection) -> str:
    payload = section.content_json or {}
    if isinstance(payload, dict):
        bullet = payload.get("bullet")
        if isinstance(bullet, str) and bullet.strip():
            return bullet.strip()
    return section.title or ""


def _rank_profile_sections(sections: list[ProfileSection], jd_text: str, limit: int = 12) -> list[tuple[ProfileSection, int]]:
    jd_tokens = set(_to_tokens(jd_text))
    scored: list[tuple[ProfileSection, int, float]] = []

    for section in sections:
        text = f"{section.title} {_bullet_text(section)}"
        overlap = len(jd_tokens.intersection(set(_to_tokens(text))))
        scored.append((section, overlap, float(section.confidence or 0.0)))

    scored.sort(key=lambda item: (item[1], item[2]), reverse=True)
    picked = scored[:limit] if scored else []

    if picked and picked[0][1] <= 0:
        # JD 与档案几乎无词面重叠时，退化为按置信度挑选
        scored.sort(key=lambda item: item[2], reverse=True)
        picked = scored[:limit]

    return [(section, overlap) for section, overlap, _ in picked]


def _keywords_from_bullets(texts: Iterable[str], limit: int = 10) -> list[str]:
    words: list[str] = []
    for text in texts:
        words.extend(_to_tokens(text))
    if not words:
        return []
    counter = Counter(words)
    return [token for token, _ in counter.most_common(limit)]


def _missing_keywords(job_text: str, used_texts: Iterable[str], limit: int = 8) -> list[str]:
    job_counter = Counter(_to_tokens(job_text))
    used = set(_to_tokens(" ".join(used_texts)))
    missing = [token for token, _ in job_counter.most_common() if token not in used]
    return missing[:limit]


def _build_resume_sections(selected: list[ProfileSection]) -> list[dict]:
    grouped: dict[str, list[dict]] = defaultdict(list)

    for section in selected:
        mapped = SECTION_TYPE_MAP.get((section.section_type or "general").lower(), "custom")
        bullet = _bullet_text(section)

        if mapped == "education":
            payload = section.content_json or {}
            normalized = payload.get("normalized") if isinstance(payload, dict) else {}
            if not isinstance(normalized, dict):
                normalized = {}
            grouped[mapped].append(
                {
                    "school": normalized.get("school") or section.title or "教育经历",
                    "degree": normalized.get("degree", ""),
                    "major": normalized.get("major", ""),
                    "description": normalized.get("description") or bullet,
                }
            )
            continue

        if mapped == "experience":
            payload = section.content_json or {}
            normalized = payload.get("normalized") if isinstance(payload, dict) else {}
            if not isinstance(normalized, dict):
                normalized = {}
            grouped[mapped].append(
                {
                    "company": normalized.get("company") or section.title or "实践经历",
                    "position": normalized.get("position", ""),
                    "description": normalized.get("description") or bullet,
                }
            )
            continue

        if mapped == "project":
            payload = section.content_json or {}
            normalized = payload.get("normalized") if isinstance(payload, dict) else {}
            if not isinstance(normalized, dict):
                normalized = {}
            grouped[mapped].append(
                {
                    "name": normalized.get("name") or section.title or "项目经历",
                    "role": normalized.get("role", ""),
                    "description": normalized.get("description") or bullet,
                }
            )
            continue

        if mapped == "skill":
            # 优先使用 normalized.items（保持完整技能名如 "Cursor Vibe Coding"）
            payload = section.content_json or {}
            normalized = payload.get("normalized") if isinstance(payload, dict) else None
            items = (normalized.get("items") if isinstance(normalized, dict) else None) or []
            if not items:
                items = _keywords_from_bullets([bullet], limit=8)
            if not items:
                items = [bullet] if bullet else []
            grouped[mapped].append(
                {
                    "category": section.title or "核心技能",
                    "items": items,
                }
            )
            continue

        grouped[mapped].append(
            {
                "subtitle": section.title or "补充亮点",
                "description": bullet,
            }
        )

    ordered_types = ["education", "experience", "project", "skill", "custom"]
    rows: list[dict] = []
    for index, section_type in enumerate(ordered_types):
        content = grouped.get(section_type)
        if not content:
            continue
        rows.append(
            {
                "section_type": section_type,
                "title": SECTION_TITLE_MAP[section_type],
                "sort_order": index,
                "visible": True,
                "content_json": content,
            }
        )
    return rows


_logger = logging.getLogger(__name__)

_REWRITE_SYSTEM_PROMPT = """你是一位资深 HR 顾问。请根据目标岗位 JD，改写候选人的简历各模块内容，使其更匹配岗位要求。

## 规则
1. **保留所有事实和数字**，严禁编造经历或虚构数据
2. **STAR 改写**：用 Situation-Task-Action-Result 结构优化描述
3. **关键词注入**：将 JD 中的关键技能词自然融入描述（不要生硬堆砌）
4. **量化优化**：已有数字保留，描述模糊处可建议追加"[待量化]"标记
5. **教育经历**：一般不改写，原样保留
6. **技能清单**：可根据 JD 调整顺序，将 JD 匹配的技能排前面

## 输入
你会收到 JSON 格式的 resume_sections 和 jd_text。

## 输出
返回严格 JSON，格式同 resume_sections，但 content_json 中的描述文本已改写：
{"sections": [同输入结构，description/bullet 已优化]}"""


async def _llm_rewrite_sections(rows: list[dict], jd_text: str) -> tuple:
    """调 LLM 对已组装的简历 sections 做 JD 定制化改写。
    返回 (rows, rewrite_applied: bool)。失败时 rewrite_applied=False。"""
    from app.agents.llm import chat_completion, extract_json

    # 构建紧凑的输入（只传必要信息，控制 token）
    compact_sections = []
    for row in rows:
        compact_sections.append({
            "section_type": row["section_type"],
            "title": row["title"],
            "content_json": row["content_json"],
        })

    user_content = json.dumps(
        {"resume_sections": compact_sections, "jd_text": jd_text[:4000]},
        ensure_ascii=False,
    )

    try:
        raw = await chat_completion(
            messages=[
                {"role": "system", "content": _REWRITE_SYSTEM_PROMPT},
                {"role": "user", "content": user_content},
            ],
            temperature=0.3,
            json_mode=True,
            max_tokens=4096,
            tier="premium",
        )
    except Exception as exc:
        _logger.warning("LLM rewrite failed, using original rows: %s", exc)
        return rows, False

    parsed = extract_json(raw or "")
    if not isinstance(parsed, dict):
        _logger.warning("LLM rewrite returned non-dict, using original rows")
        return rows, False

    rewritten = parsed.get("sections")
    if not isinstance(rewritten, list) or len(rewritten) == 0:
        return rows, False

    # 合并：用 LLM 返回的 content_json 替换原 rows
    result = []
    for idx, row in enumerate(rows):
        new_row = dict(row)
        if idx < len(rewritten) and isinstance(rewritten[idx], dict):
            llm_content = rewritten[idx].get("content_json")
            if isinstance(llm_content, list) and len(llm_content) > 0:
                new_row["content_json"] = llm_content
        result.append(new_row)
    return result, True


def _profile_to_contact_json(profile: Profile) -> dict:
    info = profile.base_info_json or {}
    if not isinstance(info, dict):
        info = {}
    contact = {
        "email": info.get("email") or getattr(profile, "email", "") or "",
        "phone": info.get("phone") or getattr(profile, "phone", "") or "",
        "wechat": info.get("wechat") or getattr(profile, "wechat", "") or "",
    }
    return {key: value for key, value in contact.items() if isinstance(value, str) and value.strip()}


def _build_source_profile_snapshot(profile: Profile, selected: list[ProfileSection]) -> dict:
    return {
        "profile_id": profile.id,
        "profile_updated_at": str(profile.updated_at),
        "selected_section_ids": [item.id for item in selected],
        "selected_count": len(selected),
    }


def _sse(event: str, payload: dict) -> str:
    body = json.dumps(payload, ensure_ascii=False)
    return f"event: {event}\ndata: {body}\n\n"


async def _get_default_profile(db: AsyncSession) -> Profile:
    result = await db.execute(
        select(Profile).order_by(Profile.is_default.desc(), Profile.updated_at.desc())
    )
    profile = result.scalars().first()
    if not profile:
        raise HTTPException(status_code=400, detail="请先在 Profile 页面建立个人档案")
    return profile


async def _get_profile_sections(profile_id: int, db: AsyncSession) -> list[ProfileSection]:
    result = await db.execute(
        select(ProfileSection)
        .where(ProfileSection.profile_id == profile_id)
        .order_by(ProfileSection.sort_order.asc(), ProfileSection.updated_at.desc())
    )
    sections = list(result.scalars().all())
    if not sections:
        raise HTTPException(status_code=400, detail="档案条目为空，请先在 Profile 页面确认至少 1 条事实")
    return sections


async def _create_generated_resume(
    *,
    db: AsyncSession,
    profile: Profile,
    title: str,
    summary: str,
    source_mode: str,
    source_job_ids: list[int],
    contact_json: dict,
    style_config: dict,
    template_id: int | None,
    source_profile_snapshot: dict,
    rows: list[dict],
) -> Resume:
    resume = Resume(
        user_name=profile.name or "默认候选人",
        title=title,
        summary=summary,
        contact_json=contact_json,
        style_config=style_config,
        template_id=template_id,
        is_primary=False,
        language="zh",
        source_mode=source_mode,
        source_job_ids=source_job_ids,
        source_profile_snapshot=source_profile_snapshot,
    )
    db.add(resume)
    await db.flush()

    for row in rows:
        db.add(
            ResumeSection(
                resume_id=resume.id,
                section_type=row["section_type"],
                sort_order=row["sort_order"],
                title=row["title"],
                visible=True,
                content_json=row["content_json"],
            )
        )

    await db.commit()
    await db.refresh(resume)
    return resume


async def _generate_for_job(
    profile: Profile,
    job: Job,
    sections: list[ProfileSection],
    db: AsyncSession,
    reference_resume: Resume | None = None,
) -> dict:
    """供 MCP/Agent 复用的单岗位生成入口。"""
    jd_text = (job.raw_description or "").strip()
    if not jd_text:
        raise HTTPException(status_code=400, detail=f"岗位 {job.id} 缺少 JD 文本")

    ranked = _rank_profile_sections(sections, jd_text, limit=12)
    selected = [item[0] for item in ranked]
    rows = _build_resume_sections(selected)
    rows, rewrite_applied = await _llm_rewrite_sections(rows, jd_text)

    base_contact_json = (
        (reference_resume.contact_json or {})
        if reference_resume and isinstance(reference_resume.contact_json, dict)
        else _profile_to_contact_json(profile)
    )
    base_style_config = (
        (reference_resume.style_config or {})
        if reference_resume and isinstance(reference_resume.style_config, dict)
        else {}
    )
    base_template_id = reference_resume.template_id if reference_resume else None
    base_summary = profile.headline or profile.exit_story or ""
    if not base_summary and reference_resume and isinstance(reference_resume.summary, str):
        base_summary = reference_resume.summary

    resume = await _create_generated_resume(
        db=db,
        profile=profile,
        title=f"{job.company} - {job.title} 定制简历",
        summary=base_summary,
        source_mode="per_job",
        source_job_ids=[job.id],
        contact_json=base_contact_json,
        style_config=base_style_config,
        template_id=base_template_id,
        source_profile_snapshot=_build_source_profile_snapshot(profile, selected),
        rows=rows,
    )

    used_bullets = [
        {
            "id": section.id,
            "section_type": section.section_type,
            "title": section.title,
        }
        for section in selected
    ]
    used_texts = [_bullet_text(section) for section in selected]
    missing_keywords = _missing_keywords(jd_text, used_texts)

    return {
        "job_id": job.id,
        "job_title": job.title,
        "resume_id": resume.id,
        "resume_title": resume.title,
        "used_bullets": used_bullets,
        "used_bullets_count": len(used_bullets),
        "missing_keywords": missing_keywords,
        "missing_capabilities": missing_keywords,
        "profile_hit_ratio": f"{len(selected)}/{len(sections)}",
        "match_rate": f"{len(selected)}/{len(sections)}",
        "rewrite_applied": rewrite_applied,
    }


@router.post("/generate")
async def optimize_generate(
    data: OptimizeGenerateRequest,
    db: AsyncSession = Depends(get_db),
):
    profile = await _get_default_profile(db)
    profile_sections = await _get_profile_sections(profile.id, db)

    reference_resume: Resume | None = None
    if data.reference_resume_id is not None:
        ref_result = await db.execute(select(Resume).where(Resume.id == data.reference_resume_id))
        reference_resume = ref_result.scalar_one_or_none()
        if not reference_resume:
            raise HTTPException(status_code=404, detail="reference_resume_id 对应简历不存在")

    effective_job_ids = _ordered_unique_ids(data.job_ids)
    if len(effective_job_ids) > MAX_OPTIMIZE_JOB_COUNT:
        raise HTTPException(
            status_code=400,
            detail=f"单次最多生成 {MAX_OPTIMIZE_JOB_COUNT} 个岗位，请分批操作",
        )

    jobs_result = await db.execute(select(Job).where(Job.id.in_(effective_job_ids)))
    job_map = {job.id: job for job in jobs_result.scalars().all()}
    missing = [job_id for job_id in effective_job_ids if job_id not in job_map]
    if missing:
        raise HTTPException(status_code=404, detail=f"以下岗位不存在: {missing}")

    ordered_jobs = [job_map[job_id] for job_id in effective_job_ids]

    base_contact_json = (
        (reference_resume.contact_json or {})
        if reference_resume and isinstance(reference_resume.contact_json, dict)
        else _profile_to_contact_json(profile)
    )
    base_style_config = (
        (reference_resume.style_config or {})
        if reference_resume and isinstance(reference_resume.style_config, dict)
        else {}
    )
    base_template_id = reference_resume.template_id if reference_resume else None
    base_summary = profile.headline or profile.exit_story or ""
    if not base_summary and reference_resume and isinstance(reference_resume.summary, str):
        base_summary = reference_resume.summary

    async def _stream():
        total = len(ordered_jobs)
        created = 0
        failed = 0
        created_resume_ids: list[int] = []

        yield _sse("heartbeat", {})

        if data.mode == "combined":
            merged_jd = "\n\n".join(job.raw_description or "" for job in ordered_jobs)
            ranked = _rank_profile_sections(profile_sections, merged_jd, limit=14)
            selected = [item[0] for item in ranked]
            used_bullets = [_bullet_text(item) for item in selected]
            rows = _build_resume_sections(selected)
            rows, rewrite_applied = await _llm_rewrite_sections(rows, merged_jd)
            if not rewrite_applied:
                yield _sse("warning", {"message": "AI 改写失败，已使用原始内容生成简历", "mode": "combined"})
            source_profile_snapshot = _build_source_profile_snapshot(profile, selected)

            try:
                title = f"{profile.name or '候选人'} - 综合定制简历"
                resume = await _create_generated_resume(
                    db=db,
                    profile=profile,
                    title=title,
                    summary=base_summary,
                    source_mode="combined",
                    source_job_ids=[job.id for job in ordered_jobs],
                    contact_json=base_contact_json,
                    style_config=base_style_config,
                    template_id=base_template_id,
                    source_profile_snapshot=source_profile_snapshot,
                    rows=rows,
                )
                created += 1
                created_resume_ids.append(resume.id)
                yield _sse("progress", {"index": 1, "total": 1, "status": "success", "mode": "combined"})
                yield _sse(
                    "result",
                    {
                        "mode": "combined",
                        "resume_id": resume.id,
                        "resume_title": resume.title,
                        "job_ids": [job.id for job in ordered_jobs],
                        "reference_resume_id": reference_resume.id if reference_resume else None,
                        "used_bullets": [
                            {
                                "id": section.id,
                                "section_type": section.section_type,
                                "title": section.title,
                            }
                            for section in selected
                        ],
                        "missing_keywords": _missing_keywords(merged_jd, used_bullets),
                        "profile_hit_ratio": f"{len(selected)}/{len(profile_sections)}",
                    },
                )
            except Exception as exc:
                await db.rollback()
                failed += 1
                yield _sse("progress", {"index": 1, "total": 1, "status": "failed", "mode": "combined"})
                yield _sse("error", {"mode": "combined", "message": str(exc)})

            yield _sse(
                "done",
                {
                    "mode": "combined",
                    "total": 1,
                    "created": created,
                    "failed": failed,
                    "resume_ids": created_resume_ids,
                },
            )
            return

        for idx, job in enumerate(ordered_jobs, start=1):
            yield _sse("heartbeat", {})
            jd_text = (job.raw_description or "").strip()
            if not jd_text:
                failed += 1
                yield _sse(
                    "progress",
                    {
                        "index": idx,
                        "total": total,
                        "job_id": job.id,
                        "job_title": job.title,
                        "status": "failed",
                    },
                )
                yield _sse(
                    "error",
                    {
                        "index": idx,
                        "total": total,
                        "job_id": job.id,
                        "job_title": job.title,
                        "message": "岗位缺少 JD 文本，已跳过",
                    },
                )
                continue

            try:
                ranked = _rank_profile_sections(profile_sections, jd_text, limit=12)
                selected = [item[0] for item in ranked]
                used_bullets = [_bullet_text(item) for item in selected]
                rows = _build_resume_sections(selected)
                rows, rewrite_applied = await _llm_rewrite_sections(rows, jd_text)
                if not rewrite_applied:
                    yield _sse("warning", {"message": "AI 改写失败，已使用原始内容", "job_id": job.id})
                source_profile_snapshot = _build_source_profile_snapshot(profile, selected)
                resume = await _create_generated_resume(
                    db=db,
                    profile=profile,
                    title=f"{job.company} - {job.title} 定制简历",
                    summary=base_summary,
                    source_mode="per_job",
                    source_job_ids=[job.id],
                    contact_json=base_contact_json,
                    style_config=base_style_config,
                    template_id=base_template_id,
                    source_profile_snapshot=source_profile_snapshot,
                    rows=rows,
                )

                created += 1
                created_resume_ids.append(resume.id)

                yield _sse(
                    "progress",
                    {
                        "index": idx,
                        "total": total,
                        "job_id": job.id,
                        "job_title": job.title,
                        "status": "success",
                    },
                )
                yield _sse(
                    "result",
                    {
                        "index": idx,
                        "total": total,
                        "mode": "per_job",
                        "job_id": job.id,
                        "job_title": job.title,
                        "resume_id": resume.id,
                        "resume_title": resume.title,
                        "reference_resume_id": reference_resume.id if reference_resume else None,
                        "used_bullets": [
                            {
                                "id": section.id,
                                "section_type": section.section_type,
                                "title": section.title,
                            }
                            for section in selected
                        ],
                        "missing_keywords": _missing_keywords(jd_text, used_bullets),
                        "profile_hit_ratio": f"{len(selected)}/{len(profile_sections)}",
                    },
                )
            except Exception as exc:
                await db.rollback()
                failed += 1
                yield _sse(
                    "progress",
                    {
                        "index": idx,
                        "total": total,
                        "job_id": job.id,
                        "job_title": job.title,
                        "status": "failed",
                    },
                )
                yield _sse(
                    "error",
                    {
                        "index": idx,
                        "total": total,
                        "job_id": job.id,
                        "job_title": job.title,
                        "message": str(exc),
                    },
                )

        yield _sse(
            "done",
            {
                "mode": "per_job",
                "total": total,
                "created": created,
                "failed": failed,
                "resume_ids": created_resume_ids,
            },
        )

    return StreamingResponse(
        _stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )
