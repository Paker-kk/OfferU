"""
测试 /api/optimize/generate — per_job 模式
为 3 个 picked 岗位各生成一份定制简历
"""
import json
import urllib.request

BASE = "http://localhost:8000"


def api_get(path):
    req = urllib.request.Request(f"{BASE}{path}")
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


# 1. 取出 picked 岗位 IDs
jobs = api_get("/api/jobs/?triage_status=picked")
job_ids = [j["id"] for j in jobs["items"]]
print(f"Picked jobs: {job_ids}")

if not job_ids:
    print("没有 picked 状态的岗位，请先运行 seed_jobs.py")
    exit(1)

# 2. 调用 SSE /generate
payload = json.dumps({"job_ids": job_ids, "mode": "per_job"}, ensure_ascii=False).encode()
req = urllib.request.Request(
    f"{BASE}/api/optimize/generate",
    data=payload,
    headers={"Content-Type": "application/json", "Accept": "text/event-stream"},
    method="POST",
)

print("\n=== SSE Stream ===")
with urllib.request.urlopen(req) as resp:
    buffer = ""
    for line in resp:
        decoded = line.decode("utf-8")
        buffer += decoded
        # SSE 事件以空行分隔
        while "\n\n" in buffer:
            block, buffer = buffer.split("\n\n", 1)
            event_type = None
            data_str = None
            for l in block.strip().split("\n"):
                if l.startswith("event: "):
                    event_type = l[7:]
                elif l.startswith("data: "):
                    data_str = l[6:]
            if event_type and data_str:
                data = json.loads(data_str)
                if event_type == "heartbeat":
                    continue
                print(f"[{event_type}] {json.dumps(data, ensure_ascii=False, indent=2)}")

# 3. 验证生成的简历
print("\n=== 检查生成的简历 ===")
resumes = api_get("/api/resume/")
if isinstance(resumes, list):
    items = resumes
elif isinstance(resumes, dict):
    items = resumes.get("items") or resumes.get("resumes") or []
else:
    items = []

for r in items:
    rid = r.get("id")
    title = r.get("title")
    sections = r.get("sections_count") or r.get("sections") or "?"
    print(f"  Resume #{rid}: {title} (sections: {sections})")

print(f"\n✅ 共生成 {len(items)} 份简历")
