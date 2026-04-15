# =============================================
# Email 路由 — 邮箱面试通知管理 API
# =============================================
# GET  /api/email/auth-url       获取 Gmail OAuth 授权链接
# GET  /api/email/callback       OAuth 回调（交换 code → token）
# GET  /api/email/status         检查授权状态（Gmail + IMAP）
# GET  /api/email/notifications  面试通知列表
# POST /api/email/sync           触发邮件同步 + AI解析 + 自动日历
# POST /api/email/imap-connect   IMAP 直连（QQ/163/Gmail，无需 GCP）
# =============================================
# 双通道邮件接入：
#   通道 A — Gmail OAuth2（需 GCP Console 配置）
#   通道 B — IMAP 直连（QQ/163/Gmail/Outlook 等，只需授权码）
# 任一通道可用即可 sync，优先 IMAP（门槛更低）
# =============================================

from __future__ import annotations

import base64
import email as email_lib
import imaplib
import json
import ssl
from datetime import datetime, timedelta
from email.header import decode_header
from email.utils import parseaddr
from typing import Optional
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, Query
from fastapi.responses import RedirectResponse, JSONResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models.models import InterviewNotification, CalendarEvent
from app.agents.email_parser import parse_interview_email

router = APIRouter()

# ---- 内存存储（重启丢失，最安全） ----
_oauth_tokens: dict = {}          # Gmail OAuth tokens
_imap_credentials: dict = {}      # IMAP 凭据: {host, port, user, password}

# Google OAuth2 端点
GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"
GMAIL_API_URL = "https://gmail.googleapis.com/gmail/v1"
SCOPES = "https://www.googleapis.com/auth/gmail.readonly"

# ---- 中国校招邮件搜索关键词 ----
# 覆盖：面试、笔试、测评、网申确认、offer、拒信
CAMPUS_KEYWORDS_IMAP = [
    "面试", "笔试", "测评", "邀请", "interview", "offer",
    "录用", "录取", "恭喜", "网申", "简历已收到",
    "遗憾", "感谢参与", "未通过", "assessment",
]

# ---- IMAP 服务器预设 ----
IMAP_PRESETS = {
    "qq": {"host": "imap.qq.com", "port": 993},
    "163": {"host": "imap.163.com", "port": 993},
    "126": {"host": "imap.126.com", "port": 993},
    "gmail": {"host": "imap.gmail.com", "port": 993},
    "outlook": {"host": "outlook.office365.com", "port": 993},
    "foxmail": {"host": "imap.qq.com", "port": 993},
}

# category → 中文显示名
CATEGORY_DISPLAY = {
    "application": "网申确认",
    "written_test": "笔试通知",
    "assessment": "在线测评",
    "interview_1": "初面/技术面",
    "interview_2": "复面/交叉面",
    "interview_hr": "HR面/终面",
    "offer": "录用通知",
    "rejection": "拒信",
    "unknown": "其他",
}

# 需要自动创建日历事件的 category
AUTO_CALENDAR_CATEGORIES = {
    "written_test", "assessment",
    "interview_1", "interview_2", "interview_hr",
}


# ===================== Gmail OAuth 部分（保持不变） =====================

def _get_redirect_uri() -> str:
    settings = get_settings()
    if settings.gmail_redirect_uri:
        return settings.gmail_redirect_uri
    origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    if not origins:
        raise ValueError("cors_origins is empty and gmail_redirect_uri not set")
    return f"{origins[0]}/api/email/callback"


def _get_frontend_url() -> str:
    settings = get_settings()
    origins = [o.strip() for o in settings.cors_origins.split(",") if o.strip()]
    return origins[0] if origins else "http://localhost:3000"


@router.get("/auth-url")
async def get_auth_url():
    """生成 Gmail OAuth2 授权链接"""
    settings = get_settings()
    if not settings.gmail_client_id:
        return JSONResponse(status_code=400, content={"message": "GMAIL_CLIENT_ID not configured"})
    redirect_uri = _get_redirect_uri()
    params = {
        "client_id": settings.gmail_client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": SCOPES,
        "access_type": "offline",
        "prompt": "consent",
    }
    return {"auth_url": f"{GOOGLE_AUTH_URL}?{urlencode(params)}"}


