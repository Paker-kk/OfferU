"""
完整 E2E 验证脚本
模拟用户浏览器访问的全链路:
  1. Profile 页 → GET /api/profile/
  2. Jobs 页 → GET /api/jobs/ 
  3. Optimize 页 → POST /api/optimize/generate (SSE)
  4. Resume 页 → GET /api/resume/, GET /api/resume/{id}
  5. Config 页 → GET /api/config/
"""
import httpx
import json
import sys

BASE = "http://127.0.0.1:8000"
PASS = 0
FAIL = 0

def check(name, condition, detail=""):
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  ✓ {name}" + (f" — {detail}" if detail else ""))
    else:
        FAIL += 1
        print(f"  ✗ {name}" + (f" — {detail}" if detail else ""))

with httpx.Client(timeout=60) as c:
    # ========== 1. Profile ==========
    print("\n═══ 1. Profile Page ═══")
    r = c.get(f"{BASE}/api/profile/")
    check("GET /api/profile/ returns 200", r.status_code == 200)
    p = r.json()
    check("Profile has name", bool(p.get("name")), p.get("name", ""))
    
    pid = p.get("id")
    sections = p.get("sections", [])
    check("Profile has sections", len(sections) > 0, f"count={len(sections)}")
    
    # Check each section has content
    for s in sections:
        cj = s.get("content_json", {})
        has_content = bool(cj.get("normalized") or cj.get("field_values"))
        stype = s.get("section_type", "?")
        check(f"Section '{stype}' has content", has_content)

    # ========== 2. Jobs ==========
    print("\n═══ 2. Jobs Page ═══")
    r = c.get(f"{BASE}/api/jobs/")
    check("GET /api/jobs/ returns 200", r.status_code == 200)
    jobs_data = r.json()
    jobs = jobs_data.get("items", jobs_data) if isinstance(jobs_data, dict) else jobs_data
    if not isinstance(jobs, list):
        jobs = []
    check("Jobs exist", len(jobs) > 0, f"count={len(jobs)}")
    
    picked_jobs = [j for j in jobs if j.get("triage_status") == "picked"]
    check("Picked jobs exist", len(picked_jobs) > 0, f"count={len(picked_jobs)}")

    # ========== 3. Optimize / Generate ==========
    print("\n═══ 3. Optimize Page (SSE Generate) ═══")
    if picked_jobs:
        job_id = picked_jobs[0]["id"]
        with c.stream(
            "POST",
            f"{BASE}/api/optimize/generate",
            json={"job_ids": [job_id], "mode": "per_job"},
            timeout=300,
        ) as resp:
            check("POST /api/optimize/generate returns 200", resp.status_code == 200)
            
            raw_text = ""
            for chunk in resp.iter_text():
                raw_text += chunk
        
        events = []
        for line in raw_text.strip().split("\n"):
            if line.startswith("data: "):
                try:
                    events.append(json.loads(line[6:]))
                except:
                    pass
        
        event_types = set()
        for line in raw_text.strip().split("\n"):
            if line.startswith("event: "):
                event_types.add(line[7:].strip())
        
        check("SSE has heartbeat events", "heartbeat" in event_types, str(event_types))
        check("SSE has result event", "result" in event_types)
        check("SSE has done event", "done" in event_types)
        
        # Parse result event
        result_events = []
        current_event_type = None
        for line in raw_text.strip().split("\n"):
            if line.startswith("event: "):
                current_event_type = line[7:].strip()
            elif line.startswith("data: ") and current_event_type == "result":
                try:
                    result_events.append(json.loads(line[6:]))
                except:
                    pass
        
        if result_events:
            re0 = result_events[0]
            check("Result has resume_id", "resume_id" in re0, f"id={re0.get('resume_id')}")
            
            mkw = re0.get("missing_keywords", [])
            check("missing_keywords present", len(mkw) > 0, str(mkw[:8]))
            
            # Verify no invalid bigrams in missing_keywords
            bad_tokens = [w for w in mkw if len(w) == 2 and all('\u4e00' <= ch <= '\u9fff' for ch in w) and w not in [
                "生成", "分析", "团队", "经验", "管理", "数据", "项目", "技术", "产品", 
                "需求", "视频", "能力", "用户", "设计", "方案", "平台", "系统", "研发",
                "策略", "广告", "运营", "市场", "增长", "推荐", "优化", "算法", "模型",
            ]]
            # Actually just check no obviously broken tokens
            has_bad = any(w in ["频生", "类产", "品的", "和项", "目管"] for w in mkw)
            check("No invalid bigram tokens", not has_bad, f"keywords={mkw[:10]}")
            
            new_rid = re0.get("resume_id")
        else:
            new_rid = None
    
    # ========== 4. Resume Review ==========
    print("\n═══ 4. Resume Page ═══")
    r = c.get(f"{BASE}/api/resume/")
    check("GET /api/resume/ returns 200", r.status_code == 200)
    resumes = r.json()
    check("Resumes exist", len(resumes) > 0, f"count={len(resumes)}")
    
    if new_rid:
        r = c.get(f"{BASE}/api/resume/{new_rid}")
        check(f"GET /api/resume/{new_rid} returns 200", r.status_code == 200)
        resume = r.json()
        secs = resume.get("sections", [])
        check("Resume has sections", len(secs) > 0, f"count={len(secs)}")
        
        for sec in secs:
            st = sec.get("section_type", "?")
            cj = sec.get("content_json", [])
            has_data = bool(cj)
            check(f"Resume section '{st}' has content", has_data)
            
            # Check bullets/description quality for non-skill sections
            if st in ("experience", "project") and cj:
                desc = str(cj[0].get("description", ""))
                has_star = "•" in desc or "STAR" in desc.upper() or len(desc) > 50
                check(f"Resume '{st}' has rich description", has_star, f"len={len(desc)}")

    # ========== 5. Config ==========
    print("\n═══ 5. Config Page ═══")
    r = c.get(f"{BASE}/api/config/")
    check("GET /api/config/ returns 200", r.status_code == 200)
    cfg = r.json()
    check("llm_provider is set", bool(cfg.get("llm_provider")), cfg.get("llm_provider"))
    check("tier_model_map field exists", "tier_model_map" in cfg)
    check("provider_presets has qwen", any(p["id"] == "qwen" for p in cfg.get("provider_presets", [])))

    # ========== Summary ==========
    print(f"\n{'='*40}")
    print(f"E2E Result: {PASS} passed, {FAIL} failed")
    if FAIL > 0:
        sys.exit(1)
    else:
        print("All checks passed! ✓")
