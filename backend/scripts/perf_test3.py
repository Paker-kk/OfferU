"""Test: localhost vs 127.0.0.1 — DNS resolution delay?"""
import time
import requests

# Test with localhost
print("=== localhost ===")
t0 = time.time()
r = requests.get("http://localhost:8000/api/config")
print(f"  Time: {(time.time()-t0)*1000:.0f}ms")

# Test with 127.0.0.1
print("\n=== 127.0.0.1 ===")
t0 = time.time()
r = requests.get("http://127.0.0.1:8000/api/config")
print(f"  Time: {(time.time()-t0)*1000:.0f}ms")

# Test: does the server listen on IPv6?
print("\n=== [::1] (IPv6) ===")
t0 = time.time()
try:
    r = requests.get("http://[::1]:8000/api/config", timeout=3)
    print(f"  Time: {(time.time()-t0)*1000:.0f}ms (status={r.status_code})")
except Exception as e:
    print(f"  Time: {(time.time()-t0)*1000:.0f}ms ERROR: {e}")

# DNS resolution check
print("\n=== DNS lookup for 'localhost' ===")
import socket
t0 = time.time()
try:
    results = socket.getaddrinfo("localhost", 8000)
    dt = (time.time()-t0)*1000
    print(f"  Time: {dt:.0f}ms")
    for r in results:
        print(f"  {r[0].name}: {r[4]}")
except Exception as e:
    print(f"  ERROR: {e}")
