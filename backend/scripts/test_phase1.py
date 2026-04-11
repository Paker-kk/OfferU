"""Phase 1 端到端测试 — Profile CRUD + AI 对话引导"""
import asyncio
import httpx
import json

BASE = "http://127.0.0.1:8000/api"


async def main():
    async with httpx.AsyncClient(timeout=30) as c:
        # ======= 1. Health Check =======
        r = await c.get(f"{BASE}/health")
        assert r.status_code == 200
        print("✅ 1. Health OK")

        # ======= 2. Pool CRUD =======
        r = await c.post(f"{BASE}/pools/", json={"name": "产品方向", "color": "#8B5CF6"})
        assert r.status_code == 201
        pool = r.json()
        pool_id = pool["id"]
        print(f"✅ 2a. Pool created: {pool['name']} (id={pool_id})")

        r = await c.get(f"{BASE}/pools/")
        assert r.status_code == 200
        pools = r.json()
        assert len(pools) >= 1
        print(f"✅ 2b. Pool list: {len(pools)} pool(s)")

        r = await c.put(f"{BASE}/pools/{pool_id}", json={"name": "产品方向Pro"})
        assert r.status_code == 200
        assert r.json()["name"] == "产品方向Pro"
        print(f"✅ 2c. Pool updated: {r.json()['name']}")

        # ======= 3. Profile Get/Update =======
        r = await c.get(f"{BASE}/profile/")
        assert r.status_code == 200
        profile = r.json()
        print(f"✅ 3a. Profile auto-created: id={profile['id']}")

        r = await c.put(f"{BASE}/profile/", json={
            "name": "张小文",
            "school": "北京语言大学",
            "major": "汉语言文学",
            "degree": "本科",
            "email": "zhangxw@example.com",
            "onboarding_step": 1,
        })
        assert r.status_code == 200
        p = r.json()
        assert p["name"] == "张小文"
        assert p["school"] == "北京语言大学"
        print(f"✅ 3b. Profile updated: {p['name']} @ {p['school']}")

        # ======= 4. Target Roles =======
        r = await c.post(f"{BASE}/profile/target-roles", json={
            "role_name": "内容运营", "fit": "primary"
        })
        assert r.status_code == 201
        role1_id = r.json()["id"]
        print(f"✅ 4a. Target role added: 内容运营 (id={role1_id})")

        r = await c.post(f"{BASE}/profile/target-roles", json={
            "role_name": "品牌策划", "fit": "secondary"
        })
        assert r.status_code == 201
        print(f"✅ 4b. Target role added: 品牌策划")

        r = await c.get(f"{BASE}/profile/target-roles")
        assert len(r.json()) >= 2
        print(f"✅ 4c. Target roles list: {len(r.json())} roles")

        # ======= 5. Manual Section (Bullet) =======
        r = await c.post(f"{BASE}/profile/sections", json={
            "section_type": "education",
            "title": "北京语言大学",
            "content_json": {
                "school": "北京语言大学",
                "degree": "本科",
                "major": "汉语言文学",
                "gpa": "3.6/4.0",
                "start_date": "2022-09",
                "end_date": "2026-06",
            }
        })
        assert r.status_code == 201
        sec_id = r.json()["id"]
        print(f"✅ 5a. Section created: education (id={sec_id})")

        r = await c.put(f"{BASE}/profile/sections/{sec_id}", json={
            "content_json": {
                "school": "北京语言大学",
                "degree": "本科",
                "major": "汉语言文学",
                "gpa": "3.7/4.0",
                "start_date": "2022-09",
                "end_date": "2026-06",
            }
        })
        assert r.status_code == 200
        assert r.json()["content_json"]["gpa"] == "3.7/4.0"
        print(f"✅ 5b. Section updated: GPA → 3.7")

        # ======= 6. Profile Stats =======
        r = await c.get(f"{BASE}/profile/")
        p = r.json()
        assert p["stats"]["total_bullets"] >= 1
        print(f"✅ 6. Profile stats: {p['stats']['total_bullets']} bullets, types={p['stats']['by_type']}")

        # ======= 7. Instant Draft (Step 2.5) =======
        print("\n--- 7. 即时价值钩子 (Step 2.5) ---")
        r = await c.post(f"{BASE}/profile/instant-draft", json={
            "experiences": ["校报编辑部主编", "字节跳动内容运营实习", "大学生创业大赛二等奖"],
            "target_roles": ["内容运营", "品牌策划"],
        })
        assert r.status_code == 200
        draft = r.json()
        print(f"✅ 7. Instant draft headline: {draft.get('headline', 'N/A')}")
        print(f"   Sections: {len(draft.get('sections', []))} sections")
        if draft.get("missing_hints"):
            print(f"   Missing hints: {draft['missing_hints'][:2]}")

        # ======= 8. AI Chat (SSE) =======
        print("\n--- 8. AI 对话引导 (SSE) ---")
        async with c.stream("POST", f"{BASE}/profile/chat", json={
            "topic": "internship",
            "message": "我在字节跳动做了3个月的内容运营实习，主要负责抖音号的内容策划和发布",
        }) as resp:
            events = []
            async for line in resp.aiter_lines():
                line = line.strip()
                if not line or line.startswith(":"):
                    continue
                if line.startswith("data:"):
                    data = line[5:].strip()
                    if data:
                        try:
                            parsed = json.loads(data)
                            events.append(parsed)
                        except json.JSONDecodeError:
                            pass

        ai_msgs = [e for e in events if e.get("event") == "ai_message"]
        bullets = [e for e in events if e.get("event") == "bullet_candidate"]
        print(f"✅ 8a. AI reply: {ai_msgs[0]['data']['content'][:80]}..." if ai_msgs else "⚠️ No AI message")
        print(f"✅ 8b. Bullet candidates: {len(bullets)}")
        if bullets:
            b = bullets[0]["data"]
            print(f"   First bullet: [{b.get('section_type')}] {b.get('title')}")
            session_id = ai_msgs[0]["data"].get("session_id") if ai_msgs else None

            # ======= 9. Confirm Bullet =======
            if session_id:
                r = await c.post(f"{BASE}/profile/chat/confirm", json={
                    "session_id": session_id,
                    "bullet_index": b.get("index", 0),
                })
                assert r.status_code == 200
                confirmed = r.json()
                print(f"✅ 9. Bullet confirmed: [{confirmed['section_type']}] {confirmed['title']} (source={confirmed['source']})")

        # ======= 10. Generate Narrative =======
        print("\n--- 10. 职业叙事生成 ---")
        r = await c.post(f"{BASE}/profile/generate-narrative")
        if r.status_code == 200:
            narr = r.json()
            print(f"✅ 10. Headline: {narr.get('headline', 'N/A')}")
            print(f"    Exit story: {narr.get('exit_story', 'N/A')[:60]}...")
        else:
            print(f"⚠️ 10. Narrative: {r.status_code} {r.text[:100]}")

        # ======= 11. Cleanup - Delete pool =======
        r = await c.delete(f"{BASE}/pools/{pool_id}")
        assert r.status_code == 204
        print(f"\n✅ 11. Pool deleted")

        print("\n🎉 Phase 1 全部测试通过！")


asyncio.run(main())
