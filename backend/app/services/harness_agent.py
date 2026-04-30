from __future__ import annotations

import re
from typing import Any, Awaitable, Callable

ToolHandler = Callable[..., Awaitable[Any]]
RiskLevel = str

READ_TOOLS = {
    "get_profile",
    "list_jobs",
    "get_job",
    "job_stats",
    "list_pools",
    "list_scraper_sources",
    "list_scraper_tasks",
    "list_resumes",
    "list_applications",
    "list_calendar_events",
    "list_email_notifications",
    "list_interview_questions",
    "career_exploration",
}

CONFIRM_TOOLS = {
    "batch_triage",
    "run_scraper",
    "generate_resume",
    "import_jobs_to_application_table",
    "auto_fill_calendar",
    "sync_email_notifications",
}

WRITE_TOOLS = {
    "triage_job",
    "create_application",
}

TOOL_DESCRIPTIONS = {
    "get_profile": "Read the current user profile.",
    "list_jobs": "Read jobs from the local OfferU job database.",
    "get_job": "Read a single job detail.",
    "job_stats": "Read job statistics.",
    "list_pools": "Read job pools.",
    "list_scraper_sources": "Read available scraper sources.",
    "list_scraper_tasks": "Read scraper task history.",
    "list_resumes": "Read saved resumes.",
    "list_applications": "Read application records.",
    "list_calendar_events": "Read calendar events.",
    "list_email_notifications": "Read parsed email notifications.",
    "list_interview_questions": "Read interview questions.",
    "career_exploration": "Generate transferable-skill career paths.",
    "batch_triage": "Batch triage jobs into a status or pool.",
    "run_scraper": "Start a job scraper task.",
    "generate_resume": "Generate a tailored resume for a job.",
    "import_jobs_to_application_table": "Import jobs into application tracking.",
    "auto_fill_calendar": "Create calendar events from parsed interview emails.",
    "sync_email_notifications": "Sync and parse email notifications.",
    "triage_job": "Triage one job.",
    "create_application": "Create one pending application record.",
}


def get_default_tool_registry() -> dict[str, dict[str, Any]]:
    registry: dict[str, dict[str, Any]] = {}
    for name in sorted(READ_TOOLS):
        registry[name] = _tool_entry(name, "read")
    for name in sorted(WRITE_TOOLS):
        registry[name] = _tool_entry(name, "write")
    for name in sorted(CONFIRM_TOOLS):
        registry[name] = _tool_entry(name, "confirm")
    return registry


def _tool_entry(name: str, risk_level: RiskLevel) -> dict[str, Any]:
    return {
        "name": name,
        "description": TOOL_DESCRIPTIONS.get(name, name.replace("_", " ")),
        "parameters": {},
        "risk_level": risk_level,
        "handler": None,
    }


def classify_intent(message: str) -> str:
    text = (message or "").strip().lower()
    if not text:
        return "general"

    career_keywords = (
        "职业",
        "方向",
        "职业规划",
        "没想到",
        "意想不到",
        "可迁移",
        "转行",
        "career",
        "path",
        "direction",
        "transferable",
    )
    job_keywords = (
        "岗位",
        "职位",
        "实习",
        "抓取",
        "爬取",
        "筛选",
        "投递",
        "job",
        "intern",
        "scrape",
        "apply",
    )
    resume_keywords = ("简历", "resume", "优化", "生成")
    application_keywords = ("投递表", "投递管理", "application", "跟进")
    interview_keywords = ("面试", "interview", "日程", "calendar", "邮件", "email")

    if any(keyword in text for keyword in career_keywords):
        return "career_exploration"
    if any(keyword in text for keyword in job_keywords):
        return "job_workflow"
    if any(keyword in text for keyword in resume_keywords):
        return "resume_workflow"
    if any(keyword in text for keyword in application_keywords):
        return "application_tracking"
    if any(keyword in text for keyword in interview_keywords):
        return "follow_up"
    return "general"


def last_user_message(messages: list[dict[str, str]]) -> str:
    for message in reversed(messages or []):
        if message.get("role") == "user":
            return str(message.get("content") or "")
    return ""


def build_application_import_preview(job: dict[str, Any]) -> dict[str, Any]:
    return {
        "company_name": str(job.get("company") or "").strip(),
        "job_title": str(job.get("title") or "").strip(),
        "location": str(job.get("location") or "").strip(),
        "job_link": str(job.get("apply_url") or job.get("url") or "").strip(),
        "source": str(job.get("source") or "").strip(),
        "salary_text": str(job.get("salary_text") or job.get("salary") or "").strip(),
    }


