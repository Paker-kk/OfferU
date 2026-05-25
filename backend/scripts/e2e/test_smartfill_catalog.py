from __future__ import annotations

import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.routes.profile import _build_smartfill_catalog_from_profile  # noqa: E402


def test_smartfill_catalog_handles_serialized_profile_shape() -> None:
    profile_payload = {
        "id": 1,
        "name": "林若晨",
        "headline": "复旦大学 · 信息管理与信息系统 · AI产品经理候选人",
        "base_info_json": {
            "name": "林若晨",
            "phone": "13812345678",
            "email": "lin.ruochen@example.com",
            "summary": "复旦大学信息管理与信息系统本科，关注AI产品、数据分析与自动化工作流。",
            "personal_archive": {
                "schemaVersion": "personal.archive.v1",
                "updatedAt": "2026-05-04T12:15:44.477Z",
                "resumeArchive": {
                    "basicInfo": {
                        "name": "林若晨",
                        "phone": "13812345678",
                        "email": "lin.ruochen@example.com",
                        "currentCity": "广东省 / 深圳市 / 南山区",
                        "jobIntention": "AI产品经理",
                    },
                    "personalSummary": "复旦大学信息管理与信息系统本科，关注AI产品、数据分析与自动化工作流。",
                    "education": [
                        {
                            "id": "edu_fudan_1",
                            "schoolName": "复旦大学",
                            "educationLevel": "本科",
                            "degree": "管理学学士",
                            "major": "信息管理与信息系统",
                            "startDate": "2022-09",
                            "endDate": "2026-06",
                            "gpa": "3.72/4.00",
                            "relatedCourses": ["产品管理", "数据结构"],
                            "descriptions": ["连续两年获得校级二等奖学金"],
                        }
                    ],
                    "workExperiences": [],
                    "internshipExperiences": [],
                    "projects": [],
                    "skills": [],
                    "certificates": [],
                    "awards": [],
                    "personalExperiences": [],
                },
                "applicationArchive": {
                    "identityContact": {
                        "chineseName": "林若晨",
                        "phone": "13812345678",
                    }
                },
            },
        },
        "sections": [],
    }

    catalog = _build_smartfill_catalog_from_profile(profile_payload)

    assert catalog, "serialized profile shape should produce catalog entries"
    assert any(item["path"] == "basic.fullName" for item in catalog)
    assert any(item["path"] == "resumeArchive.education.0.schoolName" for item in catalog)
    assert any(item["path"] == "applicationArchive.identityContact.chineseName" for item in catalog)


def test_smartfill_catalog_treats_single_month_as_date_not_range() -> None:
    catalog = _build_smartfill_catalog_from_profile(
        {
            "resumeArchive": {
                "education": [
                    {
                        "schoolName": "复旦大学",
                        "startDate": "2022-09",
                        "endDate": "2026-06",
                    }
                ]
            }
        }
    )

    start = next(item for item in catalog if item["path"] == "resumeArchive.education.0.startDate")
    end = next(item for item in catalog if item["path"] == "resumeArchive.education.0.endDate")

    assert start["valueType"] == "date"
    assert end["valueType"] == "date"


def test_smartfill_catalog_filters_attachment_metadata_noise() -> None:
    catalog = _build_smartfill_catalog_from_profile(
        {
            "applicationArchive": {
                "attachments": {
                    "resumeZh": {
                        "id": "att_resume",
                        "fileName": "林若晨-中文简历.pdf",
                        "fileType": "application/pdf",
                        "fileSize": 680000,
                        "uploadedAt": "2026-05-03T15:29:02Z",
                        "fieldType": "resumeZh",
                    }
                }
            }
        }
    )

    paths = {item["path"] for item in catalog}

    assert "applicationArchive.attachments.resumeZh.fileName" in paths
    assert "applicationArchive.attachments.resumeZh.fileType" not in paths
    assert "applicationArchive.attachments.resumeZh.fileSize" not in paths
    assert "applicationArchive.attachments.resumeZh.uploadedAt" not in paths
    assert "applicationArchive.attachments.resumeZh.fieldType" not in paths


def test_smartfill_catalog_uses_human_labels_for_archive_keys() -> None:
    catalog = _build_smartfill_catalog_from_profile(
        {
            "resumeArchive": {
                "workExperiences": [{"positionName": "产品运营实习生"}],
                "projects": [{"projectRole": "产品负责人", "projectLink": "https://example.com/project"}],
                "skills": [{"skillName": "SQL / Python 数据分析"}],
                "certificates": [{"scoreOrLevel": "548", "acquiredAt": "2024-06", "issuer": "教育部教育考试院"}],
            },
            "applicationArchive": {
                "attachments": {"resumeZh": {"fileName": "林若晨-中文简历.pdf"}},
            },
        }
    )
    labels = {item["path"]: item["label"] for item in catalog}

    assert labels["resumeArchive.workExperiences.0.positionName"] == "职位名称"
    assert labels["resumeArchive.projects.0.projectRole"] == "项目角色"
    assert labels["resumeArchive.projects.0.projectLink"] == "项目链接"
    assert labels["resumeArchive.skills.0.skillName"] == "技能名称"
    assert labels["resumeArchive.certificates.0.scoreOrLevel"] == "证书成绩/等级"
    assert labels["resumeArchive.certificates.0.acquiredAt"] == "获得时间"
    assert labels["resumeArchive.certificates.0.issuer"] == "颁发机构"
    assert labels["applicationArchive.attachments.resumeZh.fileName"] == "附件名称"


if __name__ == "__main__":
    test_smartfill_catalog_handles_serialized_profile_shape()
    test_smartfill_catalog_treats_single_month_as_date_not_range()
    test_smartfill_catalog_filters_attachment_metadata_noise()
    test_smartfill_catalog_uses_human_labels_for_archive_keys()
    print("smartfill catalog tests passed")
