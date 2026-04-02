# =============================================
# Config 路由 — 系统配置管理 API
# =============================================
# GET  /api/config/  获取当前配置（含多 LLM Provider 模型列表）
# PUT  /api/config/  更新配置
# =============================================

from fastapi import APIRouter
from pydantic import BaseModel

from app.config import get_settings

router = APIRouter()

# ---- 多 LLM 提供商的可选模型 ----
# 前端根据用户选择的 provider 渲染对应模型下拉
AVAILABLE_PROVIDERS = [
    {
        "id": "deepseek",
        "name": "DeepSeek",
        "description": "国内首选，性价比极高",
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
    llm_provider: str = "deepseek"
    llm_model: str = "deepseek-chat"
    # API Keys（前端输入，运行时生效）
    deepseek_api_key: str = ""
    openai_api_key: str = ""
    ollama_base_url: str = "http://localhost:11434"


# 内存中存储配置（后续可持久化到数据库）
# 初始化时从 .env 加载已有 API Key
_settings_init = get_settings()
_current_config = ConfigUpdate(
    deepseek_api_key=_settings_init.deepseek_api_key,
    openai_api_key=_settings_init.openai_api_key,
    ollama_base_url=_settings_init.ollama_base_url,
    llm_provider=_settings_init.llm_provider,
    llm_model=_settings_init.llm_model,
)


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
    data["deepseek_api_key"] = _mask_key(data["deepseek_api_key"])
    data["openai_api_key"] = _mask_key(data["openai_api_key"])
    data["available_providers"] = AVAILABLE_PROVIDERS
    return data


@router.put("/")
async def update_config(data: ConfigUpdate):
    """更新系统配置"""
    global _current_config
    # 如果前端传来的 key 全是 * 或为空，说明用户没改，保留原值
    if not data.deepseek_api_key or "*" in data.deepseek_api_key:
        data.deepseek_api_key = _current_config.deepseek_api_key
    if not data.openai_api_key or "*" in data.openai_api_key:
        data.openai_api_key = _current_config.openai_api_key
    _current_config = data
    # 同步 LLM 配置到全局 Settings（运行时覆盖）
    settings = get_settings()
    settings.llm_provider = data.llm_provider
    settings.llm_model = data.llm_model
    settings.deepseek_api_key = data.deepseek_api_key
    settings.openai_api_key = data.openai_api_key
    settings.ollama_base_url = data.ollama_base_url
    return {"message": "Config updated", "config": _current_config.model_dump()}