def build_job_card(job: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": int(job.get("id") or 0),
        "title": str(job.get("title") or "").strip(),
        "company": str(job.get("company") or "").strip(),
        "location": str(job.get("location") or "").strip(),
        "salary_text": str(job.get("salary_text") or job.get("salary") or "").strip(),
        "source": str(job.get("source") or "").strip(),
        "apply_url": str(job.get("apply_url") or job.get("url") or "").strip(),
        "summary": str(job.get("summary") or "")[:240],
    }


ROLE_KEYWORD_PATTERNS = (
    "AI 产品运营",
    "AI产品运营",
    "用户研究",
    "产品运营",
    "内容运营",
    "新媒体运营",
    "社群运营",
    "活动运营",
    "用户增长",
    "产品经理",
    "产品助理",
    "商业分析",
    "行业研究",
    "战略分析",
    "市场营销",
    "品牌策划",
    "校园招聘",
    "人力资源",
    "HR",
    "数据分析",
    "AI Product Operations",
    "Product Operations",
    "User Research",
    "Content Operations",
    "Product Manager",
    "Data Analyst",
)

CITY_KEYWORDS = (
    "北京",
    "上海",
    "深圳",
    "广州",
    "杭州",
    "南京",
    "苏州",
    "成都",
    "武汉",
    "西安",
    "重庆",
    "天津",
    "厦门",
    "长沙",
    "青岛",
    "香港",
)

CITY_ALIASES = {
    "beijing": "北京",
    "shanghai": "上海",
    "shenzhen": "深圳",
    "guangzhou": "广州",
    "hangzhou": "杭州",
    "nanjing": "南京",
    "suzhou": "苏州",
    "chengdu": "成都",
    "wuhan": "武汉",
    "xian": "西安",
    "xi'an": "西安",
    "hong kong": "香港",
}

GENERIC_SCRAPER_KEYWORDS = {"实习", "校招", "应届"}
SCRAPER_KEYWORD_STOPWORDS = {
    "岗位",
    "职位",
    "岗位库",
    "匹配",
    "筛选",
    "相关",
    "不相关",
    "如果",
    "继续",
    "爬取",
    "抓取",
    "帮我",
    "请先",
}


def _dedupe_strings(items: list[str], limit: int = 6) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for item in items:
        text = str(item or "").strip()
        if not text:
            continue
        if _looks_like_corrupt_keyword(text):
            continue
        if re.sub(r"\s+", "", text) in SCRAPER_KEYWORD_STOPWORDS:
            continue
        key = re.sub(r"\s+", "", text).lower()
        if key in seen:
            continue
        seen.add(key)
        result.append(text)
        if len(result) >= limit:
            break
    return result


def _looks_like_corrupt_keyword(text: str) -> bool:
    compact = re.sub(r"\s+", "", str(text or ""))
    if not compact:
        return True
    placeholder_count = compact.count("?") + compact.count("�")
    return placeholder_count >= 2 and placeholder_count / max(len(compact), 1) >= 0.2


def _profile_role_keywords(profile: dict[str, Any] | None) -> list[str]:
    if not isinstance(profile, dict):
        return []
    roles = profile.get("target_roles") or []
    keywords: list[str] = []
    if isinstance(roles, list):
        for role in roles:
            if isinstance(role, dict):
                keywords.append(str(role.get("role_name") or ""))
            else:
                keywords.append(str(role or ""))
    headline = str(profile.get("headline") or "").strip()
    if headline:
        keywords.append(headline)
    return _dedupe_strings(keywords, limit=4)


def _message_role_keywords(message: str) -> list[str]:
    text = str(message or "")
    compact = re.sub(r"\s+", "", text)
    keywords: list[str] = []
    for pattern in ROLE_KEYWORD_PATTERNS:
        if pattern in text or re.sub(r"\s+", "", pattern) in compact:
            keywords.append(pattern)

    for match in re.finditer(r"([\u4e00-\u9fa5A-Za-z0-9+ ]{2,18})(?:方向|岗位|职位|实习|校招)", text):
        candidate = match.group(1).strip(" ，,、/和找想做的")
        previous = None
        while previous != candidate:
            previous = candidate
            candidate = re.sub(r"^.*?(?:帮我找|帮我|请|想找|找|抓取|爬取|筛选)", "", candidate).strip()
        for city in CITY_KEYWORDS:
            candidate = re.sub(rf"^{re.escape(city)}\s*", "", candidate).strip()
        candidate = re.sub(r"(实习|校招|应届)$", "", candidate).strip()
        if not candidate:
            continue
        pieces = re.split(r"[、/,，和及]|以及|或者|或", candidate)
        for piece in pieces:
            cleaned = piece.strip()
            if 2 <= len(cleaned) <= 18 and not re.search(r"我|帮|请|抓取|爬取|筛选|岗位|职位", cleaned):
                keywords.append(cleaned)

    return _dedupe_strings(keywords, limit=5)


def build_scraper_args_from_context(
    *,
    user_message: str,
    profile: dict[str, Any] | None,
    max_results: int = 30,
) -> dict[str, Any]:
    role_keywords = _message_role_keywords(user_message) or _profile_role_keywords(profile)
    text = str(user_message or "")
    location = next((city for city in CITY_KEYWORDS if city in text), "")
    if not location:
        lowered = text.lower()
        location = next((city for alias, city in CITY_ALIASES.items() if alias in lowered), "")

    keywords = _dedupe_strings(role_keywords, limit=5)
    if re.search(r"实习|intern", text, re.IGNORECASE):
        keywords.append("实习")
    if re.search(r"校招|应届|春招|秋招", text, re.IGNORECASE):
        keywords.append("校招")
    if not keywords:
        keywords = ["实习"]

    return {
        "source": "shixiseng",
        "keywords": _dedupe_strings(keywords, limit=6),
        "location": location,
        "max_results": max_results,
    }


def _text_contains_keyword(text: str, keyword: str) -> bool:
    haystack = re.sub(r"\s+", "", str(text or "")).lower()
    needle = re.sub(r"\s+", "", str(keyword or "")).lower()
    return bool(needle and needle in haystack)


def _job_matches_keywords(job: dict[str, Any], keywords: list[str]) -> bool:
    primary_keywords = [
        keyword for keyword in keywords
        if keyword and keyword not in GENERIC_SCRAPER_KEYWORDS
    ]
    if not primary_keywords:
        return True
    text = " ".join(
        str(job.get(key) or "")
        for key in ("title", "company", "summary", "raw_description", "company_industry")
    )
    return any(_text_contains_keyword(text, keyword) for keyword in primary_keywords)


