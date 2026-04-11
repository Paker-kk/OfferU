# -*- coding: utf-8 -*-
"""
Phase 1 补充测试 — Jobs 扩展 + Scraper batch_id + Optimize 生成
"""
import httpx
import json
import time

BASE = "http://127.0.0.1:8000/api"
passed = 0
failed = 0
client = httpx.Client(follow_redirects=True, timeout=120)


def test(name, fn):
    global passed, failed
    try:
        fn()
        print(f"  \u2705 {name}")
        passed += 1
    except Exception as e:
        print(f"  \u274c {name}: {e}")
        failed += 1


# =======================
# 1. Jobs 路由扩展测试
# =======================
print("\n=== 1. Jobs \u8def\u7531\u6269\u5c55 ===")


def test_ingest():
    r = client.post(f"{BASE}/jobs/ingest", json={
        "jobs": [
            {
                "title": "\u4ea7\u54c1\u8fd0\u8425\u5b9e\u4e60\u751f",
                "company": "\u817e\u8baf",
                "location": "\u6df1\u5733",
                "source": "boss",
                "hash_key": f"test_p1ext_tencent_{int(time.time())}",
                "raw_description": "\u8d1f\u8d23\u4ea7\u54c1\u8fd0\u8425\u7b56\u5212\uff0c\u6570\u636e\u5206\u6790\uff0c\u7528\u6237\u589e\u957f\uff0c\u5185\u5bb9\u7b56\u5212\uff0c\u6d3b\u52a8\u8fd0\u8425",
            },
            {
                "title": "\u5185\u5bb9\u7f16\u8f91",
                "company": "\u5b57\u8282\u8df3\u52a8",
                "location": "\u5317\u4eac",
                "source": "zhilian",
                "hash_key": f"test_p1ext_bytedance_{int(time.time())}",
                "raw_description": "\u8d1f\u8d23\u77ed\u89c6\u9891\u5185\u5bb9\u5ba1\u6838\u4e0e\u7f16\u8f91\uff0c\u9700\u8981\u6709\u6587\u5b57\u529f\u5e95\uff0c\u719f\u6089\u65b0\u5a92\u4f53\u8fd0\u8425",
            },
        ]
    })
    assert r.status_code == 200, f"ingest failed: {r.text}"
    data = r.json()
    assert data["created"] >= 0


test("1a. \u521b\u5efa\u6d4b\u8bd5\u5c97\u4f4d", test_ingest)


def test_triage_filter():
    r = client.get(f"{BASE}/jobs/", params={"triage_status": "unscreened"})
    assert r.status_code == 200
    data = r.json()
    assert "items" in data
    for item in data["items"]:
        assert item["triage_status"] == "unscreened"


test("1b. triage_status \u7b5b\u9009", test_triage_filter)


def test_pool_null_filter():
    r = client.get(f"{BASE}/jobs/", params={"pool_id": "null"})
    assert r.status_code == 200
    data = r.json()
    for item in data["items"]:
        assert item["pool_id"] is None


test("1c. pool_id=null \u7b5b\u9009", test_pool_null_filter)


def test_single_triage():
    r = client.get(f"{BASE}/jobs/", params={"page_size": 1})
    items = r.json()["items"]
    assert len(items) > 0
    job_id = items[0]["id"]
    r = client.patch(f"{BASE}/jobs/{job_id}", json={"triage_status": "screened"})
    assert r.status_code == 200
    data = r.json()
    assert data["triage_status"] == "screened"
    client.patch(f"{BASE}/jobs/{job_id}", json={"triage_status": "unscreened"})


test("1d. \u5355\u4e2a\u5c97\u4f4d\u5206\u62e3", test_single_triage)


def test_batch_triage():
    r = client.get(f"{BASE}/jobs/", params={"page_size": 2})
    items = r.json()["items"]
    if len(items) < 2:
        return
    job_ids = [items[0]["id"], items[1]["id"]]
    r = client.patch(f"{BASE}/jobs/batch-triage", json={
        "job_ids": job_ids,
        "triage_status": "ignored",
    })
    assert r.status_code == 200
    assert r.json()["updated"] >= 1
    r = client.get(f"{BASE}/jobs/{job_ids[0]}")
    assert r.json()["triage_status"] == "ignored"
    client.patch(f"{BASE}/jobs/batch-triage", json={
        "job_ids": job_ids,
        "triage_status": "unscreened",
    })


test("1e. \u6279\u91cf\u5206\u62e3", test_batch_triage)


def test_pool_assign():
    r = client.post(f"{BASE}/pools/", json={"name": "\u6d4b\u8bd5\u6c60-P1\u6269\u5c55"})
    assert r.status_code == 201, f"create pool: {r.status_code} {r.text}"
    pool_id = r.json()["id"]
    r = client.get(f"{BASE}/jobs/", params={"page_size": 1})
    job_id = r.json()["items"][0]["id"]
    r = client.patch(f"{BASE}/jobs/{job_id}", json={"pool_id": pool_id})
    assert r.status_code == 200
    assert r.json()["pool_id"] == pool_id
    r = client.get(f"{BASE}/jobs/", params={"pool_id": str(pool_id)})
    assert r.status_code == 200
    for item in r.json()["items"]:
        assert item["pool_id"] == pool_id
    client.patch(f"{BASE}/jobs/{job_id}", json={"pool_id": 0})
    client.delete(f"{BASE}/pools/{pool_id}")


test("1f. \u6c60\u5206\u914d + \u7b5b\u9009", test_pool_assign)


