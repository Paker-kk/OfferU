# =============================================
# Config routes - system configuration management
# =============================================
# GET  /api/config/  -> get current settings and provider presets
# PUT  /api/config/  -> update settings (supports patch updates)
# =============================================

from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import APIRouter
from pydantic import BaseModel, Field

from app.config import get_settings

router = APIRouter()

# backend/config.json
_CONFIG_FILE = Path(__file__).resolve().parent.parent.parent / "config.json"
_DEFAULT_OLLAMA_BASE_URL = "http://localhost:11434"
_PLACEHOLDER_API_KEYS = {
    "sk-your-openai-key-here",
    "your-openai-api-key",
    "your-deepseek-api-key",
    "your-gemini-api-key",
    "your-api-key",
    "replace-with-your-api-key",
    "api-key-here",
    "sk-your-key",
    # 历史示例值，视为未配置
    "aizasyc7mpmbytxt21mlxr2zt0p68er4mrunzgi",
}

PROVIDER_PRESETS: list[dict[str, Any]] = [
    {
        "id": "deepseek",
        "name": "DeepSeek",
        "description": "Cost-effective Chinese/English model",
        "default_base_url": "https://api.deepseek.com",
        "models": [
            {"id": "deepseek-chat", "name": "DeepSeek Chat", "description": "DeepSeek-V3.2 non-thinking mode"},
            {"id": "deepseek-reasoner", "name": "DeepSeek Reasoner", "description": "DeepSeek-V3.2 reasoning mode"},
        ],
        "key_prefix": "sk-",
    },
    {
        "id": "openai",
        "name": "OpenAI",
        "description": "Mainstream global provider",
        "default_base_url": "https://api.openai.com/v1",
        "models": [
            {"id": "gpt-4.1-mini", "name": "GPT-4.1 Mini", "description": "Balanced speed and quality"},
            {"id": "gpt-4o-mini", "name": "GPT-4o Mini", "description": "Fast multimodal model"},
            {"id": "gpt-4.1", "name": "GPT-4.1", "description": "High quality general model"},
        ],
        "key_prefix": "sk-",
    },
    {
        "id": "qwen",
        "name": "Qwen",
        "description": "Alibaba DashScope OpenAI-compatible API",
        "default_base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "models": [
            {"id": "qwen-flash", "name": "Qwen Flash", "description": "Ultra-fast, lowest cost (tier=fast)"},
            {"id": "qwen3.5-plus", "name": "Qwen3.5 Plus", "description": "Balanced quality and speed (tier=standard/premium)"},
            {"id": "qwen3.6-plus", "name": "Qwen3.6 Plus", "description": "Best reasoning quality (tier=premium)"},
            {"id": "qwen3.5-flash", "name": "Qwen3.5 Flash", "description": "Fast with good quality"},
        ],
        "key_prefix": "sk-",
    },
    {
        "id": "siliconflow",
        "name": "SiliconFlow",
        "description": "Aggregated open model inference",
        "default_base_url": "https://api.siliconflow.com/v1",
        "models": [
            {"id": "deepseek-ai/DeepSeek-V3.2", "name": "DeepSeek-V3.2", "description": "Popular coding and writing model"},
            {"id": "Qwen/Qwen3-32B", "name": "Qwen3-32B", "description": "Strong Chinese performance"},
            {"id": "zai-org/GLM-4.5", "name": "GLM-4.5", "description": "General purpose option"},
        ],
        "key_prefix": "sk-",
    },
    {
        "id": "gemini",
        "name": "Google Gemini",
        "description": "Gemini via OpenAI-compatible endpoint",
        "default_base_url": "https://generativelanguage.googleapis.com/v1beta/openai",
        "models": [
            {"id": "gemini-2.5-flash", "name": "Gemini 2.5 Flash", "description": "Fast and low-cost"},
            {"id": "gemini-2.5-pro", "name": "Gemini 2.5 Pro", "description": "High quality reasoning"},
        ],
        "key_prefix": "",
    },
    {
        "id": "zhipu",
        "name": "智谱",
        "description": "BigModel Open Platform",
        "default_base_url": "https://open.bigmodel.cn/api/paas/v4",
        "models": [
            {"id": "glm-5.1", "name": "GLM-5.1", "description": "Latest flagship"},
            {"id": "glm-4.6", "name": "GLM-4.6", "description": "Stable general model"},
            {"id": "glm-4-plus", "name": "GLM-4-Plus", "description": "Legacy high-quality model"},
        ],
        "key_prefix": "",
    },
    {
        "id": "ollama",
        "name": "Ollama",
        "description": "Local open-source inference",
        "default_base_url": "http://localhost:11434/v1",
        "models": [
            {"id": "qwen2.5:7b", "name": "Qwen2.5 7B", "description": "Good Chinese local model"},
            {"id": "llama3.1:8b", "name": "Llama 3.1 8B", "description": "General open model"},
            {"id": "gemma2:9b", "name": "Gemma2 9B", "description": "Google open model"},
        ],
        "key_prefix": "",
    },
    {
        "id": "custom",
        "name": "自定义 (OpenAI 兼容)",
        "description": "Any OpenAI-compatible API endpoint (e.g. Groq, Mistral, Together, Azure OpenAI, etc.)",
        "default_base_url": "",
        "models": [],
        "key_prefix": "",
    },
]