def build_career_exploration_fallback(
    *,
    profile: dict[str, Any] | None,
    user_message: str,
) -> dict[str, Any]:
    profile = profile or {}
    target_roles = profile.get("target_roles") or []
    role_names = [
        str(item.get("role_name") or "").strip()
        for item in target_roles
        if isinstance(item, dict) and str(item.get("role_name") or "").strip()
    ]
    headline = str(profile.get("headline") or "").strip()
    anchor = role_names[0] if role_names else headline or "your current strengths"
    sections_by_type = profile.get("sections_by_type") or {}
    section_count = sum(int(value or 0) for value in sections_by_type.values()) if isinstance(sections_by_type, dict) else 0

    summary = (
        f"Your profile suggests a reusable base around {anchor}: problem framing, communication, "
        f"information synthesis, and execution follow-through. I found {section_count} profile items to treat as evidence, "
        "so these paths stay adjacent to your demonstrated strengths instead of inventing unrelated experience."
    )

    career_paths = [
        {
            "title": "AI Product Operations",
            "industry": "AI tools and SaaS",
            "fit_reason": "Connects user insight, workflow design, content clarity, and cross-functional coordination.",
            "entry_route": "Start with product operations intern, AI workflow assistant, or growth operations roles.",
            "salary_range": "China internship: 150-350 CNY/day; entry full-time: 12k-25k CNY/month varies by city.",
            "search_keywords": ["AI product operations", "workflow operations", "product assistant"],
            "application_strategy": "Show one workflow you improved, the metric you watched, and a concise product sense memo.",
        },
        {
            "title": "Employer Branding Strategist",
            "industry": "Recruiting, campus hiring, and HR tech",
            "fit_reason": "Uses storytelling, audience segmentation, event thinking, and platform content skills.",
            "entry_route": "Target campus recruitment, employer branding, HR content, or talent marketing internships.",
            "salary_range": "China internship: 120-300 CNY/day; entry full-time: 10k-20k CNY/month.",
            "search_keywords": ["employer branding", "campus recruitment", "talent marketing"],
            "application_strategy": "Prepare a sample campaign for one company and explain channel, message, and conversion goal.",
        },
        {
            "title": "Customer Education Designer",
            "industry": "SaaS, developer tools, fintech, and education technology",
            "fit_reason": "Turns complex information into usable lessons, onboarding flows, docs, and workshops.",
            "entry_route": "Look for user education, academy operations, knowledge base, or customer success enablement roles.",
            "salary_range": "China internship: 150-300 CNY/day; entry full-time: 11k-22k CNY/month.",
            "search_keywords": ["customer education", "user onboarding", "knowledge operations"],
            "application_strategy": "Submit a mini onboarding guide that teaches a real product feature in under five minutes.",
        },
        {
            "title": "Research and Insights Analyst",
            "industry": "Consulting, consumer research, internet strategy, and venture research",
            "fit_reason": "Rewards curiosity, synthesis, structured writing, interviews, and pattern finding.",
            "entry_route": "Apply for user research assistant, industry research intern, strategy analyst intern roles.",
            "salary_range": "China internship: 150-400 CNY/day; entry full-time: 12k-28k CNY/month.",
            "search_keywords": ["user research", "industry research", "strategy analyst intern"],
            "application_strategy": "Attach a two-page research brief with sources, insight, implication, and recommended action.",
        },
        {
            "title": "Community Growth Operator",
            "industry": "Consumer apps, education, creator economy, and B2B communities",
            "fit_reason": "Combines communication, event design, content rhythm, feedback loops, and retention thinking.",
            "entry_route": "Search for community operations, creator operations, user growth, or content community roles.",
            "salary_range": "China internship: 120-300 CNY/day; entry full-time: 10k-22k CNY/month.",
            "search_keywords": ["community operations", "creator operations", "user growth"],
            "application_strategy": "Bring a 30-day community activation plan with audience, cadence, and measurable outcomes.",
        },
    ]

    return {
        "transferable_skills_summary": summary,
        "career_paths": career_paths,
        "quick_wins": [
            "Pick two paths and search 20 real job descriptions to validate keyword overlap.",
            "Rewrite one resume section for each selected path without changing any facts.",
            "Create one proof-of-work artifact: campaign brief, research memo, workflow map, or onboarding guide.",
        ],
        "reality_check": {
            "best_fit": career_paths[0]["title"],
            "timeline": "1-2 weeks for validation, 2-4 weeks for portfolio evidence, 4-8 weeks for targeted applications.",
            "note": f"Prompt signal: {user_message[:120]}",
        },
    }


async def default_tool_runner(name: str, args: dict[str, Any]) -> Any:
    from app.database import async_session
    from app.mcp_server import (
        batch_triage,
        create_application,
        generate_resume,
        get_job,
        get_profile,
        job_stats,
        list_applications,
        list_jobs,
        list_pools,
        list_resumes,
        triage_job,
    )

    mcp_tools = {
        "get_profile": get_profile,
        "list_jobs": list_jobs,
        "get_job": get_job,
        "job_stats": job_stats,
        "list_pools": list_pools,
        "batch_triage": batch_triage,
        "generate_resume": generate_resume,
        "list_resumes": list_resumes,
        "list_applications": list_applications,
        "create_application": create_application,
        "triage_job": triage_job,
    }
    if name in mcp_tools:
        return await mcp_tools[name](**args)

    if name == "list_scraper_sources":
        from app.routes.scraper import list_sources

        return await list_sources()

    if name == "list_scraper_tasks":
        from app.routes.scraper import list_tasks

        async with async_session() as db:
            return await list_tasks(db=db)

    if name == "run_scraper":
        from app.routes.scraper import RunRequest, run_scraper

        async with async_session() as db:
            return await run_scraper(RunRequest(**args), db=db)

    if name == "import_jobs_to_application_table":
        from app.services.application_workspace import create_records_from_jobs

        table_id = int(args.get("table_id") or 0)
        job_ids = [int(item) for item in args.get("job_ids") or []]
        async with async_session() as db:
            return await create_records_from_jobs(db, table_id=table_id, job_ids=job_ids)

    if name == "list_calendar_events":
        from app.routes.calendar import list_events

        async with async_session() as db:
            return await list_events(start=args.get("start"), end=args.get("end"), db=db)

    if name == "auto_fill_calendar":
        from app.routes.calendar import auto_fill_events

        async with async_session() as db:
            return await auto_fill_events(db=db)

    if name == "list_email_notifications":
        from app.routes.email import list_notifications

        async with async_session() as db:
            return await list_notifications(db=db)

    if name == "sync_email_notifications":
        from app.routes.email import sync_emails

        async with async_session() as db:
            return await sync_emails(db=db)

    if name == "list_interview_questions":
        from app.routes.interview import list_questions

        async with async_session() as db:
            return await list_questions(
                company=args.get("company"),
                role=args.get("role"),
                job_id=args.get("job_id"),
                category=args.get("category"),
                db=db,
            )

    return {"error": f"Unknown harness tool: {name}"}


