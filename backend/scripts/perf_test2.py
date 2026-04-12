"""Deep performance diagnosis — is it proxy, DB, or middleware?"""
import time
import requests

BASE = "http://localhost:8000"

# Test 1: Direct (bypass proxy)
print("=== Test 1: With proxies={'http': None, 'https': None} ===")
t0 = time.time()
r = requests.get(f"{BASE}/api/config", proxies={"http": None, "https": None})
dt = (time.time() - t0) * 1000
print(f"  Config: {dt:.0f}ms (status={r.status_code})")

# Test 2: urllib3 direct (no requests overhead)
print("\n=== Test 2: urllib3 direct ===")
import urllib.request
t0 = time.time()
with urllib.request.urlopen(f"{BASE}/api/config") as resp:
    data = resp.read()
dt = (time.time() - t0) * 1000
print(f"  Config: {dt:.0f}ms (size={len(data)})")

# Test 3: Multiple rapid requests (connection reuse)
print("\n=== Test 3: 5 rapid requests with Session ===")
s = requests.Session()
s.proxies = {"http": None, "https": None}
for i in range(5):
    t0 = time.time()
    r = s.get(f"{BASE}/api/config")
    dt = (time.time() - t0) * 1000
    print(f"  Request {i+1}: {dt:.0f}ms")

# Test 4: FastAPI docs (no DB involved)
print("\n=== Test 4: /docs (no DB) ===")
t0 = time.time()
r = requests.get(f"{BASE}/docs", proxies={"http": None, "https": None})
dt = (time.time() - t0) * 1000
print(f"  /docs: {dt:.0f}ms (status={r.status_code})")
