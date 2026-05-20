from __future__ import annotations

import re
from typing import Any, Optional

_MODULE_FIELD_MAP: dict[str, dict[str, str]] = {
    "基本信息": {
        "姓名": "basicInfo.name",
        "中文姓名": "identityContact.chineseName",
        "英文/拼音姓名": "identityContact.englishOrPinyinName",
        "手机号": "basicInfo.phone",
        "手机号码": "basicInfo.phone",
        "联系电话": "basicInfo.phone",
        "邮箱": "basicInfo.email",
        "电子邮箱": "basicInfo.email",
        "所在城市": "basicInfo.currentCity",
        "现居住城市": "basicInfo.currentCity",
        "目标岗位": "basicInfo.jobIntention",
        "期望职位": "jobPreference.expectedPosition",
        "个人网站": "basicInfo.website",
        "GitHub": "basicInfo.github",
        "个人简介": "personalSummary",
        "自我评价": "personalSummary",
    },
    "身份联系": {
        "性别": "identityContact.gender",
        "出生日期": "identityContact.birthDate",
        "国籍/地区": "identityContact.nationalityOrRegion",
        "国籍": "identityContact.nationalityOrRegion",
        "证件类型": "identityContact.idType",
        "身份证号": "identityContact.idNumber",
        "证件号码": "identityContact.idNumber",
        "民族": "identityContact.ethnicity",
        "籍贯": "identityContact.nativePlace",
        "户口所在地": "identityContact.householdRegistration",
        "户籍": "identityContact.householdRegistration",
        "政治面貌": "identityContact.politicalStatus",
        "婚姻状况": "identityContact.maritalStatus",
        "地址": "identityContact.currentAddress",
        "通信地址": "identityContact.currentAddress",
    },
    "求职偏好": {
        "期望职位": "jobPreference.expectedPosition",
        "期望职位类别": "jobPreference.expectedPositionCategory",
        "期望城市": "jobPreference.expectedCities",
        "期望薪资": "jobPreference.expectedSalary",
        "工作类型": "jobPreference.employmentType",
        "到岗时间": "jobPreference.availableStartDate",
        "求职状态": "jobPreference.currentJobSearchStatus",
        "是否接受调剂": "jobPreference.acceptAdjustment",
        "是否接受出差": "jobPreference.acceptBusinessTravel",
        "是否接受外派": "jobPreference.acceptAssignment",
        "是否接受倒班": "jobPreference.acceptShiftWork",
    },
    "校招专项": {
        "是否应届生": "campusFields.isFreshGraduate",
        "毕业时间": "campusFields.graduationDate",
        "生源地": "campusFields.studentOrigin",
        "学生状态": "campusFields.studentStatus",
        "学号": "campusFields.studentId",
        "GPA": "campusFields.gpa",
        "专业排名": "campusFields.majorRank",
        "论文题目": "campusFields.thesis",
        "专利": "campusFields.patent",
    },
    "关系合规": {
        "紧急联系人姓名": "relationshipCompliance.emergencyContactName",
        "紧急联系人关系": "relationshipCompliance.emergencyContactRelation",
        "紧急联系人电话": "relationshipCompliance.emergencyContactPhone",
        "是否有亲属在目标公司": "relationshipCompliance.hasRelativeInTargetCompany",
        "背调授权": "relationshipCompliance.backgroundCheckAuthorization",
        "是否有竞业限制": "relationshipCompliance.hasNonCompete",
        "健康声明": "relationshipCompliance.healthDeclaration",
    },
    "来源推荐": {
        "来源渠道": "sourceReferral.sourceChannel",
        "内推码": "sourceReferral.referralCode",
        "内推人姓名": "sourceReferral.referralName",
        "内推人工号": "sourceReferral.referralEmployeeId",
        "内推人联系方式": "sourceReferral.referralContact",
        "推荐信息": "sourceReferral.recommenderInfo",
        "备注": "sourceReferral.notes",
    },
    "教育经历": {
        "学校名称": "education.schoolName",
        "学校全称": "education.schoolName",
        "毕业院校": "education.schoolName",
        "专业": "education.major",
        "专业名称": "education.majorName",
        "学历": "education.educationLevel",
        "最高学历": "education.educationLevel",
        "学位": "education.degree",
        "学位名称": "education.degreeName",
        "入学时间": "education.startDate",
        "开始时间": "education.startDate",
        "毕业时间": "education.endDate",
        "结束时间": "education.endDate",
        "GPA": "education.gpa",
        "绩点": "education.gpaScore",
        "学习形式": "education.educationType",
        "培养方式": "education.educationType",
        "教育类型": "education.educationType",
        "院系": "education.departmentName",
        "导师": "education.supervisor",
        "专业排名": "education.classRank",
        "学号": "education.studentId",
        "相关课程": "education.relatedCourses",
    },
    "工作经历": {
        "公司名称": "workExperiences.companyName",
        "公司": "workExperiences.companyName",
        "工作单位": "workExperiences.companyName",
        "职位名称": "workExperiences.positionName",
        "职位": "workExperiences.positionName",
        "部门": "workExperiences.department",
        "开始时间": "workExperiences.startDate",
        "结束时间": "workExperiences.endDate",
        "工作描述": "workExperiences.descriptions",
        "行业": "workExperiences.industry",
        "工作城市": "workExperiences.workCity",
        "离职原因": "workExperiences.leavingReason",
    },
    "实习经历": {
        "公司名称": "internshipExperiences.companyName",
        "实习公司": "internshipExperiences.companyName",
        "职位名称": "internshipExperiences.positionName",
        "实习职位": "internshipExperiences.positionName",
        "开始时间": "internshipExperiences.startDate",
        "结束时间": "internshipExperiences.endDate",
        "实习描述": "internshipExperiences.descriptions",
    },
    "项目经历": {
        "项目名称": "projects.projectName",
        "项目角色": "projects.projectRole",
        "项目链接": "projects.projectLink",
        "开始时间": "projects.startDate",
        "结束时间": "projects.endDate",
        "项目描述": "projects.descriptions",
    },
    "技能": {
        "技能名称": "skills.skillName",
        "掌握程度": "skills.proficiency",
        "备注": "skills.remark",
    },
    "证书": {
        "证书名称": "certificates.certificateName",
        "证书成绩/等级": "certificates.scoreOrLevel",
        "获得时间": "certificates.acquiredAt",
        "颁发机构": "certificates.issuer",
    },
    "获奖经历": {
        "奖项名称": "awards.awardName",
        "颁奖单位": "awards.issuer",
        "获奖时间": "awards.awardedAt",
        "获奖描述": "awards.descriptions",
    },
    "个人经历": {
        "经历名称": "personalExperiences.experienceTitle",
        "开始时间": "personalExperiences.startDate",
        "结束时间": "personalExperiences.endDate",
        "描述": "personalExperiences.descriptions",
    },
}

