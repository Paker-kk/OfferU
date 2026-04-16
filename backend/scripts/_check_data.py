"""Quick data check for Profile + Jobs before optimize E2E test."""
import requests, json

BASE = "http://localhost:8000/api"

# Check profile
p = requests.get(f"{BASE}/profile/").json()
sections = p.get("sections", [])
print(f"=== Profile id={p.get('id')} name={p.get('name')} sections={len(sections)} ===")
for s in sections:
    cj = s.get("content_json", {})
    bullets = cj if isinstance(cj, list) else [cj]
    text = str(bullets[0])[:80] if bullets else "EMPTY"
    print(f"  [{s['section_type']}] {s['title']}: {text}...")

# Check jobs (picked)
j = requests.get(f"{BASE}/jobs/?page_size=10&triage_status=picked").json()
items = j.get("items", [])
print(f"\n=== Jobs (picked) total={j.get('total', 0)} ===")
for job in items:
    desc = (job.get("raw_description") or "")[:60]
    print(f"  id={job['id']} {job['company']} - {job['title']}: {desc}...")

# Check all jobs if no picked
if not items:
    j2 = requests.get(f"{BASE}/jobs/?page_size=10").json()
    items2 = j2.get("items", [])
    print(f"\n=== All Jobs total={j2.get('total', 0)} ===")
    for job in items2:
        print(f"  id={job['id']} [{job.get('triage_status')}] {job['company']} - {job['title']}")
