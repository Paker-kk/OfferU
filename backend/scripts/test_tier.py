"""Quick E2E test: optimize/generate with tier=premium LLM rewrite."""
import requests, json

r = requests.post(
    "http://localhost:8000/api/optimize/generate",
    json={"job_ids": [1], "pool_name": "AIGC方向"},
)
print("Status:", r.status_code)
d = r.json()
resumes = d.get("resumes", [])
print(f"Resumes generated: {len(resumes)}")

for res in resumes:
    print(f"\n--- Resume #{res.get('id')} for job #{res.get('job_id')} ---")
    for sec in res.get("sections", []):
        content = sec["content"]
        print(f"  [{sec['section_type']}] {content[:120]}...")
