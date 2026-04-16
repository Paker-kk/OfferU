"""检查简历 #4 的实际内容"""
import json
import urllib.request

r = json.loads(urllib.request.urlopen("http://localhost:8000/api/resume/4").read())
print(f"Resume: {r.get('title')}")
print(f"Summary: {r.get('summary', '')[:100]}")
print()
for s in r.get("sections", []):
    cj = s.get("content_json", [])
    print(f"[{s['section_type']}] {s['title']}")
    if isinstance(cj, list):
        for item in cj:
            desc = item.get("description", "")
            name = (item.get("school") or item.get("company") or 
                    item.get("name") or item.get("category") or "?")
            print(f"  {name}:")
            if desc:
                for line in desc.split("\n")[:3]:
                    print(f"    {line[:100]}")
            items_list = item.get("items")
            if items_list:
                print(f"    items: {items_list[:5]}")
    print()
