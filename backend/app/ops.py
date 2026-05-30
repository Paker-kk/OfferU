from __future__ import annotations

import inspect
import json
import time
from dataclasses import dataclass, field
from typing import Any, Awaitable, Callable, Optional

from sqlalchemy import func, select

from app.database import async_session
from app.services.agent_operations import (
    batch_triage,
    create_application,
    generate_cover_letter,
    generate_resume,
    get_job,
    get_profile,
    get_resume,
    job_stats,
    list_applications,
    list_jobs,
    list_pools,
    list_resumes,
    triage_job,
)
from app.models.models import AgentWorkspaceState, Job, OperationAuditLog, Pool


OperationFn = Callable[..., Awaitable[Any]]


@dataclass(frozen=True)
class Operation:
    name: str
    fn: OperationFn
    description: str
    parameters: dict[str, str] = field(default_factory=dict)
    group: str = "core"
    side_effects: tuple[str, ...] = ("read",)
    permissions: tuple[str, ...] = ()
    examples: tuple[dict[str, Any], ...] = ()
    version: str = "2026-05-23"

    @property
    def is_mutation(self) -> bool:
        return any(effect in self.side_effects for effect in ("write", "llm", "external"))

    def schema(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "description": self.description,
            "parameters": self.parameters,
            "group": self.group,
            "side_effects": list(self.side_effects),
            "supports_dry_run": self.is_mutation,
            "requires_confirmation": self.is_mutation,
            "permissions": list(self.permissions),
            "examples": list(self.examples),
            "output_contract": {
                "ok": "bool",
                "operation": "str",
                "operation_version": "str|null",
                "inputs": "object",
                "outputs": "object|array|string|number|null",
                "warnings": "list[str]",
                "errors": "list[str]",
                "side_effects": "list[str]",
                "elapsed_ms": "float",
            },
            "operation_version": self.version,
        }


OPERATIONS: dict[str, Operation] = {
    "get_profile": Operation(
        name="get_profile",
        fn=get_profile,
        description="获取用户个人资料概览，包括基本信息、目标岗位、经历统计。",
        group="profile",
    ),
    "list_pools": Operation(
        name="list_pools",
        fn=list_pools,
        description="获取岗位池列表。",
        group="jobs",
    ),
    "list_jobs": Operation(
        name="list_jobs",
        fn=list_jobs,
        description="分页浏览岗位列表，支持按分拣状态、池、关键词筛选。",
        parameters={
            "triage_status": "str? (unscreened|screened|ignored)",
            "pool_id": "int?",
            "keyword": "str?",
            "page": "int=1",
            "page_size": "int=20",
        },
        group="jobs",
    ),
    "get_job": Operation(
        name="get_job",
        fn=get_job,
        description="查看单个岗位详情，含完整 JD、投递链接、学历经验要求。",
        parameters={"job_id": "int"},
        group="jobs",
    ),
    "triage_job": Operation(
        name="triage_job",
        fn=triage_job,
        description="将单个岗位分拣为 screened/ignored/unscreened，可分配岗位池。",
        parameters={"job_id": "int", "status": "str", "pool_id": "int?"},
        group="jobs",
        side_effects=("write",),
    ),
    "batch_triage": Operation(
        name="batch_triage",
        fn=batch_triage,
        description="批量分拣多个岗位。",
        parameters={"job_ids": "list[int]", "status": "str", "pool_id": "int?"},
        group="jobs",
        side_effects=("write",),
    ),
    "generate_resume": Operation(
        name="generate_resume",
        fn=generate_resume,
        description="为指定岗位 AI 生成一份定制简历并保存。",
        parameters={"job_id": "int", "reference_resume_id": "int?"},
        group="resume",
        side_effects=("llm", "write"),
    ),
    "list_resumes": Operation(
        name="list_resumes",
        fn=list_resumes,
        description="查看所有简历列表，包含 AI 溯源标签。",
        group="resume",
    ),
    "get_resume": Operation(
        name="get_resume",
        fn=get_resume,
        description="查看简历完整内容。",
        parameters={"resume_id": "int"},
        group="resume",
    ),
    "list_applications": Operation(
        name="list_applications",
        fn=list_applications,
        description="查看投递记录列表，可按状态筛选。",
        parameters={"status": "str?", "page": "int=1", "page_size": "int=20"},
        group="applications",
    ),
    "create_application": Operation(
        name="create_application",
        fn=create_application,
        description="为指定岗位创建一条待投递记录。",
        parameters={"job_id": "int", "notes": "str?"},
        group="applications",
        side_effects=("write",),
    ),
    "generate_cover_letter": Operation(
        name="generate_cover_letter",
        fn=generate_cover_letter,
        description="为指定岗位和简历生成求职信草稿。",
        parameters={"job_id": "int", "resume_id": "int"},
        group="applications",
        side_effects=("llm",),
    ),
    "job_stats": Operation(
        name="job_stats",
        fn=job_stats,
        description="获取岗位数据统计。",
        group="analytics",
    ),
}


