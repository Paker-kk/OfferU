"""Performance test for backend API endpoints"""
import time
import requests

BASE = "http://localhost:8000"

endpoints = [
    "/api/jobs/?page=1&period=week",
    "/api/jobs/stats?period=week",
    "/api/jobs/trend?period=week",
    "/api/resume/",
    "/api/config",
]

print("=== Backend API Performance Test ===\n")
for ep in endpoints:
    url = BASE + ep
    t0 = time.time()
    try:
        r = requests.get(url)
        dt = (time.time() - t0) * 1000
        size = len(r.content)
        print(f"  {ep}")
        print(f"    Status: {r.status_code}  Time: {dt:.0f}ms  Size: {size} bytes")
    except Exception as e:
        print(f"  {ep} -> ERROR: {e}")
    print()
