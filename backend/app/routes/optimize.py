# =============================================
# Optimize 路由 — AI 简历定制生成工作区
# =============================================
# POST /api/optimize/generate  → SSE 流式生成简历
#   body: {job_ids, mode, reference_resume_id?}
#   events: progress / result / error / done / heartbeat
#
# 核心逻辑：
#   1. 加载 Profile bullets + 目标 JD
#   2. 按 JD 关键词召回最相关的 bullets
#   3. 组装成简历骨架 → 改写润色
#   4. 保存为新 Resume 记录
# =============================================

import json
import asyncio
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sse_starlette import EventSourceResponse

from app.database import get_db
from app.models.models import (
    Job, Profile, ProfileSection, ProfileTargetRole,
    Resume, ResumeSection,
)
from app.agents.llm import chat_completion, extract_json

router = APIRouter()
logger = logging.getLogger(__name__)


# =============================================
# 请求/响应模型
# =============================================

class GenerateRequest(BaseModel):
    job_ids: list[int]
    mode: str = "per_job"  # per_job / combined
    reference_resume_id: Optional[int] = None


# =============================================
# Prompt 模板
# =============================================

BULLET_RECALL_PROMPT = """你是简历定制专家。根据目标岗位 JD，从候选人的 Profile Bullet 池中选出最相关的条目，并按相关性排序。

## 目标岗位 JD
{jd_text}

## 候选人 Profile Bullets
{bullets_text}

## 输出 JSON
{{
  "selected_bullets": [
    {{
      "id": <bullet的原始序号>,
      "section_type": "education|internship|project|activity|skill|...",
      "title": "条目标题",
      "relevance": "high|medium|low",
      "reason": "为什么这条和JD相关（一句话）"
    }}
  ],
  "missing_capabilities": ["JD要求但Profile中没有的能力"],
  "match_rate": "N/M"
}}

只选相关性 medium 以上的条目。最多选 15 条。"""

ASSEMBLE_PROMPT = """你是校招简历写作专家。根据以下信息生成一份完整的简历内容。

## 候选人基础信息
{basic_info}

## 目标岗位
{job_info}

## 选中的 Profile Bullets（按相关性排序）
{selected_bullets}

## 核心规则
1. **零虚构**：只能使用上面提供的 Bullet 内容，绝不凭空添加事实
2. **STAR 改写**：优化每条 Bullet 的表达，突出成果和数据
3. **关键词嵌入**：将 JD 中的关键词自然融入描述
4. **校招适配**：把实习/项目/社团当正式经历对待
5. **结构清晰**：按 教育背景 → 实习经历 → 项目经历 → 校园活动 → 技能证书 排序

## 输出 JSON
{{
  "title": "简历标题（如：张三-产品运营-XX大学）",
  "summary": "3句话的个人简介/求职意向",
  "sections": [
    {{
      "section_type": "education|experience|project|skill|activity",
      "title": "段落标题（如：教育背景）",
      "content_json": [
        {{
          "subtitle": "子标题（如：公司名+职位 / 学校名+专业）",
          "date_range": "时间范围",
          "description": "STAR法改写后的描述（HTML格式，用<ul><li>）"
        }}
      ]
    }}
  ],
  "used_bullet_ids": [1, 3, 5],
  "missing_capabilities": ["JD要求但简历中缺失的能力"]
}}"""


# =============================================
# 辅助函数
# =============================================

def _format_bullets(sections: list[ProfileSection]) -> str:
    """将 Profile sections 格式化为带序号的文本"""
    lines = []
    for i, s in enumerate(sections):
        content = s.content_json or {}
        org = content.get("organization", "")
        role = content.get("role", "")
        desc = content.get("description", "")
        lines.append(
            f"[{i}] [{s.section_type}] {s.title}"
            f" | 组织: {org} | 角色: {role}"
            f" | 描述: {desc}"
        )
    return "\n".join(lines)


