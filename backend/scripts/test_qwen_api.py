"""快速测试 Qwen 工作空间 API 连通性 + 模型名称"""
import asyncio
import os
import httpx
from openai import AsyncOpenAI

BASE_URL = "https://ws-swr9i9kneudx2ljk.cn-beijing.maas.aliyuncs.com/compatible-mode/v1"
API_KEY = os.getenv("QWEN_API_KEY", "")
if not API_KEY:
    raise RuntimeError("请先设置环境变量 QWEN_API_KEY")

# 候选模型名称
MODELS_TO_TEST = [
    "qwen-flash",
    "qwen-turbo",
    "qwen3.5-flash",
]

# 绕过 Windows 系统代理 (Clash / IE Settings)
http_client = httpx.AsyncClient(
    transport=httpx.AsyncHTTPTransport(local_address="0.0.0.0"),
)
client = AsyncOpenAI(api_key=API_KEY, base_url=BASE_URL, http_client=http_client)

async def test_model(model: str):
    try:
        resp = await client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": "Say hello in one sentence."}],
            max_tokens=50,
            temperature=0.1,
        )
        content = resp.choices[0].message.content
        print(f"  [OK] {model} -> {content[:80]}")
        return True
    except Exception as e:
        print(f"  [FAIL] {model} -> {e}")
        return False

async def main():
    print(f"Testing workspace API: {BASE_URL}\n")
    for m in MODELS_TO_TEST:
        await test_model(m)

if __name__ == "__main__":
    asyncio.run(main())
