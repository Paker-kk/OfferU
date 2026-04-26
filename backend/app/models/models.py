# =============================================
# OfferU - 数据库模型定义
# =============================================
# 核心表：jobs, resumes, resume_sections, resume_templates,
#         interview_notifications, calendar_events, applications
# 使用 SQLAlchemy 2.0 Mapped 声明式语法
# =============================================

from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, Boolean, DateTime, Float, Integer, String, Text, ForeignKey, func
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

    # ---- 岗位详情（校招场景关键字段） ----
    salary_min: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 月薪下限（元）
    salary_max: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 月薪上限（元）
    salary_text: Mapped[str] = mapped_column(String(100), default="")  # 原始薪资文本，如 "15-25K·13薪"
    education: Mapped[str] = mapped_column(String(50), default="")  # 学历要求，如 "本科" "硕士"
    experience: Mapped[str] = mapped_column(String(100), default="")  # 经验要求，如 "1-3年" "应届"
    job_type: Mapped[str] = mapped_column(String(50), default="")  # 岗位类型，如 "全职" "实习" "校招"
    company_size: Mapped[str] = mapped_column(String(100), default="")  # 公司规模，如 "100-499人"
    company_industry: Mapped[str] = mapped_column(String(200), default="")  # 行业，如 "游戏" "AI"
    company_logo: Mapped[str] = mapped_column(Text, default="")  # 公司 Logo URL
    is_campus: Mapped[bool] = mapped_column(Boolean, default=False)  # 是否校招岗位

    # ---- AI 分析输出 ----
    summary: Mapped[str] = mapped_column(Text, default="")
    keywords: Mapped[Optional[list]] = mapped_column(JSON, default=list)

    # ---- Inbox 分拣与池分组 ----
    triage_status: Mapped[str] = mapped_column(String(20), default="inbox", index=True)
    pool_id: Mapped[Optional[int]] = mapped_column(
        Integer,
        ForeignKey("pools.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    # 采集批次 ID；历史数据统一回填为 legacy-import
    batch_id: Mapped[str] = mapped_column(String(64), default="legacy-import", index=True)

    # ---- 元数据 ----
    hash_key: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    pool: Mapped[Optional["Pool"]] = relationship(back_populates="jobs")


class Pool(Base):
    """岗位池：用于在已筛选岗位中按主题做分组（前端语义为文件夹）"""

    __tablename__ = "pools"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    description: Mapped[str] = mapped_column(Text, default="")
    color: Mapped[str] = mapped_column(String(20), default="#3B82F6")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    scope: Mapped[str] = mapped_column(String(20), default="picked", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    jobs: Mapped[list["Job"]] = relationship(back_populates="pool")


class Batch(Base):
    """采集批次：记录一次采集任务的上下文，用于 Inbox 分区"""

    __tablename__ = "batches"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    source: Mapped[str] = mapped_column(String(50), default="")
    keywords: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    location: Mapped[str] = mapped_column(String(100), default="")
    max_results: Mapped[int] = mapped_column(Integer, default=0)
    job_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="completed")
    total_fetched: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


class Profile(Base):
    """个人档案主表：承载基础信息与叙事字段"""

    __tablename__ = "profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120), default="默认档案")
    school: Mapped[str] = mapped_column(String(200), default="")
    major: Mapped[str] = mapped_column(String(200), default="")
    degree: Mapped[str] = mapped_column(String(50), default="")
    gpa: Mapped[str] = mapped_column(String(20), default="")
    email: Mapped[str] = mapped_column(String(200), default="")
    phone: Mapped[str] = mapped_column(String(50), default="")
    wechat: Mapped[str] = mapped_column(String(100), default="")
    headline: Mapped[str] = mapped_column(String(300), default="")
    exit_story: Mapped[str] = mapped_column(Text, default="")
    cross_cutting_advantage: Mapped[str] = mapped_column(Text, default="")
    base_info_json: Mapped[dict] = mapped_column(JSON, default=dict)
    is_default: Mapped[bool] = mapped_column(Boolean, default=True)
    onboarding_step: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    target_roles: Mapped[list["ProfileTargetRole"]] = relationship(
        back_populates="profile", cascade="all, delete-orphan"
    )
    sections: Mapped[list["ProfileSection"]] = relationship(
        back_populates="profile",
        cascade="all, delete-orphan",
        order_by="ProfileSection.sort_order",
    )
    chat_sessions: Mapped[list["ProfileChatSession"]] = relationship(
        back_populates="profile", cascade="all, delete-orphan"
    )


class ProfileTargetRole(Base):
    """目标岗位条目：支持 fit 分级"""

    __tablename__ = "profile_target_roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    profile_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("profiles.id", ondelete="CASCADE"), index=True
    )
    role_name: Mapped[str] = mapped_column(String(120), index=True)
    role_level: Mapped[str] = mapped_column(String(60), default="")
    fit: Mapped[str] = mapped_column(String(30), default="primary")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    profile: Mapped["Profile"] = relationship(back_populates="target_roles")


class ProfileSection(Base):
    """档案条目：Bullet 级事实条目，支持来源与置信度"""

    __tablename__ = "profile_sections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    profile_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("profiles.id", ondelete="CASCADE"), index=True
    )
    section_type: Mapped[str] = mapped_column(String(60), index=True)
    parent_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("profile_sections.id", ondelete="SET NULL"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(220), default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    content_json: Mapped[dict] = mapped_column(JSON, default=dict)
    source: Mapped[str] = mapped_column(String(30), default="manual")
    confidence: Mapped[float] = mapped_column(Float, default=1.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    profile: Mapped["Profile"] = relationship(back_populates="sections")


class ProfileChatSession(Base):
    """档案对话会话：记录多轮消息与候选条目提取结果"""

    __tablename__ = "profile_chat_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    profile_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("profiles.id", ondelete="CASCADE"), index=True
    )
    topic: Mapped[str] = mapped_column(String(60), default="general")
    messages_json: Mapped[list] = mapped_column(JSON, default=list)
    extracted_bullets: Mapped[list] = mapped_column(JSON, default=list)
    extracted_bullets_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    profile: Mapped["Profile"] = relationship(back_populates="chat_sessions")


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
    source_mode: Mapped[str] = mapped_column(String(30), default="manual")
    source_job_ids: Mapped[Optional[list]] = mapped_column(JSON, default=list)
    source_profile_snapshot: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
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
    category: Mapped[str] = mapped_column(String(50), default="unknown")  # 8种校招状态分类
    interview_time: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    location: Mapped[str] = mapped_column(String(500), default="")
    action_required: Mapped[str] = mapped_column(String(500), default="")  # 用户待办操作
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


# =============================================
# 面经模块 (PRD §8.5)
# =============================================

class InterviewExperience(Base):
    """收集到的面经原文"""
    __tablename__ = "interview_experiences"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    company: Mapped[str] = mapped_column(String(300), index=True)
    role: Mapped[str] = mapped_column(String(300), index=True)
    source_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source_platform: Mapped[str] = mapped_column(String(50), default="manual")  # manual / niuke / zhihu
    raw_text: Mapped[str] = mapped_column(Text)
    interview_rounds: Mapped[Optional[str]] = mapped_column(Text, nullable=True)  # JSON: 面试轮次
    job_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("jobs.id"), nullable=True)
    collected_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    questions: Mapped[list["InterviewQuestion"]] = relationship(
        back_populates="experience", cascade="all, delete-orphan"
    )


class InterviewQuestion(Base):
    """从面经中提炼的结构化问题"""
    __tablename__ = "interview_questions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    experience_id: Mapped[int] = mapped_column(Integer, ForeignKey("interview_experiences.id"))
    question_text: Mapped[str] = mapped_column(Text)
    round_type: Mapped[str] = mapped_column(String(50), default="department")  # hr / department / final
    category: Mapped[str] = mapped_column(String(50), default="behavioral")  # behavioral / technical / case / motivation
    difficulty: Mapped[int] = mapped_column(Integer, default=3)  # 1-5
    frequency: Mapped[int] = mapped_column(Integer, default=1)  # 出现次数
    suggested_answer: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    job_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("jobs.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    experience: Mapped["InterviewExperience"] = relationship(back_populates="questions")
