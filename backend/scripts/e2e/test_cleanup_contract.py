from __future__ import annotations

from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8", errors="replace")


def assert_not_contains(text: str, forbidden: list[str], *, label: str) -> None:
    found = [item for item in forbidden if item in text]
    if found:
        raise AssertionError(f"{label} still contains: {found}")


def assert_contains(text: str, required: list[str], *, label: str) -> None:
    missing = [item for item in required if item not in text]
    if missing:
        raise AssertionError(f"{label} is missing: {missing}")


def main() -> None:
    sidebar = read("frontend/src/components/layout/Sidebar.tsx")
    assert_not_contains(
        sidebar,
        ['href: "/scraper"', 'href: "/email"', 'href: "/analytics"', 'href: "/agent"'],
        label="Sidebar navigation",
    )

    scraper_page = read("frontend/src/app/scraper/page.tsx")
    assert_contains(scraper_page, ['redirect("/jobs")'], label="Scraper route")

    harness_dock = read("frontend/src/components/ai/HarnessAgentDock.tsx")
    assert_contains(
        harness_dock,
        ["useDraggableDock", "launcherDragHandleProps", "consumeDragClick", "OfferU 全局助手"],
        label="Harness dock",
    )
    assert_not_contains(
        harness_dock,
        ["鎴戞槸", "鑱屼笟", "鍖归厤", "鍙戦€", "闇€瑕佺"],
        label="Harness dock visible copy",
    )

    profile_dock = read("frontend/src/components/ai/ProfileAgentDock.tsx")
    assert_contains(
        profile_dock,
        ["useDraggableDock", "launcherDragHandleProps", "consumeDragClick"],
        label="Profile dock",
    )

    application_workspace = read("backend/app/services/application_workspace.py")
    assert_contains(
        application_workspace,
        ["公司名称", "岗位名称", "投递状态", "待投递", "自定义字段"],
        label="Application workspace schema",
    )
    assert_not_contains(
        application_workspace,
        ["鍏徃", "宀椾綅", "鎶曢€", "鑷畾涔夊瓧娈"],
        label="Application workspace schema",
    )

    print("cleanup contract ok")


if __name__ == "__main__":
    main()
