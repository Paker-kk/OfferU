# =============================================
# OfferU - 数据库模型定义
# =============================================
# 核心表：jobs, resumes, resume_sections, resume_templates,
#         interview_notifications, calendar_events, applications
# 使用 SQLAlchemy 2.0 Mapped 声明式语法
# =============================================

from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, DateTime, Float, Integer, String, Text, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Job(Base):
    """岗位表：存储从各平台爬取的岗位信息"""
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # ---- 岗位基本信息 ----
    title: Mapped[str] = mapped_column(String(500), index=True)
    company: Mapped[str] = mapped_column(String(300), index=True)
    location: Mapped[str] = mapped_column(String(300), default="")
    url: Mapped[str] = mapped_column(Text, default="")
    apply_url: Mapped[str] = mapped_column(Text, default="")
    source: Mapped[str] = mapped_column(String(50), index=True, default="linkedin")
    raw_description: Mapped[str] = mapped_column(Text, default="")
    posted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # ---- AI 分析输出 ----
    summary: Mapped[str] = mapped_column(Text, default="")
    keywords: Mapped[Optional[list]] = mapped_column(JSON, default=list)

    # ---- 元数据 ----
    hash_key: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class ResumeTemplate(Base):
    """
    简历模板表：存储内置和用户自定义的简历模板
    ─────────────────────────────────────────────
    模板通过 CSS 变量控制样式（主色调/字号/边距等），
    html_layout 使用 Jinja2 语法定义 A4 页面的 HTML 结构。
    前端预览时通过 css_variables 注入 CSS 自定义属性，
    后端 PDF 导出时同样将 css_variables 渲染进 HTML。
    """
    __tablename__ = "resume_templates"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100))
    thumbnail_url: Mapped[str] = mapped_column(String(500), default="")
    # CSS 变量集合：{ primaryColor, accentColor, bodySize, headingSize, lineHeight, pageMargin, sectionGap, fontFamily }
    css_variables: Mapped[dict] = mapped_column(JSON, default=dict)
    # Jinja2 HTML 模板，渲染简历为 A4 页面
    html_layout: Mapped[str] = mapped_column(Text, default="")
    is_builtin: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Resume(Base):
    """
    简历主表：存储简历元信息和全局设置
    ─────────────────────────────────────────────
    一个用户可拥有多份简历（不同语言/不同方向）。
    简历的具体内容段落存储在 ResumeSection 子表中，
    通过 resume_id FK 关联，删除简历时级联删除所有段落。
    style_config 存储用户对模板样式的覆盖（如修改字号/颜色），
    与模板的 css_variables 合并后生成最终样式。
    """
    __tablename__ = "resumes"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_name: Mapped[str] = mapped_column(String(200))
    title: Mapped[str] = mapped_column(String(300), default="未命名简历")
    photo_url: Mapped[str] = mapped_column(String(500), default="")
    # 个人简介 HTML（TipTap 富文本输出）
    summary: Mapped[str] = mapped_column(Text, default="")
    # 联系方式结构化数据：{ phone, email, linkedin, website, github, ... }
    contact_json: Mapped[dict] = mapped_column(JSON, default=dict)
    # 关联模板（可为空，使用系统默认）
    template_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("resume_templates.id"), nullable=True
    )
    # 用户对模板样式的覆盖：{ primaryColor, bodySize, lineHeight, ... }
    style_config: Mapped[dict] = mapped_column(JSON, default=dict)
    is_primary: Mapped[bool] = mapped_column(default=True)
    language: Mapped[str] = mapped_column(String(10), default="zh")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # ORM 关系：简历包含的段落列表，按 sort_order 排序
    sections: Mapped[list["ResumeSection"]] = relationship(
        back_populates="resume", cascade="all, delete-orphan",
        order_by="ResumeSection.sort_order"
    )
    template: Mapped[Optional["ResumeTemplate"]] = relationship()


class ResumeSection(Base):
    """
    简历段落通用块表：每一段（教育/经历/技能/项目/自定义）是一条记录
    ─────────────────────────────────────────────
    采用通用块设计：section_type 区分类型，content_json 内部按类型存不同结构。
    这样新增段落类型（如"证书""荣誉"）不需要修改数据库表结构。

    content_json 按 section_type 的约定结构：
      education:   [{ school, degree, major, gpa, startDate, endDate, description }]
      experience:  [{ company, position, startDate, endDate, description }]
      skill:       [{ category, items: ["Python", "React", ...] }]
      project:     [{ name, role, url, startDate, endDate, description }]
      certificate: [{ name, issuer, date, url }]
      custom:      [{ subtitle, description }]

    description 字段存储 TipTap 输出的 HTML，支持富文本排版。
    """
    __tablename__ = "resume_sections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    resume_id: Mapped[int] = mapped_column(Integer, ForeignKey("resumes.id", ondelete="CASCADE"))
    section_type: Mapped[str] = mapped_column(String(50))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    title: Mapped[str] = mapped_column(String(200), default="")
    visible: Mapped[bool] = mapped_column(default=True)
    content_json: Mapped[list] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    resume: Mapped["Resume"] = relationship(back_populates="sections")


class InterviewNotification(Base):
    """面试通知表：从邮件中解析出的面试邀请"""
    __tablename__ = "interview_notifications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email_subject: Mapped[str] = mapped_column(String(500), default="")
    email_from: Mapped[str] = mapped_column(String(300), default="")
    email_body: Mapped[str] = mapped_column(Text, default="")
    company: Mapped[str] = mapped_column(String(300), default="")
    position: Mapped[str] = mapped_column(String(500), default="")
    interview_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    location: Mapped[str] = mapped_column(String(500), default="")
    parsed_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # 关联日历事件
    calendar_events: Mapped[list["CalendarEvent"]] = relationship(back_populates="notification")


class CalendarEvent(Base):
    """日程表：面试日程 + 自动同步事件"""
    __tablename__ = "calendar_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(500))
    description: Mapped[str] = mapped_column(Text, default="")
    event_type: Mapped[str] = mapped_column(String(50), default="interview")  # interview / deadline / other
    start_time: Mapped[datetime] = mapped_column(DateTime)
    end_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    location: Mapped[str] = mapped_column(String(500), default="")

    # 关联
    related_job_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("jobs.id"), nullable=True
    )
    related_notification_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("interview_notifications.id"), nullable=True
    )
    notification: Mapped[Optional["InterviewNotification"]] = relationship(
        back_populates="calendar_events"
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Application(Base):
    """投递记录表：跟踪自动/手动投递状态"""
    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    job_id: Mapped[int] = mapped_column(Integer, ForeignKey("jobs.id"))
    status: Mapped[str] = mapped_column(
        String(50), default="pending"
    )  # pending / submitted / rejected / interview / offer
    cover_letter: Mapped[str] = mapped_column(Text, default="")
    apply_url: Mapped[str] = mapped_column(Text, default="")
    notes: Mapped[str] = mapped_column(Text, default="")
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )
