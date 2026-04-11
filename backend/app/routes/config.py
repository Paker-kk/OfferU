# =============================================
# Config 路由 — 系统配置管理 API
# =============================================
# GET  /api/config/  获取当前配置（含多 LLM Provider 模型列表）
# PUT  /api/config/  更新配置
# =============================================
# 持久化策略：
#   配置保存到 backend/config.json 文件
#   启动时从文件加载 → 内存缓存 → 修改时写回文件
#   API Key 等敏感字段仅存本地，不进 Git（已在 .gitignore）
# =============================================

import json
import os
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

from app.config import get_settings

router = APIRouter()

# 配置文件路径（backend/ 目录下）
_CONFIG_FILE = Path(__file__).resolve().parent.parent.parent / "config.json"

# ---- 多 LLM 提供商的可选模型 ----
# 前端根据用户选择的 provider 渲染对应模型下拉
AVAILABLE_PROVIDERS = [
    {
        "id": "qwen",
        "name": "阿里云百炼 Qwen",
        "description": "默认首选，国内最便宜，OpenAI 兼容",
        "models": [
            {"id": "qwen-flash", "name": "Qwen-Flash (Qwen3.5)", "description": "极低成本 ¥0.15/M·默认推荐"},
            {"id": "qwen-plus", "name": "Qwen-Plus (Qwen3.6)", "description": "均衡 ¥0.8/M·复杂任务"},
            {"id": "qwen3-max", "name": "Qwen3-Max", "description": "最强 ¥2.5/M·推理"},
            {"id": "qwen-turbo", "name": "Qwen-Turbo", "description": "¥0.3/M·已停更建议用Flash"},
            {"id": "qwen-long", "name": "Qwen-Long", "description": "10M上下文 ¥0.5/M"},
            {"id": "deepseek-r1", "name": "DeepSeek-R1 (百炼托管)", "description": "百炼第三方·同Key可用"},
        ],
    },
    {
        "id": "deepseek",
        "name": "DeepSeek (官方)",
        "description": "DeepSeek 官方 API，需单独 Key",
        "models": [
            {"id": "deepseek-chat", "name": "DeepSeek-V3", "description": "通用对话，¥1/M tokens"},
            {"id": "deepseek-reasoner", "name": "DeepSeek-R1", "description": "深度推理，¥4/M tokens"},
        ],
    },
    {
        "id": "openai",
        "name": "OpenAI",
        "description": "国际主流，能力最强",
        "models": [
            {"id": "gpt-4o-mini", "name": "GPT-4o Mini", "description": "$0.15/M tokens"},
            {"id": "gpt-4o", "name": "GPT-4o", "description": "$2.50/M tokens"},
        ],
    },
    {
        "id": "ollama",
        "name": "Ollama (本地)",
        "description": "完全免费，需自行部署",
        "models": [
            {"id": "qwen2.5:7b", "name": "Qwen2.5 7B", "description": "通义千问，中文出色"},
            {"id": "llama3.1:8b", "name": "Llama 3.1 8B", "description": "Meta 开源"},
            {"id": "gemma2:9b", "name": "Gemma2 9B", "description": "Google 开源"},
        ],
    },
]


class ConfigUpdate(BaseModel):
    """用户可配置的系统参数"""
    search_keywords: list[str] = []
    search_locations: list[str] = []
    banned_keywords: list[str] = []
    top_n: int = 15
    email_to: str = ""
    sources_enabled: list[str] = ["linkedin"]
    # AI 模型选择（多 LLM Provider）
    llm_provider: str = "qwen"
    llm_model: str = "qwen-flash"
    # API Keys（前端输入，运行时生效）
    qwen_api_key: str = ""
    qwen_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    deepseek_api_key: str = ""
    openai_api_key: str = ""
    ollama_base_url: str = "http://localhost:11434"
    # BOSS直聘 Cookie（用户从浏览器粘贴，含 wt2/zp_token，有效期约 7-14 天）
    boss_cookie: str = ""
    # 智联招聘 Cookie（可选，用户从浏览器粘贴，提升 API 访问成功率）
    zhilian_cookie: str = ""


# ---- 持久化：加载 / 保存配置文件 ----

def _load_config() -> ConfigUpdate:
    """
    启动时加载配置：优先读 config.json，不存在则从 .env Settings 初始化
    """
    if _CONFIG_FILE.exists():
        try:
            raw = json.loads(_CONFIG_FILE.read_text(encoding="utf-8"))
            return ConfigUpdate(**raw)
        except (json.JSONDecodeError, Exception):
            pass  # 文件损坏则回退到默认值
    # 首次启动：从 .env 加载
    s = get_settings()
    return ConfigUpdate(
        qwen_api_key=s.qwen_api_key,
        qwen_base_url=s.qwen_base_url,
        deepseek_api_key=s.deepseek_api_key,
        openai_api_key=s.openai_api_key,
        ollama_base_url=s.ollama_base_url,
        llm_provider=s.llm_provider,
        llm_model=s.llm_model,
    )


def _save_config(cfg: ConfigUpdate) -> None:
    """将配置写入 config.json 持久化"""
    _CONFIG_FILE.write_text(
        json.dumps(cfg.model_dump(), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


# 启动时加载
_current_config = _load_config()

# 同步 config.json 的 LLM 配置到全局 Settings（确保启动后即可用）
# 规则：config.json 的非空值覆盖 .env，空值保留 .env 中的值
_startup_settings = get_settings()
if _current_config.llm_provider:
    _startup_settings.llm_provider = _current_config.llm_provider
if _current_config.llm_model:
    _startup_settings.llm_model = _current_config.llm_model
if _current_config.qwen_api_key:
    _startup_settings.qwen_api_key = _current_config.qwen_api_key
if _current_config.qwen_base_url:
    _startup_settings.qwen_base_url = _current_config.qwen_base_url
if _current_config.deepseek_api_key:
    _startup_settings.deepseek_api_key = _current_config.deepseek_api_key
if _current_config.openai_api_key:
    _startup_settings.openai_api_key = _current_config.openai_api_key
if _current_config.ollama_base_url:
    _startup_settings.ollama_base_url = _current_config.ollama_base_url


def _mask_key(key: str) -> str:
    """对 API Key 进行脱敏，只显示前 4 位和后 4 位"""
    if not key or len(key) <= 8:
        return "*" * len(key) if key else ""
    return key[:4] + "*" * (len(key) - 8) + key[-4:]


@router.get("/")
async def get_config():
    """获取当前系统配置 + 可用的 LLM Provider 列表"""
    data = _current_config.model_dump()
    # API Key 脱敏，不直接暴露完整 Key
    data["qwen_api_key"] = _mask_key(data["qwen_api_key"])
    data["deepseek_api_key"] = _mask_key(data["deepseek_api_key"])
    data["openai_api_key"] = _mask_key(data["openai_api_key"])
    # BOSS Cookie 脱敏：只告知是否已配置，不暴露内容
    data["boss_cookie_set"] = bool(data.get("boss_cookie", ""))
    data["boss_cookie"] = "***已配置***" if data.get("boss_cookie") else ""
    # 智联 Cookie 脱敏
    data["zhilian_cookie_set"] = bool(data.get("zhilian_cookie", ""))
    data["zhilian_cookie"] = "***已配置***" if data.get("zhilian_cookie") else ""
    data["available_providers"] = AVAILABLE_PROVIDERS
    return data


@router.put("/")
async def update_config(data: ConfigUpdate):
    """更新系统配置"""
    global _current_config
    # 如果前端传来的 key 全是 * 或为空，说明用户没改，保留原值
    if not data.qwen_api_key or "*" in data.qwen_api_key:
        data.qwen_api_key = _current_config.qwen_api_key
    if not data.deepseek_api_key or "*" in data.deepseek_api_key:
        data.deepseek_api_key = _current_config.deepseek_api_key
    if not data.openai_api_key or "*" in data.openai_api_key:
        data.openai_api_key = _current_config.openai_api_key
    # BOSS Cookie：前端传 "***已配置***" 表示不修改，传空串表示清除
    if data.boss_cookie == "***已配置***":
        data.boss_cookie = _current_config.boss_cookie
    # 智联 Cookie：同理
    if data.zhilian_cookie == "***已配置***":
        data.zhilian_cookie = _current_config.zhilian_cookie
    _current_config = data
    # 持久化到 config.json
    _save_config(_current_config)
    # 同步 LLM 配置到全局 Settings（运行时覆盖）
    settings = get_settings()
    settings.llm_provider = data.llm_provider
    settings.llm_model = data.llm_model
    settings.qwen_api_key = data.qwen_api_key
    settings.qwen_base_url = data.qwen_base_url
    settings.deepseek_api_key = data.deepseek_api_key
    settings.openai_api_key = data.openai_api_key
    settings.ollama_base_url = data.ollama_base_url
    return {"message": "Config updated", "config": _current_config.model_dump()}


@router.get("/boss-status")
async def boss_cookie_status():
    """
    检查 BOSS直聘 Cookie 配置状态
    返回：是否已配置、关键字段是否存在、上次验证结果
    """
    cookie = _current_config.boss_cookie
    if not cookie:
        return {
            "configured": False,
            "has_wt2": False,
            "has_zp_token": False,
            "message": "未配置 Cookie，请在浏览器登录 zhipin.com 后粘贴 Cookie",
        }
    return {
        "configured": True,
        "has_wt2": "wt2" in cookie,
        "has_zp_token": "zp_token" in cookie,
        "message": "Cookie 已配置" + (
            "，关键字段完整" if "wt2" in cookie else "，但缺少 wt2 字段，可能无法正常使用"
        ),
    }