def _format_job(job: Job) -> str:
    """格式化 JD 为文本"""
    parts = [f"岗位: {job.title}", f"公司: {job.company}"]
    if job.location:
        parts.append(f"地点: {job.location}")
    if job.raw_description:
        # 截取前 2000 字避免 token 过长
        desc = job.raw_description[:2000]
        parts.append(f"JD原文:\n{desc}")
    return "\n".join(parts)


# =============================================
# 核心生成逻辑
# =============================================

async def _generate_for_job(
    profile: Profile,
    job: Job,
    sections: list[ProfileSection],
    db: AsyncSession,
) -> dict:
    """为单个岗位生成定制简历"""

    # Step 1: Bullet 召回 — 从 Profile 池中选出与 JD 最相关的条目
    bullets_text = _format_bullets(sections)
    jd_text = _format_job(job)

    recall_prompt = BULLET_RECALL_PROMPT.format(
        jd_text=jd_text,
        bullets_text=bullets_text,
    )

    recall_result = await chat_completion(
        messages=[
            {"role": "system", "content": "你是简历定制专家，请严格按 JSON 格式输出。"},
            {"role": "user", "content": recall_prompt},
        ],
        json_mode=True,
    )
    recall_data = extract_json(recall_result)
    if not recall_data or "selected_bullets" not in recall_data:
        recall_data = {"selected_bullets": [], "missing_capabilities": [], "match_rate": "0/0"}

    # Step 2: 组装 + 改写 — 用选中的 bullets 生成完整简历
    selected = recall_data.get("selected_bullets", [])
    if not selected:
        return {
            "job_id": job.id,
            "job_title": job.title,
            "company": job.company,
            "error": "未找到与该JD相关的档案条目，请先完善个人档案",
            "match_rate": recall_data.get("match_rate", "0/0"),
        }

    # 构造选中 bullets 的详细文本
    selected_text_lines = []
    for sb in selected:
        idx = sb.get("id", 0)
        if 0 <= idx < len(sections):
            s = sections[idx]
            content = s.content_json or {}
            selected_text_lines.append(
                f"- [{sb.get('relevance', 'medium')}] {s.title}: "
                f"{content.get('description', '')} "
                f"(组织: {content.get('organization', '')})"
            )
        else:
            selected_text_lines.append(f"- {sb.get('title', '')}: {sb.get('reason', '')}")

    basic_info = f"{profile.name} | {profile.school} {profile.major} {profile.degree}"
    if profile.email:
        basic_info += f" | {profile.email}"
    if profile.phone:
        basic_info += f" | {profile.phone}"
    if profile.headline:
        basic_info += f"\n一句话定位: {profile.headline}"

    job_info = f"{job.title} @ {job.company}"
    if job.location:
        job_info += f" ({job.location})"

    assemble_prompt = ASSEMBLE_PROMPT.format(
        basic_info=basic_info,
        job_info=job_info,
        selected_bullets="\n".join(selected_text_lines),
    )

    assemble_result = await chat_completion(
        messages=[
            {"role": "system", "content": "你是校招简历写作专家，请严格按 JSON 格式输出。"},
            {"role": "user", "content": assemble_prompt},
        ],
        json_mode=True,
    )
    resume_data = extract_json(assemble_result)
    if not resume_data:
        return {
            "job_id": job.id,
            "job_title": job.title,
            "company": job.company,
            "error": "AI 生成简历失败，请重试",
        }

    # Step 3: 保存为新 Resume 记录
    resume = Resume(
        user_name=profile.name or "未命名",
        title=resume_data.get("title", f"{profile.name}-{job.title}"),
        summary=resume_data.get("summary", ""),
        source_job_ids=[job.id],
        source_mode="per_job",
    )
    db.add(resume)
    await db.flush()  # 获取 resume.id

    # 保存段落
    for idx, sec_data in enumerate(resume_data.get("sections", [])):
        section = ResumeSection(
            resume_id=resume.id,
            section_type=sec_data.get("section_type", "custom"),
            sort_order=idx,
            title=sec_data.get("title", ""),
            content_json=sec_data.get("content_json", []),
        )
        db.add(section)

    await db.commit()
    await db.refresh(resume)

    return {
        "job_id": job.id,
        "job_title": job.title,
        "company": job.company,
        "resume_id": resume.id,
        "resume_title": resume.title,
        "summary": resume.summary,
        "sections_count": len(resume_data.get("sections", [])),
        "match_rate": recall_data.get("match_rate", ""),
        "missing_capabilities": recall_data.get("missing_capabilities", []),
        "used_bullets": len(selected),
    }


