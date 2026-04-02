# =============================================
# 实习僧 数据源适配器 — 面向实习/校招
# =============================================
# 爬取策略：通过实习僧公开搜索 API 获取实习岗位
# 特点：
#   - 专注于实习/校招岗位（适合在校生或应届生）
#   - API 较为友好，反爬力度相对较低
#   - 数据字段包含实习补贴、每周天数等特色信息
# =============================================

import hashlib
from typing import Optional

import httpx

from app.services.scrapers.base import (
    JobScraperBase,
    JobItem,
    register_scraper,
)


class ShixisengScraper(JobScraperBase):
    """
    实习僧适配器
    source_name: "shixiseng"

    搜索流程：
      1. 调用实习僧搜索 API（keyword + city）
      2. 解析返回的 JSON data.list
      3. _normalize() 转为统一 JobItem 格式
    """

    source_name = "shixiseng"

    # 实习僧内推/搜索 API
    SEARCH_URL = "https://www.shixiseng.com/api/intern/search"

    # 城市映射
    CITY_NAMES = {
        "北京": "北京",
        "上海": "上海",
        "深圳": "深圳",
        "广州": "广州",
        "杭州": "杭州",
        "成都": "成都",
        "南京": "南京",
    }

    HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://www.shixiseng.com/",
    }

    def _make_hash(self, title: str, company: str, url: str) -> str:
        raw = f"{title}|{company}|{url}"
        return hashlib.md5(raw.encode()).hexdigest()

    async def search(
        self,
        keywords: list[str],
        location: str = "北京",
        max_results: int = 50,
    ) -> list[JobItem]:
        """
        搜索实习僧岗位
        每个关键词发起一次请求，合并去重后截断
        """
        results: list[JobItem] = []
        seen_hashes: set[str] = set()

        async with httpx.AsyncClient(timeout=15.0) as client:
            for kw in keywords:
                params = {
                    "k": kw,
                    "city": self.CITY_NAMES.get(location, location),
                    "page": 1,
                    "type": "intern",  # intern=实习, school=校招
                }
                try:
                    resp = await client.get(
                        self.SEARCH_URL,
                        params=params,
                        headers=self.HEADERS,
                    )
                    data = resp.json()

                    # 实习僧返回结构：
                    # { code: 0, msg: "success", data: { list: [...], total: N } }
                    job_list = data.get("data", {}).get("list", [])

                    for raw in job_list:
                        item = self._normalize(raw)
                        # 去重
                        if item.hash_key not in seen_hashes:
                            seen_hashes.add(item.hash_key)
                            results.append(item)
                        if len(results) >= max_results:
                            break
                except Exception:
                    continue

                if len(results) >= max_results:
                    break

        return results[:max_results]

    def _normalize(self, raw: dict) -> JobItem:
        """将实习僧原始 JSON 转为统一 JobItem"""
        intern_id = raw.get("id", "")
        url = f"https://www.shixiseng.com/intern/{intern_id}" if intern_id else ""

        title = raw.get("name", "")
        company = raw.get("company_name", "")
        city = raw.get("city", "")
        salary = raw.get("stipend", "")  # 实习补贴

        return JobItem(
            title=title,
            company=company,
            location=city,
            url=url,
            source="shixiseng",
            salary=salary,
            seniority_level="实习",  # 实习僧默认都是实习岗
            employment_type="实习",
            raw_description=raw.get("desc", ""),
            posted_at=raw.get("created_at", ""),
            hash_key=self._make_hash(title, company, url),
            company_info={
                "industry": raw.get("industry", ""),
                "days_per_week": raw.get("day", ""),  # 每周实习天数
                "duration": raw.get("month", ""),  # 实习时长(月)
            },
        )

    async def get_detail(self, job_id: str) -> Optional[JobItem]:
        """
        获取单个实习岗详情
        TODO: 请求详情页解析完整 JD
        """
        return None


# 注册到全局适配器注册表
register_scraper(ShixisengScraper())
