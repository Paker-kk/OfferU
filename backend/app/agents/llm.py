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

import json
import re
from typing import Optional

from openai import AsyncOpenAI

from app.config import get_settings


DEFAULT_BASE_URLS = {
    "deepseek": "https://api.deepseek.com",
    "qwen": "https://dashscope.aliyuncs.com/compatible-mode/v1",
    "siliconflow": "https://api.siliconflow.com/v1",
    "gemini": "https://generativelanguage.googleapis.com/v1beta/openai",
    "zhipu": "https://open.bigmodel.cn/api/paas/v4",
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
    DeepSeek 和 Ollama 都兼容 OpenAI API 协议，
    因此只需切换 base_url 和 api_key 即可复用同一个客户端。

    返回: (client, model_name)
    """
    settings = get_settings()
    provider = (settings.llm_provider or "deepseek").strip().lower()
    model = settings.llm_model
    active_base_url = (settings.active_llm_base_url or "").strip().rstrip("/")
    active_api_key = (settings.active_llm_api_key or "").strip()

    if provider == "deepseek":
        api_key = settings.deepseek_api_key or active_api_key
        if not api_key:
            raise ValueError("DeepSeek API Key 未配置，请在设置页面填写")
        client = AsyncOpenAI(
            api_key=api_key,
            base_url=active_base_url or DEFAULT_BASE_URLS["deepseek"],
        )
    elif provider == "openai":
        api_key = settings.openai_api_key or active_api_key
        if not api_key:
            raise ValueError("OpenAI API Key 未配置，请在设置页面填写")
        if active_base_url:
            client = AsyncOpenAI(api_key=api_key, base_url=active_base_url)
        else:
            client = AsyncOpenAI(api_key=api_key)
    elif provider == "qwen":
        api_key = settings.qwen_api_key or active_api_key
        if not api_key:
            raise ValueError("Qwen API Key 未配置，请在设置页面填写")
        client = AsyncOpenAI(
            api_key=api_key,
            base_url=active_base_url or DEFAULT_BASE_URLS["qwen"],
        )
    elif provider == "siliconflow":
        api_key = settings.siliconflow_api_key or active_api_key
        if not api_key:
            raise ValueError("SiliconFlow API Key 未配置，请在设置页面填写")
        client = AsyncOpenAI(
            api_key=api_key,
            base_url=active_base_url or DEFAULT_BASE_URLS["siliconflow"],
        )
    elif provider == "gemini":
        api_key = settings.gemini_api_key or active_api_key
        if not api_key:
            raise ValueError("Gemini API Key 未配置，请在设置页面填写")
        client = AsyncOpenAI(
            api_key=api_key,
            base_url=active_base_url or DEFAULT_BASE_URLS["gemini"],
        )
    elif provider == "zhipu":
        api_key = settings.zhipu_api_key or active_api_key
        if not api_key:
            raise ValueError("智谱 API Key 未配置，请在设置页面填写")
        client = AsyncOpenAI(
            api_key=api_key,
            base_url=active_base_url or DEFAULT_BASE_URLS["zhipu"],
        )
    elif provider == "ollama":
        ollama_base_url = active_base_url or settings.ollama_base_url
        client = AsyncOpenAI(
            api_key="ollama",  # Ollama 不需要真实 key
            base_url=_ensure_ollama_v1(ollama_base_url),
        )
    else:
        # 自定义 OpenAI 兼容服务商
        if not active_base_url:
            raise ValueError(f"不支持的 LLM Provider: {provider}，且未配置 active_llm_base_url")
        if not active_api_key:
            raise ValueError(f"自定义 Provider {provider} 缺少 API Key")
        client = AsyncOpenAI(
            api_key=active_api_key,
            base_url=active_base_url,
        )

    return client, model


async def chat_completion(
    messages: list[dict],
    temperature: float = 0.3,
    json_mode: bool = False,
    max_tokens: int = 4096,
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

    返回: 模型的文本输出，失败返回 None
    """
    client, model = _get_client()

    kwargs: dict = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    # JSON mode — OpenAI / DeepSeek / Qwen 默认支持 response_format
    # Ollama 兼容实现不稳定，默认关闭
    settings = get_settings()
    if json_mode and settings.llm_provider != "ollama":
        kwargs["response_format"] = {"type": "json_object"}

    try:
        response = await client.chat.completions.create(**kwargs)
        return response.choices[0].message.content
    except Exception as e:
        # 日志记录（后续可替换为 logging）
        print(f"[LLM Error] {settings.llm_provider}/{model}: {e}")
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
        pass

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
