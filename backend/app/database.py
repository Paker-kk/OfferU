# =============================================
# OfferU - 数据库引擎
# =============================================
# 异步 SQLAlchemy 引擎配置
# 支持 SQLite（开发）和 PostgreSQL（生产）
# =============================================

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings

settings = get_settings()

# 创建异步数据库引擎
# echo=False 关闭 SQL 日志；生产环境 database_url 应为 postgresql+asyncpg://...
# 开发环境默认使用 sqlite+aiosqlite:///./djm.db
engine = create_async_engine(settings.database_url, echo=False)

# expire_on_commit=False：commit 后 ORM 对象属性不失效，
# 避免异步上下文中意外触发延迟加载（async session 不允许隐式 IO）
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    """所有 ORM 模型的基类"""
    pass


async def get_db():
    """FastAPI 依赖注入：提供数据库会话"""
    async with async_session() as session:
        yield session


async def init_db():
    """创建所有表（首次启动时调用）"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await seed_templates()


# =============================================
# 内置模板种子数据
# =============================================
# 首次启动时自动插入 4 套内置模板，
# 每套模板包含主题配色、字号/间距 CSS 变量。
# 通过检查 is_builtin + name 去重，避免重复插入。
# =============================================

BUILTIN_TEMPLATES = [
    {
        "name": "经典蓝",
        "thumbnail_url": "",
        "css_variables": {
            "primaryColor": "#2563eb",
            "accentColor": "#1e40af",
            "bodySize": "13",
            "headingSize": "16",
            "lineHeight": "1.5",
            "pageMargin": "2.2",
            "sectionGap": "14",
            "fontFamily": "Inter, 'Noto Sans SC', sans-serif",
        },
        "is_builtin": True,
    },
    {
        "name": "现代灰",
        "thumbnail_url": "",
        "css_variables": {
            "primaryColor": "#374151",
            "accentColor": "#6b7280",
            "bodySize": "12.5",
            "headingSize": "15",
            "lineHeight": "1.45",
            "pageMargin": "2.0",
            "sectionGap": "12",
            "fontFamily": "'Source Sans Pro', 'Noto Sans SC', sans-serif",
        },
        "is_builtin": True,
    },
    {
        "name": "优雅紫",
        "thumbnail_url": "",
        "css_variables": {
            "primaryColor": "#7c3aed",
            "accentColor": "#5b21b6",
            "bodySize": "13",
            "headingSize": "16",
            "lineHeight": "1.55",
            "pageMargin": "2.4",
            "sectionGap": "16",
            "fontFamily": "'Playfair Display', 'Noto Serif SC', serif",
        },
        "is_builtin": True,
    },
    {
        "name": "清新绿",
        "thumbnail_url": "",
        "css_variables": {
            "primaryColor": "#059669",
            "accentColor": "#047857",
            "bodySize": "13",
            "headingSize": "15.5",
            "lineHeight": "1.5",
            "pageMargin": "2.0",
            "sectionGap": "14",
            "fontFamily": "'Nunito', 'Noto Sans SC', sans-serif",
        },
        "is_builtin": True,
    },
]


async def seed_templates():
    """如果内置模板不存在则插入"""
    from app.models.models import ResumeTemplate
    from sqlalchemy import select

    async with async_session() as session:
        result = await session.execute(
            select(ResumeTemplate).where(ResumeTemplate.is_builtin == True)
        )
        existing = {t.name for t in result.scalars().all()}

        for tpl in BUILTIN_TEMPLATES:
            if tpl["name"] not in existing:
                session.add(ResumeTemplate(**tpl))

        await session.commit()