def list_operations() -> list[dict[str, Any]]:
    return [op.schema() for op in sorted(OPERATIONS.values(), key=lambda item: item.name)]


def get_operation_schema(name: str) -> Optional[dict[str, Any]]:
    op = OPERATIONS.get(name)
    return op.schema() if op else None


def build_tools_description() -> str:
    lines: list[str] = []
    for op in sorted(OPERATIONS.values(), key=lambda item: item.name):
        param_str = ", ".join(f"{k}: {v}" for k, v in op.parameters.items()) if op.parameters else "无参数"
        effects = ",".join(op.side_effects)
        lines.append(f"- {op.name}({param_str}) [{effects}]: {op.description}")
    return "\n".join(lines)


WORKFLOW_CATALOG: dict[str, dict[str, Any]] = {
    "daily_review": {
        "name": "daily_review",
        "description": "每天快速查看岗位池、未筛岗位和数据概览，决定当天优先处理什么。",
        "intent_keywords": ["今日", "每天", "review", "dashboard", "概览", "岗位"],
        "steps": [
            {"operation": "job_stats", "args": {}},
            {"operation": "list_pools", "args": {}},
            {"operation": "list_jobs", "args": {"triage_status": "unscreened", "page_size": 20}},
        ],
    },
    "batch_triage": {
        "name": "batch_triage",
        "description": "批量筛选岗位：先读上下文和候选岗位，再由 agent 选择 job_ids，最后 dry-run 批量分拣。",
        "intent_keywords": ["批量", "筛选", "分拣", "triage", "忽略", "入池"],
        "steps": [
            {"operation": "get_profile", "args": {}},
            {"operation": "list_jobs", "args": {"triage_status": "unscreened", "page_size": 50}},
            {"operation": "batch_update_jobs", "args": {"job_ids": [], "triage_status": "picked"}, "dry_run": True},
        ],
    },
    "tailored_resume": {
        "name": "tailored_resume",
        "description": "针对单个岗位生成定制简历：先核对 profile、岗位和现有简历，再 dry-run 生成。",
        "intent_keywords": ["简历", "优化", "定制", "resume", "岗位匹配"],
        "steps": [
            {"operation": "get_profile", "args": {}},
            {"operation": "get_job", "args": {"job_id": 0}},
            {"operation": "list_resumes", "args": {}},
            {"operation": "generate_resume", "args": {"job_id": 0}, "dry_run": True},
        ],
    },
    "application_pipeline": {
        "name": "application_pipeline",
        "description": "从已筛岗位到投递待办：读取岗位、生成简历和求职信草稿、创建投递记录；不自动提交站外申请。",
        "intent_keywords": ["投递", "申请", "application", "cover letter", "求职信"],
        "steps": [
            {"operation": "get_job", "args": {"job_id": 0}},
            {"operation": "generate_resume", "args": {"job_id": 0}, "dry_run": True},
            {"operation": "generate_cover_letter", "args": {"job_id": 0, "resume_id": 0}, "dry_run": True},
            {"operation": "create_application", "args": {"job_id": 0}, "dry_run": True},
        ],
    },
    "workspace_handoff": {
        "name": "workspace_handoff",
        "description": "读取或写入 UI 当前页面上下文，让外部 agent 接管用户正在看的对象。",
        "intent_keywords": ["当前页面", "上下文", "handoff", "selection", "接管"],
        "steps": [
            {"operation": "get_current_view", "args": {"scope": "default"}},
            {"operation": "set_current_view", "args": {"scope": "default", "route": "", "title": "", "updated_by": "external_agent"}, "dry_run": True},
        ],
    },
}


