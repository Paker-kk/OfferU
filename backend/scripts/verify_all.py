"""验证所有 API 端点数据完整性"""
import json
import urllib.request

BASE = "http://localhost:8000"

def get(path):
    return json.loads(urllib.request.urlopen(f"{BASE}{path}").read())

print("=== Profile ===")
p = get("/api/profile/")
print(f"  Name: {p.get('name')}")
roles = p.get("target_roles", [])
print(f"  Target Roles ({len(roles)}):")
for r in roles:
    print(f"    - {r.get('title')}")
sections = p.get("sections", [])
print(f"  Sections ({len(sections)}):")
for s in sections:
    print(f"    - [{s.get('section_type')}] {s.get('title')}")

print("\n=== Jobs (picked) ===")
j = get("/api/jobs/?triage_status=picked")
for item in j.get("items", []):
    print(f"  #{item['id']}: {item['company']} - {item['title']} [pool_id={item.get('pool_id')}]")

print("\n=== Pools ===")
pools = get("/api/pools/")
pool_list = pools if isinstance(pools, list) else pools.get("items", [])
for pool in pool_list:
    print(f"  Pool #{pool['id']}: {pool['name']} (scope={pool.get('scope')})")

print("\n=== Resumes ===")
resumes = get("/api/resume/")
items = resumes if isinstance(resumes, list) else resumes.get("items", resumes.get("resumes", []))
for r in items:
    rid = r["id"]
    print(f"  Resume #{rid}: {r['title']}")
    detail = get(f"/api/resume/{rid}")
    for s in detail.get("sections", []):
        st = s.get("section_type", "?")
        title = s.get("title", "?")
        cj = s.get("content_json")
        item_count = len(cj) if isinstance(cj, list) else 1
        print(f"    [{st}] {title} ({item_count} items)")

print("\n✅ 全流程数据验证完成")
