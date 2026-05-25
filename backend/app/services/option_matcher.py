from __future__ import annotations

import re
from typing import Optional


CONFIG_MAPPING: dict[str, dict[str, str]] = {
    "education_level": {
        "博士研究生": "博士",
        "硕士研究生": "硕士",
        "硕士": "硕士",
        "博士": "博士",
        "本科": "本科",
        "本科在读": "本科",
        "大专": "大专",
        "大专在读": "大专",
        "中专": "中专",
        "高中": "高中",
        "硕士研究生及以上": "博士",
        "本科及以上": "本科",
        "大专及以上": "大专",
    },
    "education_type": {
        "全日制": "全国普通高等院校全日制",
        "非全日制": "全国普通高等院校非全日制",
        "统招全日制": "统招全日制",
        "统招非全日制": "统招非全日制",
        "自考": "自考",
        "专升本": "统招专升本",
        "海外": "海外及港澳台",
        "海外留学生": "海外及港澳台",
    },
    "gender": {
        "男": "男",
        "女": "女",
        "male": "男",
        "female": "女",
        "Male": "男",
        "Female": "女",
        "M": "男",
        "F": "女",
    },
    "political_status": {
        "中共党员": "党员",
        "中共预备党员": "预备党员",
        "共青团员": "团员",
        "群众": "群众",
        "民主党派": "民主党派",
        "无党派人士": "无党派人士",
    },
    "marital_status": {
        "未婚": "未婚",
        "已婚": "已婚",
        "离异": "离异",
        "丧偶": "丧偶",
    },
    "id_type": {
        "身份证": "中国 - 居民身份证",
        "居民身份证": "中国 - 居民身份证",
        "护照": "护照",
        "港澳居民来往内地通行证": "中国 - 港澳居民来往内地通行证",
        "台湾居民来往内地通行证": "中国 - 台湾居民来往大陆通行证",
        "港澳居民居住证": "中国 - 港澳居民居住证",
        "台湾居民居住证": "中国 - 台湾居民居住证",
    },
    "language_exam_type": {
        "CET-4": "大学英语四级考试",
        "CET-6": "大学英语六级考试",
        "CET4": "大学英语四级考试",
        "CET6": "大学英语六级考试",
        "CET-4（四级）": "大学英语四级考试",
        "CET-6（六级）": "大学英语六级考试",
        "CET4（四级）": "大学英语四级考试",
        "CET6（六级）": "大学英语六级考试",
        "英语四级": "大学英语四级考试",
        "英语六级": "大学英语六级考试",
        "大学英语四级": "大学英语四级考试",
        "大学英语六级": "大学英语六级考试",
        "全国大学英语四级考试合格证书": "大学英语四级考试",
        "全国大学英语六级考试合格证书": "大学英语六级考试",
        "IELTS": "雅思（IELTS）",
        "雅思": "雅思（IELTS）",
        "TOEFL": "托福（TOEFL）",
        "托福": "托福（TOEFL）",
        "TOEIC": "托业（TOEIC）",
        "托业": "托业（TOEIC）",
        "TEM-4": "大学生英语专业四级考试",
        "TEM-8": "大学生英语专业八级考试",
        "专四": "大学生英语专业四级考试",
        "专八": "大学生英语专业八级考试",
    },
    "proficiency": {
        "精通": "精通",
        "熟练": "熟练",
        "一般": "一般",
        "入门": "入门",
        "了解": "入门",
        "掌握": "熟练",
        "熟悉": "熟练",
        "母语": "母语/精通",
    },
    "author_order": {
        "第一作者": "一作",
        "第二作者": "二作",
        "第三作者": "三作",
        "通讯作者": "通讯作者",
    },
    "arrival_time": {
        "随时到岗": "随时",
        "一周内": "一周内",
        "一个月内": "一个月内",
        "三个月内": "三个月内",
        "三个月以上": "三个月以上",
    },
}

CATEGORY_KEYWORD_MAP: list[tuple[list[str], str]] = [
    (["学历", "学位", "education", "degree"], "education_level"),
    (["学习形式", "培养方式", "学历类型", "education_type", "全日制"], "education_type"),
    (["性别", "gender", "sex"], "gender"),
    (["政治", "political", "党员"], "political_status"),
    (["婚姻", "marital"], "marital_status"),
    (["证件", "id_type", "证件类型", "个人证件"], "id_type"),
    (["英语", "考试类型", "language", "CET", "IELTS", "TOEFL", "证书名称", "英语证书"], "language_exam_type"),
    (["掌握程度", "熟练", "proficiency", "语言水平", "精通程度"], "proficiency"),
    (["作者", "author"], "author_order"),
    (["到岗", "arrival", "入职时间"], "arrival_time"),
]


def _infer_category(level1_title: str, level2_title: str) -> Optional[str]:
    text = f"{level1_title} {level2_title}".lower()
    for keywords, category in CATEGORY_KEYWORD_MAP:
        for kw in keywords:
            if kw.lower() in text:
                return category
    return None


def _match_config_mapping(
    resume_value: str,
    candidates: list[str],
    category: Optional[str],
) -> Optional[tuple[str, float]]:
    if category and category in CONFIG_MAPPING:
        mapping = CONFIG_MAPPING[category]
        mapped = mapping.get(resume_value)
        if mapped:
            for c in candidates:
                if _normalize(c) == _normalize(mapped):
                    return c, 1.0
            for c in candidates:
                if _normalize(mapped) in _normalize(c) or _normalize(c).endswith(_normalize(mapped)):
                    return c, 1.0

    for cat_mapping in CONFIG_MAPPING.values():
        mapped = cat_mapping.get(resume_value)
        if mapped:
            for c in candidates:
                if _normalize(c) == _normalize(mapped):
                    return c, 1.0
            for c in candidates:
                if _normalize(mapped) in _normalize(c) or _normalize(c).endswith(_normalize(mapped)):
                    return c, 1.0

    return None