_MODULE_ALIASES: dict[str, list[str]] = {
    "基本信息": ["基本信息", "个人资料", "基础信息", "个人信息", "基本资料"],
    "身份联系": ["身份联系", "身份信息", "联系方式", "身份与联系"],
    "求职偏好": ["求职偏好", "工作偏好", "求职意向", "期望工作"],
    "校招专项": ["校招专项", "校园招聘", "应届生信息"],
    "关系合规": ["关系合规", "亲属关系", "家庭关系"],
    "来源推荐": ["来源推荐", "内推信息", "推荐来源"],
    "教育经历": ["教育经历", "教育背景", "学习经历", "学历信息"],
    "工作经历": ["工作经历", "工作经验", "从业经历", "工作背景"],
    "实习经历": ["实习经历", "实习经验", "实习背景"],
    "项目经历": ["项目经历", "项目经验", "项目背景"],
    "技能": ["技能", "技能特长", "专业技能", "技能水平"],
    "证书": ["证书", "资格证书", "认证", "执业资格"],
    "获奖经历": ["获奖经历", "荣誉奖项", "获奖情况", "获奖"],
    "个人经历": ["个人经历", "校园经历", "社团经历", "社会实践"],
}

_FIELD_ALIASES: dict[str, list[str]] = {
    "姓名": ["真实姓名", "名字", "候选人姓名", "中文姓名"],
    "手机号": ["手机号码", "手机", "联系电话", "联系方式", "电话号码", "移动电话"],
    "邮箱": ["电子邮箱", "邮件", "电子邮件"],
    "所在城市": ["城市", "现居住城市", "工作城市", "所在地区"],
    "学校名称": ["学校全称", "毕业院校", "学校", "院校", "就读学校", "毕业学校"],
    "专业": ["专业名称", "所学专业", "就读专业"],
    "学历": ["最高学历", "学历层次", "教育程度", "文化程度"],
    "学位": ["学位名称", "授予学位"],
    "公司名称": ["公司", "工作单位", "企业名称", "雇主"],
    "职位名称": ["职位", "职务", "岗位"],
    "项目名称": ["项目"],
    "证书名称": ["证书", "资质名称"],
    "奖项名称": ["获奖名称", "荣誉名称"],
}