# =============================================
# SSE 流式端点
# =============================================

@router.post("/generate")
async def generate_resumes(body: GenerateRequest, db: AsyncSession = Depends(get_db)):
    """
    AI 简历定制生成 — SSE 流式
    events: progress / result / error / done / heartbeat
    """
    if not body.job_ids:
        raise HTTPException(400, "请选择至少一个岗位")

    # 加载 Profile
    profile_result = await db.execute(
        select(Profile)
        .where(Profile.is_default == True)
        .options(
            selectinload(Profile.sections),
            selectinload(Profile.target_roles),
        )
    )
    profile = profile_result.scalar_one_or_none()
    if not profile:
        raise HTTPException(400, "请先创建个人档案")
    if not profile.sections:
        raise HTTPException(400, "个人档案条目为空，请先填写经历")

    # 加载岗位
    jobs_result = await db.execute(
        select(Job).where(Job.id.in_(body.job_ids))
    )
    jobs = list(jobs_result.scalars().all())
    if not jobs:
        raise HTTPException(404, "未找到选中的岗位")

    total = len(jobs)
    sections = list(profile.sections)

    async def event_generator():
        try:
            if body.mode == "per_job":
                # 逐岗位模式：每个岗位生成一份简历
                for i, job in enumerate(jobs):
                    yield json.dumps({
                        "event": "progress",
                        "data": {
                            "current": i + 1,
                            "total": total,
                            "job_title": job.title,
                            "company": job.company,
                            "status": "generating",
                        },
                    })

                    try:
                        result = await _generate_for_job(profile, job, sections, db)
                        yield json.dumps({
                            "event": "result",
                            "data": result,
                        })
                    except Exception as e:
                        logger.error("[optimize] failed for job %s: %s", job.id, e)
                        yield json.dumps({
                            "event": "error",
                            "data": {
                                "job_id": job.id,
                                "job_title": job.title,
                                "message": str(e),
                            },
                        })

            elif body.mode == "combined":
                # 综合模式：多个 JD 合并为一个综合 JD → 生成 1 份通用简历
                yield json.dumps({
                    "event": "progress",
                    "data": {
                        "current": 1,
                        "total": 1,
                        "status": "generating",
                        "message": f"综合 {total} 个岗位 JD 生成通用简历...",
                    },
                })

                # 合并 JD 文本
                combined_jd = "\n\n---\n\n".join(
                    _format_job(job) for job in jobs
                )

                # 创建虚拟 Job 对象用于生成
                combined_job = Job(
                    id=0,
                    title=f"综合简历（{total}个岗位）",
                    company="",
                    raw_description=combined_jd[:4000],
                    hash_key="combined",
                )

                try:
                    result = await _generate_for_job(profile, combined_job, sections, db)
                    # 修正溯源信息
                    result["job_ids"] = body.job_ids
                    result["mode"] = "combined"

                    # 更新 Resume 的 source 信息
                    if result.get("resume_id"):
                        resume_result = await db.execute(
                            select(Resume).where(Resume.id == result["resume_id"])
                        )
                        resume = resume_result.scalar_one_or_none()
                        if resume:
                            resume.source_job_ids = body.job_ids
                            resume.source_mode = "combined"
                            await db.commit()

                    yield json.dumps({
                        "event": "result",
                        "data": result,
                    })
                except Exception as e:
                    logger.error("[optimize] combined generation failed: %s", e)
                    yield json.dumps({
                        "event": "error",
                        "data": {"message": str(e)},
                    })

            # 完成
            yield json.dumps({
                "event": "done",
                "data": {"total": total, "mode": body.mode},
            })

        except Exception as e:
            yield json.dumps({
                "event": "error",
                "data": {"message": f"生成流程异常: {str(e)}"},
            })

    return EventSourceResponse(event_generator())
