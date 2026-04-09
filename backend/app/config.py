# =============================================
# OfferU - 后端配置
# =============================================
# 集中管理所有环境变量和配置项
# 使用 pydantic-settings 自动从 .env / 环境变量加载
# =============================================

from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """应用全局配置，字段自动绑定同名环境变量"""

    # ---- 数据库 ----
    database_url: str = "sqlite+aiosqlite:///./djm.db"

    # ---- API Keys（多 LLM 提供商） ----
    openai_api_key: str = ""
    deepseek_api_key: str = ""
    qwen_api_key: str = ""
    siliconflow_api_key: str = ""
    gemini_api_key: str = ""
    zhipu_api_key: str = ""
    ollama_base_url: str = "http://localhost:11434"
    apify_api_key: str = ""

    # ---- AI 模型配置 ----
    # llm_provider: openai / deepseek / qwen / siliconflow / gemini / zhipu / ollama / custom
    llm_provider: str = "deepseek"
    llm_model: str = "deepseek-chat"
    active_llm_config_id: str = ""
    active_llm_base_url: str = ""
    active_llm_api_key: str = ""

    # ---- 安全 ----
    secret_key: str = "change-me-in-production"
    cors_origins: str = "http://localhost:3000"

    # ---- Gmail OAuth ----
    gmail_client_id: str = ""
    gmail_client_secret: str = ""
    gmail_redirect_uri: str = ""  # 自定义回调地址，为空则自动从 cors_origins 推导

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
