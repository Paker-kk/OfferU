# =============================================
# Email 路由 — 邮箱面试通知管理 API
# =============================================
# GET  /api/email/auth-url       获取 Gmail OAuth 授权链接
# GET  /api/email/callback       OAuth 回调（交换 code → token）
# GET  /api/email/status         检查授权状态
# GET  /api/email/notifications  面试通知列表
# POST /api/email/sync           触发邮件同步 + AI解析
# =============================================
# Gmail OAuth2 完整流程：
#   1. 前端调 /auth-url → 后端生成 Google OAuth 授权链接
#   2. 用户在 Google 页面授权 → 重定向到 /callback?code=xxx
#   3. 后端用 code 换 access_token + refresh_token，存入内存/DB
#   4. /sync 用 token 调 Gmail API 拉邮件 → LLM Agent 解析
#   5. 解析结果写入 InterviewNotification 表
# =============================================

import json
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, Query
from fastapi.responses import RedirectResponse, JSONResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.models import InterviewNotification
from app.agents.email_parser import parse_interview_email

router = APIRouter()

# ---- OAuth2 Token 内存存储（生产环境应持久化到 DB） ----
_oauth_tokens: dict = {}

# Google OAuth2 端点
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GMAIL_API_URL = "https://gmail.googleapis.com/gmail/v1"

# Gmail 只读 scope
SCOPES = "https://www.googleapis.com/auth/gmail.readonly"


def _get_redirect_uri() -> str:
    """安全获取 OAuth 回调地址。优先使用 gmail_redirect_uri，否则从 cors_origins 推导"""
    settings = get_settings()
    if settings.gmail_redirect_uri:
        return settings.gmail_redirect_uri
    origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    if not origins:
        raise ValueError("cors_origins is empty and gmail_redirect_uri not set")
    return f"{origins[0]}/api/email/callback"


def _get_frontend_url() -> str:
    """获取前端首页地址（用于 OAuth 回调后重定向）"""
    settings = get_settings()
    origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    return origins[0] if origins else "http://localhost:3000"


@router.get("/auth-url")
async def get_auth_url():
    """
    生成 Gmail OAuth2 授权链接
    前端收到后引导用户跳转到 Google 授权页面
    """
    settings = get_settings()
    if not settings.gmail_client_id:
        return JSONResponse(
            status_code=400,
            content={"message": "GMAIL_CLIENT_ID not configured in .env"},
        )

    # 回调地址（后端接收 code）
    redirect_uri = _get_redirect_uri()

    params = {
        "client_id": settings.gmail_client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": SCOPES,
        "access_type": "offline",  # 获取 refresh_token
        "prompt": "consent",
    }
    auth_url = f"{GOOGLE_AUTH_URL}?{urlencode(params)}"
    return {"auth_url": auth_url}


@router.get("/callback")
async def oauth_callback(code: str = Query(...)):
    """
    Google OAuth 回调端点
    用 authorization code 换取 access_token + refresh_token
    """
    settings = get_settings()
    redirect_uri = _get_redirect_uri()

    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": settings.gmail_client_id,
                "client_secret": settings.gmail_client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
            },
        )

    if resp.status_code != 200:
        return JSONResponse(status_code=400, content={"message": "Token exchange failed", "detail": resp.text})

    token_data = resp.json()
    _oauth_tokens["access_token"] = token_data.get("access_token")
    _oauth_tokens["refresh_token"] = token_data.get("refresh_token", _oauth_tokens.get("refresh_token"))
    _oauth_tokens["expires_at"] = datetime.utcnow() + timedelta(seconds=token_data.get("expires_in", 3600))

    # 授权成功，重定向回前端邮件页
    return RedirectResponse(url=f"{_get_frontend_url()}/email?auth=success")


@router.get("/status")
async def email_status():
    """检查 Gmail 授权状态"""
    if _oauth_tokens.get("access_token"):
        expired = datetime.utcnow() > _oauth_tokens.get("expires_at", datetime.min)
        return {"connected": not expired, "has_refresh": bool(_oauth_tokens.get("refresh_token"))}
    return {"connected": False, "has_refresh": False}


async def _ensure_valid_token() -> Optional[str]:
    """确保 access_token 有效，过期则用 refresh_token 刷新"""
    if not _oauth_tokens.get("access_token"):
        return None

    if datetime.utcnow() < _oauth_tokens.get("expires_at", datetime.min):
        return _oauth_tokens["access_token"]

    # 尝试刷新
    refresh = _oauth_tokens.get("refresh_token")
    if not refresh:
        return None

    settings = get_settings()
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(
            GOOGLE_TOKEN_URL,
            data={
                "client_id": settings.gmail_client_id,
                "client_secret": settings.gmail_client_secret,
                "refresh_token": refresh,
                "grant_type": "refresh_token",
            },
        )

    if resp.status_code != 200:
        return None

    data = resp.json()
    _oauth_tokens["access_token"] = data["access_token"]
    _oauth_tokens["expires_at"] = datetime.utcnow() + timedelta(seconds=data.get("expires_in", 3600))
    return _oauth_tokens["access_token"]