async def run_harness_agent_turn(
    *,
    messages: list[dict[str, str]],
    confirmed_action_ids: list[str] | None = None,
    tool_runner: Callable[[str, dict[str, Any]], Awaitable[Any]] | None = None,
) -> dict[str, Any]:
    user_message = last_user_message(messages)
    mode = classify_intent(user_message)
    runner = tool_runner or default_tool_runner
    tool_calls: list[dict[str, Any]] = []
    proposed_actions: list[dict[str, Any]] = []
    next_steps: list[str] = []

    async def call_tool(name: str, args: dict[str, Any] | None = None) -> Any:
        payload = args or {}
        result = await runner(name, payload)
        tool_calls.append({"tool": name, "args": payload, "result": result})
        return result

    if mode == "career_exploration":
        profile = await call_tool("get_profile", {})
        exploration = build_career_exploration_fallback(
            profile=profile if isinstance(profile, dict) else {},
            user_message=user_message,
        )
        return {
            "assistant_message": (
                "我先基于你的档案做了一版可迁移职业路径探索。"
                "这些方向强调能力迁移，下一步可以把其中 1-2 条转成岗位搜索。"
            ),
            "mode": mode,
            "requires_confirmation": False,
            "tool_calls": tool_calls,
            "proposed_actions": [],
            "career_paths": exploration["career_paths"],
            "transferable_skills_summary": exploration["transferable_skills_summary"],
            "quick_wins": exploration["quick_wins"],
            "reality_check": exploration["reality_check"],
            "job_cards": [],
            "next_steps": exploration["quick_wins"],
        }

    if mode == "job_workflow":
        profile = await call_tool("get_profile", {})
        scraper_args = build_scraper_args_from_context(
            user_message=user_message,
            profile=profile if isinstance(profile, dict) else {},
        )
        jobs_result = await call_tool("list_jobs", {"page": 1, "page_size": 8})
        raw_jobs = []
        if isinstance(jobs_result, dict):
            raw_jobs = jobs_result.get("jobs") or jobs_result.get("items") or []
        job_cards = [build_job_card(item) for item in raw_jobs if isinstance(item, dict)]
        matching_job_cards = [
            card for card in job_cards
            if _job_matches_keywords(card, scraper_args.get("keywords") or [])
        ]
        needs_fresh_scrape = bool(job_cards) and not matching_job_cards
        visible_job_cards = matching_job_cards if job_cards and not needs_fresh_scrape else []
        if visible_job_cards:
            job_ids = [card["id"] for card in visible_job_cards[:5] if card["id"]]
            proposed_actions.append(
                plan_action(
                    "batch_triage",
                    {"job_ids": job_ids, "status": "screened"},
                    index=1,
                )
            )
            next_steps = [
                "Review the suggested job cards.",
                "Confirm the batch triage action if these roles look relevant.",
                "Ask me to generate tailored resumes for the strongest matches.",
            ]
        else:
            proposed_actions.append(
                plan_action(
                    "run_scraper",
                    scraper_args,
                    index=1,
                )
            )
            next_steps = [
                "Confirm a scraper run to collect fresh jobs for this target.",
                "After jobs arrive, ask me to rank them against your profile.",
            ]
        execution = await execute_planned_actions(
            proposed_actions,
            confirmed_action_ids=confirmed_action_ids,
            tool_runner=runner,
        )
        tool_calls.extend(execution["tool_calls"])
        blocked_actions = execution["blocked_actions"]
        return {
            "assistant_message": "我检查了岗位库，并准备好了下一步动作。批量动作会等你确认后再执行。",
            "mode": mode,
            "requires_confirmation": bool(blocked_actions),
            "tool_calls": tool_calls,
            "proposed_actions": blocked_actions,
            "career_paths": [],
            "job_cards": visible_job_cards,
            "next_steps": next_steps,
        }

    if mode == "follow_up":
        notifications = await call_tool("list_email_notifications", {})
        events = await call_tool("list_calendar_events", {})
        notification_count = len(notifications) if isinstance(notifications, list) else 0
        event_count = len(events) if isinstance(events, list) else 0
        return {
            "assistant_message": f"我看了邮件通知和日程：当前有 {notification_count} 条通知、{event_count} 个日程事件。",
            "mode": mode,
            "requires_confirmation": False,
            "tool_calls": tool_calls,
            "proposed_actions": [],
            "career_paths": [],
            "job_cards": [],
            "next_steps": ["Review upcoming interviews.", "Ask me to generate answers for high-frequency questions."],
        }

    return {
        "assistant_message": "我可以帮你做职业探索、岗位筛选、简历生成、投递管理和面试跟进。你可以直接告诉我目标。",
        "mode": mode,
        "requires_confirmation": False,
        "tool_calls": tool_calls,
        "proposed_actions": [],
        "career_paths": [],
        "job_cards": [],
        "next_steps": [
            "Ask for unexpected career paths.",
            "Ask me to find suitable jobs.",
            "Ask me to prepare resumes or application tracking.",
        ],
    }


