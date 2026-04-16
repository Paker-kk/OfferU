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
    # tier → model 自定义映射 (覆盖 llm.py 中的 TIER_MODEL_MAP)
    tier_model_map: dict = {}

    # ---- 网络 ----
    # ssl_verify=False 仅用于开发环境（如 Clash 代理导致证书主机名不匹配）。
    # 普通用户保持默认 True。
    ssl_verify: bool = True
    # LLM API 全局超时（秒），防止请求挂起
    llm_timeout: int = 60

    # ---- 安全 ----
    secret_key: str = "change-me-in-production"
    cors_origins: str = "http://localhost:3000"

    # ---- Gmail OAuth ----
    gmail_client_id: str = ""
    gmail_client_secret: str = ""
    gmail_redirect_uri: str = ""  # 自定义回调地址，为空则自动从 cors_origins 推导

    # ---- IMAP 邮箱直连（QQ/163/Gmail等，无需 GCP） ----
    imap_host: str = ""          # 如 imap.qq.com / imap.163.com / imap.gmail.com
    imap_port: int = 993
    imap_user: str = ""          # 完整邮箱地址
    imap_password: str = ""      # 授权码（QQ/163）或应用专用密码（Gmail）

    # Ignore unrelated env vars (for example docker-style db_user/db_password/db_name)
    # so local startup does not fail when extra keys exist.
    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore",
    }


@lru_cache
def get_settings() -> Settings:
    return Settings()