@router.get("/notifications")
async def list_notifications(db: AsyncSession = Depends(get_db)):
    """获取已解析的面试通知列表"""
    result = await db.execute(
        select(InterviewNotification).order_by(InterviewNotification.created_at.desc())
    )
    notifications = result.scalars().all()
    return [
        {
            "id": n.id,
            "email_subject": n.email_subject,
            "email_from": n.email_from,
            "company": n.company,
            "position": n.position,
            "interview_time": n.interview_time.isoformat() if n.interview_time else None,
            "location": n.location,
            "parsed_at": str(n.parsed_at),
        }
        for n in notifications
    ]


@router.post("/sync")
async def sync_emails(db: AsyncSession = Depends(get_db)):
    """
    触发邮件同步 + Agent 解析面试通知
    流程：
      1. 用 Gmail API 拉最近 7 天的邮件
      2. 筛选含"面试/interview"关键词的邮件
      3. 调 LLM Agent 解析面试信息
      4. 写入 InterviewNotification 表
    """
    token = await _ensure_valid_token()
    if not token:
        return JSONResponse(status_code=401, content={"message": "Gmail not authorized. Please authorize first."})

    # 搜索面试相关邮件（最近7天）
    # Gmail 搜索语法：subject:() 限定标题，newer_than:7d 限定时间范围
    # OR 连接多个关键词，同时覆盖中英文场景
    query = "subject:(面试 OR interview OR 邀请) newer_than:7d"
    headers = {"Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(timeout=30.0) as client:
        # 获取邮件列表
        list_resp = await client.get(
            f"{GMAIL_API_URL}/users/me/messages",
            params={"q": query, "maxResults": 20},
            headers=headers,
        )
        if list_resp.status_code != 200:
            return JSONResponse(status_code=502, content={"message": "Gmail API error", "detail": list_resp.text})

        messages = list_resp.json().get("messages", [])
        synced = 0

        for msg_meta in messages:
            msg_id = msg_meta["id"]

            # 获取邮件详情
            detail_resp = await client.get(
                f"{GMAIL_API_URL}/users/me/messages/{msg_id}",
                params={"format": "full"},
                headers=headers,
            )
            if detail_resp.status_code != 200:
                continue

            msg_data = detail_resp.json()

            # 提取 subject 和 body
            msg_headers = {h["name"]: h["value"] for h in msg_data.get("payload", {}).get("headers", [])}
            subject = msg_headers.get("Subject", "")
            from_addr = msg_headers.get("From", "")

            # 提取邮件正文（纯文本 part）
            body = _extract_body(msg_data.get("payload", {}))

            # 调 LLM Agent 解析面试信息
            parsed = await parse_interview_email(subject, body)
            if not parsed or not parsed.get("company"):
                continue

            # 写入数据库
            notification = InterviewNotification(
                email_subject=subject,
                email_from=from_addr,
                company=parsed.get("company", ""),
                position=parsed.get("position", ""),
                interview_time=_parse_datetime(parsed.get("interview_time")),
                location=parsed.get("location", ""),
                email_body=body[:5000],  # 截断防止过大
            )
            db.add(notification)
            synced += 1

        await db.commit()
        return {"synced": synced, "total_found": len(messages)}


def _extract_body(payload: dict) -> str:
    """
    从 Gmail API payload 中递归提取纯文本正文。
    Gmail 邮件结构为 MIME 树（multipart → parts → sub-parts……），
    需要递归遍历找到 mimeType=text/plain 的叶子节点。
    body.data 是 URL-safe Base64 编码的邮件正文。
    """
    import base64

    # 叶子节点：直接是纯文本
    if payload.get("mimeType") == "text/plain" and payload.get("body", {}).get("data"):
        return base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="replace")

    # 非叶子节点：递归搜索 parts（multipart/alternative, multipart/mixed 等）
    for part in payload.get("parts", []):
        text = _extract_body(part)
        if text:
            return text

    return ""


def _parse_datetime(dt_str: Optional[str]) -> Optional[datetime]:
    """尝试解析 LLM 返回的日期时间字符串"""
    if not dt_str:
        return None
    for fmt in ["%Y-%m-%d %H:%M", "%Y-%m-%dT%H:%M", "%Y/%m/%d %H:%M", "%Y-%m-%d"]:
        try:
            return datetime.strptime(dt_str, fmt)
        except ValueError:
            continue
    return None
