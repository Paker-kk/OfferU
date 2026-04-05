# =============================================
# LLM 抽象层 — 多 Provider 统一接口
# =============================================
# 支持的提供商：
#   - DeepSeek（中国首选，便宜快速）
#   - OpenAI（GPT-4o 系列）
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


def _get_client() -> tuple[AsyncOpenAI, str]:
    """
    根据当前配置的 LLM Provider 创建对应客户端
    ─────────────────────────────────────────────
    DeepSeek 和 Ollama 都兼容 OpenAI API 协议，
    因此只需切换 base_url 和 api_key 即可复用同一个客户端。

    返回: (client, model_name)
    """
    settings = get_settings()
    provider = settings.llm_provider
    model = settings.llm_model

    if provider == "deepseek":
        if not settings.deepseek_api_key:
            raise ValueError("DeepSeek API Key 未配置，请在设置页面填写")
        client = AsyncOpenAI(
            api_key=settings.deepseek_api_key,
            base_url="https://api.deepseek.com",
        )
    elif provider == "openai":
        if not settings.openai_api_key:
            raise ValueError("OpenAI API Key 未配置，请在设置页面填写")
        client = AsyncOpenAI(
            api_key=settings.openai_api_key,
        )
    elif provider == "ollama":
        # Ollama 兼容 OpenAI API，base_url 指向本地
        client = AsyncOpenAI(
            api_key="ollama",  # Ollama 不需要真实 key
            base_url=f"{settings.ollama_base_url}/v1",
        )
    else:
        raise ValueError(f"不支持的 LLM Provider: {provider}")

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

    # JSON mode — 仅 OpenAI 和 DeepSeek 支持 response_format
    # Ollama + Qwen 也支持，但某些小模型可能不行
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