_FIELD_ALIAS_REVERSE: dict[str, str] = {}
for _canon, _aliases in _FIELD_ALIASES.items():
    _FIELD_ALIAS_REVERSE[_canon] = _canon
    for _alias in _aliases:
        _FIELD_ALIAS_REVERSE[_alias] = _canon


def _normalize_text(text: str) -> str:
    t = text.strip().lower()
    t = re.sub(r"\s+", "", t)
    return t


def _resolve_module(module_name: str) -> Optional[str]:
    nm = _normalize_text(module_name)
    for canonical, aliases in _MODULE_ALIASES.items():
        for alias in aliases:
            if _normalize_text(alias) == nm:
                return canonical
    return None


def _resolve_field(module_canonical: str, field_label: str) -> Optional[str]:
    fields = _MODULE_FIELD_MAP.get(module_canonical, {})
    nf = _normalize_text(field_label)
    for label, path in fields.items():
        if _normalize_text(label) == nf:
            return path
    canonical_field = _FIELD_ALIAS_REVERSE.get(field_label)
    if canonical_field:
        ncf = _normalize_text(canonical_field)
        for label, path in fields.items():
            if _normalize_text(label) == ncf:
                return path
    field_aliases = _FIELD_ALIASES.get(field_label, [])
    for alias in field_aliases:
        na = _normalize_text(alias)
        for label, path in fields.items():
            if _normalize_text(label) == na:
                return path
    for label, path in fields.items():
        nl = _normalize_text(label)
        if nl in nf or nf in nl:
            return path
    return None


def _extract_value_from_archive(archive: dict, dot_path: str, item_index: int = 0) -> Optional[str]:
    parts = dot_path.split(".")
    current: Any = archive

    section_key = parts[0]
    if section_key in ("basicInfo", "personalSummary"):
        ra = current.get("resumeArchive", {})
        if section_key == "personalSummary":
            return ra.get("personalSummary", "")
        current = ra.get("basicInfo", {})
        parts = parts[1:]
    elif section_key in ("identityContact", "jobPreference", "campusFields",
                         "relationshipCompliance", "sourceReferral"):
        aa = current.get("applicationArchive", {})
        current = aa.get(section_key, {})
        parts = parts[1:]
    elif section_key in ("education", "workExperiences", "internshipExperiences",
                         "projects", "skills", "certificates", "awards",
                         "personalExperiences"):
        ra = current.get("resumeArchive", {})
        arr = ra.get(section_key, [])
        if not isinstance(arr, list) or item_index < 1 or item_index > len(arr):
            return None
        current = arr[item_index - 1]
        parts = parts[1:]
    else:
        return None

    for part in parts:
        if isinstance(current, dict):
            current = current.get(part)
        else:
            return None
        if current is None:
            return None

    if isinstance(current, str):
        return current
    if isinstance(current, (int, float)):
        return str(current)
    if isinstance(current, list):
        return "; ".join(str(x) for x in current if x)
    return None


def field_map(
    fragments: list[dict],
    archive: dict,
) -> list[dict]:
    results = []
    for frag in fragments:
        module_name = frag.get("module_name", "")
        field_label = frag.get("field_label", "")
        item_index = frag.get("item_index", 0)

        module_canonical = _resolve_module(module_name)
        if not module_canonical:
            results.append({
                "module_name": module_name,
                "field_label": field_label,
                "item_index": item_index,
                "value": None,
                "match_type": "NONE",
                "archive_path": None,
            })
            continue

        archive_path = _resolve_field(module_canonical, field_label)
        if not archive_path:
            results.append({
                "module_name": module_name,
                "field_label": field_label,
                "item_index": item_index,
                "value": None,
                "match_type": "NONE",
                "archive_path": None,
            })
            continue

        value = _extract_value_from_archive(archive, archive_path, item_index)
        results.append({
            "module_name": module_name,
            "field_label": field_label,
            "item_index": item_index,
            "value": value,
            "match_type": "FIELD_MAP",
            "archive_path": archive_path,
        })

    return results