async def get_agent_playbook(detail: str = "compact") -> dict[str, Any]:
    if detail not in {"compact", "full"}:
        return {"error": "detail must be compact or full"}
    payload: dict[str, Any] = {
        "role": "OfferU external-agent operating contract",
        "principles": [
            "Use python -m app.cli manifest --pretty before controlling the system.",
            "Discover atomic operations with python -m app.cli ops --pretty and inspect parameters with schema.",
            "One CLI invocation performs one atomic operation; compose workflows in the agent, not inside ad-hoc shell scripts.",
            "Read operations execute directly; write, llm, and external side-effect operations must dry-run before user confirmation.",
            "Never auto-submit job applications, send email, or message external parties; create drafts and pending records only.",
        ],
        "commands": {
            "health": "python -m app.cli doctor --pretty",
            "manifest": "python -m app.cli manifest --pretty",
            "operations": "python -m app.cli ops --pretty",
            "schema": "python -m app.cli schema <operation> --pretty",
            "run": "python -m app.cli run <operation> --arg key=value --pretty",
            "dry_run": "python -m app.cli run <operation> --arg key=value --dry-run --pretty",
            "workflow_catalog": "python -m app.cli run workflow_catalog --pretty",
            "workflow_plan": "python -m app.cli run workflow_plan --arg goal=\"批量筛选岗位\" --pretty",
        },
        "workflow_names": sorted(WORKFLOW_CATALOG),
    }
    if detail == "full":
        payload["workflows"] = list(WORKFLOW_CATALOG.values())
        payload["operation_groups"] = sorted({op.group for op in OPERATIONS.values()})
        payload["side_effect_labels"] = sorted({effect for op in OPERATIONS.values() for effect in op.side_effects})
    return payload


async def workflow_catalog() -> dict[str, Any]:
    return {"workflows": list(WORKFLOW_CATALOG.values())}


async def workflow_plan(goal: str, limit: int = 20) -> dict[str, Any]:
    normalized_goal = (goal or "").strip().lower()
    if not normalized_goal:
        return {"error": "goal is required"}
    safe_limit = max(1, min(int(limit or 20), 100))
    workflow = _select_workflow(normalized_goal)
    if not workflow:
        return {"error": "unsupported workflow goal", "supported_workflows": sorted(WORKFLOW_CATALOG)}
    steps = [_materialize_workflow_step(step, safe_limit) for step in workflow["steps"]]
    return {
        "goal": goal,
        "workflow": workflow["name"],
        "description": workflow["description"],
        "requires_agent_judgment": _workflow_requires_agent_judgment(workflow["name"]),
        "steps": steps,
        "commands": [step["command"] for step in steps],
        "confirmation_rule": "Commands marked dry_run inspect side effects only; execute the same operation without --dry-run only after user confirmation.",
    }


def _select_workflow(normalized_goal: str) -> Optional[dict[str, Any]]:
    for workflow in WORKFLOW_CATALOG.values():
        if workflow["name"] == normalized_goal:
            return workflow
    ranked: list[tuple[int, int, dict[str, Any]]] = []
    for index, workflow in enumerate(WORKFLOW_CATALOG.values()):
        matches = sum(1 for keyword in workflow["intent_keywords"] if keyword.lower() in normalized_goal)
        if matches:
            ranked.append((matches, -index, workflow))
    if not ranked:
        return None
    ranked.sort(reverse=True, key=lambda item: (item[0], item[1]))
    return ranked[0][2]


def _materialize_workflow_step(step: dict[str, Any], limit: int) -> dict[str, Any]:
    args = dict(step.get("args", {}))
    if "page_size" in args:
        args["page_size"] = limit
    operation = step["operation"]
    dry_run = bool(step.get("dry_run"))
    command = _operation_command(operation, args, dry_run=dry_run)
    return {"operation": operation, "args": args, "dry_run": dry_run, "command": command}


