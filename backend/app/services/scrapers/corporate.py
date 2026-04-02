# =============================================
# 大厂官网 数据源适配器 — 字节/阿里/腾讯/美团/网易
# =============================================
# 统一抽象：所有大厂招聘官网共享 CorporateScraper 基类
# 各大厂子类只需实现 _build_search_url() 和 _parse_response()
# =============================================
# 支持的大厂：
#   - ByteDanceScraper (字节跳动 / jobs.bytedance.com)
#   - AlibabaScraper   (阿里巴巴 / talent.alibaba.com)
#   - TencentScraper   (腾讯 / careers.tencent.com)
# =============================================

import hashlib
from typing import Optional
from abc import abstractmethod

import httpx

from app.services.scrapers.base import (
    JobScraperBase,
    JobItem,
    register_scraper,
)


class CorporateScraper(JobScraperBase):
    """
    大厂官网适配器基类
    所有大厂子类继承此类，实现搜索URL构建和响应解析
    """

    HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Accept": "application/json",
    }

    def _make_hash(self, title: str, company: str, url: str) -> str:
        raw = f"{title}|{company}|{url}"
        return hashlib.md5(raw.encode()).hexdigest()

    @abstractmethod
    def _build_search_url(self, keyword: str, page: int) -> tuple[str, dict]:
        """构建搜索请求 URL + params/body"""
        raise NotImplementedError

    @abstractmethod
    def _parse_response(self, data: dict) -> list[JobItem]:
        """解析 API 响应为 JobItem 列表"""
        raise NotImplementedError

    async def search(
        self,
        keywords: list[str],
        location: str = "",
        max_results: int = 50,
    ) -> list[JobItem]:
        results: list[JobItem] = []
        seen: set[str] = set()

        async with httpx.AsyncClient(timeout=15.0) as client:
            for kw in keywords:
                url, params = self._build_search_url(kw, 1)
                try:
                    resp = await client.get(url, params=params, headers=self.HEADERS)
                    items = self._parse_response(resp.json())
                    for item in items:
                        if item.hash_key not in seen:
                            seen.add(item.hash_key)
                            results.append(item)
                        if len(results) >= max_results:
                            break
                except Exception:
                    continue
                if len(results) >= max_results:
                    break

        return results[:max_results]

    async def get_detail(self, job_id: str) -> Optional[JobItem]:
        return None


# =========================================
# 字节跳动
# =========================================
class ByteDanceScraper(CorporateScraper):
    source_name = "bytedance"

    def _build_search_url(self, keyword: str, page: int) -> tuple[str, dict]:
        return "https://jobs.bytedance.com/api/v1/search/job/posts", {
            "keyword": keyword,
            "limit": 20,
            "offset": (page - 1) * 20,
        }

    def _parse_response(self, data: dict) -> list[JobItem]:
        items = []
        for raw in data.get("data", {}).get("job_post_list", []):
            job_id = raw.get("id", "")
            url = f"https://jobs.bytedance.com/experienced/position/{job_id}"
            title = raw.get("title", "")
            items.append(JobItem(
                title=title,
                company="字节跳动",
                location=raw.get("city_info", {}).get("name", ""),
                url=url,
                source="bytedance",
                raw_description=raw.get("description", ""),
                hash_key=self._make_hash(title, "字节跳动", url),
                company_info={"category": raw.get("job_category", {}).get("name", "")},
            ))
        return items


# =========================================
# 阿里巴巴
# =========================================
class AlibabaScraper(CorporateScraper):
    source_name = "alibaba"

    def _build_search_url(self, keyword: str, page: int) -> tuple[str, dict]:
        return "https://talent.alibaba.com/off-campus/position-list", {
            "keyword": keyword,
            "pageIndex": page,
            "pageSize": 20,
        }

    def _parse_response(self, data: dict) -> list[JobItem]:
        items = []
        for raw in data.get("content", {}).get("datas", []):
            pos_id = raw.get("positionId", "")
            url = f"https://talent.alibaba.com/off-campus/position-detail?positionId={pos_id}"
            title = raw.get("name", "")
            items.append(JobItem(
                title=title,
                company="阿里巴巴",
                location=raw.get("workLocation", ""),
                url=url,
                source="alibaba",
                raw_description=raw.get("description", ""),
                hash_key=self._make_hash(title, "阿里巴巴", url),
                company_info={
                    "department": raw.get("departmentName", ""),
                    "category": raw.get("categoryName", ""),
                },
            ))
        return items


# =========================================
# 腾讯
# =========================================
class TencentScraper(CorporateScraper):
    source_name = "tencent"

    def _build_search_url(self, keyword: str, page: int) -> tuple[str, dict]:
        return "https://careers.tencent.com/tencentcareer/api/post/Query", {
            "keyword": keyword,
            "pageIndex": page,
            "pageSize": 20,
            "timestamp": "",
        }

    def _parse_response(self, data: dict) -> list[JobItem]:
        items = []
        for raw in data.get("Data", {}).get("Posts", []):
            post_id = raw.get("PostId", "")
            url = f"https://careers.tencent.com/jobdesc.html?postId={post_id}"
            title = raw.get("RecruitPostName", "")
            items.append(JobItem(
                title=title,
                company="腾讯",
                location=raw.get("LocationName", ""),
                url=url,
                source="tencent",
                raw_description=raw.get("Responsibility", "") + "\n" + raw.get("Requirement", ""),
                hash_key=self._make_hash(title, "腾讯", url),
                company_info={
                    "category": raw.get("CategoryName", ""),
                    "last_update": raw.get("LastUpdateTime", ""),
                },
            ))
        return items


# 注册所有大厂适配器
register_scraper(ByteDanceScraper())
register_scraper(AlibabaScraper())
register_scraper(TencentScraper())
