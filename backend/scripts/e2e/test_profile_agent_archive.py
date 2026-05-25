from __future__ import annotations

import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.routes.profile_agent import _descriptions, build_personal_archive_from_agent_patch  # noqa: E402
from app.services.resume_parser import _normalize_extracted_text  # noqa: E402


def test_resume_descriptions_merge_pdf_visual_wraps() -> None:
    text = "\u8d1f\u8d23\u516c\u53f8\u5e74\u4f1a\u9886\u5bfcAI\u89c6\u9891\u5ba3\u4f20\u7247\u9879\u76ee\n\u6280\u672f\u8d1f\u8d23\u4eba\n\u5f15\u8d77\u7701\u516c\u53f8\u5173\u6ce8"
    assert _descriptions(text) == [
        "\u8d1f\u8d23\u516c\u53f8\u5e74\u4f1a\u9886\u5bfcAI\u89c6\u9891\u5ba3\u4f20\u7247\u9879\u76ee \u6280\u672f\u8d1f\u8d23\u4eba \u5f15\u8d77\u7701\u516c\u53f8\u5173\u6ce8"
    ]


def test_resume_descriptions_keep_real_bullets() -> None:
    text = "\u2022 \u8d1f\u8d23\u516c\u53f8\u5e74\u4f1a\u9886\u5bfcAI\u89c6\u9891\u5ba3\u4f20\u7247\u9879\u76ee\n\u6280\u672f\u8d1f\u8d23\u4eba\n\u2022 \u603b\u7ed3AI\u89c6\u9891\u6280\u672f\u89c4\u8303\u6d41\u7a0b"
    assert _descriptions(text) == [
        "\u8d1f\u8d23\u516c\u53f8\u5e74\u4f1a\u9886\u5bfcAI\u89c6\u9891\u5ba3\u4f20\u7247\u9879\u76ee \u6280\u672f\u8d1f\u8d23\u4eba",
        "\u603b\u7ed3AI\u89c6\u9891\u6280\u672f\u89c4\u8303\u6d41\u7a0b",
    ]


def test_pdf_text_normalizer_joins_soft_wraps() -> None:
    raw = "\u5de5\u4f5c\u7ecf\u5386\n\u4e2d\u56fd\u7535\u4fe1\u80a1\u4efd\u6709\u9650\u516c\u53f8\u4f5b\u5c71\u5206\u516c\u53f8\n\u8d1f\u8d23\u516c\u53f8\u5e74\u4f1a\u9886\u5bfcAI\u89c6\u9891\u5ba3\u4f20\u7247\u9879\u76ee\n\u6280\u672f\u8d1f\u8d23\u4eba\n\u2022 \u603b\u7ed3AI\u89c6\u9891\u6280\u672f\u89c4\u8303\u6d41\u7a0b"
    assert _normalize_extracted_text(raw) == (
        "\u5de5\u4f5c\u7ecf\u5386\n"
        "\u4e2d\u56fd\u7535\u4fe1\u80a1\u4efd\u6709\u9650\u516c\u53f8\u4f5b\u5c71\u5206\u516c\u53f8 \u8d1f\u8d23\u516c\u53f8\u5e74\u4f1a\u9886\u5bfcAI\u89c6\u9891\u5ba3\u4f20\u7247\u9879\u76ee \u6280\u672f\u8d1f\u8d23\u4eba\n"
        "\u2022 \u603b\u7ed3AI\u89c6\u9891\u6280\u672f\u89c4\u8303\u6d41\u7a0b"
    )


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
    test_resume_descriptions_merge_pdf_visual_wraps()
    test_resume_descriptions_keep_real_bullets()
    test_pdf_text_normalizer_joins_soft_wraps()
    test_agent_patch_builds_personal_archive_for_profile_page()
    print("profile agent archive tests passed")