def _operation_command(operation: str, args: dict[str, Any], *, dry_run: bool) -> str:
    parts = ["python -m app.cli run", operation]
    for key, value in args.items():
        parts.extend(["--arg", f"{key}={json.dumps(value, ensure_ascii=True) if isinstance(value, (dict, list)) else value}"])
    if dry_run:
        parts.append("--dry-run")
    parts.append("--pretty")
    return " ".join(str(part) for part in parts)


def _workflow_requires_agent_judgment(name: str) -> list[str]:
    if name == "batch_triage":
        return ["Select concrete job_ids after reading list_jobs outputs.", "Choose picked or ignored based on profile fit and user intent."]
    if name in {"tailored_resume", "application_pipeline"}:
        return ["Replace job_id=0 and resume_id=0 with real IDs discovered from read operations."]
    if name == "workspace_handoff":
        return ["Fill route, title, selection, filters, and context from the UI state being handed off."]
    return []


async def create_pool_operation(
    name: str,
    scope: str = "picked",
    description: str = "",
    color: str = "#3B82F6",
    sort_order: int = 0,
) -> dict[str, Any]:
    normalized_name = (name or "").strip()
    normalized_scope = (scope or "picked").strip().lower()
    if not normalized_name:
        return {"error": "Pool name is required"}
    if normalized_scope not in {"inbox", "picked", "ignored"}:
        return {"error": "invalid pool scope"}

    async with async_session() as db:
        existing = (
            await db.execute(
                select(Pool).where(
                    func.lower(Pool.name) == normalized_name.lower(),
                    Pool.scope == normalized_scope,
                )
            )
        ).scalar_one_or_none()
        if existing:
            return {"error": "Pool name already exists"}

        pool = Pool(
            name=normalized_name,
            scope=normalized_scope,
            description=(description or "").strip(),
            color=(color or "#3B82F6").strip(),
            sort_order=int(sort_order or 0),
        )
        db.add(pool)
        await db.commit()
        await db.refresh(pool)
        return _serialize_pool(pool, 0)


async def update_pool_operation(
    pool_id: int,
    name: Optional[str] = None,
    description: Optional[str] = None,
    color: Optional[str] = None,
    sort_order: Optional[int] = None,
) -> dict[str, Any]:
    async with async_session() as db:
        pool = (await db.execute(select(Pool).where(Pool.id == pool_id))).scalar_one_or_none()
        if not pool:
            return {"error": "Pool not found"}

        if name is not None:
            normalized_name = name.strip()
            if not normalized_name:
                return {"error": "Pool name is required"}
            conflict = (
                await db.execute(
                    select(Pool).where(
                        func.lower(Pool.name) == normalized_name.lower(),
                        Pool.id != pool_id,
                        Pool.scope == pool.scope,
                    )
                )
            ).scalar_one_or_none()
            if conflict:
                return {"error": "Pool name already exists"}
            pool.name = normalized_name
        if description is not None:
            pool.description = description.strip()
        if color is not None:
            pool.color = color.strip()
        if sort_order is not None:
            pool.sort_order = int(sort_order)

        await db.commit()
        await db.refresh(pool)
        count = (await db.execute(select(func.count(Job.id)).where(Job.pool_id == pool_id))).scalar() or 0
        return _serialize_pool(pool, count)


async def delete_pool_operation(pool_id: int) -> dict[str, Any]:
    async with async_session() as db:
        pool = (await db.execute(select(Pool).where(Pool.id == pool_id))).scalar_one_or_none()
        if not pool:
            return {"error": "Pool not found"}
        jobs = (await db.execute(select(Job).where(Job.pool_id == pool_id))).scalars().all()
        for job in jobs:
            job.pool_id = None
        await db.delete(pool)
        await db.commit()
        return {"deleted": True, "pool_id": pool_id, "moved_to_ungrouped": len(jobs)}


def _to_internal_status(status: str) -> str:
    value = (status or "").strip().lower()
    if value in {"inbox", "unscreened"}:
        return "inbox"
    if value in {"picked", "screened"}:
        return "picked"
    if value == "ignored":
        return "ignored"
    return value


