"""Check resume #12 content."""
import os
os.environ["NO_PROXY"] = "*"
import requests

r = requests.get("http://127.0.0.1:8000/api/resume/14")
d = r.json()
print(f"Resume #{d['id']}: {d['title']}")
print(f"Summary: {d.get('summary', '')[:100]}")
for s in d.get("sections", []):
    print(f"\n[{s['section_type']}] sort={s['sort_order']}")
    content = s.get("content") or s.get("content_json") or s
    if isinstance(content, dict):
        import json
        print(f"  {json.dumps(content, ensure_ascii=False)[:300]}")
    else:
        print(f"  {str(content)[:300]}")
    print(f"  Keys: {list(s.keys())}")