def _match_similarity(
    resume_value: str,
    candidates: list[str],
) -> Optional[tuple[str, float]]:
    normalized_rv = _normalize(resume_value)
    if not normalized_rv:
        return None

    numeric_range_match = _try_numeric_range_match(resume_value, candidates)
    if numeric_range_match:
        return numeric_range_match

    best: Optional[tuple[str, float]] = None
    best_score = 0.0
    for c in candidates:
        nc = _normalize(c)
        if not nc:
            continue
        if nc == normalized_rv:
            return c, 1.0
        if nc.startswith(normalized_rv) or normalized_rv.startswith(nc):
            score = 0.9
            if score > best_score:
                best_score = score
                best = (c, score)
        if normalized_rv in nc or nc in normalized_rv:
            score = 0.8
            if score > best_score:
                best_score = score
                best = (c, score)

    return best


_NUMERIC_RANGE_RE = re.compile(r"(\d+(?:\.\d+)?)\s*[%％]?\s*[~\-—–至到]\s*(\d+(?:\.\d+)?)\s*[%％]?")
_NUMERIC_VALUE_RE = re.compile(r"(\d+(?:\.\d+)?)\s*[%％]?")


def _try_numeric_range_match(
    resume_value: str,
    candidates: list[str],
) -> Optional[tuple[str, float]]:
    nums = _NUMERIC_VALUE_RE.findall(resume_value)
    if not nums:
        return None
    target_num = float(nums[0])

    for c in candidates:
        range_match = _NUMERIC_RANGE_RE.search(c)
        if range_match:
            low = float(range_match.group(1))
            high = float(range_match.group(2))
            if low <= target_num <= high:
                return c, 1.0

    closest: Optional[tuple[str, float]] = None
    closest_dist = float("inf")
    for c in candidates:
        nums_c = _NUMERIC_VALUE_RE.findall(c)
        if not nums_c:
            continue
        for n_str in nums_c:
            try:
                n = float(n_str)
                dist = abs(n - target_num)
                if dist < closest_dist:
                    closest_dist = dist
                    closest = (c, 1.0)
            except ValueError:
                continue

    if closest and closest_dist <= target_num * 0.3 + 5:
        return closest

    return None


_FULLWIDTH_DIGITS = str.maketrans("０１２３４５６７８９", "0123456789")
_FULLWIDTH_ALPHA_UPPER = str.maketrans("ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ", "ABCDEFGHIJKLMNOPQRSTUVWXYZ")
_FULLWIDTH_ALPHA_LOWER = str.maketrans("ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ", "abcdefghijklmnopqrstuvwxyz")
_FULLWIDTH_PUNCT = str.maketrans("（）－—％～", "()--%~")


def _normalize(text: str) -> str:
    t = text.strip().lower()
    t = t.translate(_FULLWIDTH_DIGITS)
    t = t.translate(_FULLWIDTH_ALPHA_UPPER)
    t = t.translate(_FULLWIDTH_ALPHA_LOWER)
    t = t.translate(_FULLWIDTH_PUNCT)
    return re.sub(r"\s+", "", t)


_REGION_SUFFIXES = ("市", "省", "自治区", "特别行政区", "地区", "盟", "州")

_REGION_KEYWORDS = ("籍贯", "生源地", "家乡", "所在地点", "期望工作地点", "工作地点", "地点", "城市", "家庭所在", "学校所在", "地址", "位置", "region")


def _match_region(
    resume_value: str,
    candidates: list[str],
    level1_title: str,
    level2_title: str,
) -> Optional[tuple[str, float]]:
    is_region_field = any(kw in f"{level1_title}{level2_title}" for kw in _REGION_KEYWORDS)
    if not is_region_field:
        return None

    normalized_rv = _normalize(resume_value)

    for c in candidates:
        nc = _normalize(c)
        if nc == normalized_rv:
            return c, 1.0
        if nc.startswith(normalized_rv) and any(nc.endswith(s) for s in _REGION_SUFFIXES):
            return c, 1.0
        if normalized_rv.startswith(nc):
            for s in _REGION_SUFFIXES:
                if normalized_rv == nc + s:
                    return c, 1.0

    return None


def option_match(
    candidates: list[str],
    resume_value: str,
    level1_title: str,
    level2_title: str,
) -> dict:
    if not candidates or not resume_value:
        return {"value": "", "matchType": "NONE", "confidence": 0.0}

    category = _infer_category(level1_title, level2_title)

    config_result = _match_config_mapping(resume_value, candidates, category)
    if config_result:
        return {"value": config_result[0], "matchType": "CONFIG_MAPPING", "confidence": config_result[1]}

    region_result = _match_region(resume_value, candidates, level1_title, level2_title)
    if region_result:
        return {"value": region_result[0], "matchType": "REGION", "confidence": region_result[1]}

    similarity_result = _match_similarity(resume_value, candidates)
    if similarity_result:
        return {"value": similarity_result[0], "matchType": "SIMILARITY", "confidence": similarity_result[1]}

    return {"value": "", "matchType": "NONE", "confidence": 0.0}