_PRESET_BY_ID: dict[str, dict[str, Any]] = {preset["id"]: preset for preset in PROVIDER_PRESETS}

AVAILABLE_PROVIDERS = [
    {
        "id": preset["id"],
        "name": preset["name"],
        "description": preset["description"],
        "models": [
            {
                "id": model["id"],
                "name": model["name"],
                "description": model.get("description", ""),
            }
            for model in preset.get("models", [])
        ],
    }
    for preset in PROVIDER_PRESETS
]


class LlmApiConfig(BaseModel):
    """A single provider configuration entry."""

    id: str = Field(default_factory=lambda: uuid4().hex)
    provider_id: str = ""
    service_name: str = ""
    model: str = ""
    base_url: str = ""
    api_key: str = ""
    is_active: bool = False
    extra_params: dict[str, str] = Field(default_factory=dict)


class ConfigUpdate(BaseModel):
    """Mutable system configuration payload."""

    search_keywords: list[str] = Field(default_factory=list)
    search_locations: list[str] = Field(default_factory=list)
    banned_keywords: list[str] = Field(default_factory=list)
    top_n: int = 15
    email_to: str = ""
    sources_enabled: list[str] = Field(default_factory=lambda: ["linkedin"])
    profile_source_sync_enabled: bool = False

    llm_provider: str = "deepseek"
    llm_model: str = "deepseek-chat"

    deepseek_api_key: str = ""
    openai_api_key: str = ""
    qwen_api_key: str = ""
    siliconflow_api_key: str = ""
    gemini_api_key: str = ""
    zhipu_api_key: str = ""
    ollama_base_url: str = "http://localhost:11434"

    llm_api_configs: list[LlmApiConfig] = Field(default_factory=list)
    active_llm_config_id: str = ""
    active_llm_base_url: str = ""
    active_llm_api_key: str = ""

    # tier → model 自定义映射（覆盖 llm.py 中的 TIER_MODEL_MAP）
    # 格式: {"fast": "model-id", "standard": "model-id", "premium": "model-id"}
    tier_model_map: dict[str, str] = Field(default_factory=dict)

    # 网络 — 仅开发环境需要改
    ssl_verify: bool = True       # False = 跳过 SSL 验证（Clash 代理场景）
    llm_timeout: int = 60         # LLM API 超时秒数

    boss_cookie: str = ""
    zhilian_cookie: str = ""


