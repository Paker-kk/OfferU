"""Quick test of optimize/generate with tier."""
import os
os.environ["NO_PROXY"] = "*"

import requests
import json

r = requests.post(
    "http://127.0.0.1:8000/api/optimize/generate",
    json={"job_ids": [1], "pool_name": "AIGC方向"},
    timeout=120,
)
print(f"Status: {r.status_code}")
print(f"Content-Type: {r.headers.get('content-type')}")
text = r.text[:2000]
print(f"Body preview: {text}")

if r.status_code == 200:
    try:
        d = r.json()
        resumes = d.get("resumes", [])
        print(f"\nResumes: {len(resumes)}")
        for res in resumes:
            print(f"\n--- Resume #{res.get('id')} ---")
            for sec in res.get("sections", []):
                print(f"  [{sec['section_type']}] {sec['content'][:120]}")
    except Exception as e:
        print(f"JSON parse error: {e}")