def build_action_summary(tool_name: str, args: dict[str, Any]) -> str:
    if tool_name == "batch_triage":
        count = len(args.get("job_ids") or [])
        return f"Update {count} jobs to {args.get('status', 'selected status')}."
    if tool_name == "import_jobs_to_application_table":
        count = len(args.get("job_ids") or [])
        return f"Import {count} jobs into application tracking."
    if tool_name == "run_scraper":
        keywords = ", ".join(str(item) for item in (args.get("keywords") or []))
        source = args.get("source") or "selected source"
        return f"Run {source} scraper for {keywords or 'configured keywords'}."
    if tool_name == "generate_resume":
        return f"Generate tailored resume for job #{args.get('job_id', '')}."
    if tool_name == "auto_fill_calendar":
        return "Create calendar events from parsed interview notifications."
    if tool_name == "sync_email_notifications":
        return "Sync email notifications and parse interview-related messages."
    return f"Run {tool_name.replace('_', ' ')}."


def plan_action(tool_name: str, args: dict[str, Any], index: int = 1) -> dict[str, Any]:
    registry = get_default_tool_registry()
    risk_level = registry.get(tool_name, {}).get("risk_level", "confirm")
    return {
        "id": f"{tool_name}:{index}",
        "tool": tool_name,
        "args": args,
        "risk_level": risk_level,
        "requires_confirmation": risk_level == "confirm",
        "summary": build_action_summary(tool_name, args),
    }


async def execute_planned_actions(
    planned_actions: list[dict[str, Any]],
    *,
    registry: dict[str, dict[str, Any]] | None = None,
    confirmed_action_ids: list[str] | None = None,
    tool_runner: Callable[[str, dict[str, Any]], Awaitable[Any]] | None = None,
) -> dict[str, Any]:
    registry = registry or get_default_tool_registry()
    confirmed = set(confirmed_action_ids or [])
    tool_calls: list[dict[str, Any]] = []
    blocked_actions: list[dict[str, Any]] = []

    for action in planned_actions:
        action_id = str(action.get("id") or "")
        tool_name = str(action.get("tool") or "")
        risk_level = str(action.get("risk_level") or "confirm")
        args = action.get("args") if isinstance(action.get("args"), dict) else {}

        if risk_level == "confirm" and action_id not in confirmed:
            blocked_actions.append(action)
            continue

        entry = registry.get(tool_name) or {}
        handler = entry.get("handler")
        if handler is None and tool_runner is not None:
            clean_args = {k: v for k, v in args.items() if v is not None}
            result = await tool_runner(tool_name, clean_args)
        elif handler is None:
            result = {"error": f"Tool {tool_name} has no handler"}
        else:
            clean_args = {k: v for k, v in args.items() if v is not None}
            result = await handler(**clean_args)
        tool_calls.append(
            {
                "tool": tool_name,
                "args": args,
                "result": result,
                "action_id": action_id,
            }
        )

    return {
        "tool_calls": tool_calls,
        "blocked_actions": blocked_actions,
    }
