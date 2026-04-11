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

    # ---- 池/批次/分拣 ----
    triage_status: Mapped[str] = mapped_column(
        String(20), default="unscreened", index=True
    )  # unscreened / screened / ignored
    pool_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("pools.id", ondelete="SET NULL"), nullable=True
    )
    batch_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("batches.id", ondelete="SET NULL"), nullable=True
    )

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
    # ---- AI 生成溯源 ----
    source_job_ids: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)  # [job_id, ...]
    source_mode: Mapped[str] = mapped_column(String(20), default="manual")  # manual / per_job / combined
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


# =============================================
# 岗位分组池 — 用户自定义分组
# =============================================

class Pool(Base):
    """岗位池：用户自定义分组（如"产品方向""运营方向"）"""
    __tablename__ = "pools"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100))
    description: Mapped[str] = mapped_column(Text, default="")
    color: Mapped[str] = mapped_column(String(20), default="#3B82F6")  # Tailwind blue-500
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


# =============================================
# 采集批次 — 爬虫任务记录
# =============================================

class Batch(Base):
    """采集批次：每次爬虫运行产生一个批次"""
    __tablename__ = "batches"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    source: Mapped[str] = mapped_column(String(50), default="")  # boss / linkedin / zhilian ...
    keywords: Mapped[str] = mapped_column(String(500), default="")
    location: Mapped[str] = mapped_column(String(200), default="")
    max_results: Mapped[int] = mapped_column(Integer, default=0)
    job_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="running")  # running / completed / failed
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())


# =============================================
# 个人档案 — Career-Ops Profile 五大块
# =============================================

class Profile(Base):
    """
    个人档案主表 — 用户事实库的顶层容器
    ─────────────────────────────────────────────
    MVP 阶段单用户只有一个 Profile (is_default=True)。
    narrative 层字段 (headline/exit_story/cross_cutting_advantage)
    由 AI 根据已有 bullets 自动生成，用户可编辑。
    """
    __tablename__ = "profiles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    # ---- 基础信息（Step 1 表单填写） ----
    name: Mapped[str] = mapped_column(String(100), default="")
    school: Mapped[str] = mapped_column(String(200), default="")
    major: Mapped[str] = mapped_column(String(200), default="")
    degree: Mapped[str] = mapped_column(String(50), default="")  # 本科/硕士/博士/大专
    gpa: Mapped[str] = mapped_column(String(20), default="")
    email: Mapped[str] = mapped_column(String(200), default="")
    phone: Mapped[str] = mapped_column(String(50), default="")
    wechat: Mapped[str] = mapped_column(String(100), default="")

    # ---- 职业叙事（Step 5 AI 生成 + 用户编辑） ----
    headline: Mapped[str] = mapped_column(Text, default="")  # 一句话定位
    exit_story: Mapped[str] = mapped_column(Text, default="")  # 为什么选这个方向
    cross_cutting_advantage: Mapped[str] = mapped_column(Text, default="")  # 超能力/核心优势

    is_default: Mapped[bool] = mapped_column(Boolean, default=True)
    onboarding_step: Mapped[int] = mapped_column(Integer, default=0)  # 当前引导进度 0-5
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # ORM 关系
    sections: Mapped[list["ProfileSection"]] = relationship(
        back_populates="profile", cascade="all, delete-orphan",
        order_by="ProfileSection.sort_order"
    )
    target_roles: Mapped[list["ProfileTargetRole"]] = relationship(
        back_populates="profile", cascade="all, delete-orphan"
    )
    chat_sessions: Mapped[list["ProfileChatSession"]] = relationship(
        back_populates="profile", cascade="all, delete-orphan"
    )


class ProfileSection(Base):
    """
    档案条目表 — Bullet 级事实存储
    ─────────────────────────────────────────────
    每条记录是一个独立的事实条目（如"在xx公司实习3个月"）。
    section_type 对应 Profile 五大块的经历/技能子类型。
    parent_id 支持树形结构（段→多个 bullet）。
    source 记录条目来源：手动填写 / AI对话提取 / 简历导入。
    """
    __tablename__ = "profile_sections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    profile_id: Mapped[int] = mapped_column(Integer, ForeignKey("profiles.id", ondelete="CASCADE"))
    # education / internship / project / activity / competition / skill / certificate / honor / language / custom
    section_type: Mapped[str] = mapped_column(String(50), index=True)
    parent_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("profile_sections.id", ondelete="CASCADE"), nullable=True
    )
    title: Mapped[str] = mapped_column(String(300), default="")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    # 结构化内容（格式因 section_type 而异）
    content_json: Mapped[dict] = mapped_column(JSON, default=dict)
    source: Mapped[str] = mapped_column(String(20), default="manual")  # manual / ai_chat / ai_import
    confidence: Mapped[float] = mapped_column(Float, default=1.0)  # 0.0-1.0, AI 生成的置信度
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    profile: Mapped["Profile"] = relationship(back_populates="sections")


class ProfileTargetRole(Base):
    """目标岗位 — 用户想应聘的方向（Step 2 填写）"""
    __tablename__ = "profile_target_roles"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    profile_id: Mapped[int] = mapped_column(Integer, ForeignKey("profiles.id", ondelete="CASCADE"))
    role_name: Mapped[str] = mapped_column(String(100))  # 如 "产品经理""内容运营"
    role_level: Mapped[str] = mapped_column(String(50), default="")  # 实习/初级/中级
    fit: Mapped[str] = mapped_column(String(20), default="primary")  # primary / secondary / adjacent
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    profile: Mapped["Profile"] = relationship(back_populates="target_roles")


class ProfileChatSession(Base):
    """
    AI 对话引导会话 — 多轮对话状态持久化
    ─────────────────────────────────────────────
    每个 topic 可以有一个活跃会话。
    messages_json 存储完整的消息历史 [{role, content}, ...]。
    extracted_bullets 存储本次对话提取的 bullet candidates，
    用户 confirm 后写入 profile_sections。
    """
    __tablename__ = "profile_chat_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    profile_id: Mapped[int] = mapped_column(Integer, ForeignKey("profiles.id", ondelete="CASCADE"))
    # education / internship / project / activity / skill / general
    topic: Mapped[str] = mapped_column(String(50))
    messages_json: Mapped[list] = mapped_column(JSON, default=list)  # [{role, content}, ...]
    extracted_bullets: Mapped[list] = mapped_column(JSON, default=list)  # bullet candidates
    extracted_bullets_count: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active / completed
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    profile: Mapped["Profile"] = relationship(back_populates="chat_sessions")