async def update_job_operation(
    job_id: int,
    triage_status: Optional[str] = None,
    pool_id: Optional[int] = None,
    clear_pool: bool = False,
) -> dict[str, Any]:
    if triage_status is None and pool_id is None and not clear_pool:
        return {"error": "no update fields provided"}

    normalized = _to_internal_status(triage_status) if triage_status else None
    if normalized and normalized not in {"inbox", "picked", "ignored"}:
        return {"error": "invalid triage_status"}

    clear_pool = bool(clear_pool or pool_id == 0)
    target_pool_id = None if pool_id == 0 else pool_id
    if target_pool_id is not None and clear_pool:
        return {"error": "pool_id and clear_pool are mutually exclusive"}
    if target_pool_id is not None and normalized and normalized != "picked":
        return {"error": "pool_id can only be used with triage_status=picked"}

    async with async_session() as db:
        job = (await db.execute(select(Job).where(Job.id == job_id))).scalar_one_or_none()
        if not job:
            return {"error": "Job not found"}

        if normalized is not None:
            job.triage_status = normalized
            if normalized != "picked":
                job.pool_id = None

        if target_pool_id is not None:
            pool = (await db.execute(select(Pool).where(Pool.id == target_pool_id))).scalar_one_or_none()
            if not pool:
                return {"error": "Pool not found"}
            if pool.scope != "picked":
                return {"error": "only picked scope pool can be assigned"}
            job.pool_id = target_pool_id
            if normalized is None:
                job.triage_status = "picked"

        if clear_pool:
            job.pool_id = None

        await db.commit()
        await db.refresh(job)
        return _serialize_job_detail(job)


async def batch_update_jobs_operation(
    job_ids: list[int],
    triage_status: Optional[str] = None,
    pool_id: Optional[int] = None,
    clear_pool: bool = False,
) -> dict[str, Any]:
    if not job_ids:
        return {"error": "job_ids is required"}
    if len(job_ids) > 500:
        return {"error": "job_ids exceeds 500"}
    if triage_status is None and pool_id is None and not clear_pool:
        return {"error": "no update fields provided"}

    normalized = _to_internal_status(triage_status) if triage_status else None
    if normalized and normalized not in {"inbox", "picked", "ignored"}:
        return {"error": "invalid triage_status"}
    if pool_id is not None and clear_pool:
        return {"error": "pool_id and clear_pool are mutually exclusive"}
    if pool_id is not None and normalized and normalized != "picked":
        return {"error": "pool_id can only be used with triage_status=picked"}

    async with async_session() as db:
        pool = None
        if pool_id is not None:
            pool = (await db.execute(select(Pool).where(Pool.id == pool_id))).scalar_one_or_none()
            if not pool:
                return {"error": "Pool not found"}
            if pool.scope != "picked":
                return {"error": "only picked scope pool can be assigned"}

        jobs = (await db.execute(select(Job).where(Job.id.in_(job_ids)))).scalars().all()
        found_ids = {job.id for job in jobs}
        missing_ids = sorted(set(job_ids) - found_ids)
        if missing_ids:
            return {"error": f"some job_ids were not found: {missing_ids}", "missing_job_ids": missing_ids}

        for job in jobs:
            if normalized:
                job.triage_status = normalized
                if normalized != "picked":
                    job.pool_id = None
                elif pool_id is None and not clear_pool:
                    job.pool_id = None
            if pool_id is not None:
                job.pool_id = pool_id
                if triage_status is None:
                    job.triage_status = "picked"
            if clear_pool:
                job.pool_id = None

        await db.commit()
        return {"updated": len(jobs), "requested": len(job_ids), "pool_name": pool.name if pool else None}


def _serialize_job_detail(job: Job) -> dict[str, Any]:
    return {
        "id": job.id,
        "title": job.title,
        "company": job.company,
        "location": job.location or "",
        "url": job.url or "",
        "apply_url": job.apply_url or "",
        "source": job.source or "",
        "triage_status": job.triage_status or "inbox",
        "pool_id": job.pool_id,
        "batch_id": job.batch_id,
        "salary_text": job.salary_text or "",
        "education": job.education or "",
        "experience": job.experience or "",
        "job_type": job.job_type or "",
        "is_campus": job.is_campus,
        "summary": job.summary or "",
        "keywords": job.keywords or [],
        "created_at": str(job.created_at) if job.created_at else None,
    }


async def list_operation_audit(
    operation: Optional[str] = None,
    surface: Optional[str] = None,
    limit: int = 50,
) -> dict[str, Any]:
    safe_limit = max(1, min(int(limit or 50), 200))
    async with async_session() as db:
        query = select(OperationAuditLog)
        if operation:
            query = query.where(OperationAuditLog.operation == operation)
        if surface:
            query = query.where(OperationAuditLog.surface == surface)
        rows = (await db.execute(query.order_by(OperationAuditLog.created_at.desc()).limit(safe_limit))).scalars().all()
        return {
            "total_returned": len(rows),
            "items": [
                {
                    "id": row.id,
                    "operation": row.operation,
                    "operation_version": row.operation_version,
                    "surface": row.surface,
                    "ok": row.ok,
                    "dry_run": row.dry_run,
                    "side_effects": row.side_effects,
                    "inputs": row.inputs_json,
                    "warnings": row.warnings_json,
                    "errors": row.errors_json,
                    "elapsed_ms": row.elapsed_ms,
                    "created_at": str(row.created_at),
                }
                for row in rows
            ],
        }


async def get_current_view(scope: str = "default") -> dict[str, Any]:
    async with async_session() as db:
        row = (
            await db.execute(select(AgentWorkspaceState).where(AgentWorkspaceState.scope == scope))
        ).scalar_one_or_none()
        if not row:
            return {
                "scope": scope,
                "route": "",
                "title": "",
                "entity_type": "",
                "entity_id": "",
                "selection": {},
                "filters": {},
                "context": {},
                "version": 0,
                "updated_by": "",
                "updated_at": None,
            }
        return _serialize_workspace_state(row)


async def set_current_view(
    scope: str = "default",
    route: str = "",
    title: str = "",
    entity_type: str = "",
    entity_id: str = "",
    selection: Optional[dict[str, Any]] = None,
    filters: Optional[dict[str, Any]] = None,
    context: Optional[dict[str, Any]] = None,
    updated_by: str = "ui",
) -> dict[str, Any]:
    normalized_scope = (scope or "default").strip() or "default"
    async with async_session() as db:
        row = (
            await db.execute(select(AgentWorkspaceState).where(AgentWorkspaceState.scope == normalized_scope))
        ).scalar_one_or_none()
        if not row:
            row = AgentWorkspaceState(scope=normalized_scope)
            db.add(row)
        row.route = (route or "")[:300]
        row.title = (title or "")[:300]
        row.entity_type = (entity_type or "")[:80]
        row.entity_id = (str(entity_id) if entity_id is not None else "")[:120]
        row.selection_json = selection or {}
        row.filters_json = filters or {}
        row.context_json = context or {}
        row.updated_by = (updated_by or "unknown")[:80]
        row.version = int(row.version or 0) + 1
        await db.commit()
        await db.refresh(row)
        return _serialize_workspace_state(row)


async def clear_current_view(scope: str = "default") -> dict[str, Any]:
    normalized_scope = (scope or "default").strip() or "default"
    async with async_session() as db:
        row = (
            await db.execute(select(AgentWorkspaceState).where(AgentWorkspaceState.scope == normalized_scope))
        ).scalar_one_or_none()
        if not row:
            return {"cleared": False, "scope": normalized_scope}
        await db.delete(row)
        await db.commit()
        return {"cleared": True, "scope": normalized_scope}


def _serialize_workspace_state(row: AgentWorkspaceState) -> dict[str, Any]:
    return {
        "scope": row.scope,
        "route": row.route,
        "title": row.title,
        "entity_type": row.entity_type,
        "entity_id": row.entity_id,
        "selection": row.selection_json or {},
        "filters": row.filters_json or {},
        "context": row.context_json or {},
        "version": row.version,
        "updated_by": row.updated_by,
        "updated_at": str(row.updated_at) if row.updated_at else None,
    }


def _serialize_pool(pool: Pool, job_count: int = 0) -> dict[str, Any]:
    return {
        "id": pool.id,
        "name": pool.name,
        "scope": pool.scope,
        "description": pool.description or "",
        "color": pool.color or "#3B82F6",
        "sort_order": pool.sort_order or 0,
        "job_count": job_count,
        "created_at": str(pool.created_at) if pool.created_at else None,
        "updated_at": str(pool.updated_at) if pool.updated_at else None,
    }


