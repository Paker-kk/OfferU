"""Quick test of optimize/generate with tier — SSE endpoint."""
import os
os.environ["NO_PROXY"] = "*"

import requests
import json

r = requests.post(
    "http://127.0.0.1:8000/api/optimize/generate",
    json={"job_ids": [1], "pool_name": "AIGC方向"},
    timeout=180,
    stream=True,
)
print(f"Status: {r.status_code}")

current_event = None
for line in r.iter_lines(decode_unicode=True):
    if not line:
        current_event = None
        continue
    if line.startswith("event: "):
        current_event = line[7:].strip()
        continue
    if line.startswith("data: "):
        payload = line[6:]
        try:
            data = json.loads(payload)
        except json.JSONDecodeError:
            data = payload[:100]
        
        evt = current_event or "?"
        if evt == "result":
            print(f"\n[RESULT] resume_id={data.get('resume_id')}")
            print(f"  missing_keywords: {data.get('missing_keywords', [])[:5]}")
            print(f"  profile_hit_ratio: {data.get('profile_hit_ratio')}")
            used = data.get("used_bullets", [])
            print(f"  used_bullets: {len(used)} sections")
        elif evt == "done":
            print(f"\n[DONE] created={data.get('created')}, failed={data.get('failed')}")
            print(f"  resume_ids: {data.get('resume_ids')}")
        elif evt == "error":
            print(f"\n[ERROR] {data}")
        elif evt == "progress":
            status = data.get("status", "?")
            print(f"  [progress] job#{data.get('job_id','')} {status}")
        elif evt == "heartbeat":
            print("  [heartbeat]")
        else:
            print(f"  [{evt}] {str(data)[:100]}")

print("\nDone!")
