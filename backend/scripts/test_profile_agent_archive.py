from __future__ import annotations

import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.routes.profile_agent import build_personal_archive_from_agent_patch  # noqa: E402


def test_agent_patch_builds_personal_archive_for_profile_page() -> None:
    archive = build_personal_archive_from_agent_patch(
        existing_base_info={},
        patch={
            "base_info": {
                "name": "林同学",
                "phone": "13800138000",
                "email": "lin@example.com",
                "current_city": "北京",
                "job_intention": "AI 产品运营",
                "summary": "文科背景，擅长访谈和内容策划。",
            },
            "target_roles": ["用户研究"],
            "sections": [
                {
                    "section_type": "education",
                    "title": "北京大学 新闻学",
                    "content_json": {
                        "normalized": {
                            "school": "北京大学",
                            "degree": "本科",
                            "major": "新闻学",
                            "start_date": "2022.09",
                            "end_date": "2026.06",
                            "description": "课程包含传播学研究方法。",
                        }
                    },
                },
                {
                    "section_type": "experience",
                    "title": "校园媒体 实习编辑",
                    "content_json": {
                        "category_label": "实习经历",
                        "normalized": {
                            "company": "校园媒体",
                            "position": "实习编辑",
                            "description": "访谈 20 位学生并完成选题策划。",
                        },
                    },
                },
                {
                    "section_type": "project",
                    "title": "AI 工具调研",
                    "content_json": {
                        "normalized": {
                            "name": "AI 工具调研",
                            "role": "负责人",
                            "description": "整理 30 份问卷并输出产品建议。",
                        }
                    },
                },
                {
                    "section_type": "skill",
                    "title": "技能",
                    "content_json": {
                        "normalized": {
                            "items": ["访谈", "问卷分析", "内容策划"],
                        }
                    },
                },
            ],
        },
    )

    resume = archive["resumeArchive"]
    app_shared = archive["applicationArchive"]["shared"]

    assert archive["schemaVersion"] == "personal.archive.v1"
    assert resume["basicInfo"]["name"] == "林同学"
    assert resume["basicInfo"]["currentCity"] == "北京"
    assert resume["basicInfo"]["jobIntention"] == "AI 产品运营"
    assert resume["personalSummary"] == "文科背景，擅长访谈和内容策划。"
    assert resume["education"][0]["schoolName"] == "北京大学"
    assert resume["internshipExperiences"][0]["companyName"] == "校园媒体"
    assert resume["projects"][0]["projectName"] == "AI 工具调研"
    assert [item["skillName"] for item in resume["skills"]] == ["访谈", "问卷分析", "内容策划"]
    assert app_shared == resume


if __name__ == "__main__":
    test_agent_patch_builds_personal_archive_for_profile_page()
    print("profile agent archive tests passed")