OPERATIONS.update(
    {
        "agent_playbook": Operation(
            name="agent_playbook",
            fn=get_agent_playbook,
            description="输出外部 Agent 操作 OfferU 的专家级控制契约、CLI 规则和安全边界。",
            parameters={"detail": "str=compact (compact|full)"},
            group="governance",
        ),
        "workflow_catalog": Operation(
            name="workflow_catalog",
            fn=workflow_catalog,
            description="列出内置可组合工作流模板，供外部 Agent 自主选择和批量编排。",
            group="governance",
        ),
        "workflow_plan": Operation(
            name="workflow_plan",
            fn=workflow_plan,
            description="按自然语言目标选择内置工作流，并返回可执行的原子 CLI 命令序列。",
            parameters={"goal": "str", "limit": "int=20"},
            group="governance",
        ),
        "create_pool": Operation(
            name="create_pool",
            fn=create_pool_operation,
            description="创建岗位池。",
            parameters={
                "name": "str",
                "scope": "str=picked (inbox|picked|ignored)",
                "description": "str?",
                "color": "str=#3B82F6",
                "sort_order": "int=0",
            },
            group="jobs",
            side_effects=("write",),
        ),
        "update_pool": Operation(
            name="update_pool",
            fn=update_pool_operation,
            description="更新岗位池名称、描述、颜色或排序。",
            parameters={
                "pool_id": "int",
                "name": "str?",
                "description": "str?",
                "color": "str?",
                "sort_order": "int?",
            },
            group="jobs",
            side_effects=("write",),
        ),
        "delete_pool": Operation(
            name="delete_pool",
            fn=delete_pool_operation,
            description="删除岗位池，并将池内岗位移回未分组。",
            parameters={"pool_id": "int"},
            group="jobs",
            side_effects=("write",),
        ),
        "update_job": Operation(
            name="update_job",
            fn=update_job_operation,
            description="更新单个岗位的分拣状态或岗位池归属。",
            parameters={
                "job_id": "int",
                "triage_status": "str? (inbox|picked|ignored)",
                "pool_id": "int?",
                "clear_pool": "bool=false",
            },
            group="jobs",
            side_effects=("write",),
        ),
        "batch_update_jobs": Operation(
            name="batch_update_jobs",
            fn=batch_update_jobs_operation,
            description="批量更新岗位分拣状态或岗位池归属。",
            parameters={
                "job_ids": "list[int]",
                "triage_status": "str? (inbox|picked|ignored)",
                "pool_id": "int?",
                "clear_pool": "bool=false",
            },
            group="jobs",
            side_effects=("write",),
        ),
        "list_operation_audit": Operation(
            name="list_operation_audit",
            fn=list_operation_audit,
            description="查看 Operation Registry 统一审计日志。",
            parameters={"operation": "str?", "surface": "str?", "limit": "int=50"},
            group="governance",
        ),
        "get_current_view": Operation(
            name="get_current_view",
            fn=get_current_view,
            description="获取 UI 与 Agent 共享的当前工作区上下文。",
            parameters={"scope": "str=default"},
            group="context",
        ),
        "set_current_view": Operation(
            name="set_current_view",
            fn=set_current_view,
            description="写入 UI 与 Agent 共享的当前页面、选中项、过滤器和上下文。",
            parameters={
                "scope": "str=default",
                "route": "str?",
                "title": "str?",
                "entity_type": "str?",
                "entity_id": "str?",
                "selection": "dict?",
                "filters": "dict?",
                "context": "dict?",
                "updated_by": "str=ui",
            },
            group="context",
            side_effects=("write",),
        ),
        "clear_current_view": Operation(
            name="clear_current_view",
            fn=clear_current_view,
            description="清空 UI 与 Agent 共享的当前工作区上下文。",
            parameters={"scope": "str=default"},
            group="context",
            side_effects=("write",),
        ),
    }
)


