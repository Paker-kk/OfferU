"""测试通过后端 llm.py 调用 Qwen API"""
import asyncio
import sys
import os

# 添加 backend 目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.agents.llm import chat_completion

async def main():
    print("Testing chat_completion through llm.py...")
    result = await chat_completion(
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "用一句话介绍你自己。"},
        ],
        temperature=0.3,
        max_tokens=100,
    )
    if result:
        print(f"[OK] Response: {result[:200]}")
    else:
        print("[FAIL] chat_completion returned None")

asyncio.run(main())
