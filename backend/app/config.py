# =============================================
# OfferU - 后端配置
# =============================================
# 集中管理所有环境变量和配置项
# 使用 pydantic-settings 自动从 .env / 环境变量加载
# =============================================

from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    """应用全局配置，字段自动绑定同名环境变量"""

    # ---- 数据库 ----
    database_url: str = "sqlite+aiosqlite:///./djm.db"

    # ---- API Keys（多 LLM 提供商） ----
    openai_api_key: str = ""
    deepseek_api_key: str = ""
    qwen_api_key: str = ""
    qwen_base_url: str = "https://dashscope.aliyuncs.com/compatible-mode/v1"
    ollama_base_url: str = "http://localhost:11434"
    apify_api_key: str = ""

    # ---- AI 模型配置 ----
    # llm_provider: qwen / deepseek / openai / ollama
    llm_provider: str = "qwen"
    llm_model: str = "qwen-flash"

    # ---- 安全 ----
    secret_key: str = "change-me-in-production"
    cors_origins: str = "http://localhost:3000"

    # ---- Gmail OAuth ----
    gmail_client_id: str = ""
    gmail_client_secret: str = ""
    gmail_redirect_uri: str = ""  # 自定义回调地址，为空则自动从 cors_origins 推导

    # ---- 网络 ----
    # 绕过系统代理直连国内 API（Clash/V2Ray 用户需要）
    no_proxy: str = ""

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    # 将 NO_PROXY 注入 os.environ，使 httpx/openai SDK 生效
    if s.no_proxy and not os.environ.get("NO_PROXY"):
        os.environ["NO_PROXY"] = s.no_proxy
        os.environ["no_proxy"] = s.no_proxy
    return s