async def execute_operation(
    name: str,
    args: Optional[dict[str, Any]] = None,
    *,
    dry_run: bool = False,
    surface: str = "unknown",
    audit: bool = True,
) -> dict[str, Any]:
    op = OPERATIONS.get(name)
    inputs = args or {}
    started = time.perf_counter()
    if not op:
        envelope = _envelope(
            ok=False,
            operation=name,
            inputs=inputs,
            started=started,
            errors=[f"未知操作: {name}"],
        )
        await _record_audit(envelope, dry_run=dry_run, surface=surface, audit=audit)
        return envelope

    clean_args = {k: v for k, v in inputs.items() if v is not None}
    validation_error = _validate_args(op, clean_args)
    if validation_error:
        envelope = _envelope(
            ok=False,
            operation=name,
            inputs=clean_args,
            started=started,
            errors=[validation_error],
            op=op,
        )
        await _record_audit(envelope, dry_run=dry_run, surface=surface, audit=audit)
        return envelope

    if dry_run and op.is_mutation:
        envelope = _envelope(
            ok=True,
            operation=name,
            inputs=clean_args,
            started=started,
            outputs={"skipped": True, "reason": "dry_run", "side_effects": list(op.side_effects)},
            warnings=["dry_run 已启用，未执行会写入、调用 LLM 或访问外部系统的操作。"],
            op=op,
        )
        await _record_audit(envelope, dry_run=dry_run, surface=surface, audit=audit)
        return envelope

    try:
        result = await op.fn(**clean_args)
        envelope = _envelope(
            ok=not (isinstance(result, dict) and result.get("error")),
            operation=name,
            inputs=clean_args,
            started=started,
            outputs=result,
            errors=[result["error"]] if isinstance(result, dict) and result.get("error") else [],
            op=op,
        )
        await _record_audit(envelope, dry_run=dry_run, surface=surface, audit=audit)
        return envelope
    except Exception as exc:
        envelope = _envelope(
            ok=False,
            operation=name,
            inputs=clean_args,
            started=started,
            errors=[str(exc)],
            op=op,
        )
        await _record_audit(envelope, dry_run=dry_run, surface=surface, audit=audit)
        return envelope


def _validate_args(op: Operation, args: dict[str, Any]) -> Optional[str]:
    signature = inspect.signature(op.fn)
    required = [
        name
        for name, param in signature.parameters.items()
        if param.default is inspect.Parameter.empty
        and param.kind in (inspect.Parameter.POSITIONAL_OR_KEYWORD, inspect.Parameter.KEYWORD_ONLY)
    ]
    missing = [name for name in required if name not in args]
    if missing:
        return f"缺少必填参数: {', '.join(missing)}"

    allowed = set(signature.parameters)
    extra = [name for name in args if name not in allowed]
    if extra:
        return f"未知参数: {', '.join(extra)}"
    return None


def _envelope(
    *,
    ok: bool,
    operation: str,
    inputs: dict[str, Any],
    started: float,
    outputs: Any = None,
    warnings: Optional[list[str]] = None,
    errors: Optional[list[str]] = None,
    op: Optional[Operation] = None,
) -> dict[str, Any]:
    return {
        "ok": ok,
        "operation": operation,
        "operation_version": op.version if op else None,
        "inputs": inputs,
        "outputs": outputs,
        "warnings": warnings or [],
        "errors": errors or [],
        "side_effects": list(op.side_effects) if op else [],
        "elapsed_ms": round((time.perf_counter() - started) * 1000, 2),
    }


async def _record_audit(envelope: dict[str, Any], *, dry_run: bool, surface: str, audit: bool) -> None:
    if not audit or envelope.get("operation") == "list_operation_audit":
        return
    try:
        async with async_session() as db:
            row = OperationAuditLog(
                operation=envelope.get("operation") or "unknown",
                operation_version=envelope.get("operation_version") or "",
                surface=(surface or "unknown")[:40],
                ok=bool(envelope.get("ok")),
                dry_run=bool(dry_run),
                side_effects=list(envelope.get("side_effects") or []),
                inputs_json=_json_object(envelope.get("inputs")),
                outputs_json=_json_object(envelope.get("outputs")),
                warnings_json=list(envelope.get("warnings") or []),
                errors_json=list(envelope.get("errors") or []),
                elapsed_ms=float(envelope.get("elapsed_ms") or 0),
            )
            db.add(row)
            await db.commit()
    except Exception:
        return


def _json_object(value: Any) -> dict[str, Any]:
    if isinstance(value, dict):
        return value
    if value is None:
        return {}
    return {"value": value}