@router.get("/callback")
async def oauth_callback(code: str = Query(...)):
    """Google OAuth 回调端点"""
    settings = get_settings()
    redirect_uri = _get_redirect_uri()
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(GOOGLE_TOKEN_URL, data={
            "code": code,
            "client_id": settings.gmail_client_id,
            "client_secret": settings.gmail_client_secret,
            "redirect_uri": redirect_uri,
            "grant_type": "authorization_code",
        })
    if resp.status_code != 200:
        return JSONResponse(status_code=400, content={"message": "Token exchange failed", "detail": resp.text})
    token_data = resp.json()
    _oauth_tokens["access_token"] = token_data.get("access_token")
    _oauth_tokens["refresh_token"] = token_data.get("refresh_token", _oauth_tokens.get("refresh_token"))
    _oauth_tokens["expires_at"] = datetime.utcnow() + timedelta(seconds=token_data.get("expires_in", 3600))
    return RedirectResponse(url=f"{_get_frontend_url()}/email?auth=success")


async def _ensure_valid_token() -> Optional[str]:
    """确保 Gmail access_token 有效"""
    if not _oauth_tokens.get("access_token"):
        return None
    if datetime.utcnow() < _oauth_tokens.get("expires_at", datetime.min):
        return _oauth_tokens["access_token"]
    refresh = _oauth_tokens.get("refresh_token")
    if not refresh:
        return None
    settings = get_settings()
    async with httpx.AsyncClient(timeout=15.0) as client:
        resp = await client.post(GOOGLE_TOKEN_URL, data={
            "client_id": settings.gmail_client_id,
            "client_secret": settings.gmail_client_secret,
            "refresh_token": refresh,
            "grant_type": "refresh_token",
        })
    if resp.status_code != 200:
        return None
    data = resp.json()
    _oauth_tokens["access_token"] = data["access_token"]
    _oauth_tokens["expires_at"] = datetime.utcnow() + timedelta(seconds=data.get("expires_in", 3600))
    return _oauth_tokens["access_token"]


# ===================== IMAP 直连部分（新增） =====================

class ImapConnectRequest(BaseModel):
    """IMAP 连接请求体"""
    host: str = ""           # 留空则从 provider 预设推导
    port: int = 993
    user: str                # 完整邮箱地址
    password: str            # 授权码
    provider: str = ""       # qq / 163 / gmail / outlook（用于自动填充 host）


@router.post("/imap-connect")
async def imap_connect(data: ImapConnectRequest):
    """
    IMAP 直连测试 + 保存凭据到内存
    - QQ 邮箱：host=imap.qq.com, port=993, 需要授权码
    - 163 邮箱：host=imap.163.com, port=993, 需要授权码
    - Gmail：host=imap.gmail.com, port=993, 需要应用专用密码
    """
    # 从 provider 预设推导 host
    host = data.host
    port = data.port
    if not host and data.provider:
        preset = IMAP_PRESETS.get(data.provider.lower(), {})
        host = preset.get("host", "")
        port = preset.get("port", 993)

    # 自动检测 provider from email domain
    if not host:
        domain = data.user.rsplit("@", 1)[-1].lower() if "@" in data.user else ""
        domain_map = {
            "qq.com": "qq", "foxmail.com": "qq", "vip.qq.com": "qq",
            "163.com": "163", "126.com": "126",
            "gmail.com": "gmail",
            "outlook.com": "outlook", "hotmail.com": "outlook",
        }
        provider_key = domain_map.get(domain, "")
        if provider_key:
            preset = IMAP_PRESETS.get(provider_key, {})
            host = preset.get("host", "")
            port = preset.get("port", 993)

    if not host:
        return JSONResponse(status_code=400, content={
            "message": "无法确定 IMAP 服务器地址，请手动填写 host 或选择 provider"
        })

    # 测试连接
    try:
        ctx = ssl.create_default_context()
        conn = imaplib.IMAP4_SSL(host, port, ssl_context=ctx)
        conn.login(data.user, data.password)
        conn.logout()
    except imaplib.IMAP4.error as e:
        return JSONResponse(status_code=401, content={
            "message": f"IMAP 登录失败: {e}。请检查邮箱地址和授权码是否正确。"
        })
    except Exception as e:
        return JSONResponse(status_code=502, content={
            "message": f"IMAP 连接失败: {e}。请检查网络或服务器地址。"
        })

    # 保存到内存
    _imap_credentials.update({
        "host": host, "port": port,
        "user": data.user, "password": data.password,
    })
    return {"message": "IMAP 连接成功", "host": host, "user": data.user}


# ===================== 状态检查（合并 Gmail + IMAP） =====================

@router.get("/status")
async def email_status():
    """检查邮箱连接状态（Gmail OAuth + IMAP）"""
    gmail_connected = False
    if _oauth_tokens.get("access_token"):
        gmail_connected = datetime.utcnow() < _oauth_tokens.get("expires_at", datetime.min)

    imap_connected = bool(_imap_credentials.get("host") and _imap_credentials.get("user"))

    return {
        "connected": gmail_connected or imap_connected,
        "gmail_connected": gmail_connected,
        "has_refresh": bool(_oauth_tokens.get("refresh_token")),
        "imap_connected": imap_connected,
        "imap_host": _imap_credentials.get("host", ""),
        "imap_user": _imap_credentials.get("user", ""),
    }