def _normalize_provider_id(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")
    return normalized or "custom"


def _provider_default_url(provider_id: str) -> str:
    preset = _PRESET_BY_ID.get(provider_id)
    if not preset:
        return ""
    return str(preset.get("default_base_url", "")).strip().rstrip("/")


def _provider_default_model(provider_id: str) -> str:
    preset = _PRESET_BY_ID.get(provider_id)
    if not preset:
        return ""
    models = preset.get("models", [])
    if not models:
        return ""
    return str(models[0].get("id", "")).strip()


def _provider_name(provider_id: str) -> str:
    preset = _PRESET_BY_ID.get(provider_id)
    if preset:
        return str(preset.get("name", provider_id))
    return provider_id


def _mask_key(key: str) -> str:
    if not key:
        return ""
    if len(key) <= 8:
        return "*" * len(key)
    return f"{key[:4]}{'*' * (len(key) - 8)}{key[-4:]}"


def _sanitize_api_key(raw: str) -> str:
    value = (raw or "").strip()
    if not value:
        return ""

    lowered = value.lower()
    if "*" in value:
        return ""
    if lowered in _PLACEHOLDER_API_KEYS:
        return ""
    if "your" in lowered and "key" in lowered:
        return ""
    if lowered.startswith("sk-your-"):
        return ""

    return value


def _upsert_provider_config(
    configs: list[LlmApiConfig],
    provider_id: str,
    *,
    service_name: str | None = None,
    model: str | None = None,
    base_url: str | None = None,
    api_key: str | None = None,
) -> LlmApiConfig:
    target = next((cfg for cfg in configs if cfg.provider_id == provider_id), None)
    if not target:
        target = LlmApiConfig(
            provider_id=provider_id,
            service_name=service_name or _provider_name(provider_id),
            model=model or _provider_default_model(provider_id),
            base_url=(base_url or _provider_default_url(provider_id)).rstrip("/"),
            api_key=api_key or "",
            is_active=False,
        )
        configs.append(target)
        return target

    if service_name is not None:
        target.service_name = service_name
    if model is not None:
        target.model = model
    if base_url is not None:
        target.base_url = base_url.rstrip("/")
    if api_key is not None:
        target.api_key = api_key
    return target


def _first_provider_config(configs: list[LlmApiConfig], provider_id: str) -> LlmApiConfig | None:
    return next((cfg for cfg in configs if cfg.provider_id == provider_id), None)


def _build_legacy_configs(cfg: ConfigUpdate) -> list[LlmApiConfig]:
    configs: list[LlmApiConfig] = []
    active_provider = _normalize_provider_id(cfg.llm_provider or "deepseek")
    known_providers = {"deepseek", "openai", "qwen", "siliconflow", "gemini", "zhipu", "ollama"}

    deepseek_key = _sanitize_api_key(cfg.deepseek_api_key)
    openai_key = _sanitize_api_key(cfg.openai_api_key)
    qwen_key = _sanitize_api_key(cfg.qwen_api_key)
    siliconflow_key = _sanitize_api_key(cfg.siliconflow_api_key)
    gemini_key = _sanitize_api_key(cfg.gemini_api_key)
    zhipu_key = _sanitize_api_key(cfg.zhipu_api_key)

    legacy_map = [
        (
            "deepseek",
            deepseek_key,
            cfg.llm_model if active_provider == "deepseek" else _provider_default_model("deepseek"),
            _provider_default_url("deepseek"),
        ),
        (
            "openai",
            openai_key,
            cfg.llm_model if active_provider == "openai" else _provider_default_model("openai"),
            _provider_default_url("openai"),
        ),
        (
            "qwen",
            qwen_key,
            cfg.llm_model if active_provider == "qwen" else _provider_default_model("qwen"),
            _provider_default_url("qwen"),
        ),
        (
            "siliconflow",
            siliconflow_key,
            cfg.llm_model if active_provider == "siliconflow" else _provider_default_model("siliconflow"),
            _provider_default_url("siliconflow"),
        ),
        (
            "gemini",
            gemini_key,
            cfg.llm_model if active_provider == "gemini" else _provider_default_model("gemini"),
            _provider_default_url("gemini"),
        ),
        (
            "zhipu",
            zhipu_key,
            cfg.llm_model if active_provider == "zhipu" else _provider_default_model("zhipu"),
            _provider_default_url("zhipu"),
        ),
    ]

    for provider_id, api_key, model, base_url in legacy_map:
        should_add = bool(api_key)
        if not should_add:
            continue
        configs.append(
            LlmApiConfig(
                provider_id=provider_id,
                service_name=_provider_name(provider_id),
                model=model,
                base_url=base_url,
                api_key=api_key,
                is_active=provider_id == active_provider,
            )
        )

    ollama_model = cfg.llm_model if active_provider == "ollama" else _provider_default_model("ollama")
    ollama_url_raw = (cfg.ollama_base_url or _DEFAULT_OLLAMA_BASE_URL).rstrip("/")
    ollama_is_custom = ollama_url_raw != _DEFAULT_OLLAMA_BASE_URL
    ollama_url = ollama_url_raw
    if not ollama_url.endswith("/v1"):
        ollama_url = f"{ollama_url}/v1"
    if active_provider == "ollama" or ollama_is_custom:
        configs.append(
            LlmApiConfig(
                provider_id="ollama",
                service_name=_provider_name("ollama"),
                model=ollama_model,
                base_url=ollama_url,
                api_key="",
                is_active=active_provider == "ollama",
            )
        )

    # 兼容历史 custom provider 字段
    if active_provider not in known_providers:
        custom_base_url = (cfg.active_llm_base_url or "").strip().rstrip("/")
        custom_api_key = (cfg.active_llm_api_key or "").strip()
        if custom_base_url and custom_api_key:
            configs.append(
                LlmApiConfig(
                    provider_id=active_provider,
                    service_name=(cfg.llm_provider or "Custom").strip() or "Custom",
                    model=(cfg.llm_model or "").strip(),
                    base_url=custom_base_url,
                    api_key=custom_api_key,
                    is_active=True,
                )
            )

    return configs


def _prune_auto_seed_defaults(cfg: ConfigUpdate) -> None:
    """清理非用户配置项，确保用户未配置时 API 列表为空。"""
    if not cfg.llm_api_configs:
        return

    default_ollama_url = _provider_default_url("ollama")
    if default_ollama_url and not default_ollama_url.endswith("/v1"):
        default_ollama_url = f"{default_ollama_url}/v1"
    default_ollama_model = _provider_default_model("ollama")
    default_ollama_name = _provider_name("ollama")

    cleaned: list[LlmApiConfig] = []
    for item in cfg.llm_api_configs:
        provider_id = _normalize_provider_id(item.provider_id or item.service_name)
        service_name = (item.service_name or _provider_name(provider_id)).strip()
        model = (item.model or _provider_default_model(provider_id)).strip()
        base_url = (item.base_url or _provider_default_url(provider_id)).strip().rstrip("/")
        api_key = _sanitize_api_key(item.api_key)

        if provider_id == "ollama" and base_url and not base_url.endswith("/v1"):
            base_url = f"{base_url}/v1"

        item.provider_id = provider_id
        item.service_name = service_name
        item.model = model
        item.base_url = base_url
        item.api_key = api_key

        if provider_id == "ollama":
            has_customization = (
                bool(item.extra_params)
                or service_name != default_ollama_name
                or model != default_ollama_model
                or base_url != default_ollama_url
            )
            if item.is_active or has_customization:
                cleaned.append(item)
            continue

        if api_key:
            cleaned.append(item)

    cfg.llm_api_configs = cleaned


def _sync_legacy_fields_from_configs(cfg: ConfigUpdate) -> None:
    active = next((item for item in cfg.llm_api_configs if item.is_active), None)
    if active:
        cfg.llm_provider = active.provider_id
        cfg.llm_model = active.model
        cfg.active_llm_config_id = active.id
        cfg.active_llm_base_url = active.base_url
        cfg.active_llm_api_key = active.api_key
    else:
        cfg.active_llm_config_id = ""
        cfg.active_llm_base_url = ""
        cfg.active_llm_api_key = ""

    deepseek_cfg = _first_provider_config(cfg.llm_api_configs, "deepseek")
    openai_cfg = _first_provider_config(cfg.llm_api_configs, "openai")
    qwen_cfg = _first_provider_config(cfg.llm_api_configs, "qwen")
    siliconflow_cfg = _first_provider_config(cfg.llm_api_configs, "siliconflow")
    gemini_cfg = _first_provider_config(cfg.llm_api_configs, "gemini")
    zhipu_cfg = _first_provider_config(cfg.llm_api_configs, "zhipu")
    ollama_cfg = _first_provider_config(cfg.llm_api_configs, "ollama")

    cfg.deepseek_api_key = deepseek_cfg.api_key if deepseek_cfg else ""
    cfg.openai_api_key = openai_cfg.api_key if openai_cfg else ""
    cfg.qwen_api_key = qwen_cfg.api_key if qwen_cfg else ""
    cfg.siliconflow_api_key = siliconflow_cfg.api_key if siliconflow_cfg else ""
    cfg.gemini_api_key = gemini_cfg.api_key if gemini_cfg else ""
    cfg.zhipu_api_key = zhipu_cfg.api_key if zhipu_cfg else ""

    if ollama_cfg and ollama_cfg.base_url:
        # legacy field keeps old shape without /v1 suffix
        cfg.ollama_base_url = ollama_cfg.base_url[:-3] if ollama_cfg.base_url.endswith("/v1") else ollama_cfg.base_url
    else:
        cfg.ollama_base_url = _DEFAULT_OLLAMA_BASE_URL


def _normalize_llm_state(cfg: ConfigUpdate) -> None:
    if not cfg.llm_api_configs:
        cfg.llm_api_configs = _build_legacy_configs(cfg)

    normalized: list[LlmApiConfig] = []
    for item in cfg.llm_api_configs:
        provider_id = _normalize_provider_id(item.provider_id or item.service_name)
        service_name = (item.service_name or _provider_name(provider_id)).strip()

        model = (item.model or _provider_default_model(provider_id)).strip()
        base_url = (item.base_url or _provider_default_url(provider_id)).strip().rstrip("/")
        api_key = _sanitize_api_key(item.api_key)

        if provider_id == "ollama" and base_url and not base_url.endswith("/v1"):
            base_url = f"{base_url}/v1"

        normalized.append(
            LlmApiConfig(
                id=item.id or uuid4().hex,
                provider_id=provider_id,
                service_name=service_name,
                model=model,
                base_url=base_url,
                api_key=api_key,
                is_active=bool(item.is_active),
                extra_params=item.extra_params or {},
            )
        )

    cfg.llm_api_configs = normalized
    _prune_auto_seed_defaults(cfg)

    active: LlmApiConfig | None = None
    if cfg.active_llm_config_id:
        active = next((item for item in cfg.llm_api_configs if item.id == cfg.active_llm_config_id), None)

    if active is None:
        active = next((item for item in cfg.llm_api_configs if item.is_active), None)

    if active is None and cfg.llm_api_configs:
        active = cfg.llm_api_configs[0]

    for item in cfg.llm_api_configs:
        item.is_active = bool(active and item.id == active.id)

    cfg.active_llm_config_id = active.id if active else ""
    _sync_legacy_fields_from_configs(cfg)


def _load_config() -> ConfigUpdate:
    if _CONFIG_FILE.exists():
        try:
            raw = json.loads(_CONFIG_FILE.read_text(encoding="utf-8"))
            cfg = ConfigUpdate(**raw)
            _normalize_llm_state(cfg)
            return cfg
        except (json.JSONDecodeError, Exception):
            pass

    settings = get_settings()
    cfg = ConfigUpdate(
        deepseek_api_key=settings.deepseek_api_key,
        openai_api_key=settings.openai_api_key,
        qwen_api_key=settings.qwen_api_key,
        siliconflow_api_key=settings.siliconflow_api_key,
        gemini_api_key=settings.gemini_api_key,
        zhipu_api_key=settings.zhipu_api_key,
        ollama_base_url=settings.ollama_base_url,
        llm_provider=settings.llm_provider,
        llm_model=settings.llm_model,
        active_llm_config_id=settings.active_llm_config_id,
        active_llm_base_url=settings.active_llm_base_url,
        active_llm_api_key=settings.active_llm_api_key,
    )
    _normalize_llm_state(cfg)
    return cfg


def _save_config(cfg: ConfigUpdate) -> None:
    _CONFIG_FILE.write_text(
        json.dumps(cfg.model_dump(), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _sync_runtime_settings(cfg: ConfigUpdate) -> None:
    settings = get_settings()
    settings.llm_provider = cfg.llm_provider
    settings.llm_model = cfg.llm_model
    settings.deepseek_api_key = cfg.deepseek_api_key
    settings.openai_api_key = cfg.openai_api_key
    settings.qwen_api_key = cfg.qwen_api_key
    settings.siliconflow_api_key = cfg.siliconflow_api_key
    settings.gemini_api_key = cfg.gemini_api_key
    settings.zhipu_api_key = cfg.zhipu_api_key
    settings.ollama_base_url = cfg.ollama_base_url
    settings.active_llm_config_id = cfg.active_llm_config_id
    settings.active_llm_base_url = cfg.active_llm_base_url
    settings.active_llm_api_key = cfg.active_llm_api_key
    settings.tier_model_map = cfg.tier_model_map
    settings.ssl_verify = cfg.ssl_verify
    settings.llm_timeout = cfg.llm_timeout


_current_config = _load_config()
_sync_runtime_settings(_current_config)


def _restore_masked_keys(next_cfg: ConfigUpdate, payload_fields: set[str]) -> None:
    # legacy key fields
    for field in (
        "deepseek_api_key",
        "openai_api_key",
        "qwen_api_key",
        "siliconflow_api_key",
        "gemini_api_key",
        "zhipu_api_key",
        "active_llm_api_key",
    ):
        if field not in payload_fields:
            continue
        value = getattr(next_cfg, field, "")
        if isinstance(value, str) and "*" in value:
            setattr(next_cfg, field, getattr(_current_config, field))

    # cookie placeholder semantics
    if "boss_cookie" in payload_fields and next_cfg.boss_cookie == "***已配置***":
        next_cfg.boss_cookie = _current_config.boss_cookie
    if "zhilian_cookie" in payload_fields and next_cfg.zhilian_cookie == "***已配置***":
        next_cfg.zhilian_cookie = _current_config.zhilian_cookie

    # list key masking
    if "llm_api_configs" in payload_fields:
        old_map = {item.id: item for item in _current_config.llm_api_configs}
        for item in next_cfg.llm_api_configs:
            old_item = old_map.get(item.id)
            if old_item and item.api_key and "*" in item.api_key:
                item.api_key = old_item.api_key


def _apply_legacy_updates(next_cfg: ConfigUpdate, payload_fields: set[str]) -> None:
    # Keep old update paths working (e.g., onboarding only sends deepseek_api_key)
    if "llm_api_configs" in payload_fields:
        return

    key_map: list[tuple[str, str]] = [
        ("deepseek", "deepseek_api_key"),
        ("openai", "openai_api_key"),
        ("qwen", "qwen_api_key"),
        ("siliconflow", "siliconflow_api_key"),
        ("gemini", "gemini_api_key"),
        ("zhipu", "zhipu_api_key"),
    ]

    for provider_id, key_field in key_map:
        if key_field not in payload_fields:
            continue
        _upsert_provider_config(
            next_cfg.llm_api_configs,
            provider_id,
            service_name=_provider_name(provider_id),
            model=_provider_default_model(provider_id),
            base_url=_provider_default_url(provider_id),
            api_key=getattr(next_cfg, key_field),
        )

    if "ollama_base_url" in payload_fields:
        ollama_url = (next_cfg.ollama_base_url or "http://localhost:11434").rstrip("/")
        _upsert_provider_config(
            next_cfg.llm_api_configs,
            "ollama",
            service_name=_provider_name("ollama"),
            model=_provider_default_model("ollama"),
            base_url=f"{ollama_url}/v1",
            api_key="",
        )

    if "llm_provider" in payload_fields or "llm_model" in payload_fields:
        provider_id = _normalize_provider_id(next_cfg.llm_provider or "deepseek")
        model = next_cfg.llm_model or _provider_default_model(provider_id)

        default_base_url = _provider_default_url(provider_id)
        legacy_key_map = {
            "deepseek": next_cfg.deepseek_api_key,
            "openai": next_cfg.openai_api_key,
            "qwen": next_cfg.qwen_api_key,
            "siliconflow": next_cfg.siliconflow_api_key,
            "gemini": next_cfg.gemini_api_key,
            "zhipu": next_cfg.zhipu_api_key,
        }
        target_api_key = legacy_key_map.get(provider_id, next_cfg.active_llm_api_key)

        if provider_id == "ollama":
            base_url = (next_cfg.ollama_base_url or "http://localhost:11434").rstrip("/") + "/v1"
            target_api_key = ""
        else:
            base_url = next_cfg.active_llm_base_url or default_base_url

        target = _upsert_provider_config(
            next_cfg.llm_api_configs,
            provider_id,
            service_name=_provider_name(provider_id),
            model=model,
            base_url=base_url,
            api_key=target_api_key,
        )

        for item in next_cfg.llm_api_configs:
            item.is_active = item.id == target.id
        next_cfg.active_llm_config_id = target.id

    if "active_llm_config_id" in payload_fields and next_cfg.active_llm_config_id:
        for item in next_cfg.llm_api_configs:
            item.is_active = item.id == next_cfg.active_llm_config_id


def _response_payload() -> dict[str, Any]:
    data = _current_config.model_dump()

    # legacy masked fields
    data["deepseek_api_key"] = _mask_key(data.get("deepseek_api_key", ""))
    data["openai_api_key"] = _mask_key(data.get("openai_api_key", ""))
    data["qwen_api_key"] = _mask_key(data.get("qwen_api_key", ""))
    data["siliconflow_api_key"] = _mask_key(data.get("siliconflow_api_key", ""))
    data["gemini_api_key"] = _mask_key(data.get("gemini_api_key", ""))
    data["zhipu_api_key"] = _mask_key(data.get("zhipu_api_key", ""))
    data["active_llm_api_key"] = _mask_key(data.get("active_llm_api_key", ""))

    # list entries masked
    masked_configs: list[dict[str, Any]] = []
    for item in _current_config.llm_api_configs:
        row = item.model_dump()
        row["api_key"] = _mask_key(row.get("api_key", ""))
        masked_configs.append(row)
    data["llm_api_configs"] = masked_configs

    data["boss_cookie_set"] = bool(_current_config.boss_cookie)
    data["boss_cookie"] = "***已配置***" if _current_config.boss_cookie else ""
    data["zhilian_cookie_set"] = bool(_current_config.zhilian_cookie)
    data["zhilian_cookie"] = "***已配置***" if _current_config.zhilian_cookie else ""

    # ── active_llm_summary: 让前端明确知道当前生效的配置来源 ──
    active_cfg = next((item for item in _current_config.llm_api_configs if item.is_active), None)
    active_config_id = _current_config.active_llm_config_id
    active_base_url = (_current_config.active_llm_base_url or "").strip()
    active_api_key = (_current_config.active_llm_api_key or "").strip()
    has_active = bool(active_config_id or active_base_url or active_api_key)

    if _current_config.llm_provider == "ollama":
        source = "ollama"
    elif has_active and active_cfg:
        source = "active_config"
    else:
        source = "legacy_env"

    data["active_llm_summary"] = {
        "provider_id": active_cfg.provider_id if active_cfg else _current_config.llm_provider,
        "service_name": active_cfg.service_name if active_cfg else _provider_name(_current_config.llm_provider),
        "model": active_cfg.model if active_cfg else _current_config.llm_model,
        "base_url": active_cfg.base_url if active_cfg else _provider_default_url(_current_config.llm_provider),
        "source": source,
    }

    data["provider_presets"] = PROVIDER_PRESETS
    data["available_providers"] = AVAILABLE_PROVIDERS
    return data


@router.get("/")
async def get_config():
    return _response_payload()


@router.put("/")
async def update_config(data: ConfigUpdate):
    global _current_config

    payload_fields = set(data.model_fields_set)
    updates = data.model_dump(exclude_unset=True)

    merged_raw = _current_config.model_dump()
    merged_raw.update(updates)

    next_cfg = ConfigUpdate(**merged_raw)

    _restore_masked_keys(next_cfg, payload_fields)
    _apply_legacy_updates(next_cfg, payload_fields)
    _normalize_llm_state(next_cfg)

    _current_config = next_cfg
    _save_config(_current_config)
    _sync_runtime_settings(_current_config)

    return {"message": "Config updated", "config": _current_config.model_dump()}


@router.get("/boss-status")
async def boss_cookie_status():
    cookie = _current_config.boss_cookie
    if not cookie:
        return {
            "configured": False,
            "has_wt2": False,
            "has_zp_token": False,
            "message": "Cookie not configured yet",
        }
    return {
        "configured": True,
        "has_wt2": "wt2" in cookie,
        "has_zp_token": "zp_token" in cookie,
        "message": "Cookie configured" + (
            ", key fields look good" if "wt2" in cookie else ", but wt2 is missing"
        ),
    }
