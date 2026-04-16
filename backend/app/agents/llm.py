# =============================================
# LLM 抽象层 — 多 Provider 统一接口
# =============================================
# 支持的提供商：
#   - DeepSeek（中国首选，便宜快速）
#   - OpenAI（GPT-4o 系列）
#   - Qwen（阿里云百炼）
#   - Ollama（本地部署，完全免费）
#
# 所有提供商统一为 `chat_completion()` 接口，
# 使用 OpenAI 兼容协议（DeepSeek / Ollama 均支持）。
# =============================================

from __future__ import annotations

import asyncio
import json
import logging
import re
from typing import Optional

import httpx
from openai import AsyncOpenAI

from app.config import get_settings

_logger = logging.getLogger(__name__)


def _make_http_client() -> httpx.AsyncClient:
    """
    构造绕过系统代理（Clash / IE Settings）的 httpx 客户端。
    ─────────────────────────────────────────────
    Windows 下 httpx 会自动读取系统代理，导致 SSL 证书主机名
    不匹配错误。使用自定义 transport 来绕过。
    ssl_verify 由 config.py Settings.ssl_verify 控制：
      - True (默认)  = 正常 SSL 验证
      - False (开发) = 跳过验证（Clash 等代理场景）
    """
    settings = get_settings()
    return httpx.AsyncClient(
        transport=httpx.AsyncHTTPTransport(local_address="0.0.0.0"),
        verify=settings.ssl_verify,
    )


DEFAULT_BASE_URLS = {
    "deepseek": "https://api.deepseek.com",
    "qwen": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "siliconflow": "https://api.siliconflow.com/v1",
    "gemini": "https://generativelanguage.googleapis.com/v1beta/openai",
    "zhipu": "https://open.bigmodel.cn/api/paas/v4",
}

# ---- tier → model 映射 ----
# 每个 provider 定义 fast / standard / premium 三档模型
# 未列出的 provider 或 tier 会 fallback 到 settings.llm_model
TIER_MODEL_MAP: dict[str, dict[str, str]] = {
    "qwen": {
        "fast": "qwen-flash",
        "standard": "qwen3.5-plus",
        "premium": "qwen3.5-plus",
    },
    "deepseek": {
        "fast": "deepseek-chat",
        "standard": "deepseek-chat",
        "premium": "deepseek-reasoner",
    },
    "openai": {
        "fast": "gpt-4o-mini",
        "standard": "gpt-4o",
        "premium": "gpt-4o",
    },
}


def _ensure_ollama_v1(base_url: str) -> str:
    base = base_url.rstrip("/")
    if base.endswith("/v1"):
        return base
    return f"{base}/v1"


def _get_client() -> tuple[AsyncOpenAI, str]:
    """
    根据当前配置的 LLM Provider 创建对应客户端
    ─────────────────────────────────────────────
    所有提供商统一走 OpenAI 兼容协议。
    配置路由（routes/config.py）已将激活的 provider 信息
    同步到 active_llm_base_url / active_llm_api_key，
    因此这里只需读取这两个字段即可，无需硬编码 provider 分支。

    返回: (client, model_name)
    """
    settings = get_settings()
    provider = (settings.llm_provider or "deepseek").strip().lower()
    model = settings.llm_model
    active_base_url = (settings.active_llm_base_url or "").strip().rstrip("/")
    active_api_key = (settings.active_llm_api_key or "").strip()
    http_client = _make_http_client()

    # Ollama 特殊处理：确保 /v1 后缀，使用占位 key
    if provider == "ollama":
        base_url = active_base_url or settings.ollama_base_url
        client = AsyncOpenAI(
            api_key="ollama",
            base_url=_ensure_ollama_v1(base_url),
            http_client=http_client,
        )
        return client, model

    # 通用路径：所有 OpenAI 兼容提供商（DeepSeek / Qwen / OpenAI / Gemini / 智谱 / SiliconFlow / 任意第三方）
    # 1) 优先使用 active_llm_* 字段（由设置页同步）
    # 2) 回退到 per-provider 专属 key + 默认 base_url（兼容旧配置 / 环境变量启动）
    api_key = active_api_key
    base_url = active_base_url

    if not api_key:
        # 兼容旧版：从 per-provider key 字段读取
        legacy_keys = {
            "deepseek": settings.deepseek_api_key,
            "openai": settings.openai_api_key,
            "qwen": settings.qwen_api_key,
            "siliconflow": settings.siliconflow_api_key,
            "gemini": settings.gemini_api_key,
            "zhipu": settings.zhipu_api_key,
        }
        api_key = legacy_keys.get(provider, "")

    if not api_key:
        raise ValueError(f"LLM API Key 未配置（provider={provider}），请在设置页面填写")

    if not base_url:
        base_url = DEFAULT_BASE_URLS.get(provider, "")

    if not base_url:
        raise ValueError(f"LLM Base URL 未配置（provider={provider}），请在设置页面填写")

    client = AsyncOpenAI(
        api_key=api_key,
        base_url=base_url,
        http_client=http_client,
    )

    return client, model


