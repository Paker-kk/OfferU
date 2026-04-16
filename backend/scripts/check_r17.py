import httpx, json

r = httpx.get("http://127.0.0.1:8000/api/resume/17", timeout=10)
d = r.json()
print(json.dumps(d, ensure_ascii=False, indent=2)[:5000])
