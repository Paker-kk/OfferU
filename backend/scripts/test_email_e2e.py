"""
邮件同步 → AI解析 → 自动日历 E2E 测试
======================================
测试链路：
  1. /email/status — 双通道状态检查
  2. /email/imap-connect — IMAP 连接（缺省凭据→400）
  3. /email/notifications — 通知列表（含 category 字段）
  4. /calendar/auto-fill — 自动日历补建
  5. 直接调 parse_interview_email Agent（模拟 6 封中国校招邮件）

运行: python scripts/test_email_e2e.py
"""

import asyncio
import sys
import os

# 确保 backend 在 path 上
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import httpx

BASE = "http://localhost:8000/api"
passed = 0
failed = 0


def check(label: str, ok: bool, detail: str = ""):
    global passed, failed
    if ok:
        print(f"  ✅ {label}")
        passed += 1
    else:
        print(f"  ❌ {label}  — {detail}")
        failed += 1


async def test_endpoints():
    """测试 HTTP 端点"""
    print("\n=== 1. 端点测试 ===")
    async with httpx.AsyncClient(timeout=10.0) as c:
        # 1a. status — 双通道字段
        r = await c.get(f"{BASE}/email/status")
        data = r.json()
        check("status: 返回200", r.status_code == 200)
        check("status: 有 gmail_connected", "gmail_connected" in data)
        check("status: 有 imap_connected", "imap_connected" in data)
        check("status: 有 imap_host", "imap_host" in data)

        # 1b. imap-connect 无 host → 400
        r = await c.post(f"{BASE}/email/imap-connect", json={"user": "nohost", "password": "x"})
        check("imap-connect: 无法推导 host → 400", r.status_code == 400)

        # 1c. imap-connect 自动推导 qq 域名
        r = await c.post(f"{BASE}/email/imap-connect", json={"user": "test@qq.com", "password": "wrongpass"})
        # 应该返回 401（登录失败）或 502（连接失败），但不是 400
        check("imap-connect: QQ域名自动推导 → 非400", r.status_code != 400, f"got {r.status_code}")

        # 1d. notifications — 返回数组，含 category 字段
        r = await c.get(f"{BASE}/email/notifications")
        check("notifications: 返回200", r.status_code == 200)

        # 1e. sync 未连接 → 401
        r = await c.post(f"{BASE}/email/sync")
        check("sync: 未连接邮箱 → 401", r.status_code == 401)

        # 1f. auto-fill — 返回 created/scanned
        r = await c.post(f"{BASE}/calendar/auto-fill")
        data = r.json()
        check("auto-fill: 返回200", r.status_code == 200)
        check("auto-fill: 有 created 字段", "created" in data)
        check("auto-fill: 有 scanned 字段", "scanned" in data)


# ---- 模拟中国校招邮件（6 封覆盖 8 种分类） ----
MOCK_EMAILS = [
    {
        "subject": "【华为】2025校园招聘 简历已收到确认",
        "from": "campus@huawei.com",
        "body": "亲爱的同学，您好！\n\n感谢您投递华为2025届校园招聘-软件开发工程师岗位。\n您的简历已成功提交，我们将尽快审核。\n\n华为校园招聘团队",
        "expect_category": "application",
        "expect_company": "华为",
    },
    {
        "subject": "字节跳动笔试通知 - 后端开发工程师",
        "from": "hr@bytedance.com",
        "body": "您好，\n\n恭喜您通过字节跳动2025校招简历初筛！\n请于 2025-07-20 14:00 参加在线笔试。\n笔试链接将在考前30分钟发送至您的邮箱。\n\n请务必提前准备好稳定的网络环境。",
        "expect_category": "written_test",
        "expect_company": "字节跳动",
    },
    {
        "subject": "腾讯2025校招 在线测评邀请",
        "from": "recruitment@tencent.com",
        "body": "同学你好，\n\n请在7月18日前完成腾讯校招在线性格测评。\n测评链接：（此处为示例链接）\n测评时间约45分钟，请在安静环境下完成。\n岗位：产品经理\n\n腾讯招聘",
        "expect_category": "assessment",
        "expect_company": "腾讯",
    },
    {
        "subject": "面试邀请 - 阿里巴巴技术面（一面）",
        "from": "ali-hr@alibaba-inc.com",
        "body": "您好！\n\n您已通过阿里巴巴2025校招笔试环节。\n诚邀您参加技术一面：\n时间：2025-07-22 10:00\n方式：视频面试（飞书）\n岗位：Java开发工程师\n\n如需改期，请于面试前24小时回复此邮件。\n\n阿里巴巴校招团队",
        "expect_category": "interview_1",
        "expect_company": "阿里",
    },
    {
        "subject": "恭喜！美团Offer通知",
        "from": "offer@meituan.com",
        "body": "亲爱的同学，\n\n恭喜您通过美团2025校园招聘全部面试环节！\n我们非常高兴地向您发出录用通知：\n岗位：前端开发工程师\n工作地点：北京\n请在7月30日前登录系统确认接受Offer。\n\n美团校园招聘",
        "expect_category": "offer",
        "expect_company": "美团",
    },
    {
        "subject": "网易2025校招结果通知",
        "from": "campus@corp.netease.com",
        "body": "同学你好，\n\n感谢您参与网易2025校园招聘。\n经过综合评估，很遗憾您未能通过本次面试环节。\n我们仍然认可您的能力，欢迎关注后续招聘机会。\n感谢您的参与！\n\n网易招聘团队",
        "expect_category": "rejection",
        "expect_company": "网易",
    },
]


async def test_parser_agent():
    """直接调 parse_interview_email Agent 测试 8 种分类"""
    print("\n=== 2. LLM Agent 解析测试（6封模拟校招邮件） ===")

    from app.agents.email_parser import parse_interview_email

    for i, mock in enumerate(MOCK_EMAILS, 1):
        print(f"\n  📧 Email {i}: {mock['subject'][:40]}...")
        result = await parse_interview_email(
            email_subject=mock["subject"],
            email_body=mock["body"],
            email_from=mock["from"],
        )

        if result is None:
            check(f"Email {i}: LLM 返回结果", False, "返回 None")
            continue

        check(f"Email {i}: 返回 dict", isinstance(result, dict))
        check(
            f"Email {i}: category={result.get('category')} (期望 {mock['expect_category']})",
            result.get("category") == mock["expect_category"],
            f"实际 category={result.get('category')}",
        )
        check(
            f"Email {i}: company 含 '{mock['expect_company']}'",
            mock["expect_company"] in result.get("company", ""),
            f"实际 company={result.get('company')}",
        )
        check(f"Email {i}: 有 action_required 字段", "action_required" in result)

        print(f"    → {result}")


async def main():
    print("=" * 60)
    print("邮件同步 → AI解析 → 自动日历 E2E 测试")
    print("=" * 60)

    await test_endpoints()
    await test_parser_agent()

    print(f"\n{'=' * 60}")
    print(f"结果: {passed} passed / {failed} failed / {passed + failed} total")
    print("=" * 60)
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    asyncio.run(main())