async def chat_completion(
    messages: list[dict],
    temperature: float = 0.3,
    json_mode: bool = False,
    max_tokens: int = 4096,
    tier: str = "standard",
) -> Optional[str]:
    """
    统一的 LLM Chat Completion 接口
    ─────────────────────────────────────────────
    根据全局配置自动选择 Provider 和模型。
    所有 Provider 都走 OpenAI 兼容协议。

    参数:
      messages: ChatML 格式消息列表
      temperature: 生成温度（0=确定性, 1=创造性）
      json_mode: 是否强制 JSON 输出格式
      max_tokens: 最大生成 token 数
      tier: 模型档位 fast / standard / premium

    返回: 模型的文本输出，失败返回 None
    """
    client, default_model = _get_client()

    # 根据 tier 选择模型，fallback 到配置中的默认模型
    settings = get_settings()
    provider = (settings.llm_provider or "deepseek").strip().lower()

    # 优先使用用户自定义 tier 映射，否则使用硬编码默认
    user_tier_map = getattr(settings, "tier_model_map", None) or {}
    if user_tier_map:
        model = user_tier_map.get(tier, default_model)
    else:
        provider_tiers = TIER_MODEL_MAP.get(provider, {})
        model = provider_tiers.get(tier, default_model)

    kwargs: dict = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    # JSON mode — OpenAI / DeepSeek / Qwen 默认支持 response_format
    # Ollama 兼容实现不稳定，默认关闭
    if json_mode and settings.llm_provider != "ollama":
        kwargs["response_format"] = {"type": "json_object"}

    try:
        response = await asyncio.wait_for(
            client.chat.completions.create(**kwargs),
            timeout=settings.llm_timeout,
        )
        return response.choices[0].message.content
    except asyncio.TimeoutError:
        _logger.error(f"[LLM Timeout] {provider}/{model} (tier={tier}): 超过 {settings.llm_timeout}s")
        return None
    except Exception as e:
        _logger.error(f"[LLM Error] {provider}/{model} (tier={tier}): {e}")
        return None


def extract_json(text: str) -> Optional[dict]:
    """
    从 LLM 输出文本中提取 JSON
    ─────────────────────────────────────────────
    模型可能将 JSON 包装在 markdown code block 中，
    如 ```json ... ```，需要剥离后解析。
    兼容各种 LLM 的输出习惯。
    """
    if not text:
        return None

    text = text.strip()

    # 尝试直接解析
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        _logger.debug("extract_json: direct parse failed, trying fallback: %s", text[:200])

    # 尝试从 markdown code block 中提取
    match = re.search(r'```(?:json)?\s*\n(.*?)\n```', text, re.DOTALL)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass

    # 尝试找到第一个 { 到最后一个 } 的范围
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        try:
            return json.loads(text[start:end + 1])
        except json.JSONDecodeError:
            pass

    return None