# ===================== 通知列表 =====================

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
            "category": getattr(n, "category", "unknown"),
            "category_display": CATEGORY_DISPLAY.get(getattr(n, "category", "unknown"), "其他"),
            "interview_time": n.interview_time.isoformat() if n.interview_time else None,
            "location": n.location,
            "action_required": getattr(n, "action_required", ""),
            "parsed_at": str(n.parsed_at),
        }
        for n in notifications
    ]


# ===================== 邮件同步（核心） =====================

@router.post("/sync")
async def sync_emails(db: AsyncSession = Depends(get_db)):
    """
    触发邮件同步 + AI 解析 + 自动创建日历事件
    优先使用 IMAP（门槛低），其次 Gmail OAuth
    流程：
      1. 拉最近 7 天的邮件（IMAP 或 Gmail API）
      2. 调 LLM Agent 解析（8种中国校招分类）
      3. 写入 InterviewNotification 表
      4. 有面试时间的通知 → 自动创建 CalendarEvent
    """
    # 选择数据源：优先 IMAP
    raw_emails = []
    source = "none"

    if _imap_credentials.get("host"):
        try:
            raw_emails = _fetch_imap_emails()
            source = "imap"
        except Exception as e:
            return JSONResponse(status_code=502, content={
                "message": f"IMAP 同步失败: {e}"
            })
    else:
        token = await _ensure_valid_token()
        if not token:
            return JSONResponse(status_code=401, content={
                "message": "未连接邮箱。请先通过 Gmail OAuth 或 IMAP 连接。"
            })
        try:
            raw_emails = await _fetch_gmail_emails(token)
            source = "gmail"
        except Exception as e:
            return JSONResponse(status_code=502, content={
                "message": f"Gmail 同步失败: {e}"
            })

    synced = 0
    calendar_created = 0

    for raw in raw_emails:
        subject = raw.get("subject", "")
        from_addr = raw.get("from", "")
        body = raw.get("body", "")

        # 调 LLM Agent 解析
        parsed = await parse_interview_email(subject, body, email_from=from_addr)
        if not parsed or not parsed.get("company"):
            continue

        interview_time = _parse_datetime(parsed.get("interview_time"))
        category = parsed.get("category", "unknown")

        # 写入 InterviewNotification
        notification = InterviewNotification(
            email_subject=subject,
            email_from=from_addr,
            company=parsed.get("company", ""),
            position=parsed.get("position", ""),
            category=category,
            interview_time=interview_time,
            location=parsed.get("location", ""),
            action_required=parsed.get("action_required", ""),
            email_body=body[:5000],
        )
        db.add(notification)
        await db.flush()  # 获取 notification.id
        synced += 1

        # 自动创建日历事件（仅限有时间的面试/笔试/测评）
        if interview_time and category in AUTO_CALENDAR_CATEGORIES:
            event = CalendarEvent(
                title=f"{CATEGORY_DISPLAY.get(category, '面试')} - {parsed.get('company', '')}",
                description=f"岗位: {parsed.get('position', '')}\n{parsed.get('action_required', '')}",
                event_type="interview",
                start_time=interview_time,
                end_time=interview_time + timedelta(hours=1),  # 默认 1 小时
                location=parsed.get("location", ""),
                related_notification_id=notification.id,
            )
            db.add(event)
            calendar_created += 1

    await db.commit()
    return {
        "source": source,
        "synced": synced,
        "total_found": len(raw_emails),
        "calendar_created": calendar_created,
    }


# ===================== IMAP 邮件拉取 =====================

def _fetch_imap_emails() -> list[dict]:
    """
    通过 IMAP 协议拉取最近 7 天的校招相关邮件。
    支持 QQ邮箱、163邮箱、Gmail、Outlook 等。

    返回: [{ subject, from, body }, ...]

    实现思路：
    1. SSL 连接 IMAP 服务器
    2. 按日期范围搜索 INBOX（最近 7 天）
    3. 读取邮件 subject + from + 纯文本 body
    4. 按中文校招关键词过滤
    """
    creds = _imap_credentials
    ctx = ssl.create_default_context()
    conn = imaplib.IMAP4_SSL(creds["host"], creds["port"], ssl_context=ctx)
    conn.login(creds["user"], creds["password"])
    conn.select("INBOX", readonly=True)

    # 搜索最近 7 天的邮件
    since_date = (datetime.utcnow() - timedelta(days=7)).strftime("%d-%b-%Y")
    _, msg_ids = conn.search(None, f'(SINCE "{since_date}")')

    results = []
    ids = msg_ids[0].split() if msg_ids[0] else []

    # 最多处理最近 50 封（防止首次同步过慢）
    for mid in ids[-50:]:
        try:
            _, raw_data = conn.fetch(mid, "(RFC822)")
            if not raw_data or not raw_data[0]:
                continue
            raw_bytes = raw_data[0][1]
            msg = email_lib.message_from_bytes(raw_bytes)

            # 解码 subject
            subject = _decode_header_value(msg.get("Subject", ""))
            from_addr = _decode_header_value(msg.get("From", ""))

            # 关键词过滤：subject 或 from 包含校招相关词
            text_to_check = (subject + from_addr).lower()
            if not any(kw in text_to_check for kw in CAMPUS_KEYWORDS_IMAP):
                continue

            # 提取纯文本 body
            body = _extract_email_body(msg)

            results.append({
                "subject": subject,
                "from": from_addr,
                "body": body,
            })
        except Exception:
            continue

    conn.logout()
    return results


