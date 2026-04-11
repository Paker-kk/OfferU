# =============================================
# OfferU - FastAPI 应用入口
# =============================================
# 启动命令: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
# 职责：注册路由、CORS、生命周期事件
# =============================================

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.routing import Mount

from app.config import get_settings
from app.database import init_db
from app.routes import jobs, resume, calendar, email, config, applications, scraper, pools, profile
from app.routes import optimize
from app.routes import agent as agent_route
from app.mcp_server import mcp as mcp_server

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用启动时初始化数据库表 + MCP Session Manager"""
    await init_db()
    async with mcp_server.session_manager.run():
        yield


app = FastAPI(
    title="OfferU API",
    description="AI 驱动的智能求职助手后端",
    version="0.2.0",
    lifespan=lifespan,
)

# ---- CORS 允许前端跨域访问 ----
# cors_origins 以逗号分隔多个来源，如 "http://localhost:3000,http://localhost:8080"
# allow_credentials=True 允许带 cookie 的跨域请求（Gmail OAuth 回调需要）
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- 注册路由 ----
app.include_router(jobs.router, prefix="/api/jobs", tags=["Jobs"])
app.include_router(resume.router, prefix="/api/resume", tags=["Resume"])
app.include_router(calendar.router, prefix="/api/calendar", tags=["Calendar"])
app.include_router(email.router, prefix="/api/email", tags=["Email"])
app.include_router(config.router, prefix="/api/config", tags=["Config"])
app.include_router(applications.router, prefix="/api/applications", tags=["Applications"])
app.include_router(scraper.router, prefix="/api/scraper", tags=["Scraper"])
app.include_router(pools.router, prefix="/api/pools", tags=["Pools"])
app.include_router(profile.router, prefix="/api/profile", tags=["Profile"])
app.include_router(optimize.router, prefix="/api/optimize", tags=["Optimize"])
app.include_router(agent_route.router, prefix="/api/agent", tags=["Agent"])

# ---- 静态文件（头像等上传文件） ----
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# ---- MCP Server (Streamable HTTP) ----
# 连接方式: claude mcp add --transport http offeru http://localhost:8000/mcp
mcp_server.settings.streamable_http_path = "/"
app.mount("/mcp", mcp_server.streamable_http_app())


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "service": "OfferU"}