def test_batches_list():
    r = client.get(f"{BASE}/jobs/batches")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


test("1g. \u6279\u6b21\u5217\u8868", test_batches_list)


# =======================
# 2. Optimize 生成测试
# =======================
print("\n=== 2. Optimize \u751f\u6210 ===")


def test_optimize_profile_ready():
    r = client.get(f"{BASE}/profile/")
    assert r.status_code == 200
    data = r.json()
    if data["stats"]["total_bullets"] == 0:
        client.post(f"{BASE}/profile/sections", json={
            "section_type": "internship",
            "title": "\u516c\u4f17\u53f7\u8fd0\u8425\u5b9e\u4e60\u751f",
            "content_json": {
                "organization": "\u67d0\u4e92\u8054\u7f51\u516c\u53f8",
                "role": "\u8fd0\u8425\u5b9e\u4e60\u751f",
                "description": "\u8d1f\u8d23\u5fae\u4fe1\u516c\u4f17\u53f7\u65e5\u5e38\u8fd0\u8425\uff0c3\u4e2a\u6708\u539f\u521b15\u7bc7\u6587\u7ae0\uff0c\u7c89\u4e1d\u4ece500\u589e\u81f32000",
            },
        })
        client.post(f"{BASE}/profile/sections", json={
            "section_type": "project",
            "title": "\u6821\u56ed\u6587\u521b\u54c1\u724c\u7b56\u5212",
            "content_json": {
                "organization": "\u6821\u56ed\u521b\u4e1a\u9879\u76ee",
                "role": "\u9879\u76ee\u8d1f\u8d23\u4eba",
                "description": "\u7b56\u5212\u5e76\u6267\u884c\u6821\u56ed\u6587\u521b\u54c1\u724c\u8425\u9500\u6d3b\u52a8\uff0c\u5e26\u98865\u4eba\u56e2\u961f\uff0c\u6708\u9500\u552e\u989d1.5\u4e07\u5143",
            },
        })
        client.post(f"{BASE}/profile/sections", json={
            "section_type": "education",
            "title": "\u6c49\u8bed\u8a00\u6587\u5b66",
            "content_json": {
                "organization": "\u5317\u4eac\u8bed\u8a00\u5927\u5b66",
                "role": "\u672c\u79d1\u751f",
                "description": "GPA 3.6/4.0\uff0c\u4f18\u79c0\u6bd5\u4e1a\u8bba\u6587\uff0c\u6821\u7ea7\u5956\u5b66\u91d1",
            },
        })
    r = client.get(f"{BASE}/profile/")
    assert r.json()["stats"]["total_bullets"] >= 3


test("2a. Profile \u6709\u8db3\u591f\u6761\u76ee", test_optimize_profile_ready)


def test_optimize_per_job():
    r = client.get(f"{BASE}/jobs/", params={"page_size": 1})
    items = r.json()["items"]
    assert len(items) >= 1
    job_ids = [items[0]["id"]]

    with client.stream("POST", f"{BASE}/optimize/generate",
                        json={"job_ids": job_ids, "mode": "per_job"}) as response:
        assert response.status_code == 200
        events = []
        for line in response.iter_lines():
            if line.startswith("data:"):
                raw = line[len("data:"):].strip()
                if raw:
                    try:
                        evt = json.loads(raw)
                        events.append(evt)
                    except json.JSONDecodeError:
                        pass

        event_types = [e.get("event") for e in events]
        print(f"    \u4e8b\u4ef6: {event_types}")
        assert "done" in event_types, f"\u7f3a\u5c11 done: {event_types}"

        results = [e for e in events if e.get("event") == "result"]
        if results:
            r0 = results[0]["data"]
            print(f"    \u7b80\u5386: {r0.get('resume_title', r0.get('error', 'N/A'))}")
            if r0.get("resume_id"):
                print(f"    \u547d\u4e2d bullets: {r0.get('used_bullets', 'N/A')}")
                print(f"    \u7f3a\u5931\u80fd\u529b: {r0.get('missing_capabilities', [])}")


test("2b. \u9010\u5c97\u4f4d\u751f\u6210 (SSE)", test_optimize_per_job)


def test_optimize_combined():
    r = client.get(f"{BASE}/jobs/", params={"page_size": 2})
    items = r.json()["items"]
    if len(items) < 2:
        return
    job_ids = [items[0]["id"], items[1]["id"]]

    with client.stream("POST", f"{BASE}/optimize/generate",
                        json={"job_ids": job_ids, "mode": "combined"}) as response:
        assert response.status_code == 200
        events = []
        for line in response.iter_lines():
            if line.startswith("data:"):
                raw = line[len("data:"):].strip()
                if raw:
                    try:
                        events.append(json.loads(raw))
                    except json.JSONDecodeError:
                        pass

        event_types = [e.get("event") for e in events]
        print(f"    \u4e8b\u4ef6: {event_types}")
        assert "done" in event_types

        results = [e for e in events if e.get("event") == "result"]
        if results:
            r0 = results[0]["data"]
            print(f"    \u7b80\u5386: {r0.get('resume_title', r0.get('error', 'N/A'))}")


test("2c. \u7efc\u5408\u6a21\u5f0f\u751f\u6210", test_optimize_combined)


# =======================
# 汇总
# =======================
print(f"\n{'='*40}")
print(f"Phase 1 \u8865\u5145\u6d4b\u8bd5: {passed} \u901a\u8fc7 / {failed} \u5931\u8d25")
print(f"{'='*40}")
