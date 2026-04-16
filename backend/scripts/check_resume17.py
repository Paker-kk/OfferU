import httpx, json

with httpx.Client(timeout=30) as c:
    r = c.get("http://127.0.0.1:8000/api/resumes/17")
    resume = r.json()
    sections = resume.get("sections", [])
    print("Resume #17 -", resume.get("title", ""))
    print("Sections:", len(sections))
    for s in sections:
        title = s.get("title", "?")
        items = s.get("items", [])
        print(f"  [{title}] {len(items)} items")
        for item in items[:2]:
            bullets = item.get("bullets", [])
            pt = str(item.get("primary_text", ""))[:80]
            print(f"    primary: {pt}")
            for b in bullets[:2]:
                print(f"      - {str(b)[:90]}")
