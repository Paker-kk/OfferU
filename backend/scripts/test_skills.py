"""
Skill 全栈测试 — 验证 4 类核心功能
===========================================
1. SkillPipeline (JDAnalyzer → ResumeMatcher → ContentRewriter → SectionReorder)
2. Resume Generation (Profile 驱动 LLM 改写)
3. 面经模块 (collect → extract → generate-answer)
4. Interview 面经题库 CRUD
===========================================
前置条件: 后端运行在 http://localhost:8000,
          数据库中已有 Profile (id=1) + Job (>=1条)
"""

import asyncio
import json
import sys
import time
import httpx

BASE = "http://localhost:8000"
PASS = 0
FAIL = 0
SKIP = 0
results: list[tuple[str, str, str]] = []


def log(tag: str, msg: str):
    icon = {"PASS": "✅", "FAIL": "❌", "SKIP": "⏭️", "INFO": "ℹ️"}.get(tag, "  ")
    print(f"  {icon} [{tag}] {msg}")


def check(label: str, ok: bool, detail: str = ""):
    global PASS, FAIL
    if ok:
        PASS += 1
        log("PASS", label)
        results.append((label, "PASS", detail))
    else:
        FAIL += 1
        log("FAIL", f"{label} — {detail}")
        results.append((label, "FAIL", detail))
    return ok


def skip(label: str, reason: str):
    global SKIP
    SKIP += 1
    log("SKIP", f"{label} — {reason}")
    results.append((label, "SKIP", reason))