def _decode_header_value(raw: str) -> str:
    """解码 MIME 编码的邮件头字段（如 =?UTF-8?B?...?=）"""
    if not raw:
        return ""
    parts = decode_header(raw)
    decoded = []
    for data, charset in parts:
        if isinstance(data, bytes):
            decoded.append(data.decode(charset or "utf-8", errors="replace"))
        else:
            decoded.append(data)
    return " ".join(decoded)


def _extract_email_body(msg) -> str:
    """从 email.message.Message 中提取纯文本正文"""
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            if content_type == "text/plain":
                payload = part.get_payload(decode=True)
                if payload:
                    charset = part.get_content_charset() or "utf-8"
                    return payload.decode(charset, errors="replace")
        # fallback: 取 text/html 并简单清理
        for part in msg.walk():
            if part.get_content_type() == "text/html":
                payload = part.get_payload(decode=True)
                if payload:
                    charset = part.get_content_charset() or "utf-8"
                    html = payload.decode(charset, errors="replace")
                    # 简单去 HTML 标签
                    import re
                    return re.sub(r"<[^>]+>", "", html)[:5000]
    else:
        payload = msg.get_payload(decode=True)
        if payload:
            charset = msg.get_content_charset() or "utf-8"
            return payload.decode(charset, errors="replace")
    return ""


# ===================== Gmail API 邮件拉取 =====================

async def _fetch_gmail_emails(token: str) -> list[dict]:
    """
    通过 Gmail API 拉取最近 7 天的校招相关邮件。
    返回: [{ subject, from, body }, ...]
    """
    # 扩大搜索范围：覆盖校招完整链路
    query = "subject:(面试 OR 笔试 OR 测评 OR 邀请 OR interview OR offer OR 录用 OR 遗憾) newer_than:7d"
    headers = {"Authorization": f"Bearer {token}"}

    results = []
    async with httpx.AsyncClient(timeout=30.0) as client:
        list_resp = await client.get(
            f"{GMAIL_API_URL}/users/me/messages",
            params={"q": query, "maxResults": 20},
            headers=headers,
        )
        if list_resp.status_code != 200:
            raise Exception(f"Gmail API error: {list_resp.text}")

        messages = list_resp.json().get("messages", [])

        for msg_meta in messages:
            msg_id = msg_meta["id"]
            detail_resp = await client.get(
                f"{GMAIL_API_URL}/users/me/messages/{msg_id}",
                params={"format": "full"},
                headers=headers,
            )
            if detail_resp.status_code != 200:
                continue

            msg_data = detail_resp.json()
            msg_headers = {
                h["name"]: h["value"]
                for h in msg_data.get("payload", {}).get("headers", [])
            }

            results.append({
                "subject": msg_headers.get("Subject", ""),
                "from": msg_headers.get("From", ""),
                "body": _extract_gmail_body(msg_data.get("payload", {})),
            })

    return results


def _extract_gmail_body(payload: dict) -> str:
    """从 Gmail API payload 中递归提取纯文本正文"""
    if payload.get("mimeType") == "text/plain" and payload.get("body", {}).get("data"):
        return base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="replace")
    for part in payload.get("parts", []):
        text = _extract_gmail_body(part)
        if text:
            return text
    return ""


# ===================== 工具函数 =====================

def _parse_datetime(dt_str: Optional[str]) -> Optional[datetime]:
    """尝试解析 LLM 返回的日期时间字符串"""
    if not dt_str:
        return None
    for fmt in ["%Y-%m-%d %H:%M", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M",
                "%Y/%m/%d %H:%M", "%Y-%m-%d", "%m月%d日 %H:%M"]:
        try:
            return datetime.strptime(dt_str, fmt)
        except ValueError:
            continue
    return None
