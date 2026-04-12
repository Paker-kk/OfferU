"""
快速验证 Qwen LLM 连通性
用法: cd backend && python scripts/test_qwen.py
"""
import asyncio
import os
import sys

# 确保 backend/ 是项目根
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.agents.llm import chat_completion, extract_json


async def main():
    print("=" * 50)
    print("OfferU — LLM 连通性测试 (阿里云百炼 Qwen)")
    print("=" * 50)

    # 测试 1: 简单对话
    print("\n[Test 1] 简单对话...")
    result = await chat_completion(
        messages=[
            {"role": "system", "content": "你是 OfferU 求职助手，请用一句话回答。"},
            {"role": "user", "content": "你好，请介绍一下自己。"},
        ],
        temperature=0.7,
        max_tokens=200,
    )
    if result:
        print(f"  ✅ 成功! 回复: {result[:100]}...")
    else:
        print("  ❌ 失败! 返回 None")
        return

    # 测试 2: JSON 模式
    print("\n[Test 2] JSON 模式...")
    result2 = await chat_completion(
        messages=[
            {"role": "system", "content": "请用JSON格式回答，包含 name 和 greeting 两个字段。"},
            {"role": "user", "content": "你好"},
        ],
        json_mode=True,
        max_tokens=200,
    )
    if result2:
        parsed = extract_json(result2)
        if parsed:
            print(f"  ✅ JSON 解析成功: {parsed}")
        else:
            print(f"  ⚠️  返回文本但 JSON 解析失败: {result2[:100]}")
    else:
        print("  ❌ 失败!")

    print("\n" + "=" * 50)
    print("LLM 连通性验证完成!")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())