async def main():
    global PASS, FAIL, SKIP

    async with httpx.AsyncClient(base_url=BASE, timeout=360, follow_redirects=True) as c:

        # ── 0. 连通性 ──
        print("\n═══ 0. 连通性检查 ═══")
        r = await c.get("/docs")
        check("后端连通", r.status_code == 200, f"status={r.status_code}")

        # ── 获取测试数据 ──
        r = await c.get("/api/profile/")
        profile = r.json() if r.status_code == 200 else None
        check("Profile 存在", profile is not None and "id" in (profile if isinstance(profile, dict) else {}),
              f"status={r.status_code}")

        r = await c.get("/api/jobs/")
        jobs_resp = r.json() if r.status_code == 200 else {}
        jobs = jobs_resp.get("items", []) if isinstance(jobs_resp, dict) else []
        check("Jobs 存在", len(jobs) >= 1, f"count={len(jobs)}")

        job_id = jobs[0]["id"] if jobs else None
        jd_text = jobs[0].get("raw_description", "") if jobs else ""

        # ── 1. SkillPipeline 测试 (粘贴文本模式) ──
        print("\n═══ 1. SkillPipeline (ai/analyze-text) ═══")
        RESUME_TEXT = """
示例候选人
示例大学 软件工程 本科 2025届
GPA: 3.5/4.0
实习经历:
    示例科技公司 — AI应用研发实习生 (2024.07 - 2024.12)
    - 负责 AI 内容生成平台后端开发（FastAPI + PostgreSQL）
    - 开发工作流编排模块，批处理耗时降低 40%
    - 优化推理服务，日处理请求从 500 提升至 2000
项目经历:
    OfferU — 全栈开发 (2025.01 - now)
    - 开发 AI 驱动的岗位聚合、简历优化、面经分析平台
    - 技术栈: Next.js 14 + FastAPI + SQLite + Qwen LLM API
    - 实现 Profile→简历生成→ATS 评分全链路
技能:
    Python, TypeScript, FastAPI, Next.js, Docker, Git, 工作流编排
"""
        if jd_text:
            log("INFO", f"使用 JD: {jd_text[:60]}...")
            t0 = time.time()
            try:
                r = await c.post("/api/resume/ai/analyze-text", json={
                    "resume_text": RESUME_TEXT,
                    "jd_text": jd_text[:4000],
                })
            except httpx.ReadTimeout:
                check("analyze-text 超时", False, "LLM 调用超时 (>360s)")
                r = None
            elapsed = time.time() - t0
            log("INFO", f"耗时 {elapsed:.1f}s")

            if r and check("analyze-text 状态码", r.status_code == 200, f"status={r.status_code}, body={r.text[:200]}"):
                data = r.json()

                # Skill 1: JD Analysis
                jd_a = data.get("jd_analysis", {})
                check("Skill1: jd_analysis 存在", bool(jd_a), str(list(jd_a.keys()))[:100])
                check("Skill1: required_skills", isinstance(jd_a.get("required_skills"), list),
                      str(jd_a.get("required_skills", []))[:100])
                check("Skill1: is_campus 字段", "is_campus" in jd_a, str(jd_a.get("is_campus")))

                # Skill 2: Match Analysis
                ma = data.get("match_analysis", {})
                check("Skill2: match_analysis 存在", bool(ma), str(list(ma.keys()))[:100])
                # match_analysis may have error if LLM failed for this skill
                if isinstance(ma.get("error"), str):
                    check("Skill2: match_analysis LLM", False, f"error={ma['error']}")
                else:
                    check("Skill2: ats_score 0-100", isinstance(ma.get("ats_score"), (int, float))
                          and 0 <= ma["ats_score"] <= 100, f"ats_score={ma.get('ats_score')}")
                    check("Skill2: matched_skills", isinstance(ma.get("matched_skills"), list),
                          str(ma.get("matched_skills", []))[:100])
                    check("Skill2: section_scores", isinstance(ma.get("section_scores"), list),
                          f"count={len(ma.get('section_scores', []))}")

                # Skill 3: Content Rewrite
                cr = data.get("content_rewrite", {})
                check("Skill3: content_rewrite 存在", bool(cr), str(list(cr.keys()))[:100])
                suggestions = cr.get("suggestions", [])
                check("Skill3: suggestions 列表", isinstance(suggestions, list),
                      f"count={len(suggestions)}")
                if suggestions:
                    s0 = suggestions[0]
                    check("Skill3: suggestion 有 type", "type" in s0,
                          str(s0.get("type")))
                    check("Skill3: suggestion 有 suggested", "suggested" in s0,
                          str(s0.get("suggested", ""))[:80])

                # Skill 4: Section Reorder
                sr = data.get("section_reorder", {})
                check("Skill4: section_reorder 存在", bool(sr), str(list(sr.keys()))[:100])
                check("Skill4: suggested_order", isinstance(sr.get("suggested_order"), list),
                      str(sr.get("suggested_order", []))[:100])
        else:
            skip("SkillPipeline 全部", "无 JD 数据")

        # ── 2. Resume Generation (SSE 流式) ──
        print("\n═══ 2. Resume Generation (SSE) ═══")
        if job_id:
            t0 = time.time()
            try:
                r = await c.post("/api/optimize/generate", json={
                    "job_ids": [job_id],
                    "mode": "per_job",
                })
            except httpx.ReadTimeout:
                check("generate 超时", False, "SSE 流超时 (>360s)")
                r = None
            elapsed = time.time() - t0
            log("INFO", f"耗时 {elapsed:.1f}s")

            if r and check("generate 状态码 200", r.status_code == 200, f"status={r.status_code}"):
                # SSE 返回的是 text/event-stream
                body = r.text
                check("SSE 有 event 数据", "data:" in body or "event:" in body or "{" in body,
                      f"body_len={len(body)}, preview={body[:200]}")

                # 解析 SSE: "event: xxx\ndata: {...}\n\n"
                sse_events: list[tuple[str, dict]] = []
                lines = body.split("\n")
                cur_event = ""
                for line in lines:
                    line = line.strip()
                    if line.startswith("event:"):
                        cur_event = line[6:].strip()
                    elif line.startswith("data:"):
                        try:
                            payload = json.loads(line[5:].strip())
                            sse_events.append((cur_event, payload))
                        except json.JSONDecodeError:
                            pass
                        cur_event = ""

                check("SSE 事件解析", len(sse_events) >= 1, f"event_count={len(sse_events)}")

                event_types = [e[0] for e in sse_events]
                has_result = any(t in ("result", "done", "progress") for t in event_types)
                check("SSE 有 result/done/progress", has_result,
                      f"types={event_types[:5]}")

                errors = [(t, p) for t, p in sse_events if t == "error"]
                check("SSE 无 error 事件", len(errors) == 0,
                      f"errors={[p.get('message','?') for _,p in errors]}" if errors else "clean")
        else:
            skip("Resume Generation 全部", "无 Job 数据")

        # ── 3. 面经模块 ──
        print("\n═══ 3. 面经模块 (collect → extract → generate-answer) ═══")

        # 3a. Collect — 粘贴面经
        MOCK_INTERVIEW = """
字节一面（技术面 45min）
1. 自我介绍
2. 讲一个你最有挑战的项目？遇到了什么困难？怎么解决的？
3. Python 的 GIL 是什么？对多线程有什么影响？
4. HTTP 和 HTTPS 的区别？TLS握手过程？
5. 用过 Docker 吗？Dockerfile 怎么写的？
6. 手撕代码：反转链表
7. 你有什么问题想问我的？

字节二面（技术面 60min）
1. 你在电信实习做了什么？AI视频生成平台的架构是怎样的？
2. 如何优化大模型推理的性能？
3. 数据库索引原理？B+树？什么时候不走索引？
4. Redis 的持久化方式？RDB vs AOF？
5. 微服务之间如何通信？gRPC vs REST?
6. 设计题：设计一个短链接系统
"""
        r = await c.post("/api/interview/collect", json={
            "company": "字节跳动",
            "role": "后端开发工程师",
            "raw_text": MOCK_INTERVIEW,
            "source_platform": "manual",
        })
        if check("collect 状态码 200/201", r.status_code in (200, 201), f"status={r.status_code}, body={r.text[:200]}"):
            exp = r.json()
            exp_id = exp.get("id")
            check("collect 返回 experience id", exp_id is not None, f"id={exp_id}")
            check("collect company", exp.get("company") == "字节跳动", exp.get("company"))

            # 3b. Extract — LLM 提炼问题
            if exp_id:
                log("INFO", "调用 LLM 提炼面经问题...")
                t0 = time.time()
                try:
                    r = await c.post("/api/interview/extract", json={
                        "experience_id": exp_id,
                    })
                except httpx.ReadTimeout:
                    check("extract 超时", False, "LLM 调用超时")
                    r = None
                elapsed = time.time() - t0
                log("INFO", f"extract 耗时 {elapsed:.1f}s")

                if r and check("extract 状态码 200", r.status_code == 200,
                         f"status={r.status_code}, body={r.text[:300]}"):
                    ext = r.json()
                    questions = ext.get("questions", [])
                    check("extract 提炼出问题", len(questions) >= 3,
                          f"questions_count={len(questions)}")

                    if questions:
                        q0 = questions[0]
                        check("question 有 question_text", bool(q0.get("question_text")),
                              q0.get("question_text", "")[:60])
                        check("question 有 category", q0.get("category") in
                              ("behavioral", "technical", "case", "motivation", "other", None),
                              f"category={q0.get('category')}")
                        check("question 有 difficulty", isinstance(q0.get("difficulty"), (int, float)),
                              f"difficulty={q0.get('difficulty')}")

                        # 3c. Generate Answer — 根据 Profile 生成回答
                        q_id = q0.get("id")
                        if q_id:
                            log("INFO", f"为问题 id={q_id} 生成回答思路...")
                            t0 = time.time()
                            try:
                                r = await c.post("/api/interview/generate-answer", json={
                                    "question_id": q_id,
                                })
                            except httpx.ReadTimeout:
                                check("generate-answer 超时", False, "LLM 调用超时")
                                r = None
                            elapsed = time.time() - t0
                            log("INFO", f"generate-answer 耗时 {elapsed:.1f}s")

                            if r and check("generate-answer 状态码 200", r.status_code == 200,
                                     f"status={r.status_code}, body={r.text[:300]}"):
                                ans = r.json()
                                check("返回 suggested_answer", bool(ans.get("suggested_answer")),
                                      ans.get("suggested_answer", "")[:80])
                                check("answer 长度 >= 50字", len(ans.get("suggested_answer", "")) >= 50,
                                      f"len={len(ans.get('suggested_answer', ''))}")
                        else:
                            skip("generate-answer", "未获取到 question_id")
                else:
                    skip("extract 后续", "extract 失败")
                    skip("generate-answer", "extract 失败")
        else:
            skip("extract", "collect 失败")
            skip("generate-answer", "collect 失败")

        # ── 4. 面经 CRUD 验证 ──
        print("\n═══ 4. 面经 CRUD 验证 ═══")
        r = await c.get("/api/interview/questions")
        if check("GET questions 200", r.status_code == 200, f"status={r.status_code}"):
            qs = r.json()
            check("questions 列表非空", len(qs) >= 1, f"count={len(qs)}")

        r = await c.get("/api/interview/experiences")
        if check("GET experiences 200", r.status_code == 200, f"status={r.status_code}"):
            exps = r.json()
            check("experiences 列表非空", len(exps) >= 1, f"count={len(exps)}")

        # 按公司筛选
        r = await c.get("/api/interview/questions", params={"company": "字节跳动"})
        check("questions 按公司筛选", r.status_code == 200 and len(r.json()) >= 1,
              f"status={r.status_code}, count={len(r.json()) if r.status_code==200 else 0}")

    # ── 汇总 ──
    print("\n" + "═" * 50)
    total = PASS + FAIL + SKIP
    print(f"  总计: {total}  ✅ PASS: {PASS}  ❌ FAIL: {FAIL}  ⏭️ SKIP: {SKIP}")
    if FAIL > 0:
        print("\n  失败项:")
        for label, status, detail in results:
            if status == "FAIL":
                print(f"    ❌ {label}: {detail}")
    print("═" * 50)

    return FAIL == 0


if __name__ == "__main__":
    ok = asyncio.run(main())
    sys.exit(0 if ok else 1)
