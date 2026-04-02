# =============================================
# Calendar 路由 — 日程管理 API
# =============================================
# GET    /api/calendar/events     获取日程事件
# POST   /api/calendar/events     创建日程事件
# POST   /api/calendar/auto-fill  Agent 自动填充日程
# =============================================

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.models.models import CalendarEvent

router = APIRouter()


class EventCreate(BaseModel):
    title: str
    description: str = ""
    event_type: str = "interview"
    start_time: datetime
    end_time: Optional[datetime] = None
    location: str = ""
    related_job_id: Optional[int] = None
    related_notification_id: Optional[int] = None


@router.get("/events")
async def list_events(
    start: Optional[str] = None,
    end: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """获取日程事件列表，可按时间范围筛选"""
    query = select(CalendarEvent).order_by(CalendarEvent.start_time)

    if start:
        query = query.where(CalendarEvent.start_time >= datetime.fromisoformat(start))
    if end:
        query = query.where(CalendarEvent.start_time <= datetime.fromisoformat(end))

    result = await db.execute(query)
    events = result.scalars().all()
    return [
        {
            "id": e.id,
            "title": e.title,
            "description": e.description,
            "event_type": e.event_type,
            "start_time": e.start_time.isoformat(),
            "end_time": e.end_time.isoformat() if e.end_time else None,
            "location": e.location,
            "related_job_id": e.related_job_id,
            "related_notification_id": e.related_notification_id,
        }
        for e in events
    ]


@router.post("/events")
async def create_event(data: EventCreate, db: AsyncSession = Depends(get_db)):
    """手动创建日程事件"""
    event = CalendarEvent(
        title=data.title,
        description=data.description,
        event_type=data.event_type,
        start_time=data.start_time,
        end_time=data.end_time,
        location=data.location,
        related_job_id=data.related_job_id,
        related_notification_id=data.related_notification_id,
    )
    db.add(event)
    await db.commit()
    await db.refresh(event)
    return {"id": event.id, "message": "Event created"}


@router.post("/auto-fill")
async def auto_fill_events():
    """Agent 自动从简历信息 + 面试通知生成日历事件（TODO: 接入 LLM Agent）"""
    return {"message": "Auto-fill endpoint - pending implementation"}
