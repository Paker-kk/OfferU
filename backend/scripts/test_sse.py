"""SSE 端点集成测试 — 验证 sse-starlette 重构后 7 项修复"""
import asyncio
import httpx
import json
import time

API = "http://127.0.0.1:8000"
RESUME_ID = 1
JOB_IDS = [31, 32]


async def test_sse():
    print("=" * 60)
    print("SSE 批量优化端点测试")
    print(f"Resume ID: {RESUME_ID}, Job IDs: {JOB_IDS}")
    print("=" * 60)

    start = time.time()

    async with httpx.AsyncClient(timeout=120) as client:
        async with client.stream(
            "POST",
            f"{API}/api/resume/{RESUME_ID}/ai/batch-optimize",
            json={"job_ids": JOB_IDS, "auto_apply": True},
        ) as response:
            print(f"Status: {response.status_code}")
            print(f"Content-Type: {response.headers.get('content-type')}")
            print("-" * 60)

            buffer = ""
            async for chunk in response.aiter_text():
                buffer += chunk
                # 按双换行分割 SSE 事件
                while "\n\n" in buffer:
                    event_str, buffer = buffer.split("\n\n", 1)
                    event_str = event_str.strip()
                    if not event_str:
                        continue

                    # 解析 SSE 字段
                    event_type = ""
                    data = ""
                    event_id = ""
                    for line in event_str.split("\n"):
                        if line.startswith("event:"):
                            event_type = line.split(":", 1)[1].strip()
                        elif line.startswith("data:"):
                            data = line.split(":", 1)[1].strip()
                        elif line.startswith("id:"):
                            event_id = line.split(":", 1)[1].strip()
                        elif line.startswith(":"):
                            # 心跳 comment
                            print(f"  [PING] {line}")
                            continue

                    elapsed = time.time() - start
                    if data:
                        parsed = json.loads(data)
                        print(f"  [{elapsed:.1f}s] event={event_type} id={event_id}")
                        print(f"    data={json.dumps(parsed, ensure_ascii=False, indent=2)[:500]}")
                    elif event_type:
                        print(f"  [{elapsed:.1f}s] event={event_type} (no data)")

    total = time.time() - start
    print("-" * 60)
    print(f"总耗时: {total:.1f}s")


if __name__ == "__main__":
    asyncio.run(test_sse())
